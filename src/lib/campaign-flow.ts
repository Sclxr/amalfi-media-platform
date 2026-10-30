import { marketingSendDecision, type MarketingSendInput } from "@/lib/marketing";

export const CAMPAIGN_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "SCHEDULED",
  "SENDING",
  "SENT",
  "PAUSED",
  "CANCELLED",
] as const;

export type CampaignStatusName = (typeof CAMPAIGN_STATUSES)[number];

export function campaignTransition(input: {
  status: string;
  action: "submit" | "approve" | "cancel";
  canApprove: boolean;
}): { ok: true; status: CampaignStatusName } | { ok: false; error: string } {
  if (input.action === "cancel") {
    if (input.status === "SENT" || input.status === "SENDING") {
      return { ok: false, error: "A campaign that already started cannot be cancelled here." };
    }
    return { ok: true, status: "CANCELLED" };
  }
  if (input.action === "submit") {
    if (input.status !== "DRAFT") return { ok: false, error: "Only a draft can be submitted for approval." };
    return { ok: true, status: "PENDING_APPROVAL" };
  }
  if (!input.canApprove) return { ok: false, error: "Approving a campaign requires the marketing send permission." };
  if (input.status !== "PENDING_APPROVAL") return { ok: false, error: "Only a campaign waiting for approval can be approved." };
  return { ok: true, status: "APPROVED" };
}

/**
 * Sending is refused unless the existing production kill switch allows it.
 * Even then this milestone does not place a live provider call.
 */
export function campaignSendPlan(input: { status: string } & MarketingSendInput):
  | { deliver: false; reason: string }
  | { deliver: true; mode: "stub"; reason: string } {
  if (input.status !== "APPROVED") {
    return { deliver: false, reason: "Approve the campaign before sending." };
  }
  const decision = marketingSendDecision(input);
  if (!decision.allowed) return { deliver: false, reason: decision.reason };
  return {
    deliver: true,
    mode: "stub",
    reason: "Marketing is allowed in production, but the Gmail client is still a stub and will not send.",
  };
}
