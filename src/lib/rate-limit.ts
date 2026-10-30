export type RateLimitRule = { windowMs: number; max: number };

type Bucket = { count: number; windowStart: number };

export function consumeRateLimitWith(
  store: Map<string, Bucket>,
  key: string,
  rule: RateLimitRule,
  now: number,
): { allowed: boolean; remaining: number } {
  const current = store.get(key);
  if (!current || now - current.windowStart >= rule.windowMs) {
    store.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: rule.max - 1 };
  }
  if (current.count >= rule.max) {
    return { allowed: false, remaining: 0 };
  }
  current.count += 1;
  return { allowed: true, remaining: rule.max - current.count };
}

const buckets = new Map<string, Bucket>();

export function consumeRateLimit(key: string, rule: RateLimitRule, now = Date.now()) {
  return consumeRateLimitWith(buckets, key, rule, now);
}
