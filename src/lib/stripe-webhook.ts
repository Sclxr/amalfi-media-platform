import type { CheckoutEvent } from "@/lib/stripe-billing";

export type PaidCommit = "paid" | "duplicate" | "rejected";
export type RefundCommit = "refunded" | "duplicate" | "rejected";
export type DisputeCommit = "locked" | "restored" | "duplicate" | "rejected";
export type FailureCommit = "failed" | "duplicate";

/**
 * The database adapter. Money changes and the Stripe event id commit together.
 * A throw leaves no event row, so Stripe can deliver the same event again.
 */
export type CheckoutWriter = {
  hasEvent(id: string): Promise<boolean>;
  rememberIgnored(id: string, type: string): Promise<void>;
  commitPaid(event: CheckoutEvent): Promise<PaidCommit>;
  applyRefund(event: CheckoutEvent): Promise<RefundCommit>;
  applyDispute(event: CheckoutEvent): Promise<DisputeCommit>;
  applyPaymentFailed(event: CheckoutEvent): Promise<FailureCommit>;
};

const PAY_TYPES = new Set(["checkout.session.completed", "checkout.session.async_payment_succeeded"]);
const FAIL_TYPES = new Set(["checkout.session.async_payment_failed", "payment_intent.payment_failed"]);

export type InvoicePaymentCheck = {
  status: string;
  totalCents: number;
  currency: string;
  stripeCheckoutSessionId: string | null;
};

/** A checkout event can mark an invoice paid only when the money, currency, and session all match. */
export function acceptCheckoutPayment(input: {
  type: string;
  paymentStatus: string | null;
  amountCents: number | null;
  currency: string | null;
  checkoutSessionId: string | null;
  invoice: InvoicePaymentCheck;
}): "pay" | "ignore" | "reject" {
  if (!PAY_TYPES.has(input.type)) return "ignore";
  if (input.invoice.status === "PAID") return "ignore";
  if (input.invoice.status !== "OPEN") return "reject";
  if (input.paymentStatus !== "paid") return "reject";
  if (input.amountCents !== input.invoice.totalCents) return "reject";
  if ((input.currency ?? "").toLowerCase() !== input.invoice.currency.toLowerCase()) return "reject";
  if (!input.invoice.stripeCheckoutSessionId || input.checkoutSessionId !== input.invoice.stripeCheckoutSessionId) return "reject";
  return "pay";
}

export function refundKind(amountCents: number | null, amountRefundedCents: number | null): "full" | "partial" | "none" {
  if (!amountRefundedCents || amountRefundedCents <= 0) return "none";
  if (amountCents !== null && amountRefundedCents >= amountCents) return "full";
  return "partial";
}

export async function applyCheckoutEvent(event: CheckoutEvent, writer: CheckoutWriter) {
  if (await writer.hasEvent(event.id)) return { ok: true as const, duplicate: true as const };
  if (PAY_TYPES.has(event.type)) {
    const result = await writer.commitPaid(event);
    if (result === "duplicate") return { ok: true as const, duplicate: true as const };
    if (result === "rejected") return { ok: true as const, rejected: true as const };
    return { ok: true as const, paid: true as const };
  }
  if (event.type === "charge.refunded") {
    const result = await writer.applyRefund(event);
    if (result === "duplicate") return { ok: true as const, duplicate: true as const };
    if (result === "rejected") return { ok: true as const, rejected: true as const };
    return { ok: true as const, refunded: true as const };
  }
  if (event.type === "charge.dispute.created" || event.type === "charge.dispute.closed") {
    const result = await writer.applyDispute(event);
    if (result === "duplicate") return { ok: true as const, duplicate: true as const };
    if (result === "restored") return { ok: true as const, restored: true as const };
    if (result === "rejected") return { ok: true as const, rejected: true as const };
    return { ok: true as const, locked: true as const };
  }
  if (FAIL_TYPES.has(event.type)) {
    const result = await writer.applyPaymentFailed(event);
    if (result === "duplicate") return { ok: true as const, duplicate: true as const };
    return { ok: true as const, failed: true as const };
  }
  await writer.rememberIgnored(event.id, event.type);
  return { ok: true as const, ignored: true as const };
}
