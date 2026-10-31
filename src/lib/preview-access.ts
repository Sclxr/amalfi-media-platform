/** A client preview is servable only when it is a different file from the original. */
export function previewServable(asset: { previewKey: string | null; storageKey: string }) {
  return Boolean(asset.previewKey && asset.previewKey !== asset.storageKey);
}

export function needsPreviewBackfill(asset: { kind: string; mimeType: string; previewKey: string | null; storageKey: string }) {
  if (asset.kind !== "PHOTO") return false;
  if (!asset.mimeType.startsWith("image/")) return false;
  return !previewServable(asset);
}

/** `--force` rewrites every photo preview, including ones already watermarked. */
export function shouldWritePreview(
  asset: { kind: string; mimeType: string; previewKey: string | null; storageKey: string },
  force: boolean,
) {
  if (asset.kind !== "PHOTO" || !asset.mimeType.startsWith("image/")) return false;
  return force || needsPreviewBackfill(asset);
}

export function clientMayPreview(input: {
  actorClientId: string | null;
  galleryClientId: string;
  status: string;
  propertyArchived: boolean;
  orderArchived: boolean;
}) {
  if (!input.actorClientId || input.actorClientId !== input.galleryClientId) return false;
  if (input.status !== "PUBLISHED") return false;
  if (input.propertyArchived || input.orderArchived) return false;
  return true;
}

/** Listing, order, gallery, and invoice rows that must follow a realtor change. */
export function listingAccessMove(input: { orderIds: string[]; galleryIds: string[]; invoiceIds: string[] }) {
  return {
    orders: input.orderIds,
    galleries: input.galleryIds,
    invoices: input.invoiceIds,
  };
}
