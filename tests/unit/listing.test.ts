import { describe, expect, it } from "vitest";
import { listingStatus, pickCover, pickListingOrder, pickShootDate, type ListingGallery, type ListingOrder } from "@/lib/listing";

const order = (patch: Partial<ListingOrder> & Pick<ListingOrder, "id" | "status" | "updatedAt">): ListingOrder => ({
  preferredDate: null,
  bookings: [],
  ...patch,
});

describe("listing snapshot", () => {
  it("uses the latest non-cancelled order for the card", () => {
    const delivered = order({
      id: "delivered",
      status: "DELIVERED",
      updatedAt: new Date("2026-10-01T00:00:00Z"),
    });
    const requested = order({
      id: "requested",
      status: "REQUESTED",
      updatedAt: new Date("2026-10-20T00:00:00Z"),
    });
    const cancelled = order({
      id: "cancelled",
      status: "CANCELLED",
      updatedAt: new Date("2026-10-30T00:00:00Z"),
    });
    const picked = pickListingOrder([delivered, cancelled, requested]);
    expect(picked?.id).toBe("requested");
    expect(listingStatus(picked)).toBe("REQUESTED");
    expect(listingStatus(pickListingOrder([]))).toBe("NO_SHOOT");
    expect(pickListingOrder([cancelled])?.id).toBe("cancelled");
  });

  it("prefers the next shoot, then the latest shoot, then the preferred date", () => {
    const now = new Date("2026-11-01T15:00:00Z");
    const chosen = order({
      id: "shoot",
      status: "SCHEDULED",
      updatedAt: now,
      preferredDate: new Date("2026-12-01T00:00:00Z"),
      bookings: [{ startAt: new Date("2026-10-01T15:00:00Z") }, { startAt: new Date("2026-11-03T15:00:00Z") }],
    });
    expect(pickShootDate(chosen, now)?.toISOString()).toBe("2026-11-03T15:00:00.000Z");
    expect(
      pickShootDate(
        order({
          id: "past",
          status: "DELIVERED",
          updatedAt: now,
          preferredDate: new Date("2026-12-01T00:00:00Z"),
          bookings: [{ startAt: new Date("2026-09-01T15:00:00Z") }],
        }),
        now,
      )?.toISOString(),
    ).toBe("2026-09-01T15:00:00.000Z");
    expect(
      pickShootDate(order({ id: "pref", status: "REQUESTED", updatedAt: now, preferredDate: new Date("2026-12-01T00:00:00Z") }), now)?.toISOString(),
    ).toBe("2026-12-01T00:00:00.000Z");
  });

  it("picks the first ready photo on the newest published gallery", () => {
    const galleries: ListingGallery[] = [
      {
        id: "draft",
        status: "DRAFT",
        createdAt: new Date("2026-10-30T00:00:00Z"),
        assets: [{ id: "draft-photo", kind: "PHOTO", status: "READY", sortOrder: 0, previewKey: null, storageKey: "draft.jpg" }],
      },
      {
        id: "published",
        status: "PUBLISHED",
        createdAt: new Date("2026-10-01T00:00:00Z"),
        assets: [
          { id: "video", kind: "VIDEO", status: "READY", sortOrder: 0, previewKey: null, storageKey: "clip.mp4" },
          { id: "second", kind: "PHOTO", status: "READY", sortOrder: 2, previewKey: "second-preview.jpg", storageKey: "second.jpg" },
          { id: "first", kind: "PHOTO", status: "READY", sortOrder: 1, previewKey: null, storageKey: "first.jpg" },
        ],
      },
    ];
    expect(pickCover(galleries)).toEqual({ galleryId: "published", assetId: "first", key: "first.jpg" });
  });
});
