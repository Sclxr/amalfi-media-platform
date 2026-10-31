import { adminOrderLabel, nextOrderStatuses, type OrderStatus } from "@/lib/order-status";

export const LISTING_STATUSES = [
  "NO_SHOOT",
  "REQUESTED",
  "QUOTED",
  "CONFIRMED",
  "SCHEDULED",
  "SHOOT_COMPLETE",
  "EDITING",
  "READY_FOR_DELIVERY",
  "DELIVERED",
  "ARCHIVED",
  "CANCELLED",
] as const;

export type ListingStatus = (typeof LISTING_STATUSES)[number];

export type ListingOrder = {
  id: string;
  status: OrderStatus;
  updatedAt: Date;
  preferredDate: Date | null;
  bookings: { startAt: Date | null }[];
};

export type ListingGallery = {
  id: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  createdAt: Date;
  assets: {
    id: string;
    kind: string;
    status: string;
    sortOrder: number;
    previewKey: string | null;
    storageKey: string;
  }[];
};

/** Latest non-cancelled order. If every order is cancelled, the latest cancelled order. */
export function pickListingOrder<T extends ListingOrder>(orders: readonly T[]): T | null {
  if (orders.length === 0) return null;
  const active = orders.filter((order) => order.status !== "CANCELLED");
  const pool = active.length > 0 ? active : orders;
  return [...pool].sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime() || right.id.localeCompare(left.id))[0] ?? null;
}

export function listingStatus(order: ListingOrder | null): ListingStatus {
  return order?.status ?? "NO_SHOOT";
}

export function listingStatusLabel(status: ListingStatus): string {
  if (status === "NO_SHOOT") return "No shoot";
  return adminOrderLabel(status);
}

/** Next booking start, otherwise the latest start, otherwise the preferred date. */
export function pickShootDate(order: ListingOrder | null, now = new Date()): Date | null {
  if (!order) return null;
  const starts = order.bookings.map((booking) => booking.startAt).filter((start): start is Date => start instanceof Date);
  const upcoming = starts.filter((start) => start.getTime() >= now.getTime()).sort((a, b) => a.getTime() - b.getTime());
  if (upcoming[0]) return upcoming[0];
  const latest = [...starts].sort((a, b) => b.getTime() - a.getTime());
  if (latest[0]) return latest[0];
  return order.preferredDate;
}

/** Latest non-cancelled order. Photos attach here. A cancelled-only property has no upload order. */
export function pickUploadOrder<T extends { id: string; status: OrderStatus; updatedAt: Date }>(orders: readonly T[]): T | null {
  const active = orders.filter((order) => order.status !== "CANCELLED");
  if (active.length === 0) return null;
  return [...active].sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime() || right.id.localeCompare(left.id))[0] ?? null;
}

/** Newest gallery on the upload order. Null when that order has no gallery yet. */
export function pickUploadGallery(
  orderId: string | null,
  galleries: readonly { id: string; orderId: string; createdAt: Date }[],
): string | null {
  if (!orderId) return null;
  const matches = galleries
    .filter((gallery) => gallery.orderId === orderId)
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime() || right.id.localeCompare(left.id));
  return matches[0]?.id ?? null;
}

export type ListingCover = { galleryId: string; assetId: string; key: string };

export const PROPERTY_TYPE_LABELS: Record<string, string> = {
  SINGLE_FAMILY: "Single family",
  CONDO: "Condo",
  TOWNHOUSE: "Townhouse",
  MULTI_FAMILY: "Multi-family",
  LAND: "Land",
  COMMERCIAL: "Commercial",
  RENTAL: "Rental",
  OTHER: "Other",
};

export function propertyTypeLabel(value: string): string {
  return PROPERTY_TYPE_LABELS[value] ?? "Other";
}

/** Move one id so it occupies the index of another id. Unknown ids are left in place. */
export function movePhotoOrder(ids: readonly string[], activeId: string, overId: string): string[] {
  const next = [...ids];
  const from = next.indexOf(activeId);
  const to = next.indexOf(overId);
  if (from < 0 || to < 0 || from === to) return next;
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

export function stepPhotoOrder(ids: readonly string[], activeId: string, direction: "earlier" | "later"): string[] {
  const index = ids.indexOf(activeId);
  const neighbor = direction === "earlier" ? index - 1 : index + 1;
  if (index < 0 || neighbor < 0 || neighbor >= ids.length) return [...ids];
  return movePhotoOrder(ids, activeId, ids[neighbor]!);
}

export function canMarkOrderDelivered(status: OrderStatus): boolean {
  return nextOrderStatuses(status).includes("DELIVERED");
}

/** A delivery publishes one gallery, and only when it belongs to the chosen order. */
export function deliveryGalleryId(
  galleryId: string,
  galleries: readonly { id: string; orderId: string }[],
  orderId: string,
): string | null {
  const gallery = galleries.find((item) => item.id === galleryId);
  if (!gallery || gallery.orderId !== orderId) return null;
  return gallery.id;
}

/** An explicit ready photo wins. Otherwise a published gallery wins, then the newest gallery. */
export function pickCover(galleries: readonly ListingGallery[], coverAssetId?: string | null): ListingCover | null {
  if (coverAssetId) {
    for (const gallery of galleries) {
      const photo = gallery.assets.find((asset) => asset.id === coverAssetId && asset.kind === "PHOTO" && asset.status === "READY");
      if (photo) return { galleryId: gallery.id, assetId: photo.id, key: photo.previewKey || photo.storageKey };
    }
  }
  const ranked = [...galleries].sort((left, right) => {
    const published = Number(right.status === "PUBLISHED") - Number(left.status === "PUBLISHED");
    if (published !== 0) return published;
    return right.createdAt.getTime() - left.createdAt.getTime();
  });
  for (const gallery of ranked) {
    const photo = [...gallery.assets]
      .filter((asset) => asset.kind === "PHOTO" && asset.status === "READY")
      .sort((left, right) => left.sortOrder - right.sortOrder)[0];
    if (!photo) continue;
    return { galleryId: gallery.id, assetId: photo.id, key: photo.previewKey || photo.storageKey };
  }
  return null;
}
