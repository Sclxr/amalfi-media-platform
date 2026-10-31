import "server-only";
import { Prisma } from "@prisma/client";
import { acceptCheckoutPayment, refundKind, type CheckoutWriter, type DisputeCommit, type FailureCommit, type PaidCommit, type RefundCommit } from "@/lib/stripe-webhook";
import type { CheckoutEvent } from "@/lib/stripe-billing";
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
    return settle(event, async (tx, invoice) => {
      const acceptance = acceptCheckoutPayment({
        type: event.type,
        paymentStatus: event.paymentStatus ?? null,
        amountCents: event.amountCents,
        currency: event.currency ?? null,
        checkoutSessionId: event.checkoutSessionId,
        invoice: {
          status: invoice.status,
          totalCents: invoice.totalCents,
          currency: invoice.currency,
          stripeCheckoutSessionId: invoice.stripeCheckoutSessionId,
        },
      });
      if (acceptance !== "pay") {
        await tx.auditLog.create({
          data: {
            action: "invoice.payment_rejected",
            entityType: "Invoice",
            entityId: invoice.id,
            after: json({ eventId: event.id, reason: acceptance, status: invoice.status }),
          },
        });
        return "rejected";
      }
      await tx.invoice.update({
        where: { id: invoice.id },
        data: { status: "PAID", amountPaidCents: invoice.totalCents, paidAt: new Date() },
      });
      await tx.payment.create({
        data: {
          invoiceId: invoice.id,
          status: "SUCCEEDED",
          amountCents: invoice.totalCents,
          stripePaymentIntentId: event.paymentIntentId,
          stripeChargeId: event.chargeId,
          receiptUrl: event.receiptUrl,
          method: "card",
        },
      });
      await tx.auditLog.create({
        data: {
          action: "invoice.paid",
          entityType: "Invoice",
          entityId: invoice.id,
          after: json({ eventId: event.id, amountCents: invoice.totalCents, receiptUrl: event.receiptUrl }),
        },
      });
      return "paid";
    });
  },

  async applyRefund(event): Promise<RefundCommit> {
    return settle(event, async (tx, invoice) => {
      const kind = refundKind(event.amountCents, event.amountRefundedCents);
      if (kind === "none") return "rejected";
      const status = kind === "full" ? "REFUNDED" : "PARTIALLY_REFUNDED";
      await tx.invoice.update({
        where: { id: invoice.id },
        data: { status, amountRefundedCents: event.amountRefundedCents ?? 0 },
      });
      await tx.auditLog.create({
        data: {
          action: "invoice.refunded",
          entityType: "Invoice",
          entityId: invoice.id,
          after: json({ eventId: event.id, status, amountRefundedCents: event.amountRefundedCents }),
        },
      });
      return "refunded";
    }, "rejected");
  },

  async applyDispute(event): Promise<DisputeCommit> {
    return settle(event, async (tx, invoice) => {
      const won = event.type === "charge.dispute.closed" && event.disputeStatus === "won";
      if (won && invoice.amountRefundedCents === 0 && invoice.amountPaidCents >= invoice.totalCents) {
        await tx.invoice.update({ where: { id: invoice.id }, data: { status: "PAID" } });
        await tx.auditLog.create({
          data: { action: "invoice.dispute_won", entityType: "Invoice", entityId: invoice.id, after: json({ eventId: event.id }) },
        });
        return "restored";
      }
      await tx.invoice.update({ where: { id: invoice.id }, data: { status: "UNCOLLECTIBLE" } });
      await tx.auditLog.create({
        data: { action: "invoice.dispute", entityType: "Invoice", entityId: invoice.id, after: json({ eventId: event.id, status: event.disputeStatus }) },
      });
      return "locked";
    }, "rejected");
  },

  async applyPaymentFailed(event): Promise<FailureCommit> {
    return settle(event, async (tx, invoice) => {
      await tx.auditLog.create({
        data: { action: "invoice.payment_failed", entityType: "Invoice", entityId: invoice.id, after: json({ eventId: event.id, type: event.type }) },
      });
      return "failed" as const;
    }, "failed");
  },
};

async function findInvoiceId(event: CheckoutEvent) {
  if (event.invoiceId) return event.invoiceId;
  if (!event.paymentIntentId) return null;
  const payment = await prisma.payment.findUnique({
    where: { stripePaymentIntentId: event.paymentIntentId },
    select: { invoiceId: true },
  });
  return payment?.invoiceId ?? null;
}

async function settle<T extends string>(
  event: CheckoutEvent,
  apply: (tx: Prisma.TransactionClient, invoice: { id: string; status: string; totalCents: number; currency: string; stripeCheckoutSessionId: string | null; amountPaidCents: number; amountRefundedCents: number }) => Promise<T>,
  missing: T = "rejected" as T,
): Promise<T | "duplicate"> {
  const invoiceId = await findInvoiceId(event);
  if (!invoiceId) return missing;
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.stripeEvent.findUnique({ where: { id: event.id }, select: { id: true } });
      if (existing) throw new AlreadyProcessed();
      const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
      if (!invoice) return missing;
      const outcome = await apply(tx, invoice);
      await tx.stripeEvent.create({ data: { id: event.id, type: event.type } });
      return outcome;
    });
  } catch (error) {
    if (error instanceof AlreadyProcessed) return "duplicate";
    if (isUnique(error)) {
      const saved = await prisma.stripeEvent.findUnique({ where: { id: event.id }, select: { id: true } });
      if (saved) return "duplicate";
    }
    throw error;
  }
}
