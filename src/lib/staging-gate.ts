import { timingSafeEqual } from "node:crypto";

export const HEALTH_PATH = "/portal/api/health";

export type StagingGateResult =
  | { action: "allow" }
  | { action: "challenge" }
  | { action: "misconfigured" };

function credentialsMatch(provided: string, expected: string): boolean {
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Staging is closed unless the request presents the configured basic-auth secret.
 * A missing secret fails closed. The health check stays open so a host can probe it.
 */
export function stagingGate(input: {
  appEnv: string;
  basicAuth: string | undefined;
  authorizationHeader: string | null;
  pathname: string;
}): StagingGateResult {
  if (input.appEnv !== "staging") return { action: "allow" };
  if (
    input.pathname === HEALTH_PATH ||
    input.pathname === "/unsubscribe" ||
    input.pathname === "/api/unsubscribe"
  ) {
    return { action: "allow" };
  }
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
