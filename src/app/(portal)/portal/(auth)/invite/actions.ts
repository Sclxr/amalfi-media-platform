"use server";

import { headers } from "next/headers";
import { normalizeEmail } from "@/lib/email";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getActor } from "@/server/auth/guards";
import { getEnv } from "@/server/env";
import { claimListingInvite, prepareInviteSignIn, userForInvitePassword } from "@/server/services/invites";

export async function preparePortalSignInCode(input: { email: string; invite?: string }) {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const email = normalizeEmail(input.email) ?? "";
  const env = getEnv();
  const max = env.APP_ENV === "production" || env.APP_ENV === "staging" ? 5 : 30;
  const decision = consumeRateLimit(`otp-send:${email}:${forwarded}`, { windowMs: 15 * 60 * 1000, max });
  if (!decision.allowed) return { error: "Too many codes. Try again in a few minutes." as const };
  if (!email) return { error: "Enter a valid email." as const };
  if (input.invite) {
    const prepared = await prepareInviteSignIn(input.invite, email);
    if ("error" in prepared && prepared.error) return { error: prepared.error };
  }
  return { ok: true as const };
}

export async function claimListingInviteAction(input: { token: string; email?: string; password?: string }) {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const email = input.email?.trim().toLowerCase() ?? "";
  const decision = consumeRateLimit(`invite:${email}:${forwarded}`, { windowMs: 15 * 60 * 1000, max: 10 });
  if (!decision.allowed) return { error: "Too many attempts. Try again in a few minutes." as const };

  const actor = await getActor();
  const user = input.password
    ? await userForInvitePassword(email, input.password)
    : actor
      ? { id: actor.id, email: actor.email, clientId: actor.clientId }
      : null;
  const result = await claimListingInvite({ token: input.token, user });
  if ("error" in result) return { error: result.error };
  return { ok: true as const, already: result.already, next: result.next };
}
