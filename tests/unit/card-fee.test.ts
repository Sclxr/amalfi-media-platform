import { describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { cardFeeFromEnv, cardProcessingQuote } from "@/lib/card-fee";
import { galleryDownloadDecision } from "@/lib/gallery-access";
import { ROLE_PERMISSIONS } from "@/lib/permissions";
import { markZellePaid, reverseZellePayment } from "@/server/services/billing";
import type { Actor } from "@/lib/actor";

describe("card processing fee", () => {
  it("grosses up $120 at 2.9% plus 30 cents to $123.89", () => {
    expect(cardProcessingQuote({ priceCents: 12_000, percentBps: 290, fixedCents: 30 })).toEqual({
      totalCents: 12_389,
      feeCents: 389,
    });
    expect(cardProcessingQuote({ priceCents: 0, percentBps: 290, fixedCents: 30 })).toEqual({ totalCents: 0, feeCents: 0 });
    expect(cardProcessingQuote({ priceCents: 12_000, percentBps: 0, fixedCents: 0 })).toEqual({ totalCents: 12_000, feeCents: 0 });
    expect(cardFeeFromEnv({ percent: "2.9", fixedCents: "30" })).toEqual({ percentBps: 290, fixedCents: 30 });
  });
});

describe("Zelle mark paid", () => {
  it("lets an admin unlock downloads and refuses everyone else", async () => {
    const prisma = new PrismaClient();
    const stamp = `zelle-${Date.now()}`;
    const admin = await prisma.user.create({ data: { name: "Admin", email: `${stamp}-admin@example.com`, role: "ADMIN", emailVerified: true } });
    const staff = await prisma.user.create({ data: { name: "Staff", email: `${stamp}-staff@example.com`, role: "STAFF", emailVerified: true } });
    const client = await prisma.client.create({ data: { firstName: "Riley", lastName: "Cole", email: `${stamp}@example.com` } });
    const property = await prisma.property.create({
      data: { clientId: client.id, addressLine1: `${stamp} Zelle Lane`, city: "Orlando", zip: "32801", propertyType: "SINGLE_FAMILY" },
    });
    const order = await prisma.order.create({
      data: { clientId: client.id, propertyId: property.id, status: "DELIVERED", totalCents: 12000, subtotalCents: 12000, collection: "AWAITING_ZELLE" },
    });
    const invoice = await prisma.invoice.create({
      data: { number: `INV-ZELLE-${stamp}`, clientId: client.id, orderId: order.id, status: "OPEN", subtotalCents: 12000, totalCents: 12000 },
    });
    const adminActor: Actor = { id: admin.id, email: admin.email, name: admin.name, role: "ADMIN", clientId: null, permissions: new Set(ROLE_PERMISSIONS.ADMIN) };
    const staffActor: Actor = { id: staff.id, email: staff.email, name: staff.name, role: "STAFF", clientId: null, permissions: new Set(ROLE_PERMISSIONS.STAFF) };
    try {
      await expect(markZellePaid(staffActor, invoice.id, 12000, "nope")).rejects.toThrow(/Forbidden/);
      expect(await prisma.invoice.findUnique({ where: { id: invoice.id } })).toMatchObject({ status: "OPEN" });
      const recorded = await markZellePaid(adminActor, invoice.id, 12000, "text received");
      expect(recorded).toEqual({ ok: true });
      const paid = await prisma.invoice.findUnique({ where: { id: invoice.id }, include: { payments: true } });
      expect(paid?.status).toBe("PAID");
      expect(paid?.payments).toMatchObject([{ method: "zelle", amountCents: 12000, baseCents: 12000, feeCents: 0, createdById: admin.id }]);
      expect(await prisma.order.findUnique({ where: { id: order.id } })).toMatchObject({ collection: "PAID" });
      expect(galleryDownloadDecision({ requirePaid: true, allowUnpaidDownloads: false, invoiceStatus: "PAID" }).allowed).toBe(true);
      const audit = await prisma.auditLog.findFirst({ where: { entityId: invoice.id, action: "payment.zelle" } });
      expect(audit?.actorId).toBe(admin.id);

      await expect(reverseZellePayment(staffActor, invoice.id, "no")).rejects.toThrow(/Forbidden/);
      expect(await reverseZellePayment(adminActor, invoice.id, "sent back")).toEqual({ ok: true });
      expect(await prisma.invoice.findUnique({ where: { id: invoice.id } })).toMatchObject({ status: "OPEN", amountPaidCents: 0 });
      expect(galleryDownloadDecision({ requirePaid: true, allowUnpaidDownloads: false, invoiceStatus: "OPEN" }).allowed).toBe(false);
      const card = await prisma.payment.create({
        data: { invoiceId: invoice.id, status: "SUCCEEDED", amountCents: 12389, baseCents: 12000, feeCents: 389, method: "card", stripeChargeId: `ch_${stamp}` },
      });
      await prisma.invoice.update({ where: { id: invoice.id }, data: { status: "PAID", amountPaidCents: 12000 } });
      expect(await reverseZellePayment(adminActor, invoice.id, "try card")).toMatchObject({ error: "A card payment has to be refunded in Stripe." });
      expect((await prisma.payment.findUnique({ where: { id: card.id } }))?.status).toBe("SUCCEEDED");
    } finally {
      await prisma.refund.deleteMany({ where: { payment: { invoiceId: invoice.id } } });
      await prisma.payment.deleteMany({ where: { invoiceId: invoice.id } });
      await prisma.auditLog.deleteMany({ where: { entityId: { in: [invoice.id, order.id] } } });
      await prisma.invoice.delete({ where: { id: invoice.id } });
      await prisma.order.delete({ where: { id: order.id } });
      await prisma.property.delete({ where: { id: property.id } });
      await prisma.client.delete({ where: { id: client.id } });
      await prisma.user.deleteMany({ where: { id: { in: [admin.id, staff.id] } } });
      await prisma.$disconnect();
    }
  });
});
