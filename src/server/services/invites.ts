import "server-only";
import type { Actor } from "@/lib/actor";
import { normalizeEmail } from "@/lib/email";
import { claimDecision, galleryDestination, hashInviteToken, INVITE_TTL_MS, newInviteToken } from "@/lib/invite";
import { can } from "@/lib/permissions";
import { verifyPassword } from "@/lib/password-hash";
import { prisma } from "@/server/db/prisma";
import { getEnv } from "@/server/env";
import { writeAudit } from "@/server/audit";

export async function createListingInvite(actor: Actor, propertyId: string) {
  if (!can(actor, "orders.write") && !can(actor, "media.write")) throw new Error("Forbidden");
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    include: { client: true },
  });
  if (!property) return { error: "That listing was not found." as const };
  if (!normalizeEmail(property.client.email)) return { error: "This listing's client needs an email before an invite." as const };
  const { token, tokenHash } = newInviteToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  await prisma.$transaction(async (tx) => {
    await tx.listingInvite.updateMany({
      where: { propertyId: property.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { expiresAt: new Date() },
    });
    await tx.listingInvite.create({
      data: {
        clientId: property.clientId,
        propertyId: property.id,
        tokenHash,
        expiresAt,
        createdById: actor.id,
      },
    });
  });
  await writeAudit({
    actorId: actor.id,
    action: "invite.create",
    entityType: "Property",
    entityId: property.id,
    after: { expiresAt: expiresAt.toISOString() },
  });
  const origin = getEnv().APP_URL.replace(/\/$/, "");
  return { url: `${origin}/portal/invite?token=${encodeURIComponent(token)}`, expiresAt: expiresAt.toISOString() };
}

export async function readInvite(token: string) {
  const tokenHash = hashInviteToken(token);
  const invite = await prisma.listingInvite.findUnique({
    where: { tokenHash },
    include: {
      client: true,
      property: true,
    },
  });
  if (!invite || invite.usedAt || invite.expiresAt.getTime() <= Date.now()) return null;
  const gallery = await prisma.gallery.findFirst({
    where: {
      propertyId: invite.propertyId,
      clientId: invite.clientId,
      status: "PUBLISHED",
      property: { archivedAt: null },
      order: { archivedAt: null },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  return {
    address: invite.property.addressLine1,
    clientName: `${invite.client.firstName} ${invite.client.lastName}`.trim(),
    next: galleryDestination(gallery?.id),
  };
}

export async function claimListingInvite(input: {
  token: string;
  user: { id: string; email: string; clientId: string | null } | null;
}) {
  const tokenHash = hashInviteToken(input.token.trim());
  const invite = await prisma.listingInvite.findUnique({
    where: { tokenHash },
    include: { client: true },
  });
  const decision = claimDecision({
    now: Date.now(),
    invite: invite
      ? {
          expiresAt: invite.expiresAt.getTime(),
          usedAt: invite.usedAt?.getTime() ?? null,
          clientId: invite.clientId,
          clientEmail: invite.client.email,
          clientUserId: invite.client.userId,
        }
      : null,
    user: input.user,
  });
  const user = input.user;
  if (!invite || !decision.ok || !user) return { error: decision.ok ? "This invite link is invalid or expired." : decision.error };
  const gallery = await prisma.gallery.findFirst({
    where: {
      propertyId: invite.propertyId,
      clientId: invite.clientId,
      status: "PUBLISHED",
      property: { archivedAt: null },
      order: { archivedAt: null },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  const next = galleryDestination(gallery?.id);
  if (!decision.already) {
    try {
      await prisma.$transaction(async (tx) => {
        const claimed = await tx.client.updateMany({
          where: { id: invite.clientId, OR: [{ userId: null }, { userId: user.id }] },
          data: { userId: user.id },
        });
        if (claimed.count !== 1) throw new Error("claimed");
        await tx.user.update({ where: { id: user.id }, data: { emailVerified: true } });
        await tx.listingInvite.update({ where: { id: invite.id }, data: { usedAt: new Date() } });
      });
    } catch (error) {
      if (error instanceof Error && error.message === "claimed") return { error: "This listing is already claimed." as const };
      throw error;
    }
  } else {
    await prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });
    await prisma.listingInvite.update({ where: { id: invite.id }, data: { usedAt: new Date() } });
  }
  await writeAudit({
    actorId: user.id,
    action: "invite.claim",
    entityType: "Client",
    entityId: invite.clientId,
    after: { propertyId: invite.propertyId, already: decision.already },
  });
  return { ok: true as const, already: decision.already, next };
}

export async function userForInvitePassword(email: string, password: string) {
  const normalized = normalizeEmail(email);
  if (!normalized || !password) return null;
  const user = await prisma.user.findUnique({
    where: { email: normalized },
    include: { accounts: true, client: { select: { id: true } } },
  });
  const account = user?.accounts.find((item) => item.providerId === "credential" && item.password);
  if (!user || !account?.password) return null;
  const matches = await verifyPassword(account.password, password);
  if (!matches) return null;
  return { id: user.id, email: user.email, clientId: user.client?.id ?? null };
}
