/**
 * Smallest charge whose rounded card fee leaves at least the listing price.
 * Stripe rounds percent-plus-fixed to the nearest cent, so $120.00 at 2.9% + $0.30 is $123.89.
 */
export function cardProcessingQuote(input: { priceCents: number; percentBps: number; fixedCents: number }): {
  totalCents: number;
  feeCents: number;
} {
  const priceCents = Math.max(0, Math.trunc(input.priceCents));
  const percentBps = Math.trunc(input.percentBps);
  const fixedCents = Math.trunc(input.fixedCents);
  if (priceCents === 0 || (percentBps <= 0 && fixedCents <= 0)) {
    return { totalCents: priceCents, feeCents: 0 };
  }
  if (percentBps >= 10_000 || fixedCents < 0) {
    throw new Error("Card fee settings are invalid.");
  }
  const feeFor = (total: number) => Math.round((total * percentBps + fixedCents * 10_000) / 10_000);
  const covers = (total: number) => total - feeFor(total) >= priceCents;
  let total = priceCents + Math.max(0, fixedCents);
  const limit = total + priceCents + 10_000;
  while (!covers(total)) {
    total += 1;
    if (total > limit) throw new Error("Card fee settings are invalid.");
  }
  while (total > priceCents && covers(total - 1)) total -= 1;
  return { totalCents: total, feeCents: total - priceCents };
}

export function cardFeeFromEnv(input: { percent?: string; fixedCents?: string }): { percentBps: number; fixedCents: number } {
  const percent = Number(input.percent ?? "2.9");
  const fixed = Number(input.fixedCents ?? "30");
  if (!Number.isFinite(percent) || percent < 0 || percent >= 100) {
    throw new Error("CARD_FEE_PERCENT must be a percent from 0 up to 100.");
  }
  if (!Number.isInteger(fixed) || fixed < 0 || fixed > 10_000) {
    throw new Error("CARD_FEE_FIXED_CENTS must be a whole number of cents.");
  }
  return { percentBps: Math.round(percent * 100), fixedCents: fixed };
}
