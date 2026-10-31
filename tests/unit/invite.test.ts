import { describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "@/lib/password-hash";
import { ROLE_PERMISSIONS } from "@/lib/permissions";
import { claimDecision, galleryDestination, hashInviteToken, newInviteToken, portalNext } from "@/lib/invite";
import { ensureClientProfile } from "@/server/services/client-link";
import { claimListingInvite, createListingInvite } from "@/server/services/invites";

const openInvite = {
  expiresAt: Date.now() + 60_000,
  usedAt: null,
  clientId: "client-1",
  clientEmail: "realtor@example.com",
  clientUserId: null,
};

describe("invite rules", () => {
  it("keeps a portal gallery path and drops anything else", () => {
    expect(portalNext("/portal/galleries/abc", "/portal")).toBe("/portal/galleries/abc");
    expect(portalNext("https://evil.example/portal/galleries/abc", "/portal")).toBe("/portal");
    expect(portalNext("/portal/../admin", "/portal")).toBe("/portal");
    expect(galleryDestination("gallery1")).toBe("/portal/galleries/gallery1");
    expect(galleryDestination(null)).toBe("/portal/galleries");
  });

  it("claims only a matching unused invite", () => {
    const user = { id: "user-1", email: "realtor@example.com", clientId: null };
    expect(claimDecision({ now: Date.now(), invite: openInvite, user })).toEqual({ ok: true, already: false });
    expect(claimDecision({ now: Date.now(), invite: openInvite, user: { ...user, email: "other@example.com" } }).ok).toBe(false);
    expect(claimDecision({ now: Date.now(), invite: { ...openInvite, usedAt: Date.now() }, user }).ok).toBe(false);
    expect(claimDecision({ now: Date.now(), invite: { ...openInvite, expiresAt: Date.now() - 1 }, user }).ok).toBe(false);
    expect(claimDecision({ now: Date.now(), invite: { ...openInvite, clientUserId: "someone" }, user }).ok).toBe(false);
    expect(claimDecision({ now: Date.now(), invite: openInvite, user: { ...user, clientId: "other-client" } }).ok).toBe(false);
    const again = claimDecision({ now: Date.now(), invite: { ...openInvite, clientUserId: "user-1" }, user });
    expect(again.ok && again.already).toBe(true);
    const minted = newInviteToken();
    expect(minted.tokenHash).toBe(hashInviteToken(minted.token));
    expect(minted.tokenHash).not.toBe(minted.token);
  });
});

describe("invite claim", () => {
  it("does not attach an unverified email, then claims the existing client once", async () => {
    const prisma = new PrismaClient();
    const stamp = `invite-${Date.now()}`;
    const admin = await prisma.user.create({ data: { name: "Inviter", email: `${stamp}-admin@example.com`, role: "ADMIN", emailVerified: true } });
    const password = await hashPassword("Invite-Claim-2026!");
    const user = await prisma.user.create({ data: { name: "Riley Chen", email: `${stamp}@example.com`, role: "CLIENT", emailVerified: false } });
    await prisma.account.create({
      data: { accountId: user.id, providerId: "credential", userId: user.id, password },
    });
    const client = await prisma.client.create({
      data: { firstName: "Riley", lastName: "Chen", email: `${stamp}@example.com` },
    });
    const property = await prisma.property.create({
      data: { clientId: client.id, addressLine1: `${stamp} Invite Lane`, city: "Orlando", zip: "32801", propertyType: "SINGLE_FAMILY" },
    });
    const actor = {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: "ADMIN" as const,
      clientId: null,
      permissions: new Set(ROLE_PERMISSIONS.ADMIN),
    };
    try {
      const untouched = await ensureClientProfile({ id: user.id, email: user.email, name: user.name, emailVerified: false });
      expect(untouched).toBeNull();
      expect(await prisma.client.count({ where: { email: user.email } })).toBe(1);
      expect((await prisma.client.findUnique({ where: { id: client.id } }))?.userId).toBeNull();

      const created = await createListingInvite(actor, property.id);
      expect(created).toHaveProperty("url");
      if (!("url" in created) || !created.url) throw new Error("invite was not created");
      const token = new URL(created.url).searchParams.get("token") ?? "";
      const wrong = await claimListingInvite({
        token,
        user: { id: user.id, email: "other@example.com", clientId: null },
      });
      expect(wrong).toMatchObject({ error: "Use the email this listing was created for." });
      expect(await prisma.listingInvite.count({ where: { propertyId: property.id, usedAt: null } })).toBe(1);

      const claimed = await claimListingInvite({ token, user: { id: user.id, email: user.email, clientId: null } });
      expect(claimed).toMatchObject({ ok: true, already: false });
      expect((await prisma.client.findUnique({ where: { id: client.id } }))?.userId).toBe(user.id);
      expect((await prisma.user.findUnique({ where: { id: user.id } }))?.emailVerified).toBe(true);
      expect(await prisma.client.count({ where: { email: user.email } })).toBe(1);
      const again = await claimListingInvite({ token, user: { id: user.id, email: user.email, clientId: client.id } });
      expect(again).toMatchObject({ error: "This invite link was already used." });

      const fresh = await prisma.user.create({ data: { name: "New Person", email: `${stamp}-new@example.com`, role: "CLIENT", emailVerified: false } });
      await ensureClientProfile({ id: fresh.id, email: fresh.email, name: fresh.name, emailVerified: false });
      await ensureClientProfile({ id: fresh.id, email: fresh.email, name: fresh.name, emailVerified: false });
      expect(await prisma.client.count({ where: { email: fresh.email } })).toBe(1);
      await prisma.client.deleteMany({ where: { userId: fresh.id } });
      await prisma.user.delete({ where: { id: fresh.id } });
    } finally {
      await prisma.listingInvite.deleteMany({ where: { propertyId: property.id } });
      await prisma.auditLog.deleteMany({ where: { actorId: { in: [admin.id, user.id] } } });
      await prisma.property.delete({ where: { id: property.id } });
      await prisma.client.deleteMany({ where: { email: { in: [user.email, `${stamp}-new@example.com`] } } });
      await prisma.account.deleteMany({ where: { userId: user.id } });
      await prisma.user.deleteMany({ where: { id: { in: [user.id, admin.id] } } });
      await prisma.$disconnect();
    }
  });
});
