import { betterAuth } from "better-auth";
import { twoFactor } from "better-auth/plugins";

/**
 * Loaded only by `auth generate`. The runtime config lives in auth.ts.
 * Keep plugins and additional fields in sync with auth.ts.
 */
export const auth = betterAuth({
  appName: "Amalfi Media",
  emailAndPassword: { enabled: true, minPasswordLength: 10 },
  rateLimit: { enabled: true, storage: "database" },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "CLIENT",
        input: false,
      },
      disabledAt: { type: "date", required: false, input: false },
      lastLoginAt: { type: "date", required: false, input: false },
    },
  },
  advanced: {
    database: { generateId: "uuid" },
  },
  plugins: [twoFactor({ issuer: "Amalfi Media" })],
});
