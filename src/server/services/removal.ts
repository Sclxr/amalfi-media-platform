import "server-only";
import type { Actor } from "@/lib/actor";
import {
  brokerageRemoval,
  campaignRemoval,
  clientRemoval,
  galleryRemoval,
  hasFinancialHistory,
  importRemoval,
  leadRemoval,
  listingRemoval,
  orderRemoval,
  type RemovalDecision,
} from "@/lib/removal";
import { can } from "@/lib/permissions";
import { prisma } from "@/server/db/prisma";
import { writeAudit } from "@/server/audit";
import { getEnv } from "@/server/env";
import { deleteMediaFile } from "@/server/storage/filesystem";

export const REMOVAL_KINDS = ["listing", "order", "gallery", "lead", "client", "brokerage", "campaign", "import"] as const;
export type RemovalKind = (typeof REMOVAL_KINDS)[number];

const WRITE: Record<RemovalKind, "orders.write" | "media.write" | "crm.write" | "marketing.draft"> = {
  listing: "orders.write",
  order: "orders.write",
  gallery: "media.write",
  lead: "crm.write",
  client: "crm.write",
  brokerage: "crm.write",
  campaign: "marketing.draft",
  import: "crm.write",
};

function canWrite(actor: Actor, kind: RemovalKind) {
  return can(actor, WRITE[kind]);
}

async function removeFiles(keys: Iterable<string>) {
  const root = getEnv().MEDIA_ROOT;
  if (!root) return;
  for (const key of keys) {
    if (!key) continue;
    try {
      await deleteMediaFile(root, key);
    } catch {
      await writeAudit({ action: "media.file.missing", entityType: "MediaAsset", entityId: key, after: { key } });
    }
  }
}

function invoiceMoney(invoices: { amountPaidCents: number; amountRefundedCents: number; payments: { status: string }[] }[]) {
  return hasFinancialHistory(invoices);
}

export async function previewRemoval(actor: Actor, kind: RemovalKind, id: string): Promise<{ name: string; decision: RemovalDecision } | { error: string }> {
  if (!canWrite(actor, kind) && !can(actor, "records.delete")) throw new Error("Forbidden");
  const loaded = await loadRemoval(kind, id);
  if (!loaded) return { error: "That record was not found." };
  return loaded;
}

export async function archiveRecord(actor: Actor, kind: RemovalKind, id: string) {
  if (!canWrite(actor, kind)) throw new Error("Forbidden");
  const stamp = new Date();
  if (kind === "listing") await prisma.property.update({ where: { id }, data: { archivedAt: stamp } });
  else if (kind === "order") await prisma.order.update({ where: { id }, data: { archivedAt: stamp } });
  else if (kind === "lead") await prisma.lead.update({ where: { id }, data: { deletedAt: stamp } });
  else if (kind === "client") await prisma.client.update({ where: { id }, data: { archivedAt: stamp } });
  else if (kind === "brokerage") await prisma.brokerage.update({ where: { id }, data: { archivedAt: stamp } });
  else if (kind === "campaign") await prisma.campaign.update({ where: { id }, data: { archivedAt: stamp } });
  else if (kind === "import") await prisma.importBatch.update({ where: { id }, data: { archivedAt: stamp } });
  else return { error: "Archive the gallery from its shoot." as const };
  await writeAudit({ actorId: actor.id, action: `${kind}.archive`, entityType: kind, entityId: id, after: { archived: true } });
  return { ok: true as const };
}

export async function restoreRecord(actor: Actor, kind: RemovalKind, id: string) {
  if (!canWrite(actor, kind)) throw new Error("Forbidden");
  if (kind === "listing") await prisma.property.update({ where: { id }, data: { archivedAt: null } });
  else if (kind === "order") await prisma.order.update({ where: { id }, data: { archivedAt: null } });
  else if (kind === "lead") await prisma.lead.update({ where: { id }, data: { deletedAt: null } });
  else if (kind === "client") await prisma.client.update({ where: { id }, data: { archivedAt: null } });
  else if (kind === "brokerage") await prisma.brokerage.update({ where: { id }, data: { archivedAt: null } });
  else if (kind === "campaign") await prisma.campaign.update({ where: { id }, data: { archivedAt: null } });
  else if (kind === "import") await prisma.importBatch.update({ where: { id }, data: { archivedAt: null } });
  else return { error: "Publish the gallery again from its shoot." as const };
  await writeAudit({ actorId: actor.id, action: `${kind}.restore`, entityType: kind, entityId: id, after: { archived: false } });
  return { ok: true as const };
}

export async function deleteRecord(actor: Actor, kind: RemovalKind, id: string) {
  if (!can(actor, "records.delete")) throw new Error("Forbidden");
  const loaded = await loadRemoval(kind, id);
  if (!loaded) return { error: "That record was not found." as const };
  if (!loaded.decision.canDelete) return { error: loaded.decision.reason ?? "This record cannot be deleted." };
  const keys = await destroy(kind, id);
  await removeFiles(keys);
  await writeAudit({
    actorId: actor.id,
    action: `${kind}.delete`,
    entityType: kind,
    entityId: id,
    after: { name: loaded.name, removed: loaded.decision.lines },
  });
  return { ok: true as const };
}

async function loadRemoval(kind: RemovalKind, id: string): Promise<{ name: string; decision: RemovalDecision } | null> {
  if (kind === "listing") {
    const property = await prisma.property.findUnique({
      where: { id },
      include: {
        orders: { include: { bookings: true, invoices: { include: { payments: true } }, galleries: { include: { assets: true } } } },
        galleries: { include: { assets: true } },
      },
    });
    if (!property) return null;
    const invoices = property.orders.flatMap((order) => order.invoices);
    return {
      name: property.addressLine1,
      decision: listingRemoval({
        orders: property.orders.length,
        bookings: property.orders.reduce((sum, order) => sum + order.bookings.length, 0),
        galleries: property.galleries.length,
        photos: property.galleries.reduce((sum, gallery) => sum + gallery.assets.length, 0),
        invoices: invoices.length,
        financial: invoiceMoney(invoices),
      }),
    };
  }
  if (kind === "order") {
    const order = await prisma.order.findUnique({
      where: { id },
      include: { property: true, bookings: true, invoices: { include: { payments: true } }, galleries: { include: { assets: true } } },
    });
    if (!order) return null;
    return {
      name: `Order ${order.number}`,
      decision: orderRemoval({
        bookings: order.bookings.length,
        galleries: order.galleries.length,
        photos: order.galleries.reduce((sum, gallery) => sum + gallery.assets.length, 0),
        invoices: order.invoices.length,
        financial: invoiceMoney(order.invoices),
      }),
    };
  }
  if (kind === "gallery") {
    const gallery = await prisma.gallery.findUnique({
      where: { id },
      include: { assets: true, order: { include: { invoices: { include: { payments: true } } } } },
    });
    if (!gallery) return null;
    return {
      name: gallery.title,
      decision: galleryRemoval({ photos: gallery.assets.length, financial: invoiceMoney(gallery.order.invoices) }),
    };
  }
  if (kind === "lead") {
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        properties: true,
        emails: { where: { sentAt: { not: null } }, select: { id: true } },
        client: { include: { invoices: { include: { payments: true } } } },
      },
    });
    if (!lead) return null;
    return {
      name: `${lead.firstName ?? ""} ${lead.lastName ?? ""}`.trim() || lead.email || "Realtor",
      decision: leadRemoval({
        listings: lead.properties.length,
        sentEmails: lead.emails.length,
        financial: invoiceMoney(lead.client?.invoices ?? []),
      }),
    };
  }
  if (kind === "client") {
    const client = await prisma.client.findUnique({
      where: { id },
      include: { _count: { select: { properties: true, orders: true, invoices: true, galleries: true } } },
    });
    if (!client) return null;
    return {
      name: `${client.firstName} ${client.lastName}`,
      decision: clientRemoval(client._count),
    };
  }
  if (kind === "brokerage") {
    const brokerage = await prisma.brokerage.findUnique({
      where: { id },
      include: { _count: { select: { leads: true, clients: true } } },
    });
    if (!brokerage) return null;
    return { name: brokerage.name, decision: brokerageRemoval(brokerage._count) };
  }
  if (kind === "campaign") {
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: { messages: { where: { sentAt: { not: null } }, select: { id: true } } },
    });
    if (!campaign) return null;
    return { name: campaign.name, decision: campaignRemoval({ status: campaign.status, sentMessages: campaign.messages.length }) };
  }
  const batch = await prisma.importBatch.findUnique({ where: { id } });
  if (!batch) return null;
  return { name: batch.fileName, decision: importRemoval() };
}

async function destroy(kind: RemovalKind, id: string) {
  if (kind === "listing") return destroyListing(id);
  if (kind === "order") return destroyOrder(id);
  if (kind === "gallery") return destroyGallery(id);
  if (kind === "lead") {
    await prisma.emailMessage.deleteMany({ where: { leadId: id, sentAt: null } });
    await prisma.lead.delete({ where: { id } });
    return [];
  }
  if (kind === "client") {
    await prisma.lead.updateMany({ where: { clientId: id }, data: { clientId: null } });
    await prisma.client.delete({ where: { id } });
    return [];
  }
  if (kind === "brokerage") {
    await prisma.brokerage.delete({ where: { id } });
    return [];
  }
  if (kind === "campaign") {
    await prisma.emailMessage.deleteMany({ where: { campaignId: id } });
    await prisma.campaign.delete({ where: { id } });
    return [];
  }
  const batch = await prisma.importBatch.findUnique({ where: { id } });
  await prisma.lead.updateMany({ where: { importBatchId: id }, data: { importBatchId: null } });
  await prisma.importBatch.delete({ where: { id } });
  return batch?.fileKey ? [batch.fileKey] : [];
}

async function destroyListing(id: string) {
  const property = await prisma.property.findUnique({
    where: { id },
    include: { galleries: { include: { assets: true } }, orders: { include: { invoices: { include: { payments: true } } } } },
  });
  if (!property) return [];
  const keys = fileKeys(property.galleries);
  const invoiceIds = property.orders.flatMap((order) => order.invoices.map((invoice) => invoice.id));
  const paymentIds = property.orders.flatMap((order) => order.invoices.flatMap((invoice) => invoice.payments.map((payment) => payment.id)));
  await prisma.$transaction(async (tx) => {
    await tx.property.update({ where: { id }, data: { coverAssetId: null } });
    if (paymentIds.length) await tx.refund.deleteMany({ where: { paymentId: { in: paymentIds } } });
    if (paymentIds.length) await tx.payment.deleteMany({ where: { id: { in: paymentIds } } });
    if (invoiceIds.length) await tx.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
    await tx.booking.updateMany({ where: { order: { propertyId: id } }, data: { rescheduledFromId: null } });
    await tx.gallery.deleteMany({ where: { propertyId: id } });
    await tx.order.deleteMany({ where: { propertyId: id } });
    await tx.property.delete({ where: { id } });
  });
  return [...keys];
}

async function destroyOrder(id: string) {
  const order = await prisma.order.findUnique({
    where: { id },
    include: { galleries: { include: { assets: true } }, invoices: { include: { payments: true } } },
  });
  if (!order) return [];
  const keys = fileKeys(order.galleries);
  const invoiceIds = order.invoices.map((invoice) => invoice.id);
  const paymentIds = order.invoices.flatMap((invoice) => invoice.payments.map((payment) => payment.id));
  const assetIds = order.galleries.flatMap((gallery) => gallery.assets.map((asset) => asset.id));
  await prisma.$transaction(async (tx) => {
    if (assetIds.length) await tx.property.updateMany({ where: { coverAssetId: { in: assetIds } }, data: { coverAssetId: null } });
    if (paymentIds.length) await tx.refund.deleteMany({ where: { paymentId: { in: paymentIds } } });
    if (paymentIds.length) await tx.payment.deleteMany({ where: { id: { in: paymentIds } } });
    if (invoiceIds.length) await tx.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
    await tx.booking.updateMany({ where: { orderId: id }, data: { rescheduledFromId: null } });
    await tx.gallery.deleteMany({ where: { orderId: id } });
    await tx.order.delete({ where: { id } });
  });
  return [...keys];
}

async function destroyGallery(id: string) {
  const gallery = await prisma.gallery.findUnique({ where: { id }, include: { assets: true } });
  if (!gallery) return [];
  const keys = fileKeys([gallery]);
  const assetIds = gallery.assets.map((asset) => asset.id);
  await prisma.$transaction(async (tx) => {
    if (assetIds.length) await tx.property.updateMany({ where: { coverAssetId: { in: assetIds } }, data: { coverAssetId: null } });
    await tx.gallery.delete({ where: { id } });
  });
  return [...keys];
}

function fileKeys(galleries: { zipKey?: string | null; assets: { storageKey: string; previewKey: string | null }[] }[]) {
  const keys = new Set<string>();
  for (const gallery of galleries) {
    if (gallery.zipKey) keys.add(gallery.zipKey);
    for (const asset of gallery.assets) {
      keys.add(asset.storageKey);
      if (asset.previewKey) keys.add(asset.previewKey);
    }
  }
  return keys;
}
