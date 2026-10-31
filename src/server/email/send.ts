import "server-only";
import nodemailer from "nodemailer";
import type { MailMessage } from "@/lib/email-messages";
import { stagingRecipientAllowed, transactionalDeliveryPlan } from "@/lib/transactional-email";
import { prisma } from "@/server/db/prisma";
import { getEnv } from "@/server/env";
import { logger } from "@/server/logger";

export type MailResult = { delivered: boolean; mode: "send" | "preview" | "skip"; reason?: string };

function providerConfigured(env: ReturnType<typeof getEnv>) {
  if (!env.EMAIL_FROM) return false;
  if (env.EMAIL_PROVIDER === "resend") return Boolean(env.RESEND_API_KEY);
  if (env.EMAIL_PROVIDER === "smtp") return Boolean(env.SMTP_HOST && env.SMTP_PORT);
  return false;
}

export async function sendTransactional(message: MailMessage): Promise<MailResult> {
  const env = getEnv();
  const mode = transactionalDeliveryPlan({
    appEnv: env.APP_ENV,
    emailTransactionalEnabled: env.emailTransactionalEnabled,
    stagingSend: env.emailStagingSend,
    providerConfigured: providerConfigured(env),
  });
  if (mode === "send" && env.APP_ENV === "staging") {
    const allowed = stagingRecipientAllowed(message.to, env.EMAIL_STAGING_ALLOWLIST);
    if (!allowed.allowed) {
      logger.info({ to: message.to, subject: message.subject, reason: allowed.reason }, "transactional email preview");
      if (env.emailDevPreview) {
        await prisma.appSetting.upsert({
          where: { key: "dev.lastTransactionalEmail" },
          create: { key: "dev.lastTransactionalEmail", value: { to: message.to, subject: message.subject, at: new Date().toISOString() } },
          update: { value: { to: message.to, subject: message.subject, at: new Date().toISOString() } },
        });
      }
      return { delivered: false, mode: "preview", reason: allowed.reason };
    }
  }
  if (mode === "skip") {
    logger.info({ to: message.to, subject: message.subject }, "transactional email skipped");
    return { delivered: false, mode };
  }
  if (mode === "preview") {
    logger.info({ to: message.to, subject: message.subject, text: message.text }, "transactional email preview");
    if (env.emailDevPreview) {
      await prisma.appSetting.upsert({
        where: { key: "dev.lastTransactionalEmail" },
        create: { key: "dev.lastTransactionalEmail", value: { ...message, at: new Date().toISOString() } },
        update: { value: { ...message, at: new Date().toISOString() } },
      });
    }
    return { delivered: false, mode, reason: "Preview only." };
  }
  try {
    if (env.EMAIL_PROVIDER === "resend") {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from: env.EMAIL_FROM, to: [message.to], subject: message.subject, text: message.text }),
      });
      if (!response.ok) {
        logger.error({ status: response.status, to: message.to }, "resend rejected the email");
        return { delivered: false, mode, reason: "Resend did not accept the email." };
      }
      return { delivered: true, mode };
    }
    const transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: Number(env.SMTP_PORT),
      secure: Number(env.SMTP_PORT) === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD ?? "" } : undefined,
    });
    await transport.sendMail({ from: env.EMAIL_FROM, to: message.to, subject: message.subject, text: message.text });
    return { delivered: true, mode };
  } catch (error) {
    logger.error({ err: error, to: message.to }, "transactional email failed");
    return { delivered: false, mode, reason: "The email could not be sent." };
  }
}
