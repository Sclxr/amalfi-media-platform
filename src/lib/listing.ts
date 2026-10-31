import { adminOrderLabel, type OrderStatus } from "@/lib/order-status";

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

export type ListingCover = { galleryId: string; assetId: string; key: string };

/** Published galleries win. Then the newest gallery. First ready photo by sort order. */
export function pickCover(galleries: readonly ListingGallery[]): ListingCover | null {
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
