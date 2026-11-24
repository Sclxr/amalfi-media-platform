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
