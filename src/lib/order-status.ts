export const ORDER_STATUSES = [
  "REQUESTED",
  "QUOTED",
  "CONFIRMED",
  "SCHEDULED",
  "SHOOT_COMPLETE",
  "EDITING",
  "READY_FOR_DELIVERY",
  "DELIVERED",
  "ARCHIVED",
  "CANCELLED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

const CLIENT_LABELS: Record<OrderStatus, string> = {
  REQUESTED: "Requested",
  QUOTED: "Quoted",
  CONFIRMED: "Confirmed",
  SCHEDULED: "Scheduled",
  SHOOT_COMPLETE: "In progress",
  EDITING: "In progress",
  READY_FOR_DELIVERY: "Ready",
  DELIVERED: "Delivered",
  ARCHIVED: "Delivered",
  CANCELLED: "Cancelled",
};

/** Client-facing labels. Staff see the operational names from adminOrderLabel. */
export function clientOrderLabel(status: OrderStatus): string {
  return CLIENT_LABELS[status];
}

const ADMIN_LABELS: Record<OrderStatus, string> = {
  REQUESTED: "Requested",
  QUOTED: "Quoted",
  CONFIRMED: "Confirmed",
  SCHEDULED: "Scheduled",
  SHOOT_COMPLETE: "Shot",
  EDITING: "Editing",
  READY_FOR_DELIVERY: "Ready for delivery",
  DELIVERED: "Delivered",
  ARCHIVED: "Archived",
  CANCELLED: "Cancelled",
};

export function adminOrderLabel(status: OrderStatus): string {
  return ADMIN_LABELS[status];
}

const NEXT_STATUS: Partial<Record<OrderStatus, readonly OrderStatus[]>> = {
  REQUESTED: ["QUOTED", "CANCELLED"],
  QUOTED: ["SCHEDULED", "CANCELLED"],
  CONFIRMED: ["QUOTED", "SCHEDULED", "CANCELLED"],
  SCHEDULED: ["SHOOT_COMPLETE", "CANCELLED"],
  SHOOT_COMPLETE: ["EDITING", "CANCELLED"],
  EDITING: ["DELIVERED", "CANCELLED"],
  READY_FOR_DELIVERY: ["DELIVERED", "CANCELLED"],
};

export function nextOrderStatuses(status: OrderStatus): readonly OrderStatus[] {
  return NEXT_STATUS[status] ?? [];
}

export function clientOrderStep(status: OrderStatus): number {
  switch (status) {
    case "REQUESTED":
      return 1;
    case "QUOTED":
    case "CONFIRMED":
      return 2;
    case "SCHEDULED":
      return 3;
    case "SHOOT_COMPLETE":
    case "EDITING":
      return 4;
    case "READY_FOR_DELIVERY":
      return 5;
    case "DELIVERED":
    case "ARCHIVED":
      return 6;
    case "CANCELLED":
      return 0;
  }
}
