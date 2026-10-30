import "server-only";
import { parseEnv, type ParsedEnv } from "@/lib/env";

let cached: ParsedEnv | null = null;

export function getEnv(): ParsedEnv {
  if (cached) return cached;
  cached = parseEnv(process.env);
  return cached;
}

export function resetEnvCache() {
  cached = null;
}
