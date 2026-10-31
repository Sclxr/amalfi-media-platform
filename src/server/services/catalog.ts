import "server-only";
import type { Actor } from "@/lib/actor";
import { parseDollarsToCents } from "@/lib/money";
import { can } from "@/lib/permissions";
import type { z } from "zod";
import type { areaUpdateSchema, packageUpdateSchema, serviceUpdateSchema } from "@/schemas/catalog";
import { prisma } from "@/server/db/prisma";

export async function listActivePackages(actor: Actor) {
  if (!can(actor, "orders.read")) throw new Error("Forbidden");
  return prisma.package.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, priceCents: true, slug: true },
  });
}

export async function getCatalog() {
  const [packages, services, areas] = await Promise.all([
    prisma.package.findMany({
      orderBy: { sortOrder: "asc" },
      include: { services: { include: { service: true } }, addOns: { include: { service: true } } },
    }),
    prisma.service.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.serviceArea.findMany({ orderBy: { name: "asc" } }),
  ]);
  return { packages, services, areas };
}

export async function updatePackage(actor: Actor, input: z.infer<typeof packageUpdateSchema>) {
  if (!can(actor, "settings.manage")) throw new Error("Forbidden");
  const priceCents = parseDollarsToCents(input.price);
  if (priceCents === null) return { error: "Enter a price like 120.00." as const };
  const maxSqft = input.maxSqft ? Number(input.maxSqft) : null;
  if (input.maxSqft && (!Number.isInteger(maxSqft) || (maxSqft ?? 0) < 0)) {
    return { error: "Square footage must be a whole number." as const };
  }
  const before = await prisma.package.findUnique({ where: { id: input.id } });
  if (!before) return { error: "Package not found." as const };
  await prisma.$transaction(async (tx) => {
    await tx.package.update({
      where: { id: input.id },
      data: {
        name: input.name,
        description: input.description || null,
        priceCents,
        durationMin: input.durationMin,
        maxSqft,
        active: input.active === "true",
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "package.update",
        entityType: "Package",
        entityId: input.id,
        before: { priceCents: before.priceCents, active: before.active },
        after: { priceCents, active: input.active === "true" },
      },
    });
  });
  return { id: input.id };
}

export async function updateService(actor: Actor, input: z.infer<typeof serviceUpdateSchema>) {
  if (!can(actor, "settings.manage")) throw new Error("Forbidden");
  const priceCents = input.price ? parseDollarsToCents(input.price) : null;
  if (input.pricingMode === "FIXED" && priceCents === null) {
    return { error: "A fixed-price add-on needs a price, or switch it to quote." as const };
  }
  if (input.price && priceCents === null) return { error: "Enter a price like 75.00." as const };
  const before = await prisma.service.findUnique({ where: { id: input.id } });
  if (!before) return { error: "Service not found." as const };
  await prisma.$transaction(async (tx) => {
    await tx.service.update({
      where: { id: input.id },
      data: {
        name: input.name,
        pricingMode: input.pricingMode,
        priceCents: input.pricingMode === "QUOTE" ? null : priceCents,
        active: input.active === "true",
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "service.update",
        entityType: "Service",
        entityId: input.id,
        before: { priceCents: before.priceCents, pricingMode: before.pricingMode },
        after: { priceCents, pricingMode: input.pricingMode },
      },
    });
  });
  return { id: input.id };
}

export async function updateServiceArea(actor: Actor, input: z.infer<typeof areaUpdateSchema>) {
  if (!can(actor, "settings.manage")) throw new Error("Forbidden");
  const travelFeeCents = parseDollarsToCents(input.travelFee);
  if (travelFeeCents === null) return { error: "Enter a travel fee like 0.00 or 45.00." as const };
  const before = await prisma.serviceArea.findUnique({ where: { id: input.id } });
  if (!before) return { error: "Service area not found." as const };
  const zipCodes = input.zipCodes
    .split(/[\s,]+/)
    .map((zip) => zip.trim())
    .filter(Boolean);
  await prisma.$transaction(async (tx) => {
    await tx.serviceArea.update({
      where: { id: input.id },
      data: {
        name: input.name,
        zipCodes,
        travelFeeCents,
        active: input.active === "true",
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "serviceArea.update",
        entityType: "ServiceArea",
        entityId: input.id,
        before: { travelFeeCents: before.travelFeeCents },
        after: { travelFeeCents },
      },
    });
  });
  return { id: input.id };
}
