import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { coveringInvoiceStatus, galleryDownloadDecision } from "@/lib/gallery-access";
import { nextInvoiceNumber } from "@/lib/invoice-number";
import { readCheckoutEvent, storedCheckoutAction, verifyStripeSignature, type CheckoutEvent } from "@/lib/stripe-billing";
import { acceptCheckoutPayment, applyCheckoutEvent, refundKind } from "@/lib/stripe-webhook";
import { prismaCheckoutWriter } from "@/server/billing/checkout-writer";

const openInvoice = {
  status: "OPEN",
  totalCents: 12000,
  currency: "usd",
  stripeCheckoutSessionId: "cs_match",
};

function paidEvent(patch: Partial<CheckoutEvent> = {}): CheckoutEvent {
  return {
    id: "evt_paid",
    type: "checkout.session.completed",
    invoiceId: "inv",
    amountCents: 12000,
    amountRefundedCents: null,
    currency: "usd",
    paymentStatus: "paid",
    paymentIntentId: "pi",
    chargeId: null,
    receiptUrl: null,
    checkoutSessionId: "cs_match",
    disputeStatus: null,
    ...patch,
  };
}

describe("checkout acceptance", () => {
  it("pays only a matching open session", () => {
    expect(acceptCheckoutPayment({ type: "checkout.session.completed", paymentStatus: "paid", amountCents: 12000, currency: "usd", checkoutSessionId: "cs_match", invoice: openInvoice })).toBe("pay");
    expect(acceptCheckoutPayment({ type: "checkout.session.async_payment_succeeded", paymentStatus: "paid", amountCents: 12000, currency: "USD", checkoutSessionId: "cs_match", invoice: openInvoice })).toBe("pay");
    expect(acceptCheckoutPayment({ type: "checkout.session.completed", paymentStatus: "unpaid", amountCents: 12000, currency: "usd", checkoutSessionId: "cs_match", invoice: openInvoice })).toBe("reject");
    expect(acceptCheckoutPayment({ type: "checkout.session.completed", paymentStatus: "paid", amountCents: 100, currency: "usd", checkoutSessionId: "cs_match", invoice: openInvoice })).toBe("reject");
    expect(acceptCheckoutPayment({ type: "checkout.session.completed", paymentStatus: "paid", amountCents: 12000, currency: "eur", checkoutSessionId: "cs_match", invoice: openInvoice })).toBe("reject");
    expect(acceptCheckoutPayment({ type: "checkout.session.completed", paymentStatus: "paid", amountCents: 12000, currency: "usd", checkoutSessionId: "cs_other", invoice: openInvoice })).toBe("reject");
    expect(acceptCheckoutPayment({ type: "checkout.session.completed", paymentStatus: "paid", amountCents: 12000, currency: "usd", checkoutSessionId: "cs_match", invoice: { ...openInvoice, status: "VOID" } })).toBe("reject");
    expect(acceptCheckoutPayment({ type: "checkout.session.completed", paymentStatus: "paid", amountCents: 12000, currency: "usd", checkoutSessionId: "cs_match", invoice: { ...openInvoice, status: "REFUNDED" } })).toBe("reject");
    expect(acceptCheckoutPayment({ type: "checkout.session.completed", paymentStatus: "paid", amountCents: 12000, currency: "usd", checkoutSessionId: "cs_match", invoice: { ...openInvoice, status: "PAID" } })).toBe("ignore");
  });

  it("classifies full and partial refunds", () => {
    expect(refundKind(12000, 12000)).toBe("full");
    expect(refundKind(12000, 4000)).toBe("partial");
    expect(refundKind(12000, 0)).toBe("none");
  });

  it("reads the receipt from the charge and accepts any matching v1 signature", () => {
    const payload = JSON.stringify({
      id: "evt_receipt",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_match",
          amount_total: 12000,
          currency: "usd",
          payment_status: "paid",
          receipt_url: "https://evil.example/not-a-charge",
          payment_intent: { id: "pi_real", latest_charge: { receipt_url: "https://pay.stripe.com/receipts/charge" } },
          metadata: { invoiceId: "inv" },
        },
      },
    });
    const event = readCheckoutEvent(payload);
    expect(event?.receiptUrl).toBe("https://pay.stripe.com/receipts/charge");
    expect(JSON.stringify(event)).not.toContain("not-a-charge");
    const secret = "whsec_new";
    const timestamp = Math.floor(Date.now() / 1000);
    const good = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
    const header = `t=${timestamp},v1=${good},v1=deadbeef`;
    expect(verifyStripeSignature(payload, header, `whsec_old,${secret}`).ok).toBe(true);
    expect(verifyStripeSignature(payload, `t=${timestamp},v1=deadbeef`, secret).ok).toBe(false);
  });

  it("allocates the next invoice number without reusing one", () => {
    expect(nextInvoiceNumber(2026, ["INV-2026-0002", "INV-2025-0099"])).toBe("INV-2026-0003");
    expect(nextInvoiceNumber(2026, ["INV-2026-0002"], 1)).toBe("INV-2026-0004");
  });

  it("reuses an open checkout and does not replace a completed one", () => {
    expect(storedCheckoutAction({ status: "open", url: "https://checkout.stripe.com/c/pay/cs_open" })).toEqual({
      action: "reuse",
      url: "https://checkout.stripe.com/c/pay/cs_open",
    });
    expect(storedCheckoutAction({ status: "complete", url: null }).action).toBe("complete");
    expect(storedCheckoutAction({ status: "expired", url: null }).action).toBe("replace");
    expect(storedCheckoutAction(null).action).toBe("unavailable");
    expect(storedCheckoutAction({ status: "open", url: null }).action).toBe("unavailable");
  });
});

describe("gallery unlock", () => {
  it("uses the newest live invoice and re-locks refunds", () => {
    const older = { status: "PAID", createdAt: 1, amountRefundedCents: 0 };
    const newer = { status: "OPEN", createdAt: 2, amountRefundedCents: 0 };
    expect(coveringInvoiceStatus([older, newer])).toBe("OPEN");
    expect(coveringInvoiceStatus([{ status: "PAID", createdAt: 2, amountRefundedCents: 500 }])).toBe("PARTIALLY_REFUNDED");
    expect(coveringInvoiceStatus([{ status: "VOID", createdAt: 3, amountRefundedCents: 0 }, older])).toBe("PAID");
    expect(galleryDownloadDecision({ requirePaid: true, allowUnpaidDownloads: false, invoiceStatus: "PARTIALLY_REFUNDED" }).allowed).toBe(false);
    expect(galleryDownloadDecision({ requirePaid: true, allowUnpaidDownloads: false, invoiceStatus: "REFUNDED" }).allowed).toBe(false);
    expect(galleryDownloadDecision({ requirePaid: true, allowUnpaidDownloads: false, invoiceStatus: "PAID" }).allowed).toBe(true);
    expect(galleryDownloadDecision({ requirePaid: true, allowUnpaidDownloads: false, invoiceStatus: "UNCOLLECTIBLE" }).allowed).toBe(false);
  });
});

describe("stripe writer guards", () => {
  it("rejects a void invoice, a short payment, then locks downloads after a refund", async () => {
    const prisma = new PrismaClient();
    const stamp = `stripe-${Date.now()}`;
    const client = await prisma.client.create({ data: { firstName: "Stripe", lastName: "Guard", email: `${stamp}@example.com` } });
    const voided = await prisma.invoice.create({
      data: { number: `${stamp}-void`, clientId: client.id, subtotalCents: 12000, totalCents: 12000, status: "VOID", currency: "usd", stripeCheckoutSessionId: `${stamp}-void-cs` },
    });
    const open = await prisma.invoice.create({
      data: { number: `${stamp}-open`, clientId: client.id, subtotalCents: 12000, totalCents: 12000, status: "OPEN", currency: "usd", stripeCheckoutSessionId: `${stamp}-cs` },
    });
    try {
      const voidEvent = paidEvent({ id: `${stamp}-void-evt`, invoiceId: voided.id, checkoutSessionId: `${stamp}-void-cs` });
      await expect(applyCheckoutEvent(voidEvent, prismaCheckoutWriter)).resolves.toMatchObject({ rejected: true });
      expect((await prisma.invoice.findUnique({ where: { id: voided.id } }))?.status).toBe("VOID");

      const short = paidEvent({ id: `${stamp}-short`, invoiceId: open.id, checkoutSessionId: `${stamp}-cs`, amountCents: 100 });
      await expect(prismaCheckoutWriter.commitPaid(short)).resolves.toBe("rejected");
      expect((await prisma.invoice.findUnique({ where: { id: open.id } }))?.status).toBe("OPEN");

      const paid = paidEvent({ id: `${stamp}-paid`, invoiceId: open.id, checkoutSessionId: `${stamp}-cs`, paymentIntentId: `${stamp}-pi` });
      await expect(prismaCheckoutWriter.commitPaid(paid)).resolves.toBe("paid");

      const refund = paidEvent({
        id: `${stamp}-refund`,
        type: "charge.refunded",
        invoiceId: open.id,
        amountCents: 12000,
        amountRefundedCents: 12000,
        paymentIntentId: `${stamp}-pi`,
      });
      await expect(applyCheckoutEvent(refund, prismaCheckoutWriter)).resolves.toMatchObject({ refunded: true });
      const after = await prisma.invoice.findUnique({ where: { id: open.id } });
      expect(after?.status).toBe("REFUNDED");
      expect(galleryDownloadDecision({ requirePaid: true, allowUnpaidDownloads: false, invoiceStatus: "REFUNDED" }).allowed).toBe(false);

      const partial = await prisma.invoice.update({ where: { id: open.id }, data: { status: "PAID", amountRefundedCents: 0 } });
      const partialEvent = paidEvent({
        id: `${stamp}-partial`,
        type: "charge.refunded",
        invoiceId: partial.id,
        amountCents: 12000,
        amountRefundedCents: 4000,
        paymentIntentId: `${stamp}-pi`,
      });
      await expect(prismaCheckoutWriter.applyRefund(partialEvent)).resolves.toBe("refunded");
      expect((await prisma.invoice.findUnique({ where: { id: open.id } }))?.status).toBe("PARTIALLY_REFUNDED");

      await prisma.invoice.update({ where: { id: open.id }, data: { status: "PAID" } });
      const dispute = paidEvent({ id: `${stamp}-dispute`, type: "charge.dispute.created", invoiceId: open.id, disputeStatus: "needs_response" });
      await expect(prismaCheckoutWriter.applyDispute(dispute)).resolves.toBe("locked");
      expect((await prisma.invoice.findUnique({ where: { id: open.id } }))?.status).toBe("UNCOLLECTIBLE");

      await prisma.invoice.update({ where: { id: open.id }, data: { status: "PAID", amountPaidCents: 12000, amountRefundedCents: 0 } });
      const won = paidEvent({ id: `${stamp}-won`, type: "charge.dispute.closed", invoiceId: open.id, disputeStatus: "won" });
      await expect(prismaCheckoutWriter.applyDispute(won)).resolves.toBe("restored");
      expect((await prisma.invoice.findUnique({ where: { id: open.id } }))?.status).toBe("PAID");

      const failed = paidEvent({ id: `${stamp}-fail`, type: "payment_intent.payment_failed", invoiceId: open.id });
      await expect(prismaCheckoutWriter.applyPaymentFailed(failed)).resolves.toBe("failed");
      expect((await prisma.invoice.findUnique({ where: { id: open.id } }))?.status).toBe("PAID");
    } finally {
      await prisma.payment.deleteMany({ where: { invoiceId: { in: [open.id, voided.id] } } });
      await prisma.auditLog.deleteMany({ where: { entityId: { in: [open.id, voided.id] } } });
      await prisma.stripeEvent.deleteMany({ where: { id: { contains: stamp } } });
      await prisma.invoice.deleteMany({ where: { id: { in: [open.id, voided.id] } } });
      await prisma.client.delete({ where: { id: client.id } });
      await prisma.$disconnect();
    }
  });
});
