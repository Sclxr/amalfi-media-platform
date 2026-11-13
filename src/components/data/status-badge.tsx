import { Badge } from "@/components/ui/badge";

const TONE: Record<string, "neutral" | "primary" | "success" | "warning" | "danger" | "accent"> = {
  NEW: "primary",
  CONTACTED: "accent",
  ENGAGED: "warning",
  QUALIFIED: "success",
  NURTURE: "neutral",
  CONVERTED: "success",
  LOST: "danger",
  DO_NOT_CONTACT: "danger",
  PAID: "success",
  OPEN: "warning",
  DRAFT: "neutral",
};

const LABEL: Record<string, string> = {
  DO_NOT_CONTACT: "Do not contact",
  READY_FOR_DELIVERY: "Ready for delivery",
  SHOOT_COMPLETE: "Shot",
  PARTIALLY_PAID: "Partially paid",
  PARTIALLY_REFUNDED: "Partially refunded",
  NO_SHOW: "No show",
  UNCOLLECTIBLE: "Uncollectible",
  AWAITING_ZELLE: "Awaiting Zelle",
  SINGLE_FAMILY: "Single family",
};

export function friendlyStatus(status: string) {
  if (LABEL[status]) return LABEL[status];
  return status
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={TONE[status] ?? "neutral"}>{friendlyStatus(status)}</Badge>;
}
