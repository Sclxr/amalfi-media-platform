"use server";

import { headers } from "next/headers";
import { getActor } from "@/server/auth/guards";
import { claimListingInvite, userForInvitePassword } from "@/server/services/invites";
import { consumeRateLimit } from "@/lib/rate-limit";

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
