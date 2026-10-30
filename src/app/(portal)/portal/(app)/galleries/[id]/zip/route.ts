import { getActor } from "@/server/auth/guards";
import { writeAudit } from "@/server/audit";
import { buildGalleryZip, clientGallery, downloadDecisionFor } from "@/server/services/galleries";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  if (!actor?.clientId) return new Response("Sign in required.", { status: 401 });
  const { id } = await context.params;
  const gallery = await clientGallery(actor.clientId, id);
  if (!gallery) return new Response("Not found.", { status: 404 });
  const decision = downloadDecisionFor(gallery);
  if (!decision.allowed) return new Response("Payment required before download.", { status: 402 });
  if (gallery.assets.length === 0) return new Response("This gallery has no files.", { status: 404 });
  const zip = await buildGalleryZip(
    gallery.id,
    gallery.assets.map((asset) => ({ name: asset.fileName, key: asset.storageKey })),
  );
  await writeAudit({
    actorId: actor.id,
    action: "gallery.download",
    entityType: "Gallery",
    entityId: gallery.id,
    after: { zip: true, reason: decision.reason },
  });
  const copy = Buffer.from(zip.bytes);
  return new Response(new Uint8Array(copy), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="gallery.zip"',
      "X-Accel-Redirect": `/internal-media/${zip.key}`,
    },
  });
}
