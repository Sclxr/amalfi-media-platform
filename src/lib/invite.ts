import { createHash, randomBytes } from "node:crypto";

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function newInviteToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashInviteToken(token) };
}

export function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** Portal paths only. Anything else falls back, including open redirects. */
export function portalNext(value: string | undefined, fallback: string) {
  if (!value || !value.startsWith("/portal/") || value.includes("\\") || value.includes("://") || value.split("/").includes("..")) {
    return fallback;
  }
  return value;
}

export function galleryDestination(galleryId: string | null | undefined) {
  if (!galleryId || !/^[a-z0-9]+$/i.test(galleryId)) return "/portal/galleries";
  return `/portal/galleries/${galleryId}`;
}

export type ClaimCheck = {
  now: number;
  invite: {
    expiresAt: number;
    usedAt: number | null;
    clientId: string;
    clientEmail: string;
    clientUserId: string | null;
  } | null;
  user: { id: string; email: string; clientId: string | null } | null;
};

/** An invite links one account to the existing client. Email must match. A used or expired link does not. */
export function claimDecision(input: ClaimCheck): { ok: true; already: boolean } | { ok: false; error: string } {
  if (!input.invite || input.invite.expiresAt <= input.now) {
    return { ok: false, error: "This invite link is invalid or expired." };
  }
  if (input.invite.usedAt) return { ok: false, error: "This invite link was already used." };
  if (!input.user) return { ok: false, error: "Email or password is incorrect." };
  if (input.user.email.trim().toLowerCase() !== input.invite.clientEmail.trim().toLowerCase()) {
    return { ok: false, error: "Use the email this listing was created for." };
  }
  if (input.invite.clientUserId && input.invite.clientUserId !== input.user.id) {
    return { ok: false, error: "This listing is already claimed." };
  }
  if (input.user.clientId && input.user.clientId !== input.invite.clientId) {
    return { ok: false, error: "This account is already linked to another client." };
  }
  return { ok: true, already: input.invite.clientUserId === input.user.id };
}
