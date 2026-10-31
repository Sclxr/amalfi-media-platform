import { clientMayPreview, previewServable } from "@/lib/preview-access";
import { getActor } from "@/server/auth/guards";
import { prisma } from "@/server/db/prisma";
import { ensureWatermarkedPreview, readGalleryFile } from "@/server/services/galleries";

export async function GET(_request: Request, context: { params: Promise<{ id: string; assetId: string }> }) {
  const actor = await getActor();
  if (!actor?.clientId) return new Response("Sign in required.", { status: 401 });
  const { id, assetId } = await context.params;
  const asset = await prisma.mediaAsset.findFirst({
    where: { id: assetId, galleryId: id },
    include: { gallery: { include: { property: true, order: true } } },
  });
  if (
    !asset ||
    !clientMayPreview({
      actorClientId: actor.clientId,
      galleryClientId: asset.gallery.clientId,
      status: asset.gallery.status,
      propertyArchived: Boolean(asset.gallery.property.archivedAt),
      orderArchived: Boolean(asset.gallery.order.archivedAt),
    }) ||
    !asset.mimeType.startsWith("image/")
  ) {
    return new Response("Not found.", { status: 404 });
  }
  const previewKey = previewServable(asset) ? asset.previewKey : await ensureWatermarkedPreview(asset);
  if (!previewKey || previewKey === asset.storageKey) return new Response("Not found.", { status: 404 });
  try {
    const file = await readGalleryFile(previewKey);
    return new Response(new Uint8Array(file.bytes), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, max-age=60",
        "X-Preview-Watermark": "true",
      },
    });
  } catch {
    return new Response("File not found.", { status: 404 });
  }
}
