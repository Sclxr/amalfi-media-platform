import "server-only";
import { Prisma, type PropertyType } from "@prisma/client";
import type { Actor } from "@/lib/actor";
import { normalizeEmail } from "@/lib/email";
import { nextInvoiceNumber } from "@/lib/invoice-number";
import { parseDollarsToCents } from "@/lib/money";
import { normalizePhoneE164 } from "@/lib/phone";
import { can } from "@/lib/permissions";
import { nextOpenSlot, slotDecision, travelFeeForZip, zonedDateTime, zonedParts } from "@/lib/scheduling";
import { brokerageNameKey } from "@/schemas/brokerage";
import { SHOOT_PROPERTY_TYPES, type ShootFormValues } from "@/schemas/shoot";
import { prisma } from "@/server/db/prisma";

export async function shootFormOptions(actor: Actor) {
  if (!can(actor, "orders.read")) throw new Error("Forbidden");
  const [realtors, packages, addOns, rules, blackouts] = await Promise.all([
    prisma.lead.findMany({
      where: { deletedAt: null },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true, email: true },
    }),
    prisma.package.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, priceCents: true, durationMin: true },
    }),
    prisma.service.findMany({
      where: { active: true, isAddOn: true, pricingMode: "FIXED", priceCents: { not: null } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, priceCents: true, durationMin: true },
    }),
    prisma.availabilityRule.findMany(),
    prisma.blackoutDate.findMany(),
  ]);
  const defaultStart =
    nextOpenSlot({
      now: new Date(),
      durationMin: packages[0]?.durationMin ?? 60,
      rules,
      blackouts: blackouts.map((blackout) => ({ date: blackout.date.toISOString().slice(0, 10) })),
    }) ?? "";
  return { realtors, packages, addOns, defaultStart };
}

type SavedShoot = { propertyId: string; reusedRealtor: boolean };

type ShootLine = { label: string; quantity: number; unitPriceCents: number; packageId: string | null; serviceId: string | null };

type ShootWrite = {
  input: ShootFormValues;
  email: string | null;
  startAt: Date;
  propertyType: PropertyType;
  lines: ShootLine[];
  subtotalCents: number;
  travelFeeCents: number;
  totalCents: number;
  durationMin: number;
};

/** Writes the realtor, listing, booking, and draft quote. Rolls back with the surrounding transaction. */
export async function insertBookedShoot(tx: Prisma.TransactionClient, actor: Actor, write: ShootWrite): Promise<SavedShoot> {
  const { input, startAt } = write;
  const realtor = await resolveRealtor(tx, actor, input, write.email);
  const linked = await clientIdForRealtor(tx, realtor.lead);
  const property = await tx.property.create({
    data: {
      clientId: linked.clientId,
      leadId: linked.leadId,
      addressLine1: input.addressLine1.trim(),
      city: input.city.trim(),
      state: "FL",
      zip: input.zip.trim(),
      propertyType: write.propertyType,
    },
  });
  const preferredDate = new Date(`${zonedParts(startAt).date}T00:00:00.000Z`);
  const order = await tx.order.create({
    data: {
      clientId: linked.clientId,
      propertyId: property.id,
      status: "SCHEDULED",
      subtotalCents: write.subtotalCents,
      travelFeeCents: write.travelFeeCents,
      totalCents: write.totalCents,
      preferredDate,
      instructions: input.notes.trim() || null,
      items: {
        create: write.lines.map((line) => ({
          packageId: line.packageId,
          serviceId: line.serviceId,
          label: line.label,
          quantity: line.quantity,
          unitPriceCents: line.unitPriceCents,
        })),
      },
      bookings: {
        create: {
          status: "SCHEDULED",
          startAt,
          endAt: new Date(startAt.getTime() + write.durationMin * 60 * 1000),
          durationMin: write.durationMin,
          travelFeeCents: write.travelFeeCents,
        },
      },
      history: { create: { toStatus: "SCHEDULED", actorId: actor.id, note: "Booked from New shoot." } },
    },
  });
  await createDraftInvoice(tx, {
    clientId: linked.clientId,
    orderId: order.id,
    subtotalCents: write.subtotalCents,
    totalCents: write.totalCents,
    lines: write.lines,
    travelFeeCents: write.travelFeeCents,
  });
  await tx.auditLog.create({
    data: {
      actorId: actor.id,
      action: "shoot.book",
      entityType: "Property",
      entityId: property.id,
      after: { orderId: order.id, reusedRealtor: realtor.reused, totalCents: write.totalCents },
    },
  });
  return { propertyId: property.id, reusedRealtor: realtor.reused };
}

export async function bookShoot(actor: Actor, input: ShootFormValues): Promise<SavedShoot | { error: string; field?: string }> {
  if (!can(actor, "orders.write")) throw new Error("Forbidden");
  const startAt = zonedDateTime(input.startLocal);
  if (!startAt) return { error: "Choose a date and time.", field: "startLocal" };

  const propertyType = (SHOOT_PROPERTY_TYPES as readonly string[]).includes(input.propertyType)
    ? (input.propertyType as PropertyType)
    : "SINGLE_FAMILY";
  const [pkg, addOn, areas, rules, blackouts] = await Promise.all([
    input.priceMode === "package" ? prisma.package.findFirst({ where: { id: input.packageId, active: true } }) : Promise.resolve(null),
    input.priceMode === "package" && input.addOnId
      ? prisma.service.findFirst({ where: { id: input.addOnId, active: true, isAddOn: true, pricingMode: "FIXED" } })
      : Promise.resolve(null),
    prisma.serviceArea.findMany(),
    prisma.availabilityRule.findMany(),
    prisma.blackoutDate.findMany(),
  ]);
  if (input.priceMode === "package" && !pkg) return { error: "Choose an active package.", field: "packageId" };
  const customCents = input.priceMode === "custom" ? parseDollarsToCents(input.customAmount) : null;
  if (input.priceMode === "custom" && customCents === null) return { error: "Enter a dollar amount.", field: "customAmount" };

  const lines = pkg
    ? [
        { label: pkg.name, quantity: 1, unitPriceCents: pkg.priceCents, packageId: pkg.id, serviceId: null as string | null },
        ...(addOn && addOn.priceCents !== null
          ? [{ label: addOn.name, quantity: 1, unitPriceCents: addOn.priceCents, packageId: null, serviceId: addOn.id }]
          : []),
      ]
    : [{ label: input.customLabel.trim(), quantity: 1, unitPriceCents: customCents ?? 0, packageId: null, serviceId: null }];
  const subtotalCents = lines.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0);
  const travel = travelFeeForZip(input.zip, areas);
  const totalCents = subtotalCents + travel.travelFeeCents;
  const durationMin = (pkg?.durationMin ?? 60) + (addOn ? addOn.durationMin : 0);
  const decision = slotDecision({
    start: startAt,
    durationMin,
    rules,
    blackouts: blackouts.map((blackout) => ({ date: blackout.date.toISOString().slice(0, 10) })),
  });
  if (!decision.ok) return { error: decision.reason, field: "startLocal" };

  const email = normalizeEmail(input.email);
  const write: ShootWrite = {
    input,
    email,
    startAt,
    propertyType,
    lines,
    subtotalCents,
    travelFeeCents: travel.travelFeeCents,
    totalCents,
    durationMin,
  };
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction((tx) => insertBookedShoot(tx, actor, write));
    } catch (error) {
      const known = shootError(error);
      if (known) return known;
      const unique = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
      if (!unique || attempt === 2) {
        if (unique) return { error: "Could not save the shoot. Try again." };
        throw error;
      }
    }
  }
  return { error: "Could not save the shoot. Try again." };
}

async function resolveRealtor(
  tx: Prisma.TransactionClient,
  actor: Actor,
  input: ShootFormValues,
  email: string | null,
) {
  if (input.realtorMode === "existing") {
    const lead = await tx.lead.findFirst({ where: { id: input.leadId, deletedAt: null } });
    if (!lead) throw new ShootInputError("Choose a realtor, or add a new one.", "leadId");
    return { lead, reused: false };
  }
  const existing = email ? await tx.lead.findUnique({ where: { emailNormalized: email } }) : null;
  if (existing && !existing.deletedAt) return { lead: existing, reused: true };
  if (existing?.deletedAt) throw new ShootInputError("That email belongs to an archived realtor. Restore them first.", "email");
  if (!can(actor, "crm.write")) throw new ShootInputError("You can book a realtor already on file.", "email");
  if (!email) throw new ShootInputError("Enter a valid email.", "email");
  const brokerageId = input.brokerage.trim() ? await brokerageIdForName(tx, input.brokerage) : null;
  const lead = await tx.lead.create({
    data: {
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email,
      emailNormalized: email,
      phone: input.phone.trim() || null,
      phoneE164: normalizePhoneE164(input.phone),
      city: input.city.trim() || null,
      brokerageId,
      ownerId: actor.id,
      status: "NEW",
    },
  });
  await tx.leadActivity.create({
    data: { leadId: lead.id, actorId: actor.id, type: "NOTE", summary: "Realtor added while booking a shoot." },
  });
  return { lead, reused: false };
}

async function brokerageIdForName(tx: Prisma.TransactionClient, name: string) {
  const nameKey = brokerageNameKey(name);
  if (!nameKey) return null;
  const existing = await tx.brokerage.findUnique({ where: { nameKey }, select: { id: true } });
  if (existing) return existing.id;
  const created = await tx.brokerage.create({ data: { name: name.trim(), nameKey }, select: { id: true } });
  return created.id;
}

async function clientIdForRealtor(
  tx: Prisma.TransactionClient,
  lead: {
    id: string;
    clientId: string | null;
    email: string | null;
    emailNormalized: string | null;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    brokerageId: string | null;
    convertedAt: Date | null;
  },
) {
  if (lead.clientId) return { clientId: lead.clientId, leadId: lead.id };
  const email = normalizeEmail(lead.email);
  if (!email) throw new ShootInputError("Add an email for this realtor before booking.", "email");
  const existing = await tx.client.findFirst({ where: { email: { equals: email, mode: "insensitive" } }, select: { id: true } });
  const clientId = existing
    ? existing.id
    : (
        await tx.client.create({
          data: {
            firstName: lead.firstName?.trim() || "Realtor",
            lastName: lead.lastName?.trim() || "Contact",
            email,
            phone: lead.phone,
            brokerageId: lead.brokerageId,
          },
        })
      ).id;
  const taken = await tx.lead.findFirst({ where: { clientId, id: { not: lead.id } }, select: { id: true } });
  if (taken) return { clientId, leadId: taken.id };
  await tx.lead.update({
    where: { id: lead.id },
    data: { clientId, email, emailNormalized: lead.emailNormalized ?? email, convertedAt: lead.convertedAt ?? new Date() },
  });
  return { clientId, leadId: lead.id };
}

async function createDraftInvoice(
  tx: Prisma.TransactionClient,
  input: {
    clientId: string;
    orderId: string;
    subtotalCents: number;
    totalCents: number;
    travelFeeCents: number;
    lines: { label: string; quantity: number; unitPriceCents: number }[];
  },
) {
  const year = new Date().getFullYear();
  const existing = await tx.invoice.findMany({
    where: { number: { startsWith: `INV-${year}-` } },
    select: { number: true },
  });
  const number = nextInvoiceNumber(year, existing.map((invoice) => invoice.number));
  const descriptions = [
    ...input.lines.map((line) => ({
      description: line.label,
      quantity: line.quantity,
      unitPriceCents: line.unitPriceCents,
      totalCents: line.unitPriceCents * line.quantity,
    })),
    ...(input.travelFeeCents > 0
      ? [{ description: "Travel", quantity: 1, unitPriceCents: input.travelFeeCents, totalCents: input.travelFeeCents }]
      : []),
  ];
  await tx.invoice.create({
    data: {
      number,
      clientId: input.clientId,
      orderId: input.orderId,
      status: "DRAFT",
      subtotalCents: input.subtotalCents,
      totalCents: input.totalCents,
      lineItems: {
        create: descriptions.map((line, index) => ({ ...line, sortOrder: index })),
      },
    },
  });
}

class ShootInputError extends Error {
  field: string;
  constructor(message: string, field: string) {
    super(message);
    this.field = field;
  }
}

export function shootError(error: unknown): { error: string; field?: string } | null {
  if (error instanceof ShootInputError) return { error: error.message, field: error.field };
  return null;
}
