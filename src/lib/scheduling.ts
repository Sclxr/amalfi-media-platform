export const BUSINESS_TIME_ZONE = "America/New_York";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export type ZonedParts = { weekday: number; date: string; minutes: number };

export function zonedParts(date: Date, timeZone = BUSINESS_TIME_ZONE): ZonedParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((part) => [part.type, part.value]));
  const weekday = WEEKDAYS.indexOf(parts.weekday as (typeof WEEKDAYS)[number]);
  return {
    weekday,
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

/** Interpret a datetime-local value as America/New_York. */
export function zonedDateTime(value: string, timeZone = BUSINESS_TIME_ZONE): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  const utcGuess = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute)));
  const parts = zonedParts(utcGuess, timeZone);
  const wanted = Number(hour) * 60 + Number(minute);
  const deltaMinutes = wanted - parts.minutes + (Number(day) - Number(parts.date.slice(8))) * 24 * 60;
  return new Date(utcGuess.getTime() + deltaMinutes * 60 * 1000);
}

export type AvailabilityRuleInput = { weekday: number; startMin: number; endMin: number };
export type BlackoutInput = { date: string };

export function slotDecision(input: {
  start: Date;
  durationMin: number;
  rules: AvailabilityRuleInput[];
  blackouts: BlackoutInput[];
  timeZone?: string;
}): { ok: true } | { ok: false; reason: string } {
  if (!Number.isInteger(input.durationMin) || input.durationMin <= 0) {
    return { ok: false, reason: "Duration must be a positive number of minutes." };
  }
  const parts = zonedParts(input.start, input.timeZone);
  if (input.blackouts.some((blackout) => blackout.date === parts.date)) {
    return { ok: false, reason: "That date is blocked out." };
  }
  const endMin = parts.minutes + input.durationMin;
  const fits = input.rules.some(
    (rule) => rule.weekday === parts.weekday && parts.minutes >= rule.startMin && endMin <= rule.endMin,
  );
  if (!fits) return { ok: false, reason: "That time is outside the working hours." };
  return { ok: true };
}

export type ServiceAreaInput = {
  name: string;
  zipCodes: string[];
  travelFeeCents: number;
  active: boolean;
};

export function travelFeeForZip(zip: string, areas: ServiceAreaInput[]) {
  const normalized = zip.trim();
  const active = areas.filter((area) => area.active);
  const exact = active.find((area) => area.zipCodes.includes(normalized));
  if (exact) return { matched: true, areaName: exact.name, travelFeeCents: exact.travelFeeCents };
  const fallback = active.find((area) => area.zipCodes.length === 0);
  if (fallback) return { matched: true, areaName: fallback.name, travelFeeCents: fallback.travelFeeCents };
  return { matched: false, areaName: null, travelFeeCents: 0 };
}

export type QuoteLine = {
  pricingMode: "FIXED" | "QUOTE";
  quantity: number;
  unitPriceCents: number | null;
};

export function quoteTotals(input: { packageCents: number; lines: QuoteLine[]; travelFeeCents: number }) {
  let subtotal = input.packageCents;
  let openQuotes = 0;
  for (const line of input.lines) {
    if (line.pricingMode === "QUOTE" && (line.unitPriceCents === null || line.unitPriceCents === undefined)) {
      openQuotes += 1;
      continue;
    }
    subtotal += (line.unitPriceCents ?? 0) * line.quantity;
  }
  return {
    subtotalCents: subtotal,
    travelFeeCents: input.travelFeeCents,
    totalCents: subtotal + input.travelFeeCents,
    openQuotes,
  };
}
