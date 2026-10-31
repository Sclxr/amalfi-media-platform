import { describe, expect, it } from "vitest";
import { galleryInviteMessage, passwordResetMessage, receiptMessage, verificationMessage } from "@/lib/email-messages";
import { marketingSendDecision } from "@/lib/marketing";
import { transactionalDeliveryPlan, transactionalSendDecision } from "@/lib/transactional-email";

describe("transactional email", () => {
  it("previews outside production and sends in production only when a provider is configured", () => {
    expect(transactionalSendDecision({ appEnv: "staging", emailTransactionalEnabled: true }).allowed).toBe(false);
    expect(transactionalDeliveryPlan({ appEnv: "staging", emailTransactionalEnabled: true, providerConfigured: true })).toBe("preview");
    expect(transactionalDeliveryPlan({ appEnv: "development", emailTransactionalEnabled: false, providerConfigured: false })).toBe("preview");
    expect(transactionalDeliveryPlan({ appEnv: "production", emailTransactionalEnabled: true, providerConfigured: false })).toBe("skip");
    expect(transactionalDeliveryPlan({ appEnv: "production", emailTransactionalEnabled: false, providerConfigured: true })).toBe("skip");
    expect(transactionalDeliveryPlan({ appEnv: "production", emailTransactionalEnabled: true, providerConfigured: true })).toBe("send");
    expect(marketingSendDecision({ appEnv: "staging", emailMarketingEnabled: true }).allowed).toBe(false);
    expect(marketingSendDecision({ appEnv: "production", emailMarketingEnabled: false }).allowed).toBe(false);
  });

  it("builds invite, verification, reset, and receipt messages", () => {
    const invite = galleryInviteMessage({
      to: "realtor@example.com",
      name: "Riley",
      address: "10 Palm",
      url: "https://app.example/portal/invite?token=abc",
    });
    expect(invite.subject).toContain("10 Palm");
    expect(invite.text).toContain("token=abc");
    expect(verificationMessage({ to: "a@b.c", url: "https://app.example/verify" }).text).toContain("/verify");
    expect(passwordResetMessage({ to: "a@b.c", url: "https://app.example/reset" }).text).toContain("/reset");
    const receipt = receiptMessage({
      to: "a@b.c",
      number: "INV-2026-0002",
      totalCents: 12000,
      receiptUrl: "https://pay.stripe.com/receipts/1",
      galleryUrl: "https://app.example/portal/galleries/g1",
    });
    expect(receipt.text).toContain("INV-2026-0002");
    expect(receipt.text).toContain("$120.00");
    expect(receipt.text).toContain("galleries/g1");
  });
});