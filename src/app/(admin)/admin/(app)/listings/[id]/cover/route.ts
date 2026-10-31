import { previewServable } from "@/lib/preview-access";
import { can } from "@/lib/permissions";
import { pickCover, type ListingGallery } from "@/lib/listing";
import { getActor } from "@/server/auth/guards";
import { prisma } from "@/server/db/prisma";
import { ensureWatermarkedPreview, readGalleryFile } from "@/server/services/galleries";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  if (!actor || !can(actor, "orders.read")) return new Response("Sign in required.", { status: 401 });
  const { id } = await context.params;
  const property = await prisma.property.findUnique({
    where: { id },
    include: {
      galleries: { include: { assets: true } },
    },
  });
  if (!property) return new Response("Not found.", { status: 404 });
  const galleries: ListingGallery[] = property.galleries.map((gallery) => ({
    id: gallery.id,
    status: gallery.status,
    createdAt: gallery.createdAt,
    assets: gallery.assets.map((asset) => ({
      id: asset.id,
      kind: asset.kind,
      status: asset.status,
      sortOrder: asset.sortOrder,
      previewKey: asset.previewKey,
      storageKey: asset.storageKey,
    })),
  }));
  const cover = pickCover(galleries, property.coverAssetId);
  if (!cover) return new Response("No cover photo.", { status: 404 });
  const asset = property.galleries.flatMap((gallery) => gallery.assets).find((item) => item.id === cover.assetId);
  if (!asset) return new Response("No cover photo.", { status: 404 });
  const previewKey = previewServable(asset) ? asset.previewKey : await ensureWatermarkedPreview(asset);
  if (!previewKey || previewKey === asset.storageKey) return new Response("No cover photo.", { status: 404 });
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
