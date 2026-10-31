import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { emailOTP, twoFactor } from "better-auth/plugins";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { prisma } from "@/server/db/prisma";
import { writeAudit } from "@/server/audit";
import { getEnv } from "@/server/env";
import { logger } from "@/server/logger";
import { assertPasswordAcceptable } from "@/lib/passwords";
import { consumeRateLimit } from "@/lib/rate-limit";
import { loginCodeMessage, passwordResetMessage, verificationMessage } from "@/lib/email-messages";
import { sendTransactional } from "@/server/email/send";
import { ensureClientProfile } from "@/server/services/client-link";

const env = getEnv();

const ADMIN_SESSION_SECONDS = 60 * 60 * 12;
const CLIENT_SESSION_SECONDS = 60 * 60 * 24 * 7;
/** Production and staging stay at 5. Local and CI suites sign in more than that. */
const LOGIN_ATTEMPT_MAX = env.APP_ENV === "production" || env.APP_ENV === "staging" ? 5 : 30;

function clientIp(headers: Headers | undefined): string {
  const forwarded = headers?.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return headers?.get("x-real-ip") ?? "unknown";
}

export const auth = betterAuth({
  appName: "Amalfi Media",
  baseURL: env.APP_URL,
  basePath: "/portal/api/auth",
  secret: env.AUTH_SECRET,
  trustedOrigins: [env.APP_URL],
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    autoSignIn: true,
    requireEmailVerification: true,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 60 * 30,
    sendResetPassword: async ({ user, url }) => {
      logger.info({ email: user.email }, "password reset requested");
      await sendTransactional(passwordResetMessage({ to: user.email, url }));
      if (env.emailDevPreview) {
        await prisma.appSetting.upsert({
          where: { key: "dev.lastPasswordReset" },
          create: {
            key: "dev.lastPasswordReset",
            value: { email: user.email, url, at: new Date().toISOString() },
          },
          update: {
            value: { email: user.email, url, at: new Date().toISOString() },
          },
        });
      }
    },
    password: {
      hash: hashPassword,
      verify: async ({ hash, password }) => verifyPassword(hash, password),
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: false,
    sendVerificationEmail: async ({ user, url }) => {
      logger.info({ email: user.email }, "email verification requested");
      await sendTransactional(verificationMessage({ to: user.email, url }));
      if (env.emailDevPreview) {
        await prisma.appSetting.upsert({
          where: { key: "dev.lastEmailVerification" },
          create: { key: "dev.lastEmailVerification", value: { email: user.email, url, at: new Date().toISOString() } },
          update: { value: { email: user.email, url, at: new Date().toISOString() } },
        });
      }
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "CLIENT",
        input: false,
      },
      disabledAt: {
        type: "date",
        required: false,
        input: false,
      },
      lastLoginAt: {
        type: "date",
        required: false,
        input: false,
      },
    },
  },
  session: {
    expiresIn: CLIENT_SESSION_SECONDS,
    updateAge: 60 * 60,
    cookieCache: {
      enabled: false,
    },
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 60,
    storage: "database",
    customRules: {
      "/sign-in/email": { window: 15 * 60, max: LOGIN_ATTEMPT_MAX },
      "/sign-up/email": { window: 15 * 60, max: 5 },
      "/request-password-reset": { window: 60 * 60, max: 3 },
      "/reset-password": { window: 60 * 60, max: 5 },
      "/email-otp/send-verification-otp": { window: 15 * 60, max: LOGIN_ATTEMPT_MAX },
      "/sign-in/email-otp": { window: 15 * 60, max: LOGIN_ATTEMPT_MAX },
    },
  },
  advanced: {
    cookiePrefix: env.APP_URL.startsWith("https://") ? "__Host-amalfi" : "amalfi",
    useSecureCookies: env.APP_URL.startsWith("https://"),
    trustedProxyHeaders: true,
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    },
    ipAddress: {
      ipAddressHeaders: ["x-forwarded-for", "x-real-ip"],
    },
    database: {
      generateId: "uuid",
    },
  },
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 60 * 10,
      allowedAttempts: 5,
      disableSignUp: true,
      storeOTP: "hashed",
      rateLimit: { window: 15 * 60, max: LOGIN_ATTEMPT_MAX },
      sendVerificationOTP: async ({ email, otp, type }) => {
        if (type !== "sign-in") return;
        const account = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
          select: { role: true, disabledAt: true },
        });
        if (!account || account.role !== "CLIENT" || account.disabledAt) return;
        logger.info({ email }, "portal sign-in code requested");
        await sendTransactional(loginCodeMessage({ to: email, code: otp }));
        if (env.emailDevPreview) {
          const key = `dev.portalOtp:${email.toLowerCase()}`;
          await prisma.appSetting.upsert({
            where: { key },
            create: { key, value: { to: email.toLowerCase(), code: otp, at: new Date().toISOString() } },
            update: { value: { to: email.toLowerCase(), code: otp, at: new Date().toISOString() } },
          });
        }
        await writeAudit({
          action: "auth.otp.sent",
          entityType: "User",
          entityId: email.toLowerCase(),
          after: { type: "sign-in" },
        });
      },
    }),
    twoFactor({
      issuer: "Amalfi Media",
    }),
  ],
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const email = user.email.toLowerCase().trim();
          return {
            data: {
              ...user,
              email,
              role: "CLIENT",
            },
          };
        },
        after: async (user) => {
          if (user.role !== "CLIENT") return;
          await ensureClientProfile({
            id: user.id,
            email: user.email,
            name: user.name,
            emailVerified: Boolean(user.emailVerified),
          });
        },
      },
      update: {
        after: async (user) => {
          if (user.role !== "CLIENT" || !user.emailVerified) return;
          await ensureClientProfile({
            id: user.id,
            email: user.email,
            name: user.name,
            emailVerified: true,
          });
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          const user = await prisma.user.findUnique({ where: { id: session.userId } });
          if (!user || user.disabledAt) {
            return false;
          }
          const seconds = user.role === "CLIENT" ? CLIENT_SESSION_SECONDS : ADMIN_SESSION_SECONDS;
          return {
            data: {
              ...session,
              expiresAt: new Date(Date.now() + seconds * 1000),
            },
          };
        },
        after: async (session) => {
          await prisma.user.update({
            where: { id: session.userId },
            data: { lastLoginAt: new Date() },
          });
          await writeAudit({
            actorId: session.userId,
            action: "auth.login",
            entityType: "User",
            entityId: session.userId,
            ip: session.ipAddress,
            userAgent: session.userAgent,
          });
        },
      },
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      const ip = clientIp(ctx.headers);
      if (ctx.path === "/sign-in/email") {
        const email = String(ctx.body?.email ?? "").toLowerCase().trim();
        const decision = consumeRateLimit(`login:${email}:${ip}`, {
          windowMs: 15 * 60 * 1000,
          max: LOGIN_ATTEMPT_MAX,
        });
        if (!decision.allowed) {
          await writeAudit({
            action: "auth.login.throttled",
            entityType: "User",
            entityId: email || "unknown",
            ip,
            userAgent: ctx.headers?.get("user-agent"),
            after: { email },
          });
          throw new APIError("TOO_MANY_REQUESTS", {
            message: "Too many login attempts. Try again in a few minutes.",
          });
        }
      }
      if (ctx.path === "/email-otp/send-verification-otp" || ctx.path === "/sign-in/email-otp") {
        const email = String(ctx.body?.email ?? "").toLowerCase().trim();
        const decision = consumeRateLimit(`otp:${ctx.path}:${email}:${ip}`, {
          windowMs: 15 * 60 * 1000,
          max: LOGIN_ATTEMPT_MAX,
        });
        if (!decision.allowed) {
          throw new APIError("TOO_MANY_REQUESTS", {
            message: "Too many codes. Try again in a few minutes.",
          });
        }
        if (ctx.path === "/sign-in/email-otp") {
          const account = email
            ? await prisma.user.findUnique({ where: { email }, select: { role: true } })
            : null;
          if (account && account.role !== "CLIENT") {
            throw new APIError("BAD_REQUEST", { message: "Invalid OTP" });
          }
        }
      }
      if (ctx.path === "/request-password-reset") {
        const decision = consumeRateLimit(`reset:${ip}`, {
          windowMs: 60 * 60 * 1000,
          max: 3,
        });
        if (!decision.allowed) {
          throw new APIError("TOO_MANY_REQUESTS", {
            message: "Too many password reset requests. Try again later.",
          });
        }
      }
      if (ctx.path === "/sign-up/email" || ctx.path === "/reset-password" || ctx.path === "/change-password") {
        const password = ctx.body?.password ?? ctx.body?.newPassword;
        if (typeof password === "string") {
          const problem = assertPasswordAcceptable(password);
          if (problem) {
            throw new APIError("BAD_REQUEST", { message: problem });
          }
        }
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/email") return;
      const email = String(ctx.body?.email ?? "").toLowerCase().trim();
      const returned = ctx.context.returned as { user?: { id: string } } | Response | undefined;
      const failed = returned instanceof Response && returned.status >= 400;
      if (failed) {
        await writeAudit({
          action: "auth.login.failed",
          entityType: "User",
          entityId: email || "unknown",
          ip: clientIp(ctx.headers),
          userAgent: ctx.headers?.get("user-agent"),
          after: { email },
        });
      }
    }),
  },
});

export type AuthSession = typeof auth.$Infer.Session;
