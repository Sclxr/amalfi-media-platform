export type CampaignSegment = {
  statuses?: string[];
  cities?: string[];
  tags?: string[];
};

export type SegmentLead = {
  status: string;
  city: string | null;
  tags: string[];
  emailNormalized: string | null;
};

export function parseSegment(value: unknown): CampaignSegment {
  if (!value || typeof value !== "object") return {};
  const source = value as Record<string, unknown>;
  const list = (key: string) =>
    Array.isArray(source[key]) ? source[key].filter((item): item is string => typeof item === "string" && item.length > 0) : [];
  return { statuses: list("statuses"), cities: list("cities"), tags: list("tags") };
}

/** Do-not-contact realtors never match. Empty filters match every other realtor with an email. */
export function leadMatchesSegment(lead: SegmentLead, segment: CampaignSegment): boolean {
  if (lead.status === "DO_NOT_CONTACT") return false;
  if (!lead.emailNormalized) return false;
  if (segment.statuses && segment.statuses.length > 0 && !segment.statuses.includes(lead.status)) return false;
  if (segment.cities && segment.cities.length > 0) {
    const city = lead.city?.trim().toLowerCase() ?? "";
    if (!segment.cities.some((item) => item.trim().toLowerCase() === city)) return false;
  }
  if (segment.tags && segment.tags.length > 0) {
    const tags = new Set(lead.tags.map((tag) => tag.toLowerCase()));
    if (!segment.tags.some((tag) => tags.has(tag.toLowerCase()))) return false;
  }
  return true;
}
