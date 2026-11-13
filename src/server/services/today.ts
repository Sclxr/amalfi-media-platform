import "server-only";
import type { Actor } from "@/lib/actor";
import { startOfEasternDay } from "@/lib/crumbs";
import { can } from "@/lib/permissions";
import { prisma } from "@/server/db/prisma";

export type TodayShoot = {
  id: string;
  when: Date;
  address: string;
  who: string;
  detail: string;
  href: string;
  imageSrc: string | null;
};

export type TodayMoney = {
  id: string;
  address: string;
  amountCents: number;
  href: string;
  imageSrc: string | null;
};

export type TodayGallery = {
  id: string;
  address: string;
  detail: string;
  href: string;
  imageSrc: string | null;
};

function nameOf(person: { firstName: string | null; lastName: string | null } | null | undefined) {
  const name = `${person?.firstName ?? ""} ${person?.lastName ?? ""}`.trim();
  return name || "Client";
}

function coverSrc(propertyId: string, coverAssetId: string | null, photoId?: string | null) {
  if (coverAssetId || photoId) return `/admin/listings/${propertyId}/cover`;
  return null;
}

export async function getToday(actor: Actor, now = new Date()) {
  const start = startOfEasternDay(now);
  const [bookings, invoices, drafts, bareListings] = await Promise.all([
    can(actor, "bookings.read")
      ? prisma.booking.findMany({
          where: {
            cancelledAt: null,
            status: { notIn: ["CANCELLED", "NO_SHOW"] },
            startAt: { gte: start },
            order: { archivedAt: null, property: { archivedAt: null } },
          },
          orderBy: { startAt: "asc" },
          take: 6,
          include: {
            order: {
              include: {
                client: { select: { firstName: true, lastName: true } },
                items: { take: 1, select: { label: true } },
                property: {
                  select: {
                    id: true,
                    addressLine1: true,
                    coverAssetId: true,
                    lead: { select: { firstName: true, lastName: true } },
                  },
                },
              },
            },
          },
        })
      : Promise.resolve([]),
    can(actor, "billing.read")
      ? prisma.invoice.findMany({
          where: {
            status: { in: ["OPEN", "PARTIALLY_PAID"] },
            order: { is: { archivedAt: null, property: { archivedAt: null } } },
          },
          orderBy: { createdAt: "desc" },
          take: 6,
          include: {
            order: {
              include: {
                property: { select: { id: true, addressLine1: true, coverAssetId: true } },
              },
            },
          },
        })
      : Promise.resolve([]),
    can(actor, "media.read")
      ? prisma.gallery.findMany({
          where: {
            status: "DRAFT",
            property: { archivedAt: null },
            assets: { some: { kind: "PHOTO", status: "READY" } },
          },
          orderBy: { createdAt: "desc" },
          take: 6,
          include: {
            property: { select: { id: true, addressLine1: true, coverAssetId: true } },
            assets: { where: { kind: "PHOTO", status: "READY" }, orderBy: { sortOrder: "asc" }, take: 1, select: { id: true } },
            _count: { select: { assets: { where: { kind: "PHOTO", status: "READY" } } } },
          },
        })
      : Promise.resolve([]),
    can(actor, "media.read")
      ? prisma.property.findMany({
          where: {
            archivedAt: null,
            galleries: { none: { assets: { some: { kind: "PHOTO", status: "READY" } } } },
          },
          orderBy: { createdAt: "desc" },
          take: 6,
          select: { id: true, addressLine1: true, coverAssetId: true },
        })
      : Promise.resolve([]),
  ]);

  const shoots: TodayShoot[] = bookings.flatMap((booking) => {
    if (!booking.startAt) return [];
    const property = booking.order.property;
    return [
      {
        id: booking.id,
        when: booking.startAt,
        address: property.addressLine1,
        who: nameOf(property.lead ?? booking.order.client),
        detail: booking.order.items[0]?.label ?? "Shoot",
        href: `/admin/listings/${property.id}`,
        imageSrc: coverSrc(property.id, property.coverAssetId),
      },
    ];
  });

  const unpaid: TodayMoney[] = invoices.flatMap((invoice) => {
    const property = invoice.order?.property;
    if (!property) return [];
    return [
      {
        id: invoice.id,
        address: property.addressLine1,
        amountCents: Math.max(0, invoice.totalCents - invoice.amountPaidCents),
        href: `/admin/listings/${property.id}?tab=billing`,
        imageSrc: coverSrc(property.id, property.coverAssetId),
      },
    ];
  });

  const galleries: TodayGallery[] = [
    ...drafts.map((gallery) => ({
      id: gallery.id,
      address: gallery.property.addressLine1,
      detail: `${gallery._count.assets} ${gallery._count.assets === 1 ? "photo" : "photos"} · not sent`,
      href: `/admin/listings/${gallery.property.id}?tab=gallery`,
      imageSrc: coverSrc(gallery.property.id, gallery.property.coverAssetId, gallery.assets[0]?.id),
    })),
    ...bareListings
      .filter((property) => !drafts.some((gallery) => gallery.property.id === property.id))
      .map((property) => ({
        id: property.id,
        address: property.addressLine1,
        detail: "No photos yet",
        href: `/admin/listings/${property.id}?tab=gallery`,
        imageSrc: null,
      })),
  ].slice(0, 6);

  const quoteTarget = await (can(actor, "orders.read")
    ? prisma.order.findFirst({
        where: {
          archivedAt: null,
          property: { archivedAt: null },
          OR: [{ totalCents: 0 }, { items: { some: { unitPriceCents: null } } }],
        },
        orderBy: { updatedAt: "desc" },
        select: { propertyId: true },
      })
    : Promise.resolve(null));

  return {
    shoots,
    unpaid,
    galleries,
    showMoney: can(actor, "billing.read"),
    newShootHref: "/admin/listings/new",
    sendQuoteHref: quoteTarget ? `/admin/listings/${quoteTarget.propertyId}?tab=billing` : "/admin/listings",
    uploadHref: galleries[0]?.href ?? "/admin/listings",
  };
}
