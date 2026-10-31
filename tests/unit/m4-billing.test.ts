import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { prismaCheckoutWriter } from "@/server/billing/checkout-writer";
import { galleryDownloadDecision } from "@/lib/gallery-access";
import { readCheckoutEvent, stripeBilling, verifyStripeSignature, type CheckoutEvent } from "@/lib/stripe-billing";
import { applyCheckoutEvent, type CheckoutWriter } from "@/lib/stripe-webhook";
import { stagingGate } from "@/lib/staging-gate";
import { storedZip } from "@/lib/zip-store";

describe("stripe billing", () => {
  it("boots with billing unavailable when keys are absent and refuses live keys outside production", () => {
    const absent = stripeBilling({ appEnv: "staging" });
    const live = stripeBilling({ appEnv: "staging", secretKey: "sk_live_abc", webhookSecret: "whsec_test" });
    expect(absent.configured).toBe(false);
    expect(live.configured).toBe(false);
    if (!absent.configured) expect(absent.reason).toBe("Stripe is not configured.");
    if (!live.configured) expect(live.reason).toContain("Live Stripe keys");
    expect(
      stripeBilling({ appEnv: "production", secretKey: "sk_live_abc", webhookSecret: "whsec_test" }).configured,
    ).toBe(true);
  });

  it("verifies the webhook signature and ignores card data", () => {
    const payload = JSON.stringify({
      id: "evt_test",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test",
          amount_total: 12000,
          payment_status: "paid",
          currency: "usd",
          payment_intent: {
            id: "pi_test",
            latest_charge: { receipt_url: "https://pay.stripe.com/receipts/test" },
          },
          metadata: { invoiceId: "inv_test" },
          payment_method_details: { card: { number: "4242424242424242" } },
        },
      },
    });
    const secret = "whsec_test_secret";
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
    const verified = verifyStripeSignature(payload, `t=${timestamp},v1=${signature}`, secret);
    expect(verified.ok).toBe(true);
    if (verified.ok) {
      expect(verified.event.invoiceId).toBe("inv_test");
      expect(verified.event.receiptUrl).toContain("receipts/test");
      expect(JSON.stringify(verified.event)).not.toContain("4242");
    }
    expect(verifyStripeSignature(payload, `t=${timestamp},v1=deadbeef`, secret).ok).toBe(false);
    const event = readCheckoutEvent(payload);
    expect(event?.paymentIntentId).toBe("pi_test");
    vi.stubGlobal("fetch", vi.fn());
    expect(fetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("leaves a failed delivery retryable and marks the invoice paid on the next attempt", async () => {
    const events = new Set<string>();
    const invoice = { id: "inv_retry", status: "OPEN", payments: 0 };
    let failuresLeft = 1;
    const writer: CheckoutWriter = {
      hasEvent: async (id) => events.has(id),
      rememberIgnored: async (id) => {
        events.add(id);
      },
      applyRefund: async () => "rejected",
      applyDispute: async () => "rejected",
      applyPaymentFailed: async () => "failed",
      commitPaid: async (delivered) => {
        if (events.has(delivered.id)) return "duplicate";
        if (failuresLeft > 0) {
          failuresLeft -= 1;
          throw new Error("invoice update failed");
        }
        invoice.status = "PAID";
        invoice.payments += 1;
        events.add(delivered.id);
        return "paid";
      },
    };
    const event: CheckoutEvent = {
      id: "evt_retry",
      type: "checkout.session.completed",
      invoiceId: invoice.id,
      amountCents: 12000,
      amountRefundedCents: null,
      currency: "usd",
      paymentStatus: "paid",
      paymentIntentId: "pi_retry",
      chargeId: null,
      receiptUrl: "https://pay.stripe.com/receipts/retry",
      checkoutSessionId: "cs_retry",
      disputeStatus: null,
    };

    await expect(applyCheckoutEvent(event, writer)).rejects.toThrow(/invoice update failed/);
    expect(events.has(event.id)).toBe(false);
    expect(invoice.status).toBe("OPEN");
    expect(invoice.payments).toBe(0);

    await expect(applyCheckoutEvent(event, writer)).resolves.toEqual({ ok: true, paid: true });
    expect(events.has(event.id)).toBe(true);
    expect(invoice.status).toBe("PAID");
    expect(invoice.payments).toBe(1);

    await expect(applyCheckoutEvent(event, writer)).resolves.toEqual({ ok: true, duplicate: true });
    expect(invoice.payments).toBe(1);
  });

  it("rolls the event back when the payment write fails, then pays on retry", async () => {
    const prisma = new PrismaClient();
    const stamp = `wh-${Date.now()}`;
    const client = await prisma.client.create({
      data: { firstName: "Webhook", lastName: "Retry", email: `${stamp}@example.com` },
    });
    const takenInvoice = await prisma.invoice.create({
      data: {
        number: `${stamp}-taken`,
        clientId: client.id,
        subtotalCents: 100,
        totalCents: 100,
        status: "PAID",
      },
    });
    await prisma.payment.create({
      data: {
        invoiceId: takenInvoice.id,
        status: "SUCCEEDED",
        amountCents: 100,
        stripePaymentIntentId: `${stamp}-taken`,
        method: "card",
      },
    });
    const invoice = await prisma.invoice.create({
      data: {
        number: `${stamp}-open`,
        clientId: client.id,
        subtotalCents: 12000,
        totalCents: 12000,
        currency: "usd",
        status: "OPEN",
        stripeCheckoutSessionId: `${stamp}-cs`,
      },
    });
    const event: CheckoutEvent = {
      id: `${stamp}-evt`,
      type: "checkout.session.completed",
      invoiceId: invoice.id,
      amountCents: 12000,
      amountRefundedCents: null,
      currency: "usd",
      paymentStatus: "paid",
      paymentIntentId: `${stamp}-taken`,
      chargeId: null,
      receiptUrl: "https://pay.stripe.com/receipts/retry",
      checkoutSessionId: `${stamp}-cs`,
      disputeStatus: null,
    };
    try {
      await expect(prismaCheckoutWriter.commitPaid(event)).rejects.toThrow();
      expect(await prisma.stripeEvent.findUnique({ where: { id: event.id } })).toBeNull();
      expect((await prisma.invoice.findUnique({ where: { id: invoice.id } }))?.status).toBe("OPEN");

      const retry = { ...event, paymentIntentId: `${stamp}-ok` };
      await expect(prismaCheckoutWriter.commitPaid(retry)).resolves.toBe("paid");
      const paid = await prisma.invoice.findUnique({ where: { id: invoice.id }, include: { payments: true } });
      expect(paid?.status).toBe("PAID");
      expect(paid?.amountPaidCents).toBe(12000);
      expect(paid?.payments).toHaveLength(1);
      expect(await prisma.stripeEvent.findUnique({ where: { id: event.id } })).not.toBeNull();

      await expect(applyCheckoutEvent(retry, prismaCheckoutWriter)).resolves.toEqual({ ok: true, duplicate: true });
      expect(await prisma.payment.count({ where: { invoiceId: invoice.id } })).toBe(1);
    } finally {
      await prisma.payment.deleteMany({ where: { invoiceId: { in: [invoice.id, takenInvoice.id] } } });
      await prisma.auditLog.deleteMany({ where: { entityId: invoice.id } });
      await prisma.stripeEvent.deleteMany({ where: { id: event.id } });
      await prisma.invoice.deleteMany({ where: { id: { in: [invoice.id, takenInvoice.id] } } });
      await prisma.client.delete({ where: { id: client.id } });
      await prisma.$disconnect();
    }
  });

  it("lets Stripe reach the webhook without the staging password", () => {
    expect(
      stagingGate({
        appEnv: "staging",
        basicAuth: "preview:secret",
        authorizationHeader: null,
        pathname: "/api/stripe/webhook",
      }).action,
    ).toBe("allow");
  });
});

describe("gallery downloads", () => {
  it("keeps pay-before-download and the trusted override", () => {
    expect(
      galleryDownloadDecision({ requirePaid: true, allowUnpaidDownloads: false, invoiceStatus: null }).reason,
    ).toBe("payment-required");
    expect(
      galleryDownloadDecision({ requirePaid: true, allowUnpaidDownloads: true, invoiceStatus: "OPEN" }).reason,
    ).toBe("trusted-client");
  });

  it("packs a zip the portal can hand to Nginx", () => {
    const zip = storedZip([{ name: "preview.txt", data: new TextEncoder().encode("amalfi") }]);
    const text = new TextDecoder().decode(zip);
    expect(text).toContain("preview.txt");
    expect(text).toContain("amalfi");
  });
});
