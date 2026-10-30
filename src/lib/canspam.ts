import { createHmac, timingSafeEqual } from "node:crypto";
import { normalizeEmail } from "@/lib/email";

/** Postal identity shown on every marketing message. Orlando, Florida. */
export const CAN_SPAM_ADDRESS_LINES = ["Amalfi Media", "Orlando, FL", "Central Florida"] as const;

export function signUnsubscribeToken(email: string, secret: string): string {
  const normalized = normalizeEmail(email);
  if (!normalized) throw new Error("Unsubscribe token needs an email.");
  const payload = Buffer.from(JSON.stringify({ e: normalized })).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function readUnsubscribeToken(token: string, secret: string): string | null {
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { e?: string };
    return normalizeEmail(parsed.e);
  } catch {
    return null;
  }
}

export function unsubscribeUrl(origin: string, token: string) {
  return `${origin.replace(/\/$/, "")}/api/unsubscribe?token=${encodeURIComponent(token)}`;
}

export function listUnsubscribeHeaders(url: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${url}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderCampaignHtml(input: { body: string; unsubscribeHref: string }) {
  const address = CAN_SPAM_ADDRESS_LINES.map((line) => escapeHtml(line)).join("<br>");
  const body = escapeHtml(input.body).replace(/\n/g, "<br>");
  return `<div>${body}</div><hr><p>${address}</p><p><a href="${escapeHtml(input.unsubscribeHref)}">Unsubscribe</a></p>`;
}
