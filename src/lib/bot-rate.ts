export const BOT_RATE_PER_MINUTE = 60;
export const BOT_RATE_PER_DAY = 1000;

export function botWindowKeys(now: number) {
  const minute = Math.floor(now / 60_000);
  const day = new Date(now).toISOString().slice(0, 10);
  return { minute: `m:${minute}`, day: `d:${day}` };
}

/** Seconds until the current window ends. At least 1. */
export function botRetryAfter(kind: "minute" | "day", now: number) {
  if (kind === "minute") {
    const elapsed = Math.floor(now / 1000) % 60;
    return Math.max(1, 60 - elapsed);
  }
  const date = new Date(now);
  const next = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1);
  return Math.max(1, Math.ceil((next - now) / 1000));
}

export function botRateDecision(input: { minuteCount: number; dayCount: number; now: number }) {
  if (input.minuteCount > BOT_RATE_PER_MINUTE) {
    return { allowed: false as const, retryAfter: botRetryAfter("minute", input.now) };
  }
  if (input.dayCount > BOT_RATE_PER_DAY) {
    return { allowed: false as const, retryAfter: botRetryAfter("day", input.now) };
  }
  return { allowed: true as const };
}
