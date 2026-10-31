import { formatMegabytes } from "@/lib/media-limit";
import { verifyMediaToken } from "@/lib/media-sign";
import { MediaTooLargeError, readMediaFile, writeMediaStream } from "@/server/storage/filesystem";
import { getEnv } from "@/server/env";

function tokenFrom(request: Request) {
  return new URL(request.url).searchParams.get("token") ?? "";
}

export async function PUT(request: Request) {
  const env = getEnv();
  if (!env.MEDIA_ROOT) return Response.json({ error: "Media storage is not configured." }, { status: 503 });
  const verified = verifyMediaToken(tokenFrom(request), env.ENCRYPTION_KEY);
  if (!verified || verified.purpose !== "upload") {
    return Response.json({ error: "Upload link is invalid or expired." }, { status: 401 });
  }
  if (!request.body) return Response.json({ error: "Choose a photo to upload." }, { status: 400 });
  try {
    const bytes = await writeMediaStream(env.MEDIA_ROOT, verified.key, request.body, env.mediaMaxUploadBytes);
    return Response.json({ ok: true, key: verified.key, bytes });
  } catch (error) {
    if (error instanceof MediaTooLargeError) {
      return Response.json(
        { error: `This photo is too large. The limit is ${formatMegabytes(env.mediaMaxUploadBytes)}.` },
        { status: 413 },
      );
    }
    const message = error instanceof Error && error.message === "File is empty." ? "Choose a photo to upload." : "The photo was not stored.";
    return Response.json({ error: message }, { status: 400 });
  }
}

export async function GET(request: Request) {
  const env = getEnv();
  if (!env.MEDIA_ROOT) return Response.json({ error: "Media storage is not configured." }, { status: 503 });
  const verified = verifyMediaToken(tokenFrom(request), env.ENCRYPTION_KEY);
  if (!verified || verified.purpose !== "download") {
    return Response.json({ error: "Download link is invalid or expired." }, { status: 401 });
  }
  let bytes: Buffer;
  try {
    bytes = await readMediaFile(env.MEDIA_ROOT, verified.key);
  } catch {
    return Response.json({ error: "File not found." }, { status: 404 });
  }
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(bytes.byteLength),
      "X-Accel-Redirect": `/internal-media/${verified.key}`,
      "Cache-Control": "private, max-age=0",
    },
  });
}
