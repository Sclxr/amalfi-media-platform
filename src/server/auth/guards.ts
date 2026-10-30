import "server-only";
import { headers } from "next/headers";
import { auth } from "@/server/auth/auth";
import { prisma } from "@/server/db/prisma";
import type { Actor } from "@/lib/actor";
import {
  applyOverrides,
  can,
  parseRole,
  ROLE_PERMISSIONS,
  type Permission,
} from "@/lib/permissions";

export class AuthError extends Error {
  constructor(public readonly code: "UNAUTHENTICATED" | "FORBIDDEN") {
    super(code);
  }
}

export async function getActor(): Promise<Actor | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      client: { select: { id: true } },
      permissions: true,
    },
  });
  if (!user || user.disabledAt) return null;
  const role = parseRole(user.role);
  const stored = await prisma.rolePermission.findMany({ where: { role } });
  const base = stored.length > 0 ? stored.map((row) => row.permissionKey) : ROLE_PERMISSIONS[role];
  const permissions = applyOverrides(
    base,
    user.permissions.map((row) => ({ key: row.permissionKey, granted: row.granted })),
  );
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role,
    clientId: user.client?.id ?? null,
    permissions,
  };
}

export async function requireActor(): Promise<Actor> {
  const actor = await getActor();
  if (!actor) throw new AuthError("UNAUTHENTICATED");
  return actor;
}

export async function requireStaff(): Promise<Actor> {
  const actor = await requireActor();
  if (actor.role !== "ADMIN" && actor.role !== "STAFF") throw new AuthError("FORBIDDEN");
  return actor;
}

export async function requirePermission(permission: Permission): Promise<Actor> {
  const actor = await requireStaff();
  if (!can(actor, permission)) throw new AuthError("FORBIDDEN");
  return actor;
}
