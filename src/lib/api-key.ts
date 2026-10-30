import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** Scopes a marketing bot may be given. Sending is intentionally absent. */
export const BOT_SCOPES = ["leads:write", "notes:write", "campaigns:draft"] as const;
export type BotScope = (typeof BOT_SCOPES)[number];

export function assertDraftOnlyScopes(scopes: readonly string[]): BotScope[] {
  const allowed = new Set<string>(BOT_SCOPES);
  const unique = [...new Set(scopes)];
  if (unique.length === 0) throw new Error("Choose at least one scope.");
  for (const scope of unique) {
    if (scope.includes("send") || !allowed.has(scope)) {
      throw new Error("Marketing bot keys are draft-only and cannot send.");
    }
  }
  return unique as BotScope[];
}

export function botAllows(scopes: readonly string[], scope: BotScope | "campaigns:send"): boolean {
  if (scope === "campaigns:send") return false;
  return scopes.includes(scope);
}

export function generateApiKey(): { token: string; prefix: string; hash: string } {
  const prefix = randomBytes(4).toString("hex");
  const secret = randomBytes(24).toString("hex");
  const token = `amalfi_${prefix}_${secret}`;
  return { token, prefix, hash: hashApiKey(token) };
}

export function hashApiKey(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function apiKeyPrefix(token: string): string | null {
  const match = /^amalfi_([0-9a-f]{8})_/.exec(token.trim());
  return match?.[1] ?? null;
}

export function apiKeyMatches(token: string, hash: string): boolean {
  const left = Buffer.from(hashApiKey(token));
  const right = Buffer.from(hash);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
