import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { galleryDownloadDecision } from "@/lib/gallery-access";
import { readCheckoutEvent, stripeBilling, verifyStripeSignature } from "@/lib/stripe-billing";
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
          payment_intent: "pi_test",
          receipt_url: "https://pay.stripe.com/receipts/test",
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
