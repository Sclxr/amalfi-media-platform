import "server-only";
import type { PropertyType } from "@prisma/client";
import type { Actor } from "@/lib/actor";
import { normalizeEmail } from "@/lib/email";
import {
  listingStatus,
  listingStatusLabel,
  pickCover,
  pickListingOrder,
  pickShootDate,
  type ListingGallery,
  type ListingOrder,
  type ListingStatus,
} from "@/lib/listing";
import { can } from "@/lib/permissions";
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

const listingInclude = {
  lead: true,
  client: true,
  orders: {
    include: { bookings: true, invoices: true },
    orderBy: { updatedAt: "desc" as const },
  },
  galleries: {
    include: { assets: { orderBy: { sortOrder: "asc" as const } } },
    orderBy: { createdAt: "desc" as const },
  },
};

export type ListingRecord = Awaited<ReturnType<typeof loadListings>>[number];

async function loadListings(where?: { leadId?: string; id?: string; q?: string }) {
  const q = where?.q?.trim();
  return prisma.property.findMany({
    where: {
      id: where?.id,
      leadId: where?.leadId,
      OR: q
        ? [
            { addressLine1: { contains: q, mode: "insensitive" } },
            { city: { contains: q, mode: "insensitive" } },
            { zip: { contains: q } },
            { lead: { firstName: { contains: q, mode: "insensitive" } } },
            { lead: { lastName: { contains: q, mode: "insensitive" } } },
            { lead: { email: { contains: q, mode: "insensitive" } } },
          ]
        : undefined,
    },
    include: listingInclude,
    orderBy: { createdAt: "desc" },
  });
}

export type ListingCard = {
  id: string;
  addressLine1: string;
  city: string;
  state: string;
  zip: string;
  leadId: string | null;
  realtorName: string;
  status: ListingStatus;
  statusLabel: string;
  shootDate: Date | null;
  hasCover: boolean;
  orderId: string | null;
  galleryId: string | null;
  invoiceId: string | null;
};

function toCard(property: ListingRecord, now = new Date()): ListingCard {
  const orders: ListingOrder[] = property.orders.map((order) => ({
    id: order.id,
    status: order.status,
    updatedAt: order.updatedAt,
    preferredDate: order.preferredDate,
    bookings: order.bookings.map((booking) => ({ startAt: booking.startAt })),
  }));
  const galleries: ListingGallery[] = property.galleries.map((gallery) => ({
    id: gallery.id,
    status: gallery.status,
    createdAt: gallery.createdAt,
    assets: gallery.assets.map((asset) => ({
      id: asset.id,
      kind: asset.kind,
      status: asset.status,
      sortOrder: asset.sortOrder,
      previewKey: asset.previewKey,
      storageKey: asset.storageKey,
    })),
  }));
  const order = pickListingOrder(orders);
  const cover = pickCover(galleries);
  const invoice = order ? property.orders.find((item) => item.id === order.id)?.invoices[0] : undefined;
  const galleryForOrder = order
    ? property.galleries.find((gallery) => gallery.orderId === order.id) ?? property.galleries[0]
    : property.galleries[0];
  return {
    id: property.id,
    addressLine1: property.addressLine1,
    city: property.city,
    state: property.state,
    zip: property.zip,
    leadId: property.leadId,
    realtorName: property.lead ? `${property.lead.firstName ?? ""} ${property.lead.lastName ?? ""}`.trim() || "Unassigned" : "Unassigned",
    status: listingStatus(order),
    statusLabel: listingStatusLabel(listingStatus(order)),
    shootDate: pickShootDate(order, now),
    hasCover: Boolean(cover),
    orderId: order?.id ?? null,
    galleryId: galleryForOrder?.id ?? cover?.galleryId ?? null,
    invoiceId: invoice?.id ?? null,
  };
}

export async function listListings(actor: Actor, query: { q?: string; status?: string; leadId?: string }) {
  if (!can(actor, "orders.read")) throw new Error("Forbidden");
  const rows = await loadListings({ q: query.q, leadId: query.leadId });
  const cards = rows.map((row) => toCard(row));
  if (!query.status) return cards;
  return cards.filter((card) => card.status === query.status);
}

export async function getListing(actor: Actor, id: string) {
  if (!can(actor, "orders.read")) throw new Error("Forbidden");
  const row = (await loadListings({ id }))[0];
  if (!row) return null;
  return { property: row, card: toCard(row) };
}

export async function listRealtorOptions(actor: Actor) {
  if (!can(actor, "orders.read")) throw new Error("Forbidden");
  return prisma.lead.findMany({
    where: { deletedAt: null },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: { id: true, firstName: true, lastName: true, email: true },
  });
}

export async function createListing(
  actor: Actor,
  input: {
    leadId: string;
    addressLine1: string;
    city: string;
    zip: string;
    propertyType: string;
    email?: string;
  },
) {
  if (!can(actor, "orders.write")) throw new Error("Forbidden");
  const propertyType = (PROPERTY_TYPES as readonly string[]).includes(input.propertyType)
    ? (input.propertyType as PropertyType)
    : "SINGLE_FAMILY";
  const addressLine1 = input.addressLine1.trim();
  const city = input.city.trim();
  const zip = input.zip.trim();
  if (!addressLine1 || !city || !zip) return { error: "Address, city, and ZIP are required." as const };

  const created = await prisma.$transaction(async (tx) => {
    const lead = await tx.lead.findFirst({ where: { id: input.leadId, deletedAt: null } });
    if (!lead) return { error: "Choose a realtor from the CRM." as const };
    let clientId = lead.clientId;
    if (!clientId) {
      const email = normalizeEmail(lead.email) ?? normalizeEmail(input.email);
      if (!email) return { error: "Add an email for this realtor before creating a listing." as const };
      const client = await tx.client.create({
        data: {
          firstName: lead.firstName?.trim() || "Realtor",
          lastName: lead.lastName?.trim() || "Contact",
          email,
          phone: lead.phone,
          brokerageId: lead.brokerageId,
        },
      });
      await tx.lead.update({
        where: { id: lead.id },
        data: {
          email: lead.email ?? email,
          emailNormalized: lead.emailNormalized ?? email,
          clientId: client.id,
          convertedAt: lead.convertedAt ?? new Date(),
        },
      });
      clientId = client.id;
    }
    const property = await tx.property.create({
      data: {
        clientId,
        leadId: lead.id,
        addressLine1,
        city,
        state: "FL",
        zip,
        propertyType,
      },
    });
    return { id: property.id };
  });

  if ("error" in created) return created;
  await writeAudit({
    actorId: actor.id,
    action: "listing.create",
    entityType: "Property",
    entityId: created.id,
    after: { addressLine1, leadId: input.leadId },
  });
  return created;
}

export async function updateListingAddress(
  actor: Actor,
  id: string,
  input: { addressLine1: string; city: string; zip: string },
) {
  if (!can(actor, "orders.write")) throw new Error("Forbidden");
  const addressLine1 = input.addressLine1.trim();
  const city = input.city.trim();
  const zip = input.zip.trim();
  if (!addressLine1 || !city || !zip) return { error: "Address, city, and ZIP are required." as const };
  const current = await prisma.property.findUnique({ where: { id } });
  if (!current) return { error: "That listing was not found." as const };
  await prisma.property.update({ where: { id }, data: { addressLine1, city, zip } });
  await writeAudit({
    actorId: actor.id,
    action: "listing.update",
    entityType: "Property",
    entityId: id,
    before: { addressLine1: current.addressLine1, city: current.city, zip: current.zip },
    after: { addressLine1, city, zip },
  });
  return { id };
}
