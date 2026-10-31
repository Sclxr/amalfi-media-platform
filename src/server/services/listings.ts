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
  lead: { include: { brokerage: true } },
  client: true,
  orders: {
    include: {
      bookings: { include: { photographer: true } },
      invoices: { include: { payments: true, lineItems: { orderBy: { sortOrder: "asc" as const } } } },
      items: { include: { service: true } },
      history: { orderBy: { createdAt: "desc" as const } },
    },
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
  const cover = pickCover(galleries, property.coverAssetId);
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

function optionalCount(value: string, label: string): { error: string } | { value: number | null } {
  const trimmed = value.trim();
  if (!trimmed) return { value: null };
  if (!/^\d+$/.test(trimmed)) return { error: `${label} must be a whole number.` };
  return { value: Number(trimmed) };
}

export async function updateListing(
  actor: Actor,
  id: string,
  input: {
    leadId: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    state: string;
    zip: string;
    propertyType: string;
    sqft: string;
    beds: string;
    bathsHalf: string;
    accessNotes: string;
  },
) {
  if (!can(actor, "orders.write")) throw new Error("Forbidden");
  const addressLine1 = input.addressLine1.trim();
  const city = input.city.trim();
  const zip = input.zip.trim();
  const state = input.state.trim().toUpperCase();
  if (!addressLine1 || !city || !zip) return { error: "Address, city, and ZIP are required." as const };
  if (!/^[A-Z]{2}$/.test(state)) return { error: "State is a two-letter abbreviation." as const };
  const propertyType = (PROPERTY_TYPES as readonly string[]).includes(input.propertyType) ? (input.propertyType as PropertyType) : null;
  if (!propertyType) return { error: "Choose a property type." as const };
  const sqft = optionalCount(input.sqft, "Square feet");
  const beds = optionalCount(input.beds, "Beds");
  const bathsHalf = optionalCount(input.bathsHalf, "Half baths");
  if ("error" in sqft) return { error: sqft.error };
  if ("error" in beds) return { error: beds.error };
  if ("error" in bathsHalf) return { error: bathsHalf.error };
  const current = await prisma.property.findUnique({ where: { id } });
  if (!current) return { error: "That listing was not found." as const };
  const lead = await prisma.lead.findFirst({ where: { id: input.leadId, deletedAt: null } });
  if (!lead) return { error: "Choose a realtor from the CRM." as const };
  const data = {
    leadId: lead.id,
    addressLine1,
    addressLine2: input.addressLine2.trim() || null,
    city,
    state,
    zip,
    propertyType,
    sqft: sqft.value,
    beds: beds.value,
    bathsHalf: bathsHalf.value,
    accessNotes: input.accessNotes.trim() || null,
  };
  await prisma.property.update({ where: { id }, data });
  await writeAudit({
    actorId: actor.id,
    action: "listing.update",
    entityType: "Property",
    entityId: id,
    before: {
      leadId: current.leadId,
      addressLine1: current.addressLine1,
      addressLine2: current.addressLine2,
      city: current.city,
      state: current.state,
      zip: current.zip,
      propertyType: current.propertyType,
      sqft: current.sqft,
      beds: current.beds,
      bathsHalf: current.bathsHalf,
      accessNotes: current.accessNotes,
    },
    after: data,
  });
  return { id };
}

export async function updateListingAddress(
  actor: Actor,
  id: string,
  input: { addressLine1: string; city: string; zip: string },
) {
  const current = await prisma.property.findUnique({ where: { id } });
  if (!current?.leadId) return { error: "Assign a realtor before saving." as const };
  return updateListing(actor, id, {
    leadId: current.leadId,
    addressLine1: input.addressLine1,
    addressLine2: current.addressLine2 ?? "",
    city: input.city,
    state: current.state,
    zip: input.zip,
    propertyType: current.propertyType,
    sqft: current.sqft?.toString() ?? "",
    beds: current.beds?.toString() ?? "",
    bathsHalf: current.bathsHalf?.toString() ?? "",
    accessNotes: current.accessNotes ?? "",
  });
}

export async function setListingCover(actor: Actor, propertyId: string, assetId: string | null) {
  if (!can(actor, "media.write")) throw new Error("Forbidden");
  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property) return { error: "That listing was not found." as const };
  if (assetId) {
    const asset = await prisma.mediaAsset.findFirst({
      where: { id: assetId, kind: "PHOTO", status: "READY", gallery: { propertyId } },
    });
    if (!asset) return { error: "Choose a ready photo from this listing." as const };
  }
  await prisma.property.update({ where: { id: propertyId }, data: { coverAssetId: assetId } });
  await writeAudit({
    actorId: actor.id,
    action: "listing.cover",
    entityType: "Property",
    entityId: propertyId,
    before: { coverAssetId: property.coverAssetId },
    after: { coverAssetId: assetId },
  });
  return { ok: true as const };
}
