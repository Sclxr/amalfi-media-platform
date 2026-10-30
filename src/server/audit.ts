import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function writeAudit(entry: {
  actorId?: string | null;
  apiClientId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  userAgent?: string | null;
}) {
  await prisma.auditLog.create({
    data: {
      actorId: entry.actorId || null,
      apiClientId: entry.apiClientId || null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      before: toJson(entry.before),
      after: toJson(entry.after),
      ip: entry.ip ?? null,
      userAgent: entry.userAgent ?? null,
    },
  });
}
