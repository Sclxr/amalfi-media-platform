import { createHmac, timingSafeEqual } from "node:crypto";

export type MediaPurpose = "upload" | "download";

export type MediaToken = {
  purpose: MediaPurpose;
  key: string;
  expiresAt: number;
};

export function isSafeMediaKey(key: string) {
  if (!key || key.length > 240) return false;
  if (key.startsWith("/") || key.includes("\\") || key.includes("..")) return false;
  return /^[a-zA-Z0-9][a-zA-Z0-9/_.-]*$/.test(key);
}

export function signMediaToken(token: MediaToken, secret: string) {
  if (!isSafeMediaKey(token.key)) throw new Error("Unsafe media key.");
  const payload = Buffer.from(
    JSON.stringify({ p: token.purpose, k: token.key, e: token.expiresAt }),
  ).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyMediaToken(token: string, secret: string, now = Date.now()): MediaToken | null {
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  let parsed: { p?: string; k?: string; e?: number };
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      p?: string;
      k?: string;
      e?: number;
    };
  } catch {
    return null;
  }
  if (parsed.p !== "upload" && parsed.p !== "download") return null;
  if (typeof parsed.k !== "string" || !isSafeMediaKey(parsed.k)) return null;
  if (typeof parsed.e !== "number" || parsed.e < now) return null;
  return { purpose: parsed.p, key: parsed.k, expiresAt: parsed.e };
}
