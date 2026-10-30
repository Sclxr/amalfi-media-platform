import "server-only";
import { Prisma } from "@prisma/client";
import type { CheckoutWriter, PaidCommit } from "@/lib/stripe-webhook";
import { prisma } from "@/server/db/prisma";

function isUnique(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

class AlreadyProcessed extends Error {}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export const prismaCheckoutWriter: CheckoutWriter = {
  async hasEvent(id) {
    const existing = await prisma.stripeEvent.findUnique({ where: { id }, select: { id: true } });
    return Boolean(existing);
  },

  async rememberIgnored(id, type) {
    try {
      await prisma.stripeEvent.create({ data: { id, type } });
    } catch (error) {
      if (!isUnique(error)) throw error;
    }
  },

  async commitPaid(event): Promise<PaidCommit> {
    if (!event.invoiceId) throw new Error("Checkout event is missing an invoice.");
    const invoiceId = event.invoiceId;
    try {
      await prisma.$transaction(async (tx) => {
        const existing = await tx.stripeEvent.findUnique({ where: { id: event.id }, select: { id: true } });
        if (existing) throw new AlreadyProcessed();
        const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
        if (!invoice) throw new Error("Invoice was not found.");
        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            status: "PAID",
            amountPaidCents: event.amountCents ?? invoice.totalCents,
            paidAt: new Date(),
            stripeCheckoutSessionId: event.checkoutSessionId ?? invoice.stripeCheckoutSessionId,
          },
        });
        await tx.payment.create({
          data: {
            invoiceId: invoice.id,
            status: "SUCCEEDED",
            amountCents: event.amountCents ?? invoice.totalCents,
            stripePaymentIntentId: event.paymentIntentId,
            receiptUrl: event.receiptUrl,
            method: "card",
          },
        });
        await tx.auditLog.create({
          data: {
            action: "invoice.paid",
            entityType: "Invoice",
            entityId: invoice.id,
            after: json({ eventId: event.id, amountCents: event.amountCents, receiptUrl: event.receiptUrl }),
          },
        });
        await tx.stripeEvent.create({ data: { id: event.id, type: event.type } });
      });
      return "paid";
    } catch (error) {
      if (error instanceof AlreadyProcessed) return "duplicate";
      if (isUnique(error)) {
        const saved = await prisma.stripeEvent.findUnique({ where: { id: event.id }, select: { id: true } });
        if (saved) return "duplicate";
      }
      throw error;
    }
  },
};
