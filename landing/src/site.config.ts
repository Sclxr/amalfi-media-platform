/**
 * Every unconfirmed fact lives here. Pages must not invent prices, phone numbers,
 * testimonials, stats, or credentials that are not set in this file.
 */
export const site = {
  name: "Amalfi Media",
  url: "https://amalfimedia.xyz",
  email: "eathen@amalfimedia.xyz",
  description:
    "Real estate photography, drone photos, and walkthrough video for Orlando listings.",
  analyticsId: "G-SM0WR8CEW8",
  portalUrl: "https://staging.amalfimedia.xyz/portal",
  form: {
    action: "https://formsubmit.co/eathen@amalfimedia.xyz",
    subject: "New Amalfi Media Inquiry",
    template: "table",
    captcha: true,
    next: "https://amalfimedia.xyz/book/thanks/",
  },
  /** Publish a real number by setting dial to E.164, for example "+14075550100". */
  phone: {
    display: "(407) XXX-XXXX",
    dial: null as string | null,
    confirmed: false,
  },
  /**
   * Amounts copied from the current live site for reference. They are not confirmed.
   * introNoted is an unresolved $120 figure and is not a published package.
   */
  prices: {
    confirmed: false,
    basic: 149,
    complete: 225,
    photo: 99,
    drone: 75,
    video: 125,
    introNoted: 120,
  },
  claims: {
    /** Set true only after deciding each flag below. False flags are omitted, not printed as "not confirmed". */
    reviewed: false,
    turnaround24h: false,
    faaPart107: false,
    insured: false,
  },
  areas: {
    confirmed: false,
    cities: ["Orlando", "Winter Park", "Windermere", "Lake Nona", "Dr. Phillips", "Kissimmee", "Oviedo"],
  },
  testimonials: [] as { quote: string; name: string; brokerage: string }[],
  about: {
    headshot: null as string | null,
    bio: null as string | null,
  },
  socials: [] as { label: string; href: string }[],
} as const;

export function money(amount: number) {
  return `$${amount}`;
}

/** Facts that must be confirmed before a production build. Empty optional sections are listed separately and omitted. */
export function productionPlaceholders() {
  const blockers: string[] = [];
  if (!site.phone.confirmed || !site.phone.dial) {
    blockers.push("phone: set display, set dial to E.164, and set confirmed: true");
  }
  if (!site.prices.confirmed) {
    blockers.push("prices.confirmed is false (basic, complete, photo, drone, video)");
  }
  if (!site.areas.confirmed) {
    blockers.push("areas.confirmed is false (service-area cities)");
  }
  if (!site.claims.reviewed) {
    blockers.push("claims.reviewed is false (24-hour turnaround, FAA Part 107, insured)");
  }

  const omitted: string[] = [];
  if (site.testimonials.length === 0) omitted.push("testimonials (section hidden)");
  if (!site.about.headshot) omitted.push("about.headshot (block hidden)");
  if (!site.about.bio) omitted.push("about.bio (block hidden)");
  if (site.socials.length === 0) omitted.push("socials (line hidden)");
  if (!site.prices.confirmed) omitted.push("intro $120 note (hidden until prices are confirmed)");
  return { blockers, omitted };
}
