import { z } from "zod";

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
    STAGING_BASIC_AUTH: z.string().optional(),
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
    S3_ENDPOINT: z.string().optional(),
    S3_REGION: z.string().optional(),
    S3_BUCKET: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
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
      if (value.S3_BUCKET && !value.S3_BUCKET.includes("staging")) {
        ctx.addIssue({
          code: "custom",
          path: ["S3_BUCKET"],
          message: "Staging bucket name must include staging so it cannot point at production.",
        });
      }
      if (/amalfi_prod|\/prod\b/i.test(value.DATABASE_URL)) {
        ctx.addIssue({
          code: "custom",
          path: ["DATABASE_URL"],
          message: "Staging DATABASE_URL must not point at a production database.",
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
      if (value.S3_BUCKET?.includes("staging")) {
        ctx.addIssue({
          code: "custom",
          path: ["S3_BUCKET"],
          message: "Production bucket must not be the staging bucket.",
        });
      }
    }
  });

export type ParsedEnv = z.infer<typeof envSchema> & {
  emailMarketingEnabled: boolean;
  emailTransactionalEnabled: boolean;
  emailDevPreview: boolean;
};

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
  };
}
