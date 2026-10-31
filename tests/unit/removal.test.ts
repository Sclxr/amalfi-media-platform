import { describe, expect, it } from "vitest";
import {
  brokerageRemoval,
  campaignRemoval,
  clientRemoval,
  galleryRemoval,
  hasFinancialHistory,
  leadRemoval,
  listingRemoval,
  orderRemoval,
} from "@/lib/removal";

const paid = { amountPaidCents: 12000, amountRefundedCents: 0, payments: [{ status: "SUCCEEDED" }] };
const open = { amountPaidCents: 0, amountRefundedCents: 0, payments: [] };

describe("removal eligibility", () => {
  it("treats succeeded payments and refunds as financial history", () => {
    expect(hasFinancialHistory([open])).toBe(false);
    expect(hasFinancialHistory([paid])).toBe(true);
    expect(hasFinancialHistory([{ amountPaidCents: 0, amountRefundedCents: 500, payments: [] }])).toBe(true);
  });

  it("lets an unpaid listing be deleted and lists what goes with it", () => {
    const decision = listingRemoval({ orders: 1, bookings: 0, galleries: 1, photos: 2, invoices: 0, financial: false });
    expect(decision.canDelete).toBe(true);
    expect(decision.lines).toEqual(["1 order", "1 gallery", "2 photos"]);
  });

  it("blocks a paid listing and a paid order", () => {
    expect(listingRemoval({ orders: 1, bookings: 1, galleries: 1, photos: 1, invoices: 1, financial: true }).canDelete).toBe(false);
    expect(orderRemoval({ bookings: 1, galleries: 1, photos: 1, invoices: 1, financial: true }).reason).toMatch(/Archive/);
    expect(galleryRemoval({ photos: 3, financial: true }).canDelete).toBe(false);
    expect(orderRemoval({ bookings: 0, galleries: 0, photos: 0, invoices: 0, financial: false }).canDelete).toBe(true);
  });

  it("keeps people and offices when they still have work", () => {
    expect(leadRemoval({ listings: 1, sentEmails: 0, financial: false }).canDelete).toBe(false);
    expect(leadRemoval({ listings: 0, sentEmails: 2, financial: false }).canDelete).toBe(false);
    expect(leadRemoval({ listings: 0, sentEmails: 0, financial: false }).canDelete).toBe(true);
    expect(clientRemoval({ properties: 0, orders: 1, invoices: 0, galleries: 0 }).canDelete).toBe(false);
    expect(clientRemoval({ properties: 0, orders: 0, invoices: 0, galleries: 0 }).lines).toEqual(["The client profile"]);
    expect(brokerageRemoval({ leads: 2, clients: 0 }).canDelete).toBe(false);
    expect(brokerageRemoval({ leads: 0, clients: 0 }).canDelete).toBe(true);
  });

  it("archives sent campaigns and deletes drafts", () => {
    expect(campaignRemoval({ status: "SENT", sentMessages: 1 }).canDelete).toBe(false);
    expect(campaignRemoval({ status: "SCHEDULED", sentMessages: 0 }).canDelete).toBe(false);
    expect(campaignRemoval({ status: "DRAFT", sentMessages: 0 }).canDelete).toBe(true);
  });
});