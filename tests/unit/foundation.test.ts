import { describe, expect, it } from "vitest";
import { parseEnv } from "@/lib/env";
import { galleryDownloadDecision } from "@/lib/gallery-access";
import { formatCents, parseDollarsToCents } from "@/lib/money";
import { marketingSendDecision } from "@/lib/marketing";
import { clientOrderLabel } from "@/lib/order-status";
import { assertPasswordAcceptable } from "@/lib/passwords";
import { applyOverrides, can, ROLE_PERMISSIONS } from "@/lib/permissions";
import { consumeRateLimitWith } from "@/lib/rate-limit";
import { normalizeEmail } from "@/lib/email";
import { normalizePhoneE164 } from "@/lib/phone";
import { leadFormSchema } from "@/schemas/lead";
import { brokerageNameKey } from "@/schemas/brokerage";
import { stagingGate } from "@/lib/staging-gate";

const baseEnv = {
  APP_URL: "http://localhost:3000",
  DATABASE_URL: "postgresql://amalfi:amalfi@127.0.0.1:5432/amalfi_dev",
  AUTH_SECRET: "test-only-secret-not-for-production-ok",
  ENCRYPTION_KEY: "test-only-encryption-key-32chars!",
};

describe("money", () => {
  it("formats cents and parses dollars", () => {
    expect(formatCents(12000)).toBe("$120.00");
    expect(parseDollarsToCents("$1,200.50")).toBe(120050);
    expect(parseDollarsToCents("120")).toBe(12000);
    expect(parseDollarsToCents("12.345")).toBeNull();
  });
});

describe("permissions", () => {
  it("keeps revenue, refunds, and settings away from staff", () => {
    const staff = applyOverrides(ROLE_PERMISSIONS.STAFF, []);
    expect(can({ permissions: staff }, "crm.write")).toBe(true);
    expect(can({ permissions: staff }, "overview.revenue")).toBe(false);
    expect(can({ permissions: staff }, "billing.refund")).toBe(false);
    expect(can({ permissions: staff }, "settings.manage")).toBe(false);
    expect(can({ permissions: staff }, "marketing.send")).toBe(false);
  });

  it("applies a per-user deny", () => {
    const admin = applyOverrides(ROLE_PERMISSIONS.ADMIN, [{ key: "billing.refund", granted: false }]);
    expect(can({ permissions: admin }, "billing.refund")).toBe(false);
    expect(can({ permissions: admin }, "settings.manage")).toBe(true);
  });

  it("gives clients no staff permissions", () => {
    expect(ROLE_PERMISSIONS.CLIENT).toEqual([]);
  });
});

describe("validation", () => {
  it("normalizes emails and rejects an invalid lead", () => {
    expect(normalizeEmail("  Maya@Example.com ")).toBe("maya@example.com");
    expect(normalizePhoneE164("(321) 246-6018")).toBe("+13212466018");
    expect(brokerageNameKey("Orange Blossom Homes")).toBe("orange-blossom-homes");
    const parsed = leadFormSchema.safeParse({ firstName: "", lastName: "Ellison", email: "not-an-email" });
    expect(parsed.success).toBe(false);
  });

  it("rejects common passwords", () => {
    expect(assertPasswordAcceptable("password123")).toMatch(/breached/);
    expect(assertPasswordAcceptable("short")).toMatch(/10/);
    expect(assertPasswordAcceptable("Amalfi-Demo-2026!")).toBeNull();
  });
});

describe("gallery download gate", () => {
  it("requires payment unless the gallery is open or the client is trusted", () => {
    expect(galleryDownloadDecision({ requirePaid: true, allowUnpaidDownloads: false, invoiceStatus: "OPEN" }).allowed).toBe(false);
    expect(galleryDownloadDecision({ requirePaid: true, allowUnpaidDownloads: false, invoiceStatus: "PAID" }).reason).toBe("invoice-paid");
    expect(galleryDownloadDecision({ requirePaid: true, allowUnpaidDownloads: true, invoiceStatus: "OPEN" }).reason).toBe("trusted-client");
    expect(galleryDownloadDecision({ requirePaid: false, allowUnpaidDownloads: false, invoiceStatus: null }).reason).toBe("gallery-open");
    expect(galleryDownloadDecision({ requirePaid: true, allowUnpaidDownloads: false, invoiceStatus: "REFUNDED" }).allowed).toBe(false);
  });
});

describe("marketing email kill switch", () => {
  it("blocks staging even when the flag is turned on", () => {
    expect(
      marketingSendDecision({ appEnv: "staging", emailMarketingEnabled: true }).allowed,
    ).toBe(false);
    expect(
      marketingSendDecision({ appEnv: "development", emailMarketingEnabled: false }).allowed,
    ).toBe(false);
    expect(
      marketingSendDecision({ appEnv: "production", emailMarketingEnabled: false }).allowed,
    ).toBe(false);
    expect(
      marketingSendDecision({ appEnv: "production", emailMarketingEnabled: true }).allowed,
    ).toBe(true);
  });

  it("refuses to boot staging with marketing enabled or a live Stripe key", () => {
    expect(() =>
      parseEnv({
        ...baseEnv,
        APP_ENV: "staging",
        APP_URL: "https://staging.amalfimedia.xyz",
        EMAIL_MARKETING_ENABLED: "true",
        STAGING_BASIC_AUTH: "preview:secret",
        S3_BUCKET: "amalfi-staging",
      }),
    ).toThrow(/EMAIL_MARKETING_ENABLED/);

    expect(() =>
      parseEnv({
        ...baseEnv,
        APP_ENV: "staging",
        APP_URL: "https://staging.amalfimedia.xyz",
        STAGING_BASIC_AUTH: "preview:secret",
        STRIPE_SECRET_KEY: "sk_live_not_allowed",
        S3_BUCKET: "amalfi-staging",
      }),
    ).toThrow(/sk_test_/);

    const staging = parseEnv({
      ...baseEnv,
      APP_ENV: "staging",
      APP_URL: "https://staging.amalfimedia.xyz",
      STAGING_BASIC_AUTH: "preview:secret",
      STRIPE_SECRET_KEY: "sk_test_123",
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_123",
      S3_BUCKET: "amalfi-staging",
    });
    expect(staging.emailMarketingEnabled).toBe(false);
  });
});

describe("staging access gate", () => {
  it("fails closed without a secret and allows the health check", () => {
    expect(stagingGate({ appEnv: "staging", basicAuth: undefined, authorizationHeader: null, pathname: "/admin" }).action).toBe("misconfigured");
    expect(stagingGate({ appEnv: "staging", basicAuth: undefined, authorizationHeader: null, pathname: "/portal/api/health" }).action).toBe("allow");
    const header = `Basic ${Buffer.from("preview:secret").toString("base64")}`;
    expect(stagingGate({ appEnv: "staging", basicAuth: "preview:secret", authorizationHeader: header, pathname: "/admin" }).action).toBe("allow");
    expect(stagingGate({ appEnv: "staging", basicAuth: "preview:secret", authorizationHeader: null, pathname: "/admin" }).action).toBe("challenge");
    expect(stagingGate({ appEnv: "development", basicAuth: undefined, authorizationHeader: null, pathname: "/admin" }).action).toBe("allow");
  });
});

describe("rate limit", () => {
  it("blocks the sixth login attempt in the window", () => {
    const store = new Map();
    const rule = { windowMs: 15 * 60 * 1000, max: 5 };
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(consumeRateLimitWith(store, "login:a@b.c:1.1.1.1", rule, 1_000).allowed).toBe(true);
    }
    expect(consumeRateLimitWith(store, "login:a@b.c:1.1.1.1", rule, 1_000).allowed).toBe(false);
  });
});

describe("order labels", () => {
  it("maps editing and shoot complete onto one client label", () => {
    expect(clientOrderLabel("EDITING")).toBe("In progress");
    expect(clientOrderLabel("SHOOT_COMPLETE")).toBe("In progress");
    expect(clientOrderLabel("READY_FOR_DELIVERY")).toBe("Ready");
  });
});
