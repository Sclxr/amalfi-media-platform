import { describe, expect, it } from "vitest";
import { transactionalSendDecision } from "@/lib/transactional-email";
import { canVoidInvoice } from "@/lib/invoice-void";
import {
  canMarkOrderDelivered,
  deliveryGalleryId,
  listingStatus,
  movePhotoOrder,
  pickCover,
  pickListingOrder,
  pickShootDate,
  pickUploadGallery,
  pickUploadOrder,
  stepPhotoOrder,
  type ListingGallery,
  type ListingOrder,
} from "@/lib/listing";

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

  it("chooses the latest non-cancelled order and its newest gallery", () => {
    const orders = [
      { id: "old", status: "DELIVERED" as const, updatedAt: new Date("2026-10-01T00:00:00Z") },
      { id: "new", status: "REQUESTED" as const, updatedAt: new Date("2026-10-20T00:00:00Z") },
      { id: "cancelled", status: "CANCELLED" as const, updatedAt: new Date("2026-10-30T00:00:00Z") },
    ];
    const order = pickUploadOrder(orders);
    expect(order?.id).toBe("new");
    expect(pickUploadOrder(orders.filter((item) => item.status === "CANCELLED"))).toBeNull();
    const galleries = [
      { id: "older-gallery", orderId: "new", createdAt: new Date("2026-10-21T00:00:00Z") },
      { id: "newer-gallery", orderId: "new", createdAt: new Date("2026-10-22T00:00:00Z") },
      { id: "other-order", orderId: "old", createdAt: new Date("2026-10-29T00:00:00Z") },
    ];
    expect(pickUploadGallery(order?.id ?? null, galleries)).toBe("newer-gallery");
    expect(pickUploadGallery(null, galleries)).toBeNull();
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
    expect(pickCover(galleries, "second")).toEqual({ galleryId: "published", assetId: "second", key: "second-preview.jpg" });
    expect(pickCover(galleries, "missing")).toEqual({ galleryId: "published", assetId: "first", key: "first.jpg" });
    expect(pickCover(galleries, "video")).toEqual({ galleryId: "published", assetId: "first", key: "first.jpg" });
  });

  it("reorders photos inside one list and steps earlier or later", () => {
    expect(movePhotoOrder(["a", "b", "c"], "c", "a")).toEqual(["c", "a", "b"]);
    expect(stepPhotoOrder(["a", "b", "c"], "b", "earlier")).toEqual(["b", "a", "c"]);
    expect(stepPhotoOrder(["a", "b", "c"], "a", "earlier")).toEqual(["a", "b", "c"]);
  });

  it("publishes only a gallery that belongs to the chosen order", () => {
    const galleries = [
      { id: "this-shoot", orderId: "order-a" },
      { id: "other-shoot", orderId: "order-b" },
    ];
    expect(deliveryGalleryId("this-shoot", galleries, "order-a")).toBe("this-shoot");
    expect(deliveryGalleryId("other-shoot", galleries, "order-a")).toBeNull();
    expect(canMarkOrderDelivered("EDITING")).toBe(true);
    expect(canMarkOrderDelivered("REQUESTED")).toBe(false);
  });

  it("voids an open invoice only when nothing has been paid", () => {
    expect(canVoidInvoice({ status: "OPEN", amountPaidCents: 0, payments: [] })).toBe(true);
    expect(canVoidInvoice({ status: "DRAFT", amountPaidCents: 0, payments: [] })).toBe(true);
    expect(canVoidInvoice({ status: "OPEN", amountPaidCents: 0, payments: [{ status: "SUCCEEDED" }] })).toBe(false);
    expect(canVoidInvoice({ status: "PAID", amountPaidCents: 12000, payments: [{ status: "SUCCEEDED" }] })).toBe(false);
    expect(canVoidInvoice({ status: "VOID", amountPaidCents: 0, payments: [] })).toBe(false);
  });

  it("does not send a delivery email outside production", () => {
    const decision = transactionalSendDecision({ appEnv: "staging", emailTransactionalEnabled: true });
    expect(decision.allowed).toBe(false);
    expect(decision.previewOnly).toBe(true);
  });
});
