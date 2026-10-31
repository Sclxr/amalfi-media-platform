import { can } from "@/lib/permissions";
import { getActor } from "@/server/auth/guards";
import { prisma } from "@/server/db/prisma";
import { readGalleryFile } from "@/server/services/galleries";

export async function GET(_request: Request, context: { params: Promise<{ id: string; assetId: string }> }) {
  const actor = await getActor();
  if (!actor || !can(actor, "orders.read")) return new Response("Sign in required.", { status: 401 });
  const { id, assetId } = await context.params;
  const asset = await prisma.mediaAsset.findFirst({
    where: { id: assetId, gallery: { propertyId: id }, kind: "PHOTO", status: "READY" },
  });
  if (!asset) return new Response("Not found.", { status: 404 });
  try {
    const file = await readGalleryFile(asset.storageKey);
    return new Response(new Uint8Array(file.bytes), {
      headers: {
        "Content-Type": asset.mimeType,
        "Cache-Control": "private, max-age=60",
        "X-Preview-Watermark": "false",
      },
    });
  } catch {
    return new Response("File not found.", { status: 404 });
  }
}
