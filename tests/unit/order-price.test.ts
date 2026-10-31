import { describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { ROLE_PERMISSIONS } from "@/lib/permissions";
import { orderPriceLock, orderPriceTotals, parsePriceRows } from "@/lib/order-price";
import { createInvoiceForOrder } from "@/server/services/billing";
import { setOrderPrice } from "@/server/services/orders";

describe("order price", () => {
  it("adds travel, subtracts a discount, and stays at zero", () => {
    expect(orderPriceTotals({ lines: [{ quantity: 1, unitPriceCents: 12000 }], travelFeeCents: 2500, discountCents: 500 })).toEqual({
      subtotalCents: 12000,
      totalCents: 14000,
    });
    expect(orderPriceTotals({ lines: [{ quantity: 2, unitPriceCents: 1000 }], travelFeeCents: 0, discountCents: 5000 })).toEqual({
      subtotalCents: 2000,
      totalCents: 0,
    });
  });

  it("parses line items and skips blank rows", () => {
    const parsed = parsePriceRows([
      { label: "Photos", quantity: "1", amount: "100.00" },
      { label: "", quantity: "", amount: "" },
      { label: "Drone", quantity: "", amount: "$40" },
    ]);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.lines).toEqual([
        { label: "Photos", quantity: 1, unitPriceCents: 10000 },
        { label: "Drone", quantity: 1, unitPriceCents: 4000 },
      ]);
    }
    expect(parsePriceRows([{ label: "", quantity: "", amount: "10" }]).ok).toBe(false);
    expect(parsePriceRows([{ label: "", quantity: "", amount: "" }]).ok).toBe(false);
  });

  it("locks a paid order and an open invoice", () => {
    const empty = { amountPaidCents: 0, amountRefundedCents: 0, payments: [] as { status: string }[] };
    expect(orderPriceLock([])).toBeNull();
    expect(orderPriceLock([{ ...empty, status: "VOID" }])).toBeNull();
    expect(orderPriceLock([{ ...empty, status: "OPEN" }])).toBe("Void the open invoice before changing the price.");
    expect(orderPriceLock([{ ...empty, status: "PAID", amountPaidCents: 12000 }])).toBe("This order already has a recorded payment.");
  });
});

describe("listing order price", () => {
  it("prices a package, a custom amount, and line items, then invoices once", async () => {
    const prisma = new PrismaClient();
    const stamp = `price-${Date.now()}`;
    const user = await prisma.user.create({ data: { name: "Pricer", email: `${stamp}@example.com`, role: "ADMIN" } });
    const actor = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: "ADMIN" as const,
      clientId: null,
      permissions: new Set(ROLE_PERMISSIONS.ADMIN),
    };
    const client = await prisma.client.create({ data: { firstName: "Price", lastName: "Test", email: `${stamp}-client@example.com` } });
    const property = await prisma.property.create({
      data: { clientId: client.id, addressLine1: `${stamp} Price St`, city: "Orlando", zip: "32801", propertyType: "SINGLE_FAMILY" },
    });
    const pkg = await prisma.package.create({
      data: { name: "Introductory photography", slug: stamp, priceCents: 12000, durationMin: 60, active: true },
    });
    const order = await prisma.order.create({
      data: { clientId: client.id, propertyId: property.id, status: "REQUESTED", travelFeeCents: 2500, discountCents: 500 },
    });
    try {
      await expect(setOrderPrice({ ...actor, permissions: new Set() }, property.id, order.id, { mode: "custom", label: "Nope", amount: "1" })).rejects.toThrow(/Forbidden/);

      const packaged = await setOrderPrice(actor, property.id, order.id, { mode: "package", packageId: pkg.id });
      expect(packaged).toMatchObject({ ok: true, totalCents: 14000 });
      const packageItem = await prisma.orderItem.findFirst({ where: { orderId: order.id } });
      expect(packageItem?.packageId).toBe(pkg.id);
      expect(packageItem?.unitPriceCents).toBe(12000);

      const custom = await setOrderPrice(actor, property.id, order.id, { mode: "custom", label: "Twilight shoot", amount: "80.00" });
      expect(custom).toMatchObject({ ok: true, totalCents: 10000 });
      const customItems = await prisma.orderItem.findMany({ where: { orderId: order.id } });
      expect(customItems).toHaveLength(1);
      expect(customItems[0]?.packageId).toBeNull();

      const lines = await setOrderPrice(actor, property.id, order.id, {
        mode: "lines",
        rows: [
          { label: "Photos", quantity: "1", amount: "100" },
          { label: "Drone", quantity: "2", amount: "40" },
        ],
      });
      expect(lines).toMatchObject({ ok: true, totalCents: 10000 + 8000 + 2500 - 500 });
      expect(await prisma.orderItem.count({ where: { orderId: order.id } })).toBe(2);

      const created = await createInvoiceForOrder(actor, order.id);
      expect(created).toHaveProperty("id");
      const again = await createInvoiceForOrder(actor, order.id);
      expect(again).toMatchObject({ error: "This order already has an invoice. Void it before creating another." });
      const blocked = await setOrderPrice(actor, property.id, order.id, { mode: "custom", label: "Late", amount: "1" });
      expect(blocked).toMatchObject({ error: "Void the open invoice before changing the price." });

      if ("id" in created && created.id) {
        await prisma.invoice.update({ where: { id: created.id }, data: { status: "VOID" } });
      }
      const afterVoid = await setOrderPrice(actor, property.id, order.id, { mode: "custom", label: "After void", amount: "50" });
      expect(afterVoid).toMatchObject({ ok: true, totalCents: 5000 + 2500 - 500 });

      const paidInvoice = await createInvoiceForOrder(actor, order.id);
      expect(paidInvoice).toHaveProperty("id");
      if ("id" in paidInvoice && paidInvoice.id) {
        await prisma.invoice.update({ where: { id: paidInvoice.id }, data: { status: "PAID", amountPaidCents: 7000 } });
      }
      const paidBlock = await setOrderPrice(actor, property.id, order.id, { mode: "custom", label: "Paid", amount: "1" });
      expect(paidBlock).toMatchObject({ error: "This order already has a recorded payment." });
    } finally {
      await prisma.payment.deleteMany({ where: { invoice: { orderId: order.id } } });
      await prisma.auditLog.deleteMany({ where: { actorId: user.id } });
      await prisma.invoice.deleteMany({ where: { orderId: order.id } });
      await prisma.order.delete({ where: { id: order.id } });
      await prisma.property.delete({ where: { id: property.id } });
      await prisma.package.delete({ where: { id: pkg.id } });
      await prisma.client.delete({ where: { id: client.id } });
      await prisma.user.delete({ where: { id: user.id } });
      await prisma.$disconnect();
    }
  });
});
