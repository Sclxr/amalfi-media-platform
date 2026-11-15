import { describe, expect, it } from "vitest";
import { listingNextAction, listingNextLabel, selectChrome, type ListingNextInput } from "@/lib/listing-next";

const base = (patch: Partial<ListingNextInput>): ListingNextInput => ({
  status: "SCHEDULED",
  readyPhotos: 0,
  published: false,
  paid: false,
  canSendQuote: false,
  quoteSent: false,
  canMarkZelle: false,
  ...patch,
});

describe("listing next action", () => {
  it("asks for photos while a shoot is scheduled", () => {
    expect(listingNextAction(base({ status: "SCHEDULED" }))).toBe("upload");
    expect(listingNextLabel("upload")).toBe("Upload photos");
  });

  it("delivers once photos are uploaded", () => {
    expect(listingNextAction(base({ status: "SCHEDULED", readyPhotos: 4 }))).toBe("deliver");
    expect(listingNextAction(base({ status: "EDITING", readyPhotos: 1 }))).toBe("deliver");
    expect(listingNextLabel("deliver")).toBe("Deliver gallery");
  });

  it("sends a quote when the gallery is delivered and unpaid", () => {
    expect(
      listingNextAction(base({ status: "DELIVERED", readyPhotos: 3, published: true, canSendQuote: true })),
    ).toBe("send-quote");
    expect(listingNextLabel("send-quote")).toBe("Send quote");
  });

  it("marks Zelle paid after the quote was sent", () => {
    expect(
      listingNextAction(
        base({ status: "DELIVERED", readyPhotos: 3, published: true, canSendQuote: true, quoteSent: true, canMarkZelle: true }),
      ),
    ).toBe("mark-zelle");
    expect(listingNextLabel("mark-zelle")).toBe("Mark Zelle paid");
  });

  it("resends when a sent quote cannot be marked paid from this screen", () => {
    expect(
      listingNextAction(base({ status: "DELIVERED", published: true, canSendQuote: true, quoteSent: true, canMarkZelle: false })),
    ).toBe("resend-quote");
    expect(listingNextLabel("resend-quote")).toBe("Resend quote");
  });

  it("opens downloads after the invoice is paid", () => {
    expect(listingNextAction(base({ status: "DELIVERED", readyPhotos: 3, published: true, paid: true, canSendQuote: true }))).toBe("downloads");
    expect(listingNextAction(base({ status: "SCHEDULED", paid: true }))).toBe("downloads");
    expect(listingNextLabel("downloads")).toBe("View downloads");
  });

  it("schedules a listing that has not been booked", () => {
    expect(listingNextAction(base({ status: "NO_SHOOT" }))).toBe("schedule");
    expect(listingNextAction(base({ status: "REQUESTED" }))).toBe("schedule");
    expect(listingNextAction(base({ status: "QUOTED", canSendQuote: true }))).toBe("schedule");
    expect(listingNextLabel("schedule")).toBe("Schedule shoot");
  });

  it("does not offer a next step for a cancelled listing", () => {
    expect(listingNextAction(base({ status: "CANCELLED", readyPhotos: 2, canSendQuote: true }))).toBeNull();
  });

  it("treats a published gallery as delivered even if the order is still scheduled", () => {
    expect(listingNextAction(base({ status: "SCHEDULED", readyPhotos: 2, published: true, canSendQuote: true }))).toBe("send-quote");
  });
});

describe("select mode", () => {
  it("hides checkboxes and the bulk bar until Select is on", () => {
    expect(selectChrome(false, 0)).toEqual({ checksVisible: false, barVisible: false, archiveEnabled: false });
    expect(selectChrome(false, 3)).toEqual({ checksVisible: false, barVisible: false, archiveEnabled: false });
  });

  it("shows the bar after Select and enables archive only when a row is checked", () => {
    expect(selectChrome(true, 0)).toEqual({ checksVisible: true, barVisible: true, archiveEnabled: false });
    expect(selectChrome(true, 2)).toEqual({ checksVisible: true, barVisible: true, archiveEnabled: true });
  });
});
