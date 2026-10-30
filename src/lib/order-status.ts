export const ORDER_STATUSES = [
  "REQUESTED",
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
  CONFIRMED: "Confirmed",
  SCHEDULED: "Scheduled",
  SHOOT_COMPLETE: "In progress",
  EDITING: "In progress",
  READY_FOR_DELIVERY: "Ready",
  DELIVERED: "Delivered",
  ARCHIVED: "Delivered",
  CANCELLED: "Cancelled",
};

/** Seven client-facing labels mapped from the single order status enum. */
export function clientOrderLabel(status: OrderStatus): string {
  return CLIENT_LABELS[status];
}

export function clientOrderStep(status: OrderStatus): number {
  switch (status) {
    case "REQUESTED":
      return 1;
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
