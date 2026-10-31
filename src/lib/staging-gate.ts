import { timingSafeEqual } from "node:crypto";

export const HEALTH_PATH = "/portal/api/health";

export type StagingGateResult =
  | { action: "allow" }
  | { action: "challenge" }
  | { action: "misconfigured" };

/** Portal pages, invite links, and the auth routes a realtor needs. Admin stays behind the password. */
export function stagingBasicAuthBypass(pathname: string) {
  if (pathname === HEALTH_PATH || pathname === "/unsubscribe" || pathname === "/api/unsubscribe" || pathname === "/api/stripe/webhook") {
    return true;
  }
  if (pathname === "/portal" || pathname.startsWith("/portal/")) return true;
  if (pathname === "/api/auth" || pathname.startsWith("/api/auth/")) return true;
  return false;
}

function credentialsMatch(provided: string, expected: string): boolean {
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Staging admin stays closed unless the request presents the configured basic-auth secret.
 * A missing secret fails closed for those routes. Portal, invite, and auth routes stay open
 * so a realtor can sign in; gallery files still require an application session.
 */
export function stagingGate(input: {
  appEnv: string;
  basicAuth: string | undefined;
  authorizationHeader: string | null;
  pathname: string;
}): StagingGateResult {
  if (input.appEnv !== "staging") return { action: "allow" };
  if (stagingBasicAuthBypass(input.pathname)) return { action: "allow" };
  if (!input.basicAuth || !input.basicAuth.includes(":")) return { action: "misconfigured" };
  const header = input.authorizationHeader;
  if (!header?.startsWith("Basic ")) return { action: "challenge" };
  let decoded = "";
  try {
    decoded = Buffer.from(header.slice("Basic ".length), "base64").toString("utf8");
  } catch {
    return { action: "challenge" };
  }
  if (!credentialsMatch(decoded, input.basicAuth)) return { action: "challenge" };
  return { action: "allow" };
}
