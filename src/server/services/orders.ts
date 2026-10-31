import "server-only";
import type { OrderStatus } from "@prisma/client";
import type { Actor } from "@/lib/actor";
import { can } from "@/lib/permissions";
import { parseDollarsToCents } from "@/lib/money";
import { nextOrderStatuses, type OrderStatus as StatusName } from "@/lib/order-status";
import { quoteTotals, slotDecision, travelFeeForZip, zonedDateTime } from "@/lib/scheduling";
import { prisma } from "@/server/db/prisma";
import { writeAudit } from "@/server/audit";

const PROPERTY_TYPES = [
  "SINGLE_FAMILY",
  "CONDO",
  "TOWNHOUSE",
  "MULTI_FAMILY",
  "LAND",
  "COMMERCIAL",
  "RENTAL",
  "OTHER",
] as const;

export async function listOrders(actor: Actor, view?: string) {
  if (!can(actor, "orders.read")) throw new Error("Forbidden");
  return prisma.order.findMany({
    where: { archivedAt: view === "archived" ? { not: null } : null },
    orderBy: { updatedAt: "desc" },
    include: { client: true, property: true, items: true, invoices: { include: { payments: true } } },
  });
}

export async function getOrder(actor: Actor, id: string) {
  if (!can(actor, "orders.read")) throw new Error("Forbidden");
  return prisma.order.findUnique({
    where: { id },
    include: {
      client: true,
      property: true,
      items: { include: { service: true, package: true } },
      history: { orderBy: { createdAt: "asc" }, include: { actor: true } },
      bookings: true,
      invoices: { include: { payments: true } },
    },
  });
}

export async function requestBooking(
  actor: Actor,
  input: {
    addressLine1: string;
    city: string;
    zip: string;
    propertyType: string;
    packageId: string;
    addOnIds: string[];
    preferredDate: string;
    instructions?: string;
  },
) {
  if (actor.role !== "CLIENT" || !actor.clientId) return { error: "A client profile is required." as const };
  const propertyType = (PROPERTY_TYPES as readonly string[]).includes(input.propertyType)
    ? (input.propertyType as (typeof PROPERTY_TYPES)[number])
    : "OTHER";
  const pkg = await prisma.package.findFirst({ where: { id: input.packageId, active: true } });
  if (!pkg) return { error: "Choose an active package." as const };
  const addOns = input.addOnIds.length
    ? await prisma.service.findMany({ where: { id: { in: input.addOnIds }, isAddOn: true, active: true } })
    : [];
  const areas = await prisma.serviceArea.findMany();
  const travel = travelFeeForZip(input.zip, areas);
  const totals = quoteTotals({
    packageCents: pkg.priceCents,
    travelFeeCents: travel.travelFeeCents,
    lines: addOns.map((addOn) => ({
      pricingMode: addOn.pricingMode,
      quantity: 1,
      unitPriceCents: addOn.pricingMode === "FIXED" ? addOn.priceCents : null,
    })),
  });
  const preferred = /^\d{4}-\d{2}-\d{2}$/.test(input.preferredDate) ? new Date(`${input.preferredDate}T00:00:00.000Z`) : null;
  const order = await prisma.$transaction(async (tx) => {
    const property = await tx.property.create({
      data: {
        clientId: actor.clientId!,
        addressLine1: input.addressLine1.trim(),
        city: input.city.trim(),
        zip: input.zip.trim(),
        propertyType,
        state: "FL",
      },
    });
    const created = await tx.order.create({
      data: {
        clientId: actor.clientId!,
        propertyId: property.id,
        status: "REQUESTED",
        subtotalCents: totals.subtotalCents,
        travelFeeCents: totals.travelFeeCents,
        totalCents: totals.totalCents,
        preferredDate: preferred,
        instructions: input.instructions?.trim() || null,
        items: {
          create: [
            {
              packageId: pkg.id,
              label: pkg.name,
              quantity: 1,
              unitPriceCents: pkg.priceCents,
            },
            ...addOns.map((addOn) => ({
              serviceId: addOn.id,
              label: addOn.name,
              quantity: 1,
              unitPriceCents: addOn.pricingMode === "QUOTE" ? null : addOn.priceCents,
            })),
          ],
        },
        bookings: {
          create: {
            status: "REQUESTED",
            durationMin: pkg.durationMin + addOns.length * 30,
            travelFeeCents: totals.travelFeeCents,
          },
        },
        history: {
          create: { toStatus: "REQUESTED", actorId: actor.id, note: "Booking requested from the portal." },
        },
      },
    });
    return created;
  });
  await writeAudit({
    actorId: actor.id,
    action: "order.request",
    entityType: "Order",
    entityId: order.id,
    after: { totalCents: order.totalCents, travelMatched: travel.matched, areaName: travel.areaName },
  });
  return { id: order.id, travel, openQuotes: totals.openQuotes };
}

export async function setQuotePrices(actor: Actor, orderId: string, prices: Record<string, string>) {
  if (!can(actor, "orders.write")) throw new Error("Forbidden");
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: { include: { service: true, package: true } }, invoices: { include: { payments: true } } },
  });
  if (!order) return { error: "That order was not found." as const };
  const paid = order.invoices.some(
    (invoice) => invoice.amountPaidCents > 0 || invoice.payments.some((payment) => payment.status === "SUCCEEDED"),
  );
  if (paid) return { error: "This order already has a recorded payment." as const };
  const packageCents = order.items
    .filter((item) => item.packageId)
    .reduce((sum, item) => sum + (item.unitPriceCents ?? 0) * item.quantity, 0);
  const addOnLines: { pricingMode: "FIXED" | "QUOTE"; quantity: number; unitPriceCents: number | null }[] = [];
  for (const item of order.items) {
    if (item.packageId) continue;
    const mode = (item.service?.pricingMode ?? "FIXED") as "FIXED" | "QUOTE";
    let unit = item.unitPriceCents;
    if (mode === "QUOTE" && prices[item.id]?.trim()) {
      const cents = parseDollarsToCents(prices[item.id] ?? "");
      if (cents === null) return { error: `Enter a dollar amount for ${item.label}.` as const };
      unit = cents;
    }
    await prisma.orderItem.update({ where: { id: item.id }, data: { unitPriceCents: unit } });
    addOnLines.push({ pricingMode: mode, quantity: item.quantity, unitPriceCents: unit });
  }
  const totals = quoteTotals({ packageCents, travelFeeCents: order.travelFeeCents, lines: addOnLines });
  await prisma.order.update({
    where: { id: orderId },
    data: { subtotalCents: totals.subtotalCents, totalCents: totals.totalCents },
  });
  await writeAudit({
    actorId: actor.id,
    action: "order.quote",
    entityType: "Order",
    entityId: orderId,
    after: { totalCents: totals.totalCents, openQuotes: totals.openQuotes },
  });
  return { ok: true as const, openQuotes: totals.openQuotes };
}

export async function changeOrderStatus(actor: Actor, orderId: string, toStatus: string, note: string, startLocal?: string) {
  if (!can(actor, "orders.write")) throw new Error("Forbidden");
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { bookings: true, items: { include: { service: true } } } });
  if (!order) return { error: "That order was not found." as const };
  const allowed = nextOrderStatuses(order.status as StatusName);
  if (!(allowed as readonly string[]).includes(toStatus)) {
    return { error: "That status change is not part of the order lifecycle." as const };
  }
  if (toStatus === "QUOTED") {
    const open = order.items.some((item) => item.service?.pricingMode === "QUOTE" && item.unitPriceCents === null);
    if (open) return { error: "Price every quote item before marking the order quoted." as const };
  }
  let startAt: Date | null = null;
  if (toStatus === "SCHEDULED") {
    startAt = startLocal ? zonedDateTime(startLocal) : null;
    if (!startAt) return { error: "Choose a start time in Orlando local time." as const };
    const [rules, blackouts] = await Promise.all([
      prisma.availabilityRule.findMany(),
      prisma.blackoutDate.findMany(),
    ]);
    const booking = order.bookings[0];
    const decision = slotDecision({
      start: startAt,
      durationMin: booking?.durationMin ?? 60,
      rules,
      blackouts: blackouts.map((blackout) => ({ date: blackout.date.toISOString().slice(0, 10) })),
    });
    if (!decision.ok) return { error: decision.reason };
  }
  await prisma.$transaction(async (tx) => {
    await tx.order.update({ where: { id: orderId }, data: { status: toStatus as OrderStatus } });
    await tx.orderStatusHistory.create({
      data: {
        orderId,
        fromStatus: order.status,
        toStatus: toStatus as OrderStatus,
        actorId: actor.id,
        note: note.trim() || null,
      },
    });
    if (toStatus === "SCHEDULED" && startAt) {
      const booking = order.bookings[0];
      const endAt = new Date(startAt.getTime() + (booking?.durationMin ?? 60) * 60 * 1000);
      if (booking) {
        await tx.booking.update({
          where: { id: booking.id },
          data: { status: "SCHEDULED", startAt, endAt },
        });
      }
    }
    if (toStatus === "CANCELLED") {
      await tx.booking.updateMany({ where: { orderId }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: note || null } });
    }
  });
  await writeAudit({
    actorId: actor.id,
    action: "order.status",
    entityType: "Order",
    entityId: orderId,
    before: { status: order.status },
    after: { status: toStatus },
  });
  return { ok: true as const };
}

export async function rescheduleBooking(actor: Actor, bookingId: string, startLocal: string) {
  if (!can(actor, "orders.write")) throw new Error("Forbidden");
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { order: true } });
  if (!booking) return { error: "That appointment was not found." as const };
  const startAt = zonedDateTime(startLocal);
  if (!startAt) return { error: "Choose a start time in Orlando local time." as const };
  const [rules, blackouts] = await Promise.all([prisma.availabilityRule.findMany(), prisma.blackoutDate.findMany()]);
  const decision = slotDecision({
    start: startAt,
    durationMin: booking.durationMin,
    rules,
    blackouts: blackouts.map((blackout) => ({ date: blackout.date.toISOString().slice(0, 10) })),
  });
  if (!decision.ok) return { error: decision.reason };
  const endAt = new Date(startAt.getTime() + booking.durationMin * 60 * 1000);
  await prisma.$transaction(async (tx) => {
    await tx.booking.update({ where: { id: booking.id }, data: { startAt, endAt, status: "SCHEDULED" } });
    await tx.orderStatusHistory.create({
      data: { orderId: booking.orderId, fromStatus: booking.order.status, toStatus: booking.order.status, actorId: actor.id, note: "Shoot time changed." },
    });
  });
  await writeAudit({
    actorId: actor.id,
    action: "booking.reschedule",
    entityType: "Booking",
    entityId: booking.id,
    before: { startAt: booking.startAt?.toISOString() ?? null },
    after: { startAt: startAt.toISOString() },
  });
  return { ok: true as const };
}

export async function orderCalendarEvent(orderId: string, clientId?: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, clientId },
    include: { property: true, bookings: true },
  });
  return order;
}
