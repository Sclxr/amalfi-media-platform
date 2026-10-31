import { getActor } from "@/server/auth/guards";
import { writeAudit } from "@/server/audit";
import { buildGalleryZip, clientGallery, downloadDecisionFor, readGalleryFile } from "@/server/services/galleries";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  if (!actor?.clientId) return new Response("Sign in required.", { status: 401 });
  const { id } = await context.params;
  const gallery = await clientGallery(actor.clientId, id);
  if (!gallery) return new Response("Not found.", { status: 404 });
  const decision = downloadDecisionFor(gallery);
  if (!decision.allowed) return new Response("Payment required before download.", { status: 402 });
  const photos = gallery.assets.filter((asset) => asset.kind === "PHOTO");
  if (photos.length === 0) return new Response("This gallery has no files.", { status: 404 });
  const zip = await buildGalleryZip(photos.map((asset) => ({ name: asset.fileName, key: asset.storageKey })));
  await writeAudit({
    actorId: actor.id,
    action: "gallery.download",
    entityType: "Gallery",
    entityId: gallery.id,
    after: { zip: true, photos: photos.length, reason: decision.reason },
  });
  const file = await readGalleryFile(zip.key);
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="gallery.zip"',
      "X-Accel-Redirect": `/internal-media/${zip.key}`,
    },
  });
}
