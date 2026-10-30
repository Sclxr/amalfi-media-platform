import type { CheckoutEvent } from "@/lib/stripe-billing";

export type PaidCommit = "paid" | "duplicate";

/**
 * The database adapter. `commitPaid` must insert the Stripe event id in the
 * same transaction as the invoice and payment update. A throw leaves no event
 * row, so Stripe can deliver the same event again.
 */
export type CheckoutWriter = {
  hasEvent(id: string): Promise<boolean>;
  rememberIgnored(id: string, type: string): Promise<void>;
  commitPaid(event: CheckoutEvent): Promise<PaidCommit>;
};

export async function applyCheckoutEvent(event: CheckoutEvent, writer: CheckoutWriter) {
  if (event.type !== "checkout.session.completed" || !event.invoiceId) {
    await writer.rememberIgnored(event.id, event.type);
    return { ok: true as const, ignored: true as const };
  }
  if (await writer.hasEvent(event.id)) {
    return { ok: true as const, duplicate: true as const };
  }
  const result = await writer.commitPaid(event);
  if (result === "duplicate") return { ok: true as const, duplicate: true as const };
  return { ok: true as const, paid: true as const };
}
