import { createHmac, timingSafeEqual } from "node:crypto";

export type StripeBilling =
  | { configured: false; reason: string }
  | { configured: true; secretKey: string; webhookSecret: string };

const LIVE_PREFIX = "sk_live_";

export function stripeBilling(input: {
  appEnv: string;
  secretKey?: string;
  webhookSecret?: string;
}): StripeBilling {
  if (!input.secretKey) return { configured: false, reason: "Stripe is not configured." };
  if (input.appEnv !== "production" && input.secretKey.startsWith(LIVE_PREFIX)) {
    return { configured: false, reason: "Live Stripe keys are refused outside production." };
  }
  if (input.appEnv === "staging" && !input.secretKey.startsWith("sk_test_")) {
    return { configured: false, reason: "Staging Stripe keys must be test keys." };
  }
  if (!input.webhookSecret) return { configured: false, reason: "Stripe is not configured." };
  return { configured: true, secretKey: input.secretKey, webhookSecret: input.webhookSecret };
}

export type CheckoutEvent = {
  id: string;
  type: string;
  invoiceId: string | null;
  amountCents: number | null;
  paymentIntentId: string | null;
  receiptUrl: string | null;
  checkoutSessionId: string | null;
};

/** Reads payment fields only. Card numbers and payment method details are ignored. */
export function readCheckoutEvent(payload: string): CheckoutEvent | null {
  let parsed: {
    id?: string;
    type?: string;
    data?: { object?: Record<string, unknown> };
  };
  try {
    parsed = JSON.parse(payload) as typeof parsed;
  } catch {
    return null;
  }
  if (!parsed.id || !parsed.type) return null;
  const object = parsed.data?.object ?? {};
  const metadata = object.metadata && typeof object.metadata === "object" ? (object.metadata as Record<string, unknown>) : {};
  const invoiceId = typeof metadata.invoiceId === "string" ? metadata.invoiceId : null;
  const amount = typeof object.amount_total === "number" ? object.amount_total : null;
  const paymentIntentId = typeof object.payment_intent === "string" ? object.payment_intent : null;
  const receiptUrl = typeof object.receipt_url === "string" ? object.receipt_url : null;
  const checkoutSessionId = typeof object.id === "string" ? object.id : null;
  return {
    id: parsed.id,
    type: parsed.type,
    invoiceId,
    amountCents: amount,
    paymentIntentId,
    receiptUrl,
    checkoutSessionId,
  };
}

export function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
  now = Date.now(),
): { ok: true; event: CheckoutEvent } | { ok: false; reason: string } {
  if (!header) return { ok: false, reason: "Missing Stripe signature." };
  const parts = Object.fromEntries(
    header.split(",").map((piece) => {
      const [key, value] = piece.split("=");
      return [key, value];
    }),
  );
  const timestamp = Number(parts.t);
  const signature = parts.v1;
  if (!Number.isFinite(timestamp) || !signature) return { ok: false, reason: "Stripe signature is malformed." };
  if (Math.abs(now / 1000 - timestamp) > 300) return { ok: false, reason: "Stripe signature is expired." };
  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return { ok: false, reason: "Stripe signature does not match." };
  }
  const event = readCheckoutEvent(payload);
  if (!event) return { ok: false, reason: "Stripe event could not be read." };
  return { ok: true, event };
}
