import "server-only";
import type { LeadStatus } from "@prisma/client";
import type { Actor } from "@/lib/actor";
import { dateInputToUtc } from "@/lib/dates";
import { normalizeEmail } from "@/lib/email";
import { can } from "@/lib/permissions";
import { normalizePhoneE164 } from "@/lib/phone";
import { LEAD_STATUSES, type LeadFormValues } from "@/schemas/lead";
import { prisma } from "@/server/db/prisma";

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function leadData(input: LeadFormValues) {
  const tags = (input.tags ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  return {
    firstName: input.firstName,
    lastName: input.lastName,
    email: normalizeEmail(input.email),
    emailNormalized: normalizeEmail(input.email),
    phone: emptyToNull(input.phone),
    phoneE164: normalizePhoneE164(input.phone),
    city: emptyToNull(input.city),
    status: input.status,
    tags,
    nextFollowUpAt: dateInputToUtc(emptyToNull(input.nextFollowUpAt)),
    brokerageId: emptyToNull(input.brokerageId),
    sourceId: emptyToNull(input.sourceId),
  };
}

function isLeadStatus(value: string | undefined): value is LeadStatus {
  return !!value && (LEAD_STATUSES as readonly string[]).includes(value);
}

export async function listLeads(actor: Actor, query: { q?: string; status?: string; brokerageId?: string }) {
  if (!can(actor, "crm.read")) throw new Error("Forbidden");
  const q = query.q?.trim();
  return prisma.lead.findMany({
    where: {
      deletedAt: null,
      status: isLeadStatus(query.status) ? query.status : undefined,
      brokerageId: query.brokerageId || undefined,
      OR: q
        ? [
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
            { city: { contains: q, mode: "insensitive" } },
          ]
        : undefined,
    },
    include: { brokerage: true, source: true, owner: true },
    orderBy: [{ updatedAt: "desc" }],
  });
}

export async function getLead(actor: Actor, id: string) {
  if (!can(actor, "crm.read")) throw new Error("Forbidden");
  return prisma.lead.findFirst({
    where: { id },
    include: {
      brokerage: true,
      source: true,
      owner: true,
      activities: { orderBy: { createdAt: "desc" }, include: { actor: true } },
    },
  });
}

export async function createLead(actor: Actor, input: LeadFormValues) {
  if (!can(actor, "crm.write")) throw new Error("Forbidden");
  const emailNormalized = normalizeEmail(input.email);
  if (emailNormalized) {
    const existing = await prisma.lead.findUnique({ where: { emailNormalized } });
    if (existing) return { duplicateOf: existing.id };
  }
  const data = leadData(input);
  const lead = await prisma.$transaction(async (tx) => {
    const created = await tx.lead.create({
      data: {
        ...data,
        ownerId: actor.id,
      },
    });
    await tx.leadActivity.create({
      data: {
        leadId: created.id,
        actorId: actor.id,
        type: "NOTE",
        summary: "Realtor created",
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "lead.create",
        entityType: "Lead",
        entityId: created.id,
        after: { email: created.email, status: created.status },
      },
    });
    return created;
  });
  return { id: lead.id };
}

export async function updateLead(actor: Actor, id: string, input: LeadFormValues) {
  if (!can(actor, "crm.write")) throw new Error("Forbidden");
  const current = await prisma.lead.findUnique({ where: { id } });
  if (!current) return { error: "That realtor was not found." as const };
  const emailNormalized = normalizeEmail(input.email);
  if (emailNormalized && emailNormalized !== current.emailNormalized) {
    const existing = await prisma.lead.findUnique({ where: { emailNormalized } });
    if (existing) return { duplicateOf: existing.id };
  }
  const statusChanged = current.status !== input.status;
  await prisma.$transaction(async (tx) => {
    await tx.lead.update({ where: { id }, data: leadData(input) });
    if (statusChanged) {
      await tx.leadActivity.create({
        data: {
          leadId: id,
          actorId: actor.id,
          type: "STATUS_CHANGE",
          summary: `Status changed from ${current.status} to ${input.status}`,
          data: { from: current.status, to: input.status },
        },
      });
    }
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "lead.update",
        entityType: "Lead",
        entityId: id,
        before: { status: current.status, email: current.email },
        after: { status: input.status, email: emailNormalized },
      },
    });
  });
  return { id };
}

export async function addLeadNote(actor: Actor, id: string, summary: string) {
  if (!can(actor, "crm.write")) throw new Error("Forbidden");
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) return { error: "That realtor was not found." as const };
  await prisma.$transaction(async (tx) => {
    await tx.leadActivity.create({
      data: { leadId: id, actorId: actor.id, type: "NOTE", summary },
    });
    await tx.lead.update({
      where: { id },
      data: { lastContactedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "lead.note",
        entityType: "Lead",
        entityId: id,
        after: { summary },
      },
    });
  });
  return { id };
}
