import { getActor } from "@/server/auth/guards";
import { writeAudit } from "@/server/audit";
import { clientGallery, downloadDecisionFor, readGalleryFile } from "@/server/services/galleries";
import { signMediaToken } from "@/lib/media-sign";
import { getEnv } from "@/server/env";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  if (!actor?.clientId) return new Response("Sign in required.", { status: 401 });
  const { id } = await context.params;
  const gallery = await clientGallery(actor.clientId, id);
  if (!gallery) return new Response("Not found.", { status: 404 });
  const decision = downloadDecisionFor(gallery);
  if (!decision.allowed) return new Response("Payment required before download.", { status: 402 });
  const asset = gallery.assets[0];
  if (!asset) return new Response("This gallery has no files.", { status: 404 });
  await writeAudit({
    actorId: actor.id,
    action: "gallery.download",
    entityType: "Gallery",
    entityId: id,
    after: { assetId: asset.id, reason: decision.reason },
  });
  const env = getEnv();
  const file = await readGalleryFile(asset.storageKey);
  const token = signMediaToken(
    { purpose: "download", key: asset.storageKey, expiresAt: Date.now() + 10 * 60 * 1000 },
    env.ENCRYPTION_KEY,
  );
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": asset.mimeType,
      "Content-Disposition": `attachment; filename="${asset.fileName}"`,
      "X-Accel-Redirect": `/internal-media/${asset.storageKey}`,
      "X-Media-Token": token,
    },
  });
}
