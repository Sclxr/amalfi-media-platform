import { describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { ROLE_PERMISSIONS } from "@/lib/permissions";
import { nextOpenSlot, zonedDateTime, zonedParts } from "@/lib/scheduling";
import { shootFormSchema } from "@/schemas/shoot";
import { changeOrderStatus } from "@/server/services/orders";
import { bookShoot, insertBookedShoot } from "@/server/services/shoots";
import { getToday } from "@/server/services/today";

const prisma = new PrismaClient();

function actorFor(user: { id: string; email: string; name: string }) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: "ADMIN" as const,
    clientId: null,
    permissions: new Set(ROLE_PERMISSIONS.ADMIN),
  };
}

async function hoursFor(startLocal: string) {
  const start = zonedDateTime(startLocal);
  if (!start) throw new Error("bad start");
  await prisma.availabilityRule.create({
    data: { weekday: zonedParts(start).weekday, startMin: 8 * 60, endMin: 18 * 60 },
  });
}

describe("new shoot validation", () => {
  it("asks for a realtor, a street, and a real ZIP", () => {
    const parsed = shootFormSchema.safeParse({
      realtorMode: "existing",
      addressLine1: "",
      city: "Orlando",
      zip: "328",
      priceMode: "package",
      startLocal: "",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const messages = parsed.error.issues.map((issue) => issue.message);
      expect(messages).toContain("Enter the street address.");
      expect(messages).toContain("Enter a 5-digit ZIP.");
      expect(messages).toContain("Choose a realtor, or add a new one.");
    }
  });

  it("suggests the next open hour in Orlando", () => {
    const rules = [{ weekday: 3, startMin: 9 * 60, endMin: 17 * 60 }];
    const slot = nextOpenSlot({
      now: new Date("2026-11-18T13:00:00.000Z"),
      durationMin: 60,
      rules,
      blackouts: [],
    });
    expect(slot).toBe("2026-11-18T09:00");
  });
});

describe("book a shoot", () => {
  it("creates a realtor, listing, time, and draft quote, and reuses an email", async () => {
    const stamp = `shoot-${Date.now()}`;
    const startLocal = "2027-06-16T10:00";
    await hoursFor(startLocal);
    const user = await prisma.user.create({ data: { name: "Booker", email: `${stamp}@example.com`, role: "ADMIN" } });
    const actor = actorFor(user);
    const pkg = await prisma.package.create({
      data: { name: "Introductory photography", slug: stamp, priceCents: 12000, durationMin: 60, active: true },
    });
    const saved = await bookShoot(actor, {
      realtorMode: "new",
      leadId: "",
      firstName: "Casey",
      lastName: "Nguyen",
      email: `${stamp}-casey@example.com`,
      phone: "4075550100",
      brokerage: `${stamp} Realty`,
      addressLine1: `${stamp} Lake St`,
      city: "Orlando",
      zip: "32801",
      propertyType: "SINGLE_FAMILY",
      priceMode: "package",
      packageId: pkg.id,
      addOnId: "",
      customLabel: "",
      customAmount: "",
      startLocal,
      notes: "Lockbox 1234",
    });
    expect(saved).toMatchObject({ reusedRealtor: false });
    if (!("propertyId" in saved)) return;
    const property = await prisma.property.findUnique({
      where: { id: saved.propertyId },
      include: { lead: true, orders: { include: { bookings: true, invoices: true, items: true } } },
    });
    expect(property?.addressLine1).toBe(`${stamp} Lake St`);
    expect(property?.lead?.email).toBe(`${stamp}-casey@example.com`);
    expect(property?.lead?.clientId).toBeTruthy();
    const order = property?.orders[0];
    expect(order?.status).toBe("SCHEDULED");
    expect(order?.instructions).toBe("Lockbox 1234");
    expect(order?.bookings[0]?.startAt?.toISOString()).toBe(zonedDateTime(startLocal)?.toISOString());
    expect(order?.invoices[0]?.status).toBe("DRAFT");
    expect(order?.items[0]?.unitPriceCents).toBe(12000);

    const again = await bookShoot(actor, {
      realtorMode: "new",
      leadId: "",
      firstName: "Other",
      lastName: "Name",
      email: `${stamp}-casey@example.com`,
      phone: "",
      brokerage: "",
      addressLine1: `${stamp} Second St`,
      city: "Orlando",
      zip: "32801",
      propertyType: "CONDO",
      priceMode: "custom",
      packageId: "",
      addOnId: "",
      customLabel: "Twilight",
      customAmount: "80.00",
      startLocal,
      notes: "",
    });
    expect(again).toMatchObject({ reusedRealtor: true });
    expect(await prisma.lead.count({ where: { emailNormalized: `${stamp}-casey@example.com` } })).toBe(1);

    const existing = await bookShoot(actor, {
      realtorMode: "existing",
      leadId: property?.leadId ?? "",
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      brokerage: "",
      addressLine1: `${stamp} Third St`,
      city: "Orlando",
      zip: "32801",
      propertyType: "SINGLE_FAMILY",
      priceMode: "package",
      packageId: pkg.id,
      addOnId: "",
      customLabel: "",
      customAmount: "",
      startLocal,
      notes: "",
    });
    expect(existing).toMatchObject({ reusedRealtor: false });
    if ("propertyId" in existing) {
      const third = await prisma.property.findUnique({ where: { id: existing.propertyId } });
      expect(third?.leadId).toBe(property?.leadId);
    }
  });

  it("rejects a time outside working hours and leaves no listing", async () => {
    const stamp = `hours-${Date.now()}`;
    const user = await prisma.user.create({ data: { name: "Hours", email: `${stamp}@example.com`, role: "ADMIN" } });
    const pkg = await prisma.package.create({
      data: { name: "Hours package", slug: stamp, priceCents: 10000, durationMin: 60, active: true },
    });
    const result = await bookShoot(actorFor(user), {
      realtorMode: "new",
      leadId: "",
      firstName: "Night",
      lastName: "Owl",
      email: `${stamp}@example.com`.replace("@", "-agent@"),
      phone: "",
      brokerage: "",
      addressLine1: `${stamp} Night St`,
      city: "Orlando",
      zip: "32801",
      propertyType: "SINGLE_FAMILY",
      priceMode: "package",
      packageId: pkg.id,
      addOnId: "",
      customLabel: "",
      customAmount: "",
      startLocal: "2027-06-16T22:00",
      notes: "",
    });
    expect(result).toMatchObject({ field: "startLocal" });
    expect(await prisma.property.count({ where: { addressLine1: `${stamp} Night St` } })).toBe(0);
  });

  it("rolls the realtor and listing back when the save fails", async () => {
    const stamp = `rollback-${Date.now()}`;
    const startLocal = "2027-06-16T11:00";
    const startAt = zonedDateTime(startLocal);
    if (!startAt) throw new Error("bad start");
    const user = await prisma.user.create({ data: { name: "Rollback", email: `${stamp}@example.com`, role: "ADMIN" } });
    const email = `${stamp}-roll@example.com`;
    await expect(
      prisma.$transaction(async (tx) => {
        await insertBookedShoot(tx, actorFor(user), {
          input: {
            realtorMode: "new",
            leadId: "",
            firstName: "Roll",
            lastName: "Back",
            email,
            phone: "",
            brokerage: "",
            addressLine1: `${stamp} Roll St`,
            city: "Orlando",
            zip: "32801",
            propertyType: "SINGLE_FAMILY",
            priceMode: "custom",
            packageId: "",
            addOnId: "",
            customLabel: "Twilight",
            customAmount: "80.00",
            startLocal,
            notes: "",
          },
          email,
          startAt,
          propertyType: "SINGLE_FAMILY",
          lines: [{ label: "Twilight", quantity: 1, unitPriceCents: 8000, packageId: null, serviceId: null }],
          subtotalCents: 8000,
          travelFeeCents: 0,
          totalCents: 8000,
          durationMin: 60,
        });
        throw new Error("fail the shoot");
      }),
    ).rejects.toThrow(/fail the shoot/);
    expect(await prisma.property.count({ where: { addressLine1: `${stamp} Roll St` } })).toBe(0);
    expect(await prisma.lead.count({ where: { emailNormalized: email } })).toBe(0);
    expect(await prisma.order.count({ where: { property: { addressLine1: `${stamp} Roll St` } } })).toBe(0);
  });
});

describe("mark scheduled", () => {
  it("records a start time when the order has no appointment yet", async () => {
    const stamp = `sched-${Date.now()}`;
    const startLocal = "2027-06-16T14:00";
    await hoursFor(startLocal);
    const user = await prisma.user.create({ data: { name: "Scheduler", email: `${stamp}@example.com`, role: "ADMIN" } });
    const actor = actorFor(user);
    const client = await prisma.client.create({ data: { firstName: "Sched", lastName: "Client", email: `${stamp}-c@example.com` } });
    const property = await prisma.property.create({
      data: { clientId: client.id, addressLine1: `${stamp} Schedule Ln`, city: "Orlando", zip: "32806", propertyType: "SINGLE_FAMILY" },
    });
    const order = await prisma.order.create({
      data: { clientId: client.id, propertyId: property.id, status: "QUOTED", subtotalCents: 0, totalCents: 0 },
    });
    const missing = await changeOrderStatus(actor, order.id, "SCHEDULED", "", "");
    expect(missing).toEqual({ error: "Choose a start time in Orlando local time." });
    const saved = await changeOrderStatus(actor, order.id, "SCHEDULED", "On the calendar", startLocal);
    expect(saved).toEqual({ ok: true });
    const booking = await prisma.booking.findFirst({ where: { orderId: order.id } });
    expect(booking?.startAt?.toISOString()).toBe(zonedDateTime(startLocal)?.toISOString());
    expect(booking?.status).toBe("SCHEDULED");
    const today = await getToday(actor, new Date("2027-06-16T12:00:00.000Z"));
    expect(today.shoots.some((shoot) => shoot.address === `${stamp} Schedule Ln`)).toBe(true);
  });
});
