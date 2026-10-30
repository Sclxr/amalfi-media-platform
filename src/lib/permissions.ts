export const ROLES = ["ADMIN", "STAFF", "CLIENT"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  { key: "overview.revenue", description: "See collected revenue on the overview" },
  { key: "crm.read", description: "View realtors, leads, and brokerages" },
  { key: "crm.write", description: "Create and edit realtors, leads, and brokerages" },
  { key: "marketing.draft", description: "Draft campaigns" },
  { key: "marketing.send", description: "Approve and send campaigns" },
  { key: "bookings.read", description: "View the booking calendar" },
  { key: "bookings.write", description: "Create and change bookings" },
  { key: "orders.read", description: "View orders" },
  { key: "orders.write", description: "Change orders" },
  { key: "billing.read", description: "View invoices" },
  { key: "billing.refund", description: "Refund a payment" },
  { key: "media.read", description: "View galleries" },
  { key: "media.write", description: "Upload and publish galleries" },
  { key: "settings.manage", description: "Change business settings, packages, and travel fees" },
  { key: "users.manage", description: "Manage staff accounts and permissions" },
  { key: "audit.read", description: "Read the audit log" },
] as const;

export type Permission = (typeof PERMISSIONS)[number]["key"];

const ALL_PERMISSIONS = PERMISSIONS.map((item) => item.key);

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  ADMIN: ALL_PERMISSIONS,
  STAFF: [
    "crm.read",
    "crm.write",
    "marketing.draft",
    "bookings.read",
    "bookings.write",
    "orders.read",
    "orders.write",
    "billing.read",
    "media.read",
    "media.write",
  ],
  CLIENT: [],
};

export function parseRole(value: string): Role {
  if (value === "ADMIN" || value === "STAFF" || value === "CLIENT") return value;
  throw new Error(`Unknown role: ${value}`);
}

export function applyOverrides(
  base: readonly string[],
  overrides: readonly { key: string; granted: boolean }[],
): Set<Permission> {
  const set = new Set<string>(base);
  for (const override of overrides) {
    if (override.granted) set.add(override.key);
    else set.delete(override.key);
  }
  return set as Set<Permission>;
}

export function can(actor: { permissions: ReadonlySet<string> }, permission: Permission): boolean {
  return actor.permissions.has(permission);
}
