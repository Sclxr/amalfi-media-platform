import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { twoFactor } from "better-auth/plugins";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { prisma } from "@/server/db/prisma";
import { writeAudit } from "@/server/audit";
import { getEnv } from "@/server/env";
import { logger } from "@/server/logger";
import { assertPasswordAcceptable } from "@/lib/passwords";
import { consumeRateLimit } from "@/lib/rate-limit";

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
    requireEmailVerification: false,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 60 * 30,
    sendResetPassword: async ({ user, url }) => {
      logger.info({ email: user.email }, "password reset requested");
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
          const [firstName, ...rest] = user.name.trim().split(/\s+/);
          await prisma.client.create({
            data: {
              userId: user.id,
              firstName: firstName || "Client",
              lastName: rest.join(" "),
              email: user.email.toLowerCase(),
            },
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
