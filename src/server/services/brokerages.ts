import "server-only";
import type { Actor } from "@/lib/actor";
import { can } from "@/lib/permissions";
import { brokerageNameKey, type BrokerageFormValues } from "@/schemas/brokerage";
import { prisma } from "@/server/db/prisma";

function emptyToNull(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

export async function listBrokerages(actor: Actor, q?: string) {
  if (!can(actor, "crm.read")) throw new Error("Forbidden");
  return prisma.brokerage.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { city: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    include: { _count: { select: { leads: true, clients: true } } },
    orderBy: { name: "asc" },
  });
}

export async function getBrokerage(actor: Actor, id: string) {
  if (!can(actor, "crm.read")) throw new Error("Forbidden");
  return prisma.brokerage.findUnique({
    where: { id },
    include: {
      leads: { where: { deletedAt: null }, orderBy: { updatedAt: "desc" } },
    },
  });
}

export async function createBrokerage(actor: Actor, input: BrokerageFormValues) {
  if (!can(actor, "crm.write")) throw new Error("Forbidden");
  const nameKey = brokerageNameKey(input.name);
  const existing = await prisma.brokerage.findUnique({ where: { nameKey } });
  if (existing) return { duplicateOf: existing.id };
  const created = await prisma.$transaction(async (tx) => {
    const brokerage = await tx.brokerage.create({
      data: {
        name: input.name.trim(),
        nameKey,
        phone: emptyToNull(input.phone),
        website: emptyToNull(input.website),
        address: emptyToNull(input.address),
        city: emptyToNull(input.city),
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "brokerage.create",
        entityType: "Brokerage",
        entityId: brokerage.id,
        after: { name: brokerage.name },
      },
    });
    return brokerage;
  });
  return { id: created.id };
}

export async function updateBrokerage(actor: Actor, id: string, input: BrokerageFormValues) {
  if (!can(actor, "crm.write")) throw new Error("Forbidden");
  const current = await prisma.brokerage.findUnique({ where: { id } });
  if (!current) return { error: "That brokerage was not found." as const };
  const nameKey = brokerageNameKey(input.name);
  if (nameKey !== current.nameKey) {
    const existing = await prisma.brokerage.findUnique({ where: { nameKey } });
    if (existing) return { duplicateOf: existing.id };
  }
  await prisma.$transaction(async (tx) => {
    await tx.brokerage.update({
      where: { id },
      data: {
        name: input.name.trim(),
        nameKey,
        phone: emptyToNull(input.phone),
        website: emptyToNull(input.website),
        address: emptyToNull(input.address),
        city: emptyToNull(input.city),
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "brokerage.update",
        entityType: "Brokerage",
        entityId: id,
        before: { name: current.name },
        after: { name: input.name.trim() },
      },
    });
  });
  return { id };
}
