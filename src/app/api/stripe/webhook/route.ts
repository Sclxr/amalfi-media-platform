import { readCheckoutEvent, verifyStripeSignature, type CheckoutEvent } from "@/lib/stripe-billing";
import { billingStatus } from "@/server/services/billing";
import { prisma } from "@/server/db/prisma";
import { writeAudit } from "@/server/audit";

export async function POST(request: Request) {
  const status = billingStatus();
  if (!status.configured) return Response.json({ error: "Stripe is not configured." }, { status: 503 });
  const payload = await request.text();
  const verified = verifyStripeSignature(payload, request.headers.get("stripe-signature"), status.webhookSecret);
  if (!verified.ok) return Response.json({ error: verified.reason }, { status: 400 });
  return Response.json(await applyCheckoutEvent(verified.event));
}

export async function applyCheckoutEvent(event: CheckoutEvent) {
  if (event.type !== "checkout.session.completed" || !event.invoiceId) {
    await rememberEvent(event.id, event.type);
    return { ok: true, ignored: true };
  }
  const created = await rememberEvent(event.id, event.type);
  if (!created) return { ok: true, duplicate: true };
  const invoice = await prisma.invoice.findUnique({ where: { id: event.invoiceId } });
  if (!invoice) return { ok: true, missing: true };
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      status: "PAID",
      amountPaidCents: event.amountCents ?? invoice.totalCents,
      paidAt: new Date(),
      stripeCheckoutSessionId: event.checkoutSessionId ?? invoice.stripeCheckoutSessionId,
    },
  });
  await prisma.payment.create({
    data: {
      invoiceId: invoice.id,
      status: "SUCCEEDED",
      amountCents: event.amountCents ?? invoice.totalCents,
      stripePaymentIntentId: event.paymentIntentId,
      receiptUrl: event.receiptUrl,
      method: "card",
    },
  });
  await writeAudit({
    action: "invoice.paid",
    entityType: "Invoice",
    entityId: invoice.id,
    after: { eventId: event.id, amountCents: event.amountCents, receiptUrl: event.receiptUrl },
  });
  return { ok: true, paid: true };
}

async function rememberEvent(id: string, type: string) {
  try {
    await prisma.stripeEvent.create({ data: { id, type } });
    return true;
  } catch {
    return false;
  }
}

export { readCheckoutEvent };
