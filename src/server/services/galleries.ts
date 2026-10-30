import "server-only";
import type { Actor } from "@/lib/actor";
import { galleryDownloadDecision, type InvoiceStatus } from "@/lib/gallery-access";
import { can } from "@/lib/permissions";
import { prisma } from "@/server/db/prisma";
import { getEnv } from "@/server/env";
import { readMediaFile, writeMediaFile } from "@/server/storage/filesystem";
import { writeAudit } from "@/server/audit";
import { storedZip } from "@/lib/zip-store";
import { signMediaToken } from "@/lib/media-sign";

function bestInvoiceStatus(statuses: string[]): InvoiceStatus | null {
  const paid = statuses.find((status) => status === "PAID" || status === "PARTIALLY_REFUNDED");
  return (paid ?? statuses[0] ?? null) as InvoiceStatus | null;
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
    include: { client: true, property: true, assets: { orderBy: { sortOrder: "asc" } }, order: true },
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
  const asset = await prisma.mediaAsset.create({
    data: {
      galleryId,
      kind: input.mimeType.startsWith("video/") ? "VIDEO" : "PHOTO",
      status: "READY",
      storageKey: input.key,
      previewKey: input.key,
      fileName: input.fileName,
      mimeType: input.mimeType || "application/octet-stream",
      sizeBytes: BigInt(input.sizeBytes),
      uploadedById: actor.id,
    },
  });
  return { id: asset.id };
}

export async function publishGallery(actor: Actor, id: string) {
  if (!can(actor, "media.write")) throw new Error("Forbidden");
  await prisma.gallery.update({ where: { id }, data: { status: "PUBLISHED", publishedAt: new Date() } });
  return { ok: true as const };
}

export async function clientGallery(clientId: string, id: string) {
  return prisma.gallery.findFirst({
    where: { id, clientId, status: "PUBLISHED" },
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
  order: { invoices: { status: string }[] };
}) {
  return galleryDownloadDecision({
    requirePaid: gallery.requirePaid,
    allowUnpaidDownloads: gallery.client.allowUnpaidDownloads,
    invoiceStatus: bestInvoiceStatus(gallery.order.invoices.map((invoice) => invoice.status)),
  });
}

export async function readGalleryFile(key: string) {
  const env = getEnv();
  if (!env.MEDIA_ROOT) throw new Error("MEDIA_ROOT is not configured.");
  return { root: env.MEDIA_ROOT, bytes: await readMediaFile(env.MEDIA_ROOT, key) };
}

export async function buildGalleryZip(galleryId: string, files: { name: string; key: string }[]) {
  const env = getEnv();
  if (!env.MEDIA_ROOT) throw new Error("MEDIA_ROOT is not configured.");
  const packed = [];
  for (const file of files) {
    packed.push({ name: file.name, data: new Uint8Array(await readMediaFile(env.MEDIA_ROOT, file.key)) });
  }
  const zip = storedZip(packed);
  const key = `galleries/${galleryId}/bundle.zip`;
  await writeMediaFile(env.MEDIA_ROOT, key, zip);
  const token = signMediaToken({ purpose: "download", key, expiresAt: Date.now() + 10 * 60 * 1000 }, env.ENCRYPTION_KEY);
  return { key, token, bytes: zip };
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

export async function listClients(actor: Actor) {
  if (!can(actor, "settings.manage") && !can(actor, "crm.read")) throw new Error("Forbidden");
  return prisma.client.findMany({ orderBy: { lastName: "asc" } });
}
