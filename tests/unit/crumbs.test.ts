import { describe, expect, it } from "vitest";
import { crumbTrail, startOfEasternDay } from "@/lib/crumbs";
import { friendlyStatus } from "@/components/data/status-badge";

describe("crumb trail", () => {
  it("uses section names and hides record ids until a name is known", () => {
    expect(crumbTrail("/admin/crm/leads", {})).toEqual(["Admin", "Realtors"]);
    expect(crumbTrail("/admin/listings/seed-property-hale", {})).toEqual(["Admin", "Listings"]);
    expect(crumbTrail("/admin/listings/seed-property-hale", { "seed-property-hale": "1842 Lake Conway Shore" })).toEqual([
      "Admin",
      "Listings",
      "1842 Lake Conway Shore",
    ]);
    expect(crumbTrail("/admin/billing", {})).toEqual(["Admin", "Money"]);
    expect(crumbTrail("/admin/bookings", {})).toEqual(["Admin", "Shoots"]);
  });
});

describe("Eastern day", () => {
  it("starts at midnight Eastern, including daylight time", () => {
    expect(startOfEasternDay(new Date("2026-11-13T15:00:00.000Z")).toISOString()).toBe("2026-11-13T05:00:00.000Z");
    expect(startOfEasternDay(new Date("2026-07-04T12:00:00.000Z")).toISOString()).toBe("2026-07-04T04:00:00.000Z");
  });
});

describe("friendly status", () => {
  it("does not show raw enum names", () => {
    expect(friendlyStatus("SHOOT_COMPLETE")).toBe("Shot");
    expect(friendlyStatus("DO_NOT_CONTACT")).toBe("Do not contact");
    expect(friendlyStatus("REQUESTED")).toBe("Requested");
    expect(friendlyStatus("NO_SHOW")).toBe("No show");
    expect(friendlyStatus("AWAITING_ZELLE")).not.toMatch(/_/);
  });
});
