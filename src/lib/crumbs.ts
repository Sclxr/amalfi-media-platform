const STATIC: Record<string, string | null> = {
  admin: "Admin",
  listings: "Listings",
  bookings: "Shoots",
  billing: "Money",
  orders: "Orders",
  crm: null,
  leads: "Realtors",
  brokerages: "Brokerages",
  clients: "Clients",
  marketing: "Marketing",
  settings: "Settings",
  catalog: "Catalog",
  "api-keys": "API keys",
  media: "Media",
  availability: "Availability",
  "follow-ups": "Follow-ups",
  campaigns: "Campaigns",
  templates: "Templates",
  suppression: "Suppression",
  import: "Import",
  email: "Email",
  new: "New",
  edit: "Edit",
  account: "Account",
  preview: "Preview",
};

export function isRecordId(part: string) {
  if (part in STATIC) return false;
  return part.length >= 12 || part.startsWith("seed-");
}

export function crumbTrail(pathname: string, labels: Record<string, string>) {
  const parts = pathname.split("/").filter(Boolean);
  const names: string[] = [];
  for (const part of parts) {
    const named = labels[part];
    if (named) {
      names.push(named);
      continue;
    }
    if (part in STATIC) {
      const label = STATIC[part];
      if (label) names.push(label);
      continue;
    }
    if (isRecordId(part)) continue;
    names.push(
      part
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" "),
    );
  }
  return names;
}

/** Midnight at the start of the calendar day in America/New_York. */
export function startOfEasternDay(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(read("year"), read("month") - 1, read("day"), read("hour"), read("minute"), read("second"));
  const offset = asUtc - now.getTime();
  const midnight = Date.UTC(read("year"), read("month") - 1, read("day"), 0, 0, 0);
  return new Date(midnight - offset);
}
