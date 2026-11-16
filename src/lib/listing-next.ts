import { formatDate } from "@/lib/dates";
import type { ListingStatus } from "@/lib/listing";
import { formatCents } from "@/lib/money";

export const LISTING_NEXT_ACTIONS = [
  "schedule",
  "upload",
  "deliver",
  "send-quote",
  "resend-quote",
  "mark-zelle",
  "downloads",
] as const;

export type ListingNextAction = (typeof LISTING_NEXT_ACTIONS)[number];

export type ListingNextInput = {
  status: ListingStatus;
  readyPhotos: number;
  published: boolean;
  paid: boolean;
  canSendQuote: boolean;
  quoteSent: boolean;
  canMarkZelle: boolean;
};

const BEFORE_SCHEDULE = new Set<ListingStatus>(["NO_SHOOT", "REQUESTED", "QUOTED", "CONFIRMED"]);

/**
 * One next step for a listing.
 * Scheduled with no photos uploads. Photos waiting to be shared deliver.
 * A delivered unpaid quote sends, then a sent quote is marked paid.
 * A paid listing opens the downloads.
 */
export function listingNextAction(input: ListingNextInput): ListingNextAction | null {
  if (input.status === "CANCELLED") return null;
  if (input.paid) return "downloads";
  const delivered = input.published || input.status === "DELIVERED" || input.status === "ARCHIVED";
  if (delivered) {
    if (input.canSendQuote && !input.quoteSent) return "send-quote";
    if (input.canMarkZelle) return "mark-zelle";
    if (input.canSendQuote && input.quoteSent) return "resend-quote";
    if (input.readyPhotos === 0) return "upload";
    if (!input.published) return "deliver";
    return null;
  }
  if (input.readyPhotos > 0) return "deliver";
  if (BEFORE_SCHEDULE.has(input.status)) return "schedule";
  return "upload";
}

export function listingNextLabel(action: ListingNextAction): string {
  switch (action) {
    case "schedule":
      return "Schedule shoot";
    case "upload":
      return "Upload photos";
    case "deliver":
      return "Deliver gallery";
    case "send-quote":
      return "Send quote";
    case "resend-quote":
      return "Resend quote";
    case "mark-zelle":
      return "Mark Zelle paid";
    case "downloads":
      return "View downloads";
  }
}

export type ListingCardNote = { kind: "date" | "unpaid" | "paid" | "none"; text: string };

/** The line under a listing card. The status pill already names the state. */
export function listingCardNote(input: {
  status: ListingStatus;
  shootDate: Date | null;
  paid: boolean;
  amountCents: number;
  showAmount: boolean;
}): ListingCardNote {
  if (input.status === "SCHEDULED") {
    return { kind: "date", text: input.shootDate ? formatDate(input.shootDate) : "Date not set" };
  }
  if (input.paid) return { kind: "paid", text: "Paid" };
  if (input.amountCents > 0) {
    return { kind: "unpaid", text: input.showAmount ? `Unpaid ${formatCents(input.amountCents)}` : "Unpaid" };
  }
  if (input.shootDate) return { kind: "date", text: formatDate(input.shootDate) };
  return { kind: "none", text: "" };
}

/** Bulk checkboxes and the archive bar stay hidden until Select is on. */
export function selectChrome(selecting: boolean, selectedCount: number) {
  return {
    checksVisible: selecting,
    barVisible: selecting,
    archiveEnabled: selecting && selectedCount > 0,
  };
}
