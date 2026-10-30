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
  READY_FOR_DELIVERY: "Ready",
  SHOOT_COMPLETE: "Shot",
  PARTIALLY_PAID: "Partially paid",
  PARTIALLY_REFUNDED: "Partially refunded",
};

export function StatusBadge({ status }: { status: string }) {
  const label = LABEL[status] ?? status.charAt(0) + status.slice(1).toLowerCase().replaceAll("_", " ");
  return <Badge tone={TONE[status] ?? "neutral"}>{label}</Badge>;
}
