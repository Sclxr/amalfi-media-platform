import { describe, expect, it } from "vitest";
import { bookingIcs } from "@/lib/ics";
import { adminOrderLabel, clientOrderLabel, nextOrderStatuses } from "@/lib/order-status";
import { quoteTotals, slotDecision, travelFeeForZip, zonedDateTime } from "@/lib/scheduling";
import { transactionalSendDecision } from "@/lib/transactional-email";

describe("scheduling", () => {
  const rules = [{ weekday: 2, startMin: 9 * 60, endMin: 17 * 60 }];

  it("accepts a Tuesday morning in Orlando and rejects a blackout", () => {
    const start = zonedDateTime("2026-11-03T10:00");
    expect(start).not.toBeNull();
    expect(slotDecision({ start: start!, durationMin: 60, rules, blackouts: [] }).ok).toBe(true);
    const blocked = slotDecision({
      start: start!,
      durationMin: 60,
      rules,
      blackouts: [{ date: "2026-11-03" }],
    });
    expect(blocked.ok).toBe(false);
  });

  it("prices travel from the ZIP and leaves drone as a quote", () => {
    const orlando = travelFeeForZip("32801", [
      { name: "Orlando core", zipCodes: ["32801"], travelFeeCents: 0, active: true },
      { name: "Greater Central Florida", zipCodes: [], travelFeeCents: 4500, active: true },
    ]);
    expect(orlando).toMatchObject({ areaName: "Orlando core", travelFeeCents: 0 });
    const kissimmee = travelFeeForZip("34741", [
      { name: "Orlando core", zipCodes: ["32801"], travelFeeCents: 0, active: true },
      { name: "Greater Central Florida", zipCodes: [], travelFeeCents: 4500, active: true },
    ]);
    expect(kissimmee.travelFeeCents).toBe(4500);
    const totals = quoteTotals({
      packageCents: 12000,
      travelFeeCents: orlando.travelFeeCents,
      lines: [{ pricingMode: "QUOTE", quantity: 1, unitPriceCents: null }],
    });
    expect(totals.openQuotes).toBe(1);
    expect(totals.totalCents).toBe(12000);
    const priced = quoteTotals({
      packageCents: 12000,
      travelFeeCents: 0,
      lines: [{ pricingMode: "QUOTE", quantity: 1, unitPriceCents: 15000 }],
    });
    expect(priced.totalCents).toBe(27000);
    expect(priced.openQuotes).toBe(0);
  });
});

describe("order lifecycle", () => {
  it("walks requested to quoted to scheduled to shot to editing to delivered", () => {
    expect(nextOrderStatuses("REQUESTED")).toEqual(["QUOTED", "CANCELLED"]);
    expect(nextOrderStatuses("QUOTED")).toContain("SCHEDULED");
    expect(nextOrderStatuses("SCHEDULED")).toContain("SHOOT_COMPLETE");
    expect(adminOrderLabel("SHOOT_COMPLETE")).toBe("Shot");
    expect(clientOrderLabel("EDITING")).toBe("In progress");
    expect(clientOrderLabel("READY_FOR_DELIVERY")).toBe("Ready");
  });
});

describe("transactional email and calendar", () => {
  it("previews in staging and does not send", () => {
    const decision = transactionalSendDecision({ appEnv: "staging", emailTransactionalEnabled: true });
    expect(decision.allowed).toBe(false);
    expect(decision.previewOnly).toBe(true);
    expect(decision.reason).toContain("staging");
  });

  it("exports an ics invite", () => {
    const body = bookingIcs({
      uid: "order-1",
      summary: "Amalfi Media · 10 Oak",
      allDay: "2026-11-03",
    });
    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body).toContain("DTSTART;VALUE=DATE:20261103");
  });
});
