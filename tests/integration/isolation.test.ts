import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import type { Actor } from "@/lib/actor";
import { applyOverrides, ROLE_PERMISSIONS } from "@/lib/permissions";
import { clientScope } from "@/server/db/scoped";
import { createLead } from "@/server/services/leads";

const prisma = new PrismaClient();

async function reset() {
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE "user" CASCADE`);
}

async function user(email: string, role: "ADMIN" | "STAFF" | "CLIENT") {
  return prisma.user.create({
    data: { email, name: email, role, emailVerified: true },
  });
}

beforeEach(reset);
afterAll(async () => {
  await prisma.$disconnect();
});

describe("client isolation", () => {
  it("does not return another client's order, invoice, gallery, or property", async () => {
    const userA = await user("a@example.com", "CLIENT");
    const userB = await user("b@example.com", "CLIENT");
    const clientA = await prisma.client.create({
      data: { userId: userA.id, firstName: "A", lastName: "Client", email: userA.email },
    });
    const clientB = await prisma.client.create({
      data: { userId: userB.id, firstName: "B", lastName: "Client", email: userB.email, allowUnpaidDownloads: true },
    });
    const propertyA = await prisma.property.create({
      data: { clientId: clientA.id, addressLine1: "1 A St", city: "Orlando", zip: "32801", propertyType: "CONDO" },
    });
    const propertyB = await prisma.property.create({
      data: { clientId: clientB.id, addressLine1: "2 B St", city: "Orlando", zip: "32803", propertyType: "CONDO" },
    });
    const orderB = await prisma.order.create({
      data: { clientId: clientB.id, propertyId: propertyB.id, status: "REQUESTED", totalCents: 12000 },
    });
    await prisma.invoice.create({
      data: { number: "INV-B", clientId: clientB.id, orderId: orderB.id, subtotalCents: 12000, totalCents: 12000, status: "OPEN" },
    });
    const galleryB = await prisma.gallery.create({
      data: {
        orderId: orderB.id,
        clientId: clientB.id,
        propertyId: propertyB.id,
        title: "B",
        status: "PUBLISHED",
        requirePaid: true,
      },
    });

    const actorA: Actor = {
      id: userA.id,
      email: userA.email,
      name: userA.name,
      role: "CLIENT",
      clientId: clientA.id,
      permissions: applyOverrides(ROLE_PERMISSIONS.CLIENT, []),
    };
    const scope = clientScope(actorA);
    expect(await scope.orders.get(orderB.id)).toBeNull();
    expect(await scope.invoices.list()).toEqual([]);
    expect(await scope.galleries.get(galleryB.id)).toBeNull();
    expect(await scope.properties.get(propertyB.id)).toBeNull();
    expect((await scope.orders.updateInstructions(orderB.id, "changed")).count).toBe(0);
    const unchanged = await prisma.order.findUnique({ where: { id: orderB.id } });
    expect(unchanged?.instructions).toBeNull();
    expect("leads" in scope).toBe(false);
    expect(propertyA.clientId).toBe(clientA.id);
  });
});

describe("lead authorization", () => {
  it("writes an activity and audit row, and refuses a duplicate email", async () => {
    const staff = await user("staff@example.com", "STAFF");
    const actor: Actor = {
      id: staff.id,
      email: staff.email,
      name: staff.name,
      role: "STAFF",
      clientId: null,
      permissions: applyOverrides(ROLE_PERMISSIONS.STAFF, []),
    };
    const input = {
      firstName: "Maya",
      lastName: "Ellison",
      email: "Maya@Example.com",
      phone: "3215550198",
      brokerageId: "",
      sourceId: "",
      status: "NEW" as const,
      city: "Orlando",
      nextFollowUpAt: "",
      tags: "lakefront",
    };
    const created = await createLead(actor, input);
    expect("id" in created).toBe(true);
    if (!("id" in created)) return;
    const again = await createLead(actor, input);
    expect(again).toEqual({ duplicateOf: created.id });
    const activities = await prisma.leadActivity.findMany({ where: { leadId: created.id } });
    const audits = await prisma.auditLog.findMany({ where: { entityId: created.id, action: "lead.create" } });
    expect(activities).toHaveLength(1);
    expect(audits).toHaveLength(1);
    const saved = await prisma.lead.findUnique({ where: { id: created.id } });
    expect(saved?.emailNormalized).toBe("maya@example.com");
  });

  it("rejects a client actor", async () => {
    const client = await user("client@example.com", "CLIENT");
    const actor: Actor = {
      id: client.id,
      email: client.email,
      name: client.name,
      role: "CLIENT",
      clientId: null,
      permissions: applyOverrides(ROLE_PERMISSIONS.CLIENT, []),
    };
    await expect(
      createLead(actor, {
        firstName: "No",
        lastName: "Access",
        email: "no.access@example.com",
        phone: "",
        brokerageId: "",
        sourceId: "",
        status: "NEW",
        city: "",
        nextFollowUpAt: "",
        tags: "",
      }),
    ).rejects.toThrow(/Forbidden/);
  });
});
