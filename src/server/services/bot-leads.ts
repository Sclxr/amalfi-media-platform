import "server-only";
import type { Lead } from "@prisma/client";
import { brokerageNameKey } from "@/schemas/brokerage";
import { normalizeEmail } from "@/lib/email";
import { normalizePhoneE164 } from "@/lib/phone";
import { prisma } from "@/server/db/prisma";
import { writeAudit } from "@/server/audit";

const DEFAULT_SOURCE = "Lead bot";
const SEARCH_CAP = 25;

export type BotLeadInput = {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  brokerage?: string | null;
  source?: string | null;
  tags?: string[];
  note?: string | null;
  website?: string | null;
  profileUrl?: string | null;
  externalRef?: string | null;
};

export type BotLeadResult =
  | { id: string; merged: false }
  | { id: string; merged: true; hidden?: false }
  | { id: string; merged: true; hidden: true }
  | { skipped: true; reason: "suppressed" | "do-not-contact" };

function cleanTags(tags: string[] | undefined) {
  const next = [...new Set((tags ?? []).map((tag) => tag.trim()).filter((tag) => tag.length > 0 && tag.length <= 40))];
  return next.slice(0, 20);
}

function noteText(input: BotLeadInput, created: boolean) {
  const lines: string[] = [];
  if (input.note?.trim()) lines.push(input.note.trim());
  if (input.website?.trim()) lines.push(`Website: ${input.website.trim()}`);
  if (input.profileUrl?.trim()) lines.push(`Profile: ${input.profileUrl.trim()}`);
  if (lines.length === 0 && created) lines.push("Created by the lead bot.");
  return lines.join("\n");
}

async function brokerageIdFor(name: string | null | undefined) {
  const trimmed = name?.trim();
  if (!trimmed) return null;
  const nameKey = brokerageNameKey(trimmed);
  if (!nameKey) return null;
  const existing = await prisma.brokerage.findUnique({ where: { nameKey }, select: { id: true } });
  if (existing) return existing.id;
  try {
    const created = await prisma.brokerage.create({ data: { name: trimmed, nameKey }, select: { id: true } });
    return created.id;
  } catch {
    const again = await prisma.brokerage.findUnique({ where: { nameKey }, select: { id: true } });
    return again?.id ?? null;
  }
}

async function sourceIdFor(name: string | null | undefined) {
  const trimmed = name?.trim() || DEFAULT_SOURCE;
  const existing = await prisma.leadSource.findUnique({ where: { name: trimmed }, select: { id: true } });
  if (existing) return existing.id;
  try {
    const created = await prisma.leadSource.create({ data: { name: trimmed }, select: { id: true } });
    return created.id;
  } catch {
    const again = await prisma.leadSource.findUnique({ where: { name: trimmed }, select: { id: true } });
    return again?.id ?? null;
  }
}

async function suppressed(emailNormalized: string | null) {
  if (!emailNormalized) return false;
  const row = await prisma.emailSuppression.findUnique({ where: { emailNormalized }, select: { id: true } });
  return Boolean(row);
}

type Match = { lead: Lead; hidden: boolean } | null;

async function findMatch(emailNormalized: string | null, phoneE164: string | null, externalRef: string | null): Promise<Match> {
  if (emailNormalized) {
    const lead = await prisma.lead.findUnique({ where: { emailNormalized } });
    if (lead) return { lead, hidden: Boolean(lead.deletedAt) };
  }
  if (phoneE164) {
    const active = await prisma.lead.findFirst({ where: { phoneE164, deletedAt: null }, orderBy: { createdAt: "asc" } });
    if (active) return { lead: active, hidden: false };
    const hidden = await prisma.lead.findFirst({ where: { phoneE164, deletedAt: { not: null } }, orderBy: { createdAt: "asc" } });
    if (hidden) return { lead: hidden, hidden: true };
  }
  if (externalRef) {
    const lead = await prisma.lead.findUnique({ where: { externalRef } });
    if (lead) return { lead, hidden: Boolean(lead.deletedAt) };
  }
  return null;
}

export async function saveBotLead(apiClientId: string, input: BotLeadInput): Promise<BotLeadResult> {
  const emailNormalized = normalizeEmail(input.email);
  const phoneE164 = normalizePhoneE164(input.phone);
  const externalRef = input.externalRef?.trim() || null;
  const match = await findMatch(emailNormalized, phoneE164, externalRef);
  const emailToCheck = emailNormalized ?? match?.lead.emailNormalized ?? null;
  if (await suppressed(emailToCheck)) return { skipped: true, reason: "suppressed" };
  if (match?.hidden) return { id: match.lead.id, merged: true, hidden: true };
  if (match && match.lead.status === "DO_NOT_CONTACT") return { skipped: true, reason: "do-not-contact" };

  const brokerageId = await brokerageIdFor(input.brokerage);
  const sourceId = await sourceIdFor(input.source);
  const tags = cleanTags(input.tags);

  if (match) {
    const lead = match.lead;
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        phone: lead.phone ?? (phoneE164 ? input.phone?.trim() ?? null : null),
        phoneE164: lead.phoneE164 ?? phoneE164,
        city: lead.city ?? input.city?.trim() ?? null,
        brokerageId: lead.brokerageId ?? brokerageId,
        sourceId: lead.sourceId ?? sourceId,
        externalRef: lead.externalRef ?? externalRef,
        tags: [...new Set([...lead.tags, ...tags])].slice(0, 30),
      },
    });
    const summary = noteText(input, false) || "Merged from the lead bot. Existing name, email, and status were kept.";
    await prisma.leadActivity.create({ data: { leadId: lead.id, type: "NOTE", summary } });
    await writeAudit({
      apiClientId,
      action: "bot.lead.merge",
      entityType: "Lead",
      entityId: lead.id,
      after: { email: lead.email },
    });
    return { id: lead.id, merged: true };
  }

  const lead = await prisma.lead.create({
    data: {
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email: emailNormalized,
      emailNormalized,
      phone: phoneE164 ? input.phone?.trim() ?? null : null,
      phoneE164,
      city: input.city?.trim() || null,
      brokerageId,
      sourceId,
      tags,
      externalRef,
    },
  });
  await prisma.leadActivity.create({ data: { leadId: lead.id, type: "NOTE", summary: noteText(input, true) } });
  await writeAudit({
    apiClientId,
    action: "bot.lead.create",
    entityType: "Lead",
    entityId: lead.id,
    after: { email: lead.email, externalRef },
  });
  return { id: lead.id, merged: false };
}

export async function addBotNote(apiClientId: string, leadId: string, summary: string) {
  const lead = await prisma.lead.findFirst({ where: { id: leadId, deletedAt: null } });
  if (!lead) return { error: "That realtor was not found." as const, status: 404 as const };
  const activity = await prisma.leadActivity.create({
    data: { leadId: lead.id, type: "NOTE", summary },
  });
  await writeAudit({
    apiClientId,
    action: "bot.note",
    entityType: "Lead",
    entityId: lead.id,
    after: { summary },
  });
  const flagged = lead.status === "DO_NOT_CONTACT";
  return { id: activity.id, draft: true as const, flagged, reason: flagged ? ("do-not-contact" as const) : undefined };
}

export type BotLeadView = {
  id: string;
  name: string;
  status: string;
  brokerage: string | null;
  tags: string[];
  lastContactedAt: string | null;
};

function toView(lead: { id: string; firstName: string | null; lastName: string | null; status: string; tags: string[]; lastContactedAt: Date | null; brokerage: { name: string } | null }): BotLeadView {
  return {
    id: lead.id,
    name: `${lead.firstName ?? ""} ${lead.lastName ?? ""}`.trim(),
    status: lead.status,
    brokerage: lead.brokerage?.name ?? null,
    tags: lead.tags,
    lastContactedAt: lead.lastContactedAt?.toISOString() ?? null,
  };
}

const viewInclude = { brokerage: { select: { name: true } } } as const;

export async function lookupBotLeads(query: { email?: string | null; phone?: string | null; externalRef?: string | null; q?: string | null }) {
  const emailNormalized = normalizeEmail(query.email);
  const phoneE164 = normalizePhoneE164(query.phone);
  const externalRef = query.externalRef?.trim() || null;
  const q = query.q?.trim() || null;
  if (!emailNormalized && !phoneE164 && !externalRef && !q) {
    return { error: "Search by email, phone, externalRef, or q." as const };
  }
  if (emailNormalized) {
    const lead = await prisma.lead.findFirst({ where: { emailNormalized, deletedAt: null }, include: viewInclude });
    return { leads: lead ? [toView(lead)] : [] };
  }
  if (phoneE164) {
    const leads = await prisma.lead.findMany({ where: { phoneE164, deletedAt: null }, include: viewInclude, take: SEARCH_CAP, orderBy: { updatedAt: "desc" } });
    return { leads: leads.map(toView) };
  }
  if (externalRef) {
    const lead = await prisma.lead.findFirst({ where: { externalRef, deletedAt: null }, include: viewInclude });
    return { leads: lead ? [toView(lead)] : [] };
  }
  const leads = await prisma.lead.findMany({
    where: {
      deletedAt: null,
      OR: [
        { firstName: { contains: q!, mode: "insensitive" } },
        { lastName: { contains: q!, mode: "insensitive" } },
        { brokerage: { name: { contains: q!, mode: "insensitive" } } },
      ],
    },
    include: viewInclude,
    take: SEARCH_CAP,
    orderBy: { updatedAt: "desc" },
  });
  return { leads: leads.map(toView) };
}
