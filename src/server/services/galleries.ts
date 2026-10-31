import "server-only";
import type { Actor } from "@/lib/actor";
import { coveringInvoiceStatus, galleryDownloadDecision, type InvoiceStatus } from "@/lib/gallery-access";
import { can } from "@/lib/permissions";
import { prisma } from "@/server/db/prisma";
import { getEnv } from "@/server/env";
import { deleteMediaFile, readMediaFile, resolveMediaPath, writeMediaFile } from "@/server/storage/filesystem";
import { writeAudit } from "@/server/audit";
import { streamStoredZip, uniqueZipKey } from "@/lib/zip-store";
import { previewObjectKey, watermarkedPreview } from "@/lib/preview-image";
import { deliveryGalleryId, pickUploadGallery, pickUploadOrder } from "@/lib/listing";

async function storeWatermarkedPreview(originalKey: string) {
  const env = getEnv();
  if (!env.MEDIA_ROOT) throw new Error("MEDIA_ROOT is not configured.");
  const original = await readMediaFile(env.MEDIA_ROOT, originalKey);
  const preview = await watermarkedPreview(Buffer.from(original));
  const key = previewObjectKey();
  if (key === originalKey) throw new Error("Preview key matched the original.");
  await writeMediaFile(env.MEDIA_ROOT, key, preview);
  return key;
}

function bestInvoiceStatus(invoices: { status: string; createdAt: Date; amountRefundedCents: number }[]): InvoiceStatus | null {
  return coveringInvoiceStatus(
    invoices.map((invoice) => ({
      status: invoice.status,
      createdAt: invoice.createdAt.getTime(),
      amountRefundedCents: invoice.amountRefundedCents,
    })),
  );
}

export async function listGalleries(actor: Actor) {
  if (!can(actor, "media.read")) throw new Error("Forbidden");
  return prisma.gallery.findMany({
    orderBy: { createdAt: "desc" },
    include: { client: true, property: true, assets: true },
  });
}

export async function getGalleryForStaff(actor: Actor, id: string) {
  if (!can(actor, "media.read")) throw new Error("Forbidden");
  return prisma.gallery.findUnique({
    where: { id },
    include: {
      client: true,
      property: true,
      assets: { orderBy: { sortOrder: "asc" as const } },
      order: { include: { invoices: { orderBy: { createdAt: "desc" as const } } } },
    },
  });
}

export async function createGallery(actor: Actor, input: { orderId: string; title: string }) {
  if (!can(actor, "media.write")) throw new Error("Forbidden");
  const order = await prisma.order.findUnique({ where: { id: input.orderId }, include: { property: true } });
  if (!order) return { error: "That order was not found." as const };
  const gallery = await prisma.gallery.create({
    data: {
      orderId: order.id,
      clientId: order.clientId,
      propertyId: order.propertyId,
      title: input.title.trim() || order.property.addressLine1,
      status: "DRAFT",
      requirePaid: true,
      previewWatermark: false,
    },
  });
  await writeAudit({ actorId: actor.id, action: "gallery.create", entityType: "Gallery", entityId: gallery.id });
  return { id: gallery.id };
}

export async function registerUpload(
  actor: Actor,
  galleryId: string,
  input: { key: string; fileName: string; mimeType: string; sizeBytes: number },
) {
  if (!can(actor, "media.write")) throw new Error("Forbidden");
  const gallery = await prisma.gallery.findUnique({ where: { id: galleryId } });
  if (!gallery) return { error: "That gallery was not found." as const };
  const isPhoto = !input.mimeType.startsWith("video/");
  let previewKey: string | null = null;
  if (isPhoto) {
    try {
      previewKey = await storeWatermarkedPreview(input.key);
    } catch {
      const env = getEnv();
      if (env.MEDIA_ROOT) await deleteMediaFile(env.MEDIA_ROOT, input.key);
      return { error: "This photo could not be prepared for preview." as const };
    }
  }
  const last = await prisma.mediaAsset.aggregate({ where: { galleryId }, _max: { sortOrder: true } });
  const asset = await prisma.mediaAsset.create({
    data: {
      galleryId,
      kind: isPhoto ? "PHOTO" : "VIDEO",
      status: "READY",
      storageKey: input.key,
      previewKey,
      fileName: input.fileName,
      mimeType: input.mimeType || "application/octet-stream",
      sizeBytes: BigInt(input.sizeBytes),
      sortOrder: (last._max.sortOrder ?? -1) + 1,
      uploadedById: actor.id,
    },
  });
  return { id: asset.id };
}

export async function unpublishGallery(actor: Actor, id: string) {
  if (!can(actor, "media.write")) throw new Error("Forbidden");
  await prisma.gallery.update({ where: { id }, data: { status: "DRAFT", publishedAt: null } });
  await writeAudit({ actorId: actor.id, action: "gallery.unpublish", entityType: "Gallery", entityId: id, after: { status: "DRAFT" } });
  return { ok: true as const };
}

export async function deleteGalleryPhoto(actor: Actor, propertyId: string, assetId: string) {
  if (!can(actor, "media.write")) throw new Error("Forbidden");
  const asset = await prisma.mediaAsset.findFirst({ where: { id: assetId, gallery: { propertyId } } });
  if (!asset) return { error: "That photo was not found." as const };
  await prisma.mediaAsset.delete({ where: { id: asset.id } });
  await writeAudit({
    actorId: actor.id,
    action: "gallery.photo.delete",
    entityType: "MediaAsset",
    entityId: asset.id,
    after: { galleryId: asset.galleryId, fileName: asset.fileName },
  });
  return { ok: true as const };
}

export async function moveGalleryPhoto(actor: Actor, propertyId: string, assetId: string, direction: "earlier" | "later") {
  if (!can(actor, "media.write")) throw new Error("Forbidden");
  const asset = await prisma.mediaAsset.findFirst({ where: { id: assetId, gallery: { propertyId } } });
  if (!asset) return { error: "That photo was not found." as const };
  const siblings = await prisma.mediaAsset.findMany({
    where: { galleryId: asset.galleryId, kind: "PHOTO", status: "READY" },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const index = siblings.findIndex((item) => item.id === asset.id);
  const neighbor = direction === "earlier" ? index - 1 : index + 1;
  if (index < 0 || neighbor < 0 || neighbor >= siblings.length) return { ok: true as const };
  const ordered = siblings.map((item, position) => ({ id: item.id, sortOrder: position }));
  const current = ordered[index]?.sortOrder ?? index;
  const next = ordered[neighbor]?.sortOrder ?? neighbor;
  ordered[index] = { id: siblings[index]!.id, sortOrder: next };
  ordered[neighbor] = { id: siblings[neighbor]!.id, sortOrder: current };
  await prisma.$transaction(
    ordered.map((item) => prisma.mediaAsset.update({ where: { id: item.id }, data: { sortOrder: item.sortOrder } })),
  );
  return { ok: true as const };
}

/** Latest non-cancelled order and its newest gallery. Does not create an order. */
export async function ensureListingUploadGallery(actor: Actor, propertyId: string) {
  return prepareListingGallery(actor, propertyId, {});
}

export async function publishGallery(actor: Actor, id: string) {
  if (!can(actor, "media.write")) throw new Error("Forbidden");
  await prisma.gallery.update({ where: { id }, data: { status: "PUBLISHED", publishedAt: new Date() } });
  await writeAudit({ actorId: actor.id, action: "gallery.publish", entityType: "Gallery", entityId: id, after: { status: "PUBLISHED" } });
  return { ok: true as const };
}

export async function archiveGallery(actor: Actor, id: string) {
  if (!can(actor, "media.write")) throw new Error("Forbidden");
  await prisma.gallery.update({ where: { id }, data: { status: "ARCHIVED" } });
  await writeAudit({ actorId: actor.id, action: "gallery.archive", entityType: "Gallery", entityId: id, after: { status: "ARCHIVED" } });
  return { ok: true as const };
}

export async function updateGalleryDetails(actor: Actor, id: string, input: { title: string; requirePaid: boolean }) {
  if (!can(actor, "media.write")) throw new Error("Forbidden");
  const current = await prisma.gallery.findUnique({ where: { id } });
  if (!current) return { error: "That gallery was not found." as const };
  const title = input.title.trim() || current.title;
  await prisma.gallery.update({ where: { id }, data: { title, requirePaid: input.requirePaid } });
  await writeAudit({
    actorId: actor.id,
    action: "gallery.update",
    entityType: "Gallery",
    entityId: id,
    before: { title: current.title, requirePaid: current.requirePaid },
    after: { title, requirePaid: input.requirePaid },
  });
  return { ok: true as const };
}

export async function reorderGalleryPhotos(actor: Actor, propertyId: string, galleryId: string, orderedIds: string[]) {
  if (!can(actor, "media.write")) throw new Error("Forbidden");
  const gallery = await prisma.gallery.findFirst({ where: { id: galleryId, propertyId } });
  if (!gallery) return { error: "That gallery was not found." as const };
  const siblings = await prisma.mediaAsset.findMany({
    where: { galleryId, kind: "PHOTO", status: "READY" },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const known = new Set(siblings.map((item) => item.id));
  if (orderedIds.length !== siblings.length || orderedIds.some((id) => !known.has(id))) {
    return { error: "The photo order is out of date. Refresh and try again." as const };
  }
  await prisma.$transaction(
    orderedIds.map((id, index) => prisma.mediaAsset.update({ where: { id }, data: { sortOrder: index } })),
  );
  await writeAudit({
    actorId: actor.id,
    action: "gallery.reorder",
    entityType: "Gallery",
    entityId: galleryId,
    after: { orderedIds },
  });
  return { ok: true as const };
}

export async function replaceGalleryPhoto(
  actor: Actor,
  propertyId: string,
  assetId: string,
  input: { key: string; fileName: string; mimeType: string; sizeBytes: number },
) {
  if (!can(actor, "media.write")) throw new Error("Forbidden");
  const asset = await prisma.mediaAsset.findFirst({ where: { id: assetId, gallery: { propertyId } } });
  if (!asset) return { error: "That photo was not found." as const };
  const previousKey = asset.storageKey;
  const previousPreview = asset.previewKey;
  const isPhoto = !input.mimeType.startsWith("video/");
  let previewKey: string | null = null;
  if (isPhoto) {
    try {
      previewKey = await storeWatermarkedPreview(input.key);
    } catch {
      const env = getEnv();
      if (env.MEDIA_ROOT && input.key !== previousKey) await deleteMediaFile(env.MEDIA_ROOT, input.key);
      return { error: "This photo could not be prepared for preview." as const };
    }
  }
  await prisma.mediaAsset.update({
    where: { id: asset.id },
    data: {
      storageKey: input.key,
      previewKey,
      fileName: input.fileName,
      mimeType: input.mimeType || "application/octet-stream",
      sizeBytes: BigInt(input.sizeBytes),
      kind: input.mimeType.startsWith("video/") ? "VIDEO" : "PHOTO",
      status: "READY",
    },
  });
  const env = getEnv();
  if (env.MEDIA_ROOT && previousKey !== input.key) await deleteMediaFile(env.MEDIA_ROOT, previousKey);
  if (env.MEDIA_ROOT && previousPreview && previousPreview !== previousKey && previousPreview !== previewKey) {
    await deleteMediaFile(env.MEDIA_ROOT, previousPreview);
  }
  await writeAudit({
    actorId: actor.id,
    action: "gallery.photo.replace",
    entityType: "MediaAsset",
    entityId: asset.id,
    before: { fileName: asset.fileName },
    after: { fileName: input.fileName },
  });
  return { id: asset.id };
}

export async function movePhotosToGallery(actor: Actor, propertyId: string, assetIds: string[], targetGalleryId: string) {
  if (!can(actor, "media.write")) throw new Error("Forbidden");
  const assets = await prisma.mediaAsset.findMany({
    where: { id: { in: assetIds }, gallery: { propertyId } },
    include: { gallery: true },
  });
  if (assets.length !== assetIds.length) return { error: "Choose photos from this listing." as const };
  const sourceOrderIds = new Set(assets.map((asset) => asset.gallery.orderId));
  if (sourceOrderIds.size !== 1) return { error: "Move photos within one shoot." as const };
  const target = await prisma.gallery.findFirst({ where: { id: targetGalleryId, propertyId } });
  if (!target || target.orderId !== assets[0]?.gallery.orderId) {
    return { error: "Move photos within the same shoot." as const };
  }
  const last = await prisma.mediaAsset.aggregate({ where: { galleryId: target.id }, _max: { sortOrder: true } });
  let sortOrder = (last._max.sortOrder ?? -1) + 1;
  await prisma.$transaction(
    assets.map((asset) => prisma.mediaAsset.update({ where: { id: asset.id }, data: { galleryId: target.id, sortOrder: sortOrder++ } })),
  );
  await writeAudit({
    actorId: actor.id,
    action: "gallery.photo.move",
    entityType: "Gallery",
    entityId: target.id,
    after: { assetIds },
  });
  return { ok: true as const };
}

/** Creates a gallery on an existing order. Creates the order only when createOrder is set. */
export async function prepareListingGallery(actor: Actor, propertyId: string, input: { orderId?: string; createOrder?: boolean }) {
  if (!can(actor, "media.write")) throw new Error("Forbidden");
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    include: { orders: { include: { galleries: true } } },
  });
  if (!property) return { error: "That listing was not found." as const };
  if (input.createOrder) {
    const order = await prisma.order.create({
      data: {
        clientId: property.clientId,
        propertyId: property.id,
        status: "REQUESTED",
        internalNotes: "listing-photos",
        history: { create: { toStatus: "REQUESTED", actorId: actor.id, note: "Created so listing photos have an order." } },
      },
    });
    return createGallery(actor, { orderId: order.id, title: property.addressLine1 });
  }
  const order = input.orderId ? property.orders.find((item) => item.id === input.orderId) ?? null : pickUploadOrder(property.orders);
  if (!order) return { error: "This listing has no order." as const, needsOrder: true as const };
  if (order.status === "CANCELLED") return { error: "This shoot was cancelled." as const };
  const existing = pickUploadGallery(order.id, order.galleries);
  if (existing) return { id: existing, propertyId: property.id };
  return createGallery(actor, { orderId: order.id, title: property.addressLine1 });
}

export async function deliverListingGallery(actor: Actor, propertyId: string, galleryId: string, markDelivered: boolean) {
  if (!can(actor, "media.write")) throw new Error("Forbidden");
  const gallery = await prisma.gallery.findFirst({ where: { id: galleryId, propertyId }, include: { order: true } });
  if (!gallery) return { error: "That gallery was not found." as const };
  if (!deliveryGalleryId(gallery.id, [{ id: gallery.id, orderId: gallery.orderId }], gallery.orderId)) {
    return { error: "Choose a gallery from this shoot." as const };
  }
  await publishGallery(actor, gallery.id);
  if (!markDelivered) return { ok: true as const, emailed: false as const };
  const { changeOrderStatus } = await import("@/server/services/orders");
  const { canMarkOrderDelivered } = await import("@/lib/listing");
  if (!canMarkOrderDelivered(gallery.order.status)) {
    return { error: "The gallery is published. This order cannot be marked delivered yet." as const, emailed: false as const };
  }
  const changed = await changeOrderStatus(actor, gallery.orderId, "DELIVERED", "Gallery delivered from the listing.");
  if ("error" in changed && changed.error) return { error: changed.error, emailed: false as const };
  return { ok: true as const, emailed: false as const };
}

export async function clientGallery(clientId: string, id: string) {
  return prisma.gallery.findFirst({
    where: { id, clientId, status: "PUBLISHED", property: { archivedAt: null }, order: { archivedAt: null } },
    include: {
      assets: { where: { status: "READY" }, orderBy: { sortOrder: "asc" } },
      property: true,
      client: true,
      order: { include: { invoices: { orderBy: { createdAt: "desc" } } } },
    },
  });
}

export function downloadDecisionFor(gallery: {
  requirePaid: boolean;
  client: { allowUnpaidDownloads: boolean };
  order: { invoices: { status: string; createdAt: Date; amountRefundedCents: number }[] };
}) {
  return galleryDownloadDecision({
    requirePaid: gallery.requirePaid,
    allowUnpaidDownloads: gallery.client.allowUnpaidDownloads,
    invoiceStatus: bestInvoiceStatus(gallery.order.invoices),
  });
}

export async function readGalleryFile(key: string) {
  const env = getEnv();
  if (!env.MEDIA_ROOT) throw new Error("MEDIA_ROOT is not configured.");
  return { root: env.MEDIA_ROOT, bytes: await readMediaFile(env.MEDIA_ROOT, key) };
}

export async function buildGalleryZip(files: { name: string; key: string }[]) {
  const env = getEnv();
  if (!env.MEDIA_ROOT) throw new Error("MEDIA_ROOT is not configured.");
  const key = uniqueZipKey();
  const seen = new Map<string, number>();
  const entries = files.map((file) => {
    const count = (seen.get(file.name) ?? 0) + 1;
    seen.set(file.name, count);
    const name = count === 1 ? file.name : `${count}-${file.name}`;
    return { name, sourcePath: resolveMediaPath(env.MEDIA_ROOT!, file.key) };
  });
  await streamStoredZip(resolveMediaPath(env.MEDIA_ROOT, key), entries);
  return { key };
}

export async function setTrustedDownloads(actor: Actor, clientId: string, allow: boolean) {
  if (!can(actor, "settings.manage")) throw new Error("Forbidden");
  await prisma.client.update({ where: { id: clientId }, data: { allowUnpaidDownloads: allow } });
  await writeAudit({
    actorId: actor.id,
    action: "client.downloads",
    entityType: "Client",
    entityId: clientId,
    after: { allowUnpaidDownloads: allow },
  });
}

export async function listClients(actor: Actor, view?: string) {
  if (!can(actor, "settings.manage") && !can(actor, "crm.read")) throw new Error("Forbidden");
  return prisma.client.findMany({
    where: { archivedAt: view === "archived" ? { not: null } : null },
    orderBy: { lastName: "asc" },
    include: { _count: { select: { properties: true, orders: true, invoices: true, galleries: true } } },
  });
}
