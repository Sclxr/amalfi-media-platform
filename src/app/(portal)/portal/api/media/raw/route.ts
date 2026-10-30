import { verifyMediaToken } from "@/lib/media-sign";
import { readMediaFile, writeMediaFile } from "@/server/storage/filesystem";
import { getEnv } from "@/server/env";

const MAX_BYTES = 200 * 1024 * 1024;

function tokenFrom(request: Request) {
  return new URL(request.url).searchParams.get("token") ?? "";
}

export async function PUT(request: Request) {
  const env = getEnv();
  if (!env.MEDIA_ROOT) return Response.json({ error: "MEDIA_ROOT is not configured." }, { status: 503 });
  const verified = verifyMediaToken(tokenFrom(request), env.ENCRYPTION_KEY);
  if (!verified || verified.purpose !== "upload") {
    return Response.json({ error: "Upload link is invalid or expired." }, { status: 401 });
  }
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) {
    return Response.json({ error: "File is empty or too large." }, { status: 400 });
  }
  await writeMediaFile(env.MEDIA_ROOT, verified.key, bytes);
  return Response.json({ ok: true, key: verified.key, bytes: bytes.byteLength });
}

export async function GET(request: Request) {
  const env = getEnv();
  if (!env.MEDIA_ROOT) return Response.json({ error: "MEDIA_ROOT is not configured." }, { status: 503 });
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
