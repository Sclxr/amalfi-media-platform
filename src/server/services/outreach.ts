import "server-only";
import type { ActivityType } from "@prisma/client";
import type { Actor } from "@/lib/actor";
import { can } from "@/lib/permissions";
import { prisma } from "@/server/db/prisma";
import { writeAudit } from "@/server/audit";

const ACTIVITY_TYPES = ["NOTE", "CALL", "EMAIL_SENT", "EMAIL_RECEIVED", "MEETING"] as const;

export async function listFollowUpQueue(actor: Actor) {
  if (!can(actor, "crm.read")) throw new Error("Forbidden");
  const horizon = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const [leads, tasks] = await Promise.all([
    prisma.lead.findMany({
      where: {
        deletedAt: null,
        nextFollowUpAt: { lte: horizon },
        status: { notIn: ["DO_NOT_CONTACT", "LOST", "CONVERTED"] },
      },
      include: { brokerage: true, owner: true },
      orderBy: { nextFollowUpAt: "asc" },
    }),
    prisma.reminder.findMany({
      where: { completedAt: null },
      include: { lead: true, user: true },
      orderBy: { dueAt: "asc" },
    }),
  ]);
  return { leads, tasks };
}

export async function logLeadActivity(
  actor: Actor,
  leadId: string,
  input: { type: string; summary: string },
) {
  if (!can(actor, "crm.write")) throw new Error("Forbidden");
  const lead = await prisma.lead.findFirst({ where: { id: leadId, deletedAt: null } });
  if (!lead) return { error: "That realtor was not found." as const };
  const type = (ACTIVITY_TYPES as readonly string[]).includes(input.type) ? (input.type as ActivityType) : "NOTE";
  await prisma.leadActivity.create({
    data: { leadId, actorId: actor.id, type, summary: input.summary.trim() },
  });
  if (type === "CALL" || type === "EMAIL_SENT" || type === "MEETING") {
    await prisma.lead.update({ where: { id: leadId }, data: { lastContactedAt: new Date() } });
  }
  await writeAudit({
    actorId: actor.id,
    action: "lead.activity",
    entityType: "Lead",
    entityId: leadId,
    after: { type, summary: input.summary.trim() },
  });
  return { ok: true as const };
}

export async function createTask(actor: Actor, input: { leadId?: string | null; dueAt: Date; note: string }) {
  if (!can(actor, "crm.write")) throw new Error("Forbidden");
  const task = await prisma.reminder.create({
    data: {
      userId: actor.id,
      leadId: input.leadId || null,
      dueAt: input.dueAt,
      note: input.note.trim(),
    },
  });
  await writeAudit({
    actorId: actor.id,
    action: "task.create",
    entityType: "Reminder",
    entityId: task.id,
    after: { note: task.note, dueAt: task.dueAt.toISOString() },
  });
  return task;
}

export async function completeTask(actor: Actor, id: string) {
  if (!can(actor, "crm.write")) throw new Error("Forbidden");
  const task = await prisma.reminder.findUnique({ where: { id } });
  if (!task) return { error: "That task was not found." as const };
  await prisma.reminder.update({ where: { id }, data: { completedAt: new Date() } });
  await writeAudit({
    actorId: actor.id,
    action: "task.complete",
    entityType: "Reminder",
    entityId: id,
  });
  return { ok: true as const };
}
