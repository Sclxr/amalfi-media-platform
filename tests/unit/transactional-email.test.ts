import { describe, expect, it } from "vitest";
import { galleryInviteMessage, passwordResetMessage, receiptMessage, verificationMessage } from "@/lib/email-messages";
import { marketingSendDecision } from "@/lib/marketing";
import { inviteEmailNotice, stagingRecipientAllowed, transactionalDeliveryPlan, transactionalSendDecision } from "@/lib/transactional-email";

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

  it("sends on staging only when both flags are on, and never from development or test", () => {
    const cases = [
      { appEnv: "production" as const, emailTransactionalEnabled: true, stagingSend: false, allowed: true },
      { appEnv: "production" as const, emailTransactionalEnabled: true, stagingSend: true, allowed: true },
      { appEnv: "production" as const, emailTransactionalEnabled: false, stagingSend: true, allowed: false },
      { appEnv: "staging" as const, emailTransactionalEnabled: true, stagingSend: true, allowed: true },
      { appEnv: "staging" as const, emailTransactionalEnabled: true, stagingSend: false, allowed: false },
      { appEnv: "staging" as const, emailTransactionalEnabled: false, stagingSend: true, allowed: false },
      { appEnv: "development" as const, emailTransactionalEnabled: true, stagingSend: true, allowed: false },
      { appEnv: "test" as const, emailTransactionalEnabled: true, stagingSend: true, allowed: false },
    ];
    for (const item of cases) {
      expect(transactionalSendDecision(item).allowed, `${item.appEnv} enabled=${item.emailTransactionalEnabled} stagingSend=${item.stagingSend}`).toBe(item.allowed);
    }
    expect(transactionalDeliveryPlan({ appEnv: "staging", emailTransactionalEnabled: true, stagingSend: true, providerConfigured: true })).toBe("send");
    expect(transactionalDeliveryPlan({ appEnv: "staging", emailTransactionalEnabled: true, stagingSend: true, providerConfigured: false })).toBe("skip");
    expect(transactionalDeliveryPlan({ appEnv: "development", emailTransactionalEnabled: true, stagingSend: true, providerConfigured: true })).toBe("preview");
  });

  it("matches staging allowlist addresses and domains, and allows everyone when the list is empty", () => {
    expect(stagingRecipientAllowed("Riley@Example.com", "").allowed).toBe(true);
    expect(stagingRecipientAllowed("Riley@Example.com", "   ").allowed).toBe(true);
    expect(stagingRecipientAllowed("riley@example.com", "other@example.com, Riley@Example.com").allowed).toBe(true);
    expect(stagingRecipientAllowed("riley@example.com", "example.com").allowed).toBe(true);
    expect(stagingRecipientAllowed("riley@example.com", "@example.com").allowed).toBe(true);
    expect(stagingRecipientAllowed("riley@evil.example.com", "example.com").allowed).toBe(false);
    expect(stagingRecipientAllowed("riley@example.com", "amalfimedia.xyz").reason).toBe("Recipient is not on the staging allowlist.");
    expect(inviteEmailNotice({ recipient: "riley@example.com", mode: "send", delivered: true })).toBe("Invite emailed to riley@example.com");
    expect(inviteEmailNotice({ recipient: "riley@example.com", mode: "preview", delivered: false })).toBe("Invite logged only (staging/not allowlisted)");
    expect(inviteEmailNotice({ recipient: "", mode: "skip", delivered: false, reason: "SMTP refused the message." })).toBe("Invite email failed: SMTP refused the message.");
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