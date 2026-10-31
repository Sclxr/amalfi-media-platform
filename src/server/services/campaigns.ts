import "server-only";
import type { CampaignStatus, Prisma } from "@prisma/client";
import type { Actor } from "@/lib/actor";
import { renderCampaignHtml, signUnsubscribeToken, unsubscribeUrl } from "@/lib/canspam";
import { campaignSendPlan, campaignTransition } from "@/lib/campaign-flow";
import { sendViaGmail } from "@/lib/gmail";
import { can } from "@/lib/permissions";
import { leadMatchesSegment, parseSegment, type CampaignSegment } from "@/lib/segments";
import { prisma } from "@/server/db/prisma";
import { getEnv } from "@/server/env";
import { writeAudit } from "@/server/audit";

export async function listCampaigns(actor: Actor, view?: string) {
  if (!can(actor, "marketing.draft") && !can(actor, "marketing.send")) throw new Error("Forbidden");
  return prisma.campaign.findMany({
    where: { archivedAt: view === "archived" ? { not: null } : null },
    orderBy: { updatedAt: "desc" },
    include: { createdBy: true, messages: { where: { sentAt: { not: null } }, select: { id: true } } },
  });
}

export async function getCampaign(actor: Actor, id: string) {
  if (!can(actor, "marketing.draft") && !can(actor, "marketing.send")) throw new Error("Forbidden");
  return prisma.campaign.findUnique({ where: { id }, include: { createdBy: true, approvedBy: true, messages: true } });
}

export async function createCampaign(
  actor: Actor,
  input: { name: string; subject: string; body: string; segment: CampaignSegment; source?: string },
) {
  if (!can(actor, "marketing.draft")) throw new Error("Forbidden");
  const name = input.name.trim();
  const subject = input.subject.trim();
  const body = input.body.trim();
  if (!name || !subject || !body) throw new Error("Name, subject, and body are required.");
  const env = getEnv();
  const campaign = await prisma.campaign.create({
    data: {
      name,
      subject,
      body,
      fromName: "Amalfi Media",
      fromEmail: env.APP_ENV === "production" ? "eathen@amalfimedia.xyz" : "preview@amalfimedia.xyz",
      createdById: actor.id,
      source: input.source ?? "admin",
      segment: input.segment as Prisma.InputJsonValue,
      status: "DRAFT",
    },
  });
  await writeAudit({
    actorId: actor.id,
    action: "campaign.create",
    entityType: "Campaign",
    entityId: campaign.id,
    after: { name: campaign.name, status: campaign.status },
  });
  return campaign;
}

export async function transitionCampaign(actor: Actor, id: string, action: "submit" | "approve" | "cancel") {
  if (action === "approve") {
    if (!can(actor, "marketing.send")) return { error: "Approving a campaign requires the marketing send permission." as const };
  } else if (!can(actor, "marketing.draft")) {
    throw new Error("Forbidden");
  }
  const current = await prisma.campaign.findUnique({ where: { id } });
  if (!current) return { error: "That campaign was not found." as const };
  const next = campaignTransition({ status: current.status, action, canApprove: can(actor, "marketing.send") });
  if (!next.ok) return { error: next.error };
  const campaign = await prisma.campaign.update({
    where: { id },
    data: {
      status: next.status as CampaignStatus,
      approvedById: action === "approve" ? actor.id : current.approvedById,
      approvedAt: action === "approve" ? new Date() : current.approvedAt,
    },
  });
  await writeAudit({
    actorId: actor.id,
    action: `campaign.${action}`,
    entityType: "Campaign",
    entityId: id,
    before: { status: current.status },
    after: { status: campaign.status },
  });
  return { id };
}

export async function attemptCampaignSend(actor: Actor, id: string) {
  if (!can(actor, "marketing.send")) return { error: "Sending requires the marketing send permission." as const };
  const env = getEnv();
  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) return { error: "That campaign was not found." as const };
  const plan = campaignSendPlan({
    status: campaign.status,
    appEnv: env.APP_ENV,
    emailMarketingEnabled: env.emailMarketingEnabled,
  });
  if (!plan.deliver) return { sent: false as const, reason: plan.reason };
  const gmail = sendViaGmail(
    { to: "segment", subject: campaign.subject, html: campaign.body, headers: {} },
    { enabled: process.env.GMAIL_API_ENABLED === "true" },
  );
  return { sent: false as const, reason: gmail.reason };
}

export async function campaignPreviewHtml(actor: Actor, id: string) {
  const campaign = await getCampaign(actor, id);
  if (!campaign) return null;
  const env = getEnv();
  const token = signUnsubscribeToken("preview@amalfimedia.xyz", env.ENCRYPTION_KEY);
  return renderCampaignHtml({
    body: campaign.body,
    unsubscribeHref: unsubscribeUrl(env.APP_URL, token),
  });
}

export async function recipientsForCampaign(actor: Actor, id: string) {
  const campaign = await getCampaign(actor, id);
  if (!campaign) return [];
  const segment = parseSegment(campaign.segment);
  const [leads, suppressed] = await Promise.all([
    prisma.lead.findMany({
      where: { deletedAt: null },
      select: { id: true, status: true, city: true, tags: true, emailNormalized: true, email: true, firstName: true, lastName: true },
    }),
    prisma.emailSuppression.findMany({ select: { emailNormalized: true } }),
  ]);
  const blocked = new Set(suppressed.map((row) => row.emailNormalized));
  return leads.filter((lead) => leadMatchesSegment(lead, segment) && lead.emailNormalized && !blocked.has(lead.emailNormalized));
}

export async function listTemplates(actor: Actor) {
  if (!can(actor, "marketing.draft")) throw new Error("Forbidden");
  return prisma.emailTemplate.findMany({ orderBy: { key: "asc" } });
}

export async function saveTemplate(
  actor: Actor,
  input: { key: string; subject: string; body: string; category?: "MARKETING" | "TRANSACTIONAL" },
) {
  if (!can(actor, "marketing.draft")) throw new Error("Forbidden");
  const key = input.key.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  return prisma.emailTemplate.upsert({
    where: { key },
    create: {
      key,
      category: input.category ?? "MARKETING",
      subject: input.subject.trim(),
      bodyMjml: input.body,
    },
    update: { subject: input.subject.trim(), bodyMjml: input.body },
  });
}

export async function listSuppressions(actor: Actor) {
  if (!can(actor, "marketing.draft") && !can(actor, "marketing.send")) throw new Error("Forbidden");
  return prisma.emailSuppression.findMany({ orderBy: { createdAt: "desc" } });
}

export async function suppressEmail(email: string, source: string) {
  const { normalizeEmail } = await import("@/lib/email");
  const emailNormalized = normalizeEmail(email);
  if (!emailNormalized) return { error: "Enter a valid email." as const };
  await prisma.emailSuppression.upsert({
    where: { emailNormalized },
    create: { emailNormalized, reason: "UNSUBSCRIBED", source },
    update: {},
  });
  return { ok: true as const, emailNormalized };
}
