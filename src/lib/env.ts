import { z } from "zod";
import { mediaMaxUploadBytes } from "@/lib/media-limit";

const appEnvSchema = z.enum(["development", "test", "staging", "production"]);

export const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    APP_ENV: appEnvSchema.default("development"),
    APP_URL: z.string().url(),
    DATABASE_URL: z.string().min(1),
    AUTH_SECRET: z.string().min(32),
    ENCRYPTION_KEY: z.string().min(32),
    EMAIL_MARKETING_ENABLED: z.enum(["true", "false"]).default("false"),
    EMAIL_TRANSACTIONAL_ENABLED: z.enum(["true", "false"]).default("false"),
    EMAIL_DEV_PREVIEW: z.enum(["true", "false"]).default("false"),
    EMAIL_PROVIDER: z.enum(["resend", "smtp"]).optional(),
    EMAIL_FROM: z.string().optional(),
    RESEND_API_KEY: z.string().optional(),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.string().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    STRIPE_API_BASE: z.string().url().optional(),
    STAGING_BASIC_AUTH: z.string().optional(),
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
    S3_ENDPOINT: z.string().optional(),
    S3_REGION: z.string().optional(),
    S3_BUCKET: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    MEDIA_ROOT: z.string().optional(),
    MEDIA_MAX_UPLOAD_BYTES: z.string().optional(),
    SENTRY_DSN: z.string().optional(),
    LOG_LEVEL: z.string().default("info"),
    SEED_ADMIN_PASSWORD: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    const marketingOn = value.EMAIL_MARKETING_ENABLED === "true";
    if (value.APP_ENV !== "production" && marketingOn) {
      ctx.addIssue({
        code: "custom",
        path: ["EMAIL_MARKETING_ENABLED"],
        message: "EMAIL_MARKETING_ENABLED must stay false outside production.",
      });
    }
    if (value.APP_ENV === "staging") {
      if (!value.STAGING_BASIC_AUTH?.includes(":")) {
        ctx.addIssue({
          code: "custom",
          path: ["STAGING_BASIC_AUTH"],
          message: "Staging requires STAGING_BASIC_AUTH as username:password.",
        });
      }
      if (value.STRIPE_SECRET_KEY && !value.STRIPE_SECRET_KEY.startsWith("sk_test_")) {
        ctx.addIssue({
          code: "custom",
          path: ["STRIPE_SECRET_KEY"],
          message: "Staging Stripe secret must be a test key (sk_test_).",
        });
      }
      if (
        value.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY &&
        !value.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.startsWith("pk_test_")
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"],
          message: "Staging Stripe publishable key must be a test key (pk_test_).",
        });
      }
      if (!value.MEDIA_ROOT || !pathHasSegment(value.MEDIA_ROOT, "staging")) {
        ctx.addIssue({
          code: "custom",
          path: ["MEDIA_ROOT"],
          message: "Staging MEDIA_ROOT must be a directory path that contains a staging segment.",
        });
      }
      if (value.S3_BUCKET && !value.S3_BUCKET.includes("staging")) {
        ctx.addIssue({
          code: "custom",
          path: ["S3_BUCKET"],
          message: "If an S3 bucket is set on staging, its name must include staging.",
        });
      }
      const stagingDb = databaseName(value.DATABASE_URL);
      if (!stagingDb.toLowerCase().includes("staging") || /amalfi_prod|production/i.test(stagingDb)) {
        ctx.addIssue({
          code: "custom",
          path: ["DATABASE_URL"],
          message: "Staging DATABASE_URL must use a database whose name includes staging and is not production.",
        });
      }
    }
    if (value.APP_ENV === "production") {
      if (value.STRIPE_SECRET_KEY?.startsWith("sk_test_")) {
        ctx.addIssue({
          code: "custom",
          path: ["STRIPE_SECRET_KEY"],
          message: "Production cannot use a Stripe test secret.",
        });
      }
      if (!value.MEDIA_ROOT || pathHasSegment(value.MEDIA_ROOT, "staging")) {
        ctx.addIssue({
          code: "custom",
          path: ["MEDIA_ROOT"],
          message: "Production MEDIA_ROOT must be set and must not use the staging directory.",
        });
      }
      if (value.S3_BUCKET?.includes("staging")) {
        ctx.addIssue({
          code: "custom",
          path: ["S3_BUCKET"],
          message: "Production must not use a staging bucket.",
        });
      }
      if (databaseName(value.DATABASE_URL).toLowerCase().includes("staging")) {
        ctx.addIssue({
          code: "custom",
          path: ["DATABASE_URL"],
          message: "Production DATABASE_URL must not use the staging database.",
        });
      }
      if (value.STRIPE_API_BASE && !value.STRIPE_API_BASE.startsWith("https://api.stripe.com")) {
        ctx.addIssue({
          code: "custom",
          path: ["STRIPE_API_BASE"],
          message: "Production Stripe API base must be https://api.stripe.com.",
        });
      }
    }
  });

export type ParsedEnv = z.infer<typeof envSchema> & {
  emailMarketingEnabled: boolean;
  emailTransactionalEnabled: boolean;
  emailDevPreview: boolean;
  mediaMaxUploadBytes: number;
};

function pathHasSegment(value: string, segment: string) {
  return value
    .split(/[/\\]/)
    .filter(Boolean)
    .some((part) => part.toLowerCase() === segment);
}

function databaseName(url: string) {
  try {
    const parsed = new URL(url);
    return decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  } catch {
    return url;
  }
}

function blankToUndefined(source: Record<string, string | undefined>) {
  const entries = Object.entries(source).map(([key, value]) => [key, value === "" ? undefined : value]);
  return Object.fromEntries(entries);
}

export function parseEnv(source: Record<string, string | undefined>): ParsedEnv {
  const parsed = envSchema.parse(blankToUndefined(source));
  return {
    ...parsed,
    emailMarketingEnabled: parsed.EMAIL_MARKETING_ENABLED === "true",
    emailTransactionalEnabled: parsed.EMAIL_TRANSACTIONAL_ENABLED === "true",
    emailDevPreview: parsed.EMAIL_DEV_PREVIEW === "true",
    mediaMaxUploadBytes: mediaMaxUploadBytes(parsed.MEDIA_MAX_UPLOAD_BYTES),
  };
}
