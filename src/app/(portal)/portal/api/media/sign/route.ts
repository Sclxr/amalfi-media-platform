import { randomUUID } from "node:crypto";
import { getActor } from "@/server/auth/guards";
import { getEnv } from "@/server/env";
import { signMediaToken } from "@/lib/media-sign";

const TEN_MINUTES = 10 * 60 * 1000;

function safeFileName(name: string) {
  const base = name.split(/[/\\]/).pop() ?? "file";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 80);
  return cleaned || "file";
}

export async function POST(request: Request) {
  const actor = await getActor();
  if (!actor || (actor.role !== "ADMIN" && actor.role !== "STAFF")) {
    return Response.json({ error: "Staff sign-in required." }, { status: 401 });
  }
  const env = getEnv();
  if (!env.MEDIA_ROOT) {
    return Response.json({ error: "MEDIA_ROOT is not configured." }, { status: 503 });
  }
  const body = (await request.json()) as { filename?: string };
  const filename = safeFileName(body.filename ?? "upload.bin");
  const key = `uploads/${randomUUID()}/${filename}`;
  const expiresAt = Date.now() + TEN_MINUTES;
  const uploadToken = signMediaToken({ purpose: "upload", key, expiresAt }, env.ENCRYPTION_KEY);
  const downloadToken = signMediaToken({ purpose: "download", key, expiresAt }, env.ENCRYPTION_KEY);
  const origin = env.APP_URL.replace(/\/$/, "");
  return Response.json({
    key,
    uploadUrl: `${origin}/portal/api/media/raw?token=${encodeURIComponent(uploadToken)}`,
    downloadUrl: `${origin}/portal/api/media/raw?token=${encodeURIComponent(downloadToken)}`,
    expiresAt,
  });
}
