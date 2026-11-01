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
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { stagingBasicAuthBypass, stagingGate } from "@/lib/staging-gate";
import { LOCAL_DEMO_PASSWORD, resolveSeedPassword } from "@/lib/seed-password";
import { shouldRunStartupSeed } from "@/lib/seed-marker.mjs";
import { isSafeMediaKey, signMediaToken, verifyMediaToken } from "@/lib/media-sign";

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
    expect(can({ permissions: staff }, "records.delete")).toBe(false);
    expect(can({ permissions: applyOverrides(ROLE_PERMISSIONS.ADMIN, []) }, "records.delete")).toBe(true);
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
        MEDIA_ROOT: "/var/lib/amalfi/staging/media",
        DATABASE_URL: "postgresql://amalfi_staging:secret@127.0.0.1:5432/amalfi_staging",
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
        MEDIA_ROOT: "/var/lib/amalfi/staging/media",
        DATABASE_URL: "postgresql://amalfi_staging:secret@127.0.0.1:5432/amalfi_staging",
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
      MEDIA_ROOT: "/var/lib/amalfi/staging/media",
      DATABASE_URL: "postgresql://amalfi_staging:secret@127.0.0.1:5432/amalfi_staging",
    });
    expect(staging.emailMarketingEnabled).toBe(false);
    expect(staging.emailStagingSend).toBe(false);
    expect(staging.EMAIL_STAGING_ALLOWLIST).toBeUndefined();
    expect(() =>
      parseEnv({
        ...baseEnv,
        APP_ENV: "staging",
        APP_URL: "https://staging.amalfimedia.xyz",
        STAGING_BASIC_AUTH: "preview:secret",
        MEDIA_ROOT: "/var/lib/amalfi/production/media",
        DATABASE_URL: "postgresql://amalfi_staging:secret@127.0.0.1:5432/amalfi_staging",
      }),
    ).toThrow(/MEDIA_ROOT/);
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

  it("turns the staging password off only when STAGING_GATE is off", () => {
    const closed = { appEnv: "staging", basicAuth: undefined, authorizationHeader: null, pathname: "/admin" };
    expect(stagingGate(closed).action).toBe("misconfigured");
    expect(stagingGate({ ...closed, gate: "on" }).action).toBe("misconfigured");
    expect(stagingGate({ ...closed, gate: "" }).action).toBe("misconfigured");
    expect(stagingGate({ ...closed, gate: "off", pathname: "/" }).action).toBe("allow");
    expect(stagingGate({ ...closed, gate: "off", pathname: "/admin" }).action).toBe("allow");
    expect(stagingGate({ ...closed, gate: "off", pathname: "/api/bot" }).action).toBe("allow");
    expect(stagingGate({ ...closed, gate: " off " }).action).toBe("allow");
    expect(stagingGate({ appEnv: "production", basicAuth: undefined, authorizationHeader: null, pathname: "/admin", gate: "off" }).action).toBe("allow");
    expect(
      stagingGate({ appEnv: "staging", basicAuth: "preview:secret", authorizationHeader: null, pathname: "/admin", gate: "on" }).action,
    ).toBe("challenge");

    const stagingBase = {
      ...baseEnv,
      APP_ENV: "staging" as const,
      APP_URL: "https://staging.amalfimedia.xyz",
      S3_BUCKET: "amalfi-staging",
      MEDIA_ROOT: "/var/lib/amalfi/staging/media",
      DATABASE_URL: "postgresql://amalfi_staging:secret@127.0.0.1:5432/amalfi_staging",
    };
    expect(() => parseEnv(stagingBase)).toThrow(/STAGING_BASIC_AUTH/);
    expect(() => parseEnv({ ...stagingBase, STAGING_GATE: "on" })).toThrow(/STAGING_BASIC_AUTH/);
    const open = parseEnv({ ...stagingBase, STAGING_GATE: "off" });
    expect(open.STAGING_GATE).toBe("off");
    expect(open.STAGING_BASIC_AUTH).toBeUndefined();
    expect(parseEnv({ ...stagingBase, STAGING_BASIC_AUTH: "preview:secret" }).STAGING_GATE).toBe("on");
  });

  it("lets portal and auth routes through and keeps admin behind the password", async () => {
    const open = [
      "/portal",
      "/portal/login",
      "/portal/invite",
      "/portal/register",
      "/portal/galleries/abc/preview/photo",
      "/portal/galleries/abc/download",
      "/portal/api/auth/sign-in/email-otp",
      "/portal/api/auth/email-otp/send-verification-otp",
      "/api/auth/sign-in/email",
    ];
    const closed = ["/admin", "/admin/login", "/admin/settings/api-keys", "/api/bot", "/api/bot/leads"];
    for (const pathname of open) {
      expect(stagingBasicAuthBypass(pathname), pathname).toBe(true);
      expect(
        stagingGate({ appEnv: "staging", basicAuth: "preview:secret", authorizationHeader: null, pathname }).action,
        pathname,
      ).toBe("allow");
      expect(
        stagingGate({ appEnv: "staging", basicAuth: undefined, authorizationHeader: null, pathname }).action,
        pathname,
      ).toBe("allow");
    }
    for (const pathname of closed) {
      expect(stagingBasicAuthBypass(pathname), pathname).toBe(false);
      expect(
        stagingGate({ appEnv: "staging", basicAuth: "preview:secret", authorizationHeader: null, pathname }).action,
        pathname,
      ).toBe("challenge");
    }
    expect(stagingBasicAuthBypass("/portal-admin")).toBe(false);
    expect(stagingBasicAuthBypass("/api/authorize")).toBe(false);

    const previousEnv = process.env.APP_ENV;
    const previousAuth = process.env.STAGING_BASIC_AUTH;
    const previousGate = process.env.STAGING_GATE;
    process.env.APP_ENV = "staging";
    process.env.STAGING_BASIC_AUTH = "preview:secret";
    delete process.env.STAGING_GATE;
    try {
      const portal = await proxy(new NextRequest("https://staging.amalfimedia.xyz/portal/login"));
      expect(portal.status).toBe(200);
      const admin = await proxy(new NextRequest("https://staging.amalfimedia.xyz/admin"));
      expect(admin.status).toBe(401);
      expect(admin.headers.get("WWW-Authenticate")).toContain("Basic");

      delete process.env.STAGING_BASIC_AUTH;
      process.env.STAGING_GATE = "off";
      const unlocked = await proxy(new NextRequest("https://staging.amalfimedia.xyz/admin"));
      expect(unlocked.status).toBe(307);
      expect(unlocked.headers.get("location")).toContain("/admin/login");
      const login = await proxy(new NextRequest("https://staging.amalfimedia.xyz/admin/login"));
      expect(login.status).toBe(200);
      const billing = await proxy(new NextRequest("https://staging.amalfimedia.xyz/admin/billing"));
      expect(billing.status).toBe(307);
      expect(billing.headers.get("location")).toContain("/admin/login");
      const signedIn = await proxy(
        new NextRequest("https://staging.amalfimedia.xyz/admin", { headers: { cookie: "amalfi.session_token=present" } }),
      );
      expect(signedIn.status).toBe(200);
    } finally {
      if (previousEnv === undefined) delete process.env.APP_ENV;
      else process.env.APP_ENV = previousEnv;
      if (previousAuth === undefined) delete process.env.STAGING_BASIC_AUTH;
      else process.env.STAGING_BASIC_AUTH = previousAuth;
      if (previousGate === undefined) delete process.env.STAGING_GATE;
      else process.env.STAGING_GATE = previousGate;
    }
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

describe("media signed urls", () => {
  it("accepts a matching token and rejects path escape and expiry", () => {
    const secret = "test-only-encryption-key-32chars!";
    const token = signMediaToken(
      { purpose: "download", key: "uploads/abc/photo.jpg", expiresAt: 5_000 },
      secret,
    );
    expect(verifyMediaToken(token, secret, 4_000)?.key).toBe("uploads/abc/photo.jpg");
    expect(verifyMediaToken(token, secret, 5_001)).toBeNull();
    expect(verifyMediaToken(token, "other-secret-other-secret-other", 4_000)).toBeNull();
    expect(isSafeMediaKey("../etc/passwd")).toBe(false);
    expect(isSafeMediaKey("/etc/passwd")).toBe(false);
    expect(() =>
      signMediaToken({ purpose: "upload", key: "../secret", expiresAt: 5_000 }, secret),
    ).toThrow(/Unsafe/);
  });
});

describe("startup seed", () => {
  it("skips seeding when the marker is already stored", () => {
    expect(shouldRunStartupSeed(null)).toBe(true);
    expect(shouldRunStartupSeed(undefined)).toBe(true);
    expect(shouldRunStartupSeed({ key: "seed.completed" })).toBe(false);
  });
});

describe("seed password", () => {
  it("refuses the local demo password outside development", () => {
    expect(resolveSeedPassword({ appEnv: "development" })).toBe(LOCAL_DEMO_PASSWORD);
    expect(resolveSeedPassword({ appEnv: "development", seedAdminPassword: "Custom-Dev-Password-1" })).toBe(
      "Custom-Dev-Password-1",
    );
    expect(() => resolveSeedPassword({ appEnv: "test" })).toThrow(/only used when APP_ENV=development/);
    expect(() => resolveSeedPassword({ appEnv: "staging" })).toThrow(/only used when APP_ENV=development/);
    expect(() =>
      resolveSeedPassword({ appEnv: "staging", seedAdminPassword: LOCAL_DEMO_PASSWORD }),
    ).toThrow(/refused outside development/);
    expect(() =>
      resolveSeedPassword({ appEnv: "production", seedAdminPassword: LOCAL_DEMO_PASSWORD }),
    ).toThrow(/refused outside development/);
    expect(resolveSeedPassword({ appEnv: "staging", seedAdminPassword: "Staging-Only-Password-1" })).toBe(
      "Staging-Only-Password-1",
    );
  });
});

describe("order labels", () => {
  it("maps editing and shoot complete onto one client label", () => {
    expect(clientOrderLabel("EDITING")).toBe("In progress");
    expect(clientOrderLabel("SHOOT_COMPLETE")).toBe("In progress");
    expect(clientOrderLabel("READY_FOR_DELIVERY")).toBe("Ready");
  });
});
