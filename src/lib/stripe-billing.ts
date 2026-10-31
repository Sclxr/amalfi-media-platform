import { createHmac, timingSafeEqual } from "node:crypto";

export type StripeBilling =
  | { configured: false; reason: string }
  | { configured: true; secretKey: string; webhookSecret: string };

const LIVE_PREFIX = "sk_live_";

/** What to do with a Checkout Session already stored on the invoice. */
export function storedCheckoutAction(session: { status?: string | null; url?: string | null } | null):
  | { action: "reuse"; url: string }
  | { action: "replace" }
  | { action: "complete" }
  | { action: "unavailable" } {
  if (!session) return { action: "unavailable" };
  if (session.status === "open" && session.url) return { action: "reuse", url: session.url };
  if (session.status === "complete") return { action: "complete" };
  if (session.status === "expired") return { action: "replace" };
  return { action: "unavailable" };
}

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
  amountRefundedCents: number | null;
  currency: string | null;
  paymentStatus: string | null;
  paymentIntentId: string | null;
  chargeId: string | null;
  receiptUrl: string | null;
  checkoutSessionId: string | null;
  disputeStatus: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function metadataInvoiceId(object: Record<string, unknown>): string | null {
  const metadata = asRecord(object.metadata);
  if (metadata && typeof metadata.invoiceId === "string") return metadata.invoiceId;
  const paymentIntent = asRecord(object.payment_intent);
  const nested = paymentIntent ? asRecord(paymentIntent.metadata) : null;
  return nested && typeof nested.invoiceId === "string" ? nested.invoiceId : null;
}

function paymentIntentIdOf(object: Record<string, unknown>): string | null {
  if (typeof object.payment_intent === "string") return object.payment_intent;
  const paymentIntent = asRecord(object.payment_intent);
  return paymentIntent && typeof paymentIntent.id === "string" ? paymentIntent.id : null;
}

/** Receipts live on the charge, not on the checkout session. */
export function readReceiptUrl(object: Record<string, unknown>, type: string): string | null {
  const fromCharge = (charge: Record<string, unknown> | null) =>
    charge && typeof charge.receipt_url === "string" ? charge.receipt_url : null;
  if (type.startsWith("charge.")) return fromCharge(object);
  const paymentIntent = asRecord(object.payment_intent);
  const latest = paymentIntent ? asRecord(paymentIntent.latest_charge) : asRecord(object.latest_charge);
  const fromLatest = fromCharge(latest);
  if (fromLatest) return fromLatest;
  const charges = asRecord(object.charges);
  const data = charges && Array.isArray(charges.data) ? charges.data : [];
  const first = asRecord(data[0]);
  return fromCharge(first);
}

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
  const amount = typeof object.amount_total === "number" ? object.amount_total : typeof object.amount === "number" ? object.amount : null;
  const currency = typeof object.currency === "string" ? object.currency.toLowerCase() : null;
  const paymentStatus = typeof object.payment_status === "string" ? object.payment_status : null;
  const dispute = asRecord(object);
  const disputeStatus = parsed.type.startsWith("charge.dispute.") && typeof dispute?.status === "string" ? dispute.status : null;
  const checkoutSessionId = parsed.type.startsWith("checkout.session.") && typeof object.id === "string" ? object.id : null;
  const chargeId =
    parsed.type.startsWith("charge.") && !parsed.type.startsWith("charge.dispute.") && typeof object.id === "string"
      ? object.id
      : typeof object.charge === "string"
        ? object.charge
        : null;
  return {
    id: parsed.id,
    type: parsed.type,
    invoiceId: metadataInvoiceId(object),
    amountCents: amount,
    amountRefundedCents: typeof object.amount_refunded === "number" ? object.amount_refunded : null,
    currency,
    paymentStatus,
    paymentIntentId: paymentIntentIdOf(object),
    chargeId,
    receiptUrl: readReceiptUrl(object, parsed.type),
    checkoutSessionId,
    disputeStatus,
  };
}

function headerSignatures(header: string): { timestamp: number; signatures: string[] } | null {
  let timestamp = Number.NaN;
  const signatures: string[] = [];
  for (const piece of header.split(",")) {
    const eq = piece.indexOf("=");
    if (eq <= 0) continue;
    const key = piece.slice(0, eq).trim();
    const value = piece.slice(eq + 1).trim();
    if (key === "t") timestamp = Number(value);
    if (key === "v1" && value) signatures.push(value);
  }
  if (!Number.isFinite(timestamp) || signatures.length === 0) return null;
  return { timestamp, signatures };
}

function signatureMatches(payload: string, timestamp: number, signature: string, secret: string) {
  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
  now = Date.now(),
): { ok: true; event: CheckoutEvent } | { ok: false; reason: string } {
  if (!header) return { ok: false, reason: "Missing Stripe signature." };
  const parsed = headerSignatures(header);
  if (!parsed) return { ok: false, reason: "Stripe signature is malformed." };
  if (Math.abs(now / 1000 - parsed.timestamp) > 300) return { ok: false, reason: "Stripe signature is expired." };
  const secrets = secret.split(",").map((item) => item.trim()).filter(Boolean);
  const matched = secrets.some((item) => parsed.signatures.some((signature) => signatureMatches(payload, parsed.timestamp, signature, item)));
  if (!matched) return { ok: false, reason: "Stripe signature does not match." };
  const event = readCheckoutEvent(payload);
  if (!event) return { ok: false, reason: "Stripe event could not be read." };
  return { ok: true, event };
}
