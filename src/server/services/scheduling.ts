import "server-only";
import type { Actor } from "@/lib/actor";
import { can } from "@/lib/permissions";
import { BUSINESS_TIME_ZONE, zonedParts } from "@/lib/scheduling";
import { prisma } from "@/server/db/prisma";

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function calendarRange(view: string, anchor: Date) {
  const parts = zonedParts(anchor, BUSINESS_TIME_ZONE);
  const start = new Date(`${parts.date}T00:00:00.000Z`);
  if (view === "day") return { start, end: addDays(start, 1), label: parts.date };
  if (view === "month") {
    const monthStart = new Date(`${parts.date.slice(0, 8)}01T00:00:00.000Z`);
    return { start: monthStart, end: addDays(monthStart, 32), label: parts.date.slice(0, 7) };
  }
  const weekStart = addDays(start, -parts.weekday);
  return { start: weekStart, end: addDays(weekStart, 7), label: `${zonedParts(weekStart).date} week` };
}

export async function listCalendar(actor: Actor, view: string, anchor: Date) {
  if (!can(actor, "bookings.read")) throw new Error("Forbidden");
  const range = calendarRange(view, anchor);
  const bookings = await prisma.booking.findMany({
    where: {
      OR: [
        { startAt: { gte: range.start, lt: range.end } },
        { startAt: null, order: { preferredDate: { gte: range.start, lt: range.end } } },
      ],
    },
    include: { order: { include: { property: true, client: true } } },
    orderBy: { startAt: "asc" },
  });
  return { range, bookings };
}

export async function listAvailability(actor: Actor) {
  if (!can(actor, "bookings.read")) throw new Error("Forbidden");
  const [rules, blackouts] = await Promise.all([
    prisma.availabilityRule.findMany({ orderBy: [{ weekday: "asc" }, { startMin: "asc" }] }),
    prisma.blackoutDate.findMany({ orderBy: { date: "asc" } }),
  ]);
  return { rules, blackouts };
}

export async function addAvailabilityRule(actor: Actor, input: { weekday: number; startMin: number; endMin: number }) {
  if (!can(actor, "bookings.write")) throw new Error("Forbidden");
  if (input.weekday < 0 || input.weekday > 6 || input.startMin >= input.endMin) {
    return { error: "Choose a weekday and a start time before the end time." as const };
  }
  await prisma.availabilityRule.create({ data: input });
  return { ok: true as const };
}

export async function addBlackout(actor: Actor, input: { date: string; reason: string }) {
  if (!can(actor, "bookings.write")) throw new Error("Forbidden");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return { error: "Choose a date." as const };
  await prisma.blackoutDate.create({
    data: { date: new Date(`${input.date}T00:00:00.000Z`), reason: input.reason.trim() || null },
  });
  return { ok: true as const };
}
