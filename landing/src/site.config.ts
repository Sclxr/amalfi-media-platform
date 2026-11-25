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
  /**
   * Reviews supplied by Eathen from his previous business. confirmed publishes
   * them on the preview site and in a production build.
   */
  testimonials: {
    confirmed: true,
    items: [
      {
        quote:
          "The photos turned out incredible and really brought the property to life. Amalfi Media made the entire process easy, from scheduling to receiving the final images.",
        name: "Sarah M.",
        role: "Real Estate Agent",
      },
      {
        quote:
          "Professional, reliable, and extremely detail-oriented. The drone photography added an entirely new perspective to my listing. I look forward to working with them again.",
        name: "Michael R.",
        role: "Realtor",
      },
      {
        quote:
          "Finding a photographer who understands real estate marketing makes all the difference. The photos were bright, clean, and beautifully edited.",
        name: "Jessica L.",
        role: "Real Estate Agent",
      },
      {
        quote:
          "Great communication, quick turnaround, and exceptional quality. Amalfi Media is exactly what I look for in a real estate photography partner.",
        name: "David C.",
        role: "Realtor",
      },
      {
        quote:
          "I was impressed with the quality of both the interior and exterior photography. Every room was captured beautifully, and the entire experience was seamless.",
        name: "Amanda T.",
        role: "Listing Agent",
      },
      {
        quote:
          "High-quality photography at a very reasonable price. It's refreshing to work with a company that genuinely cares about making your listings stand out.",
        name: "Daniel P.",
        role: "Real Estate Agent",
      },
      {
        quote:
          "Absolutely loved how the photos came out! They made the home feel spacious, inviting, and ready for the market.",
        name: "Nicole B.",
        role: "Realtor",
      },
      {
        quote:
          "Amalfi Media exceeded my expectations. Their attention to detail and ability to capture the best features of a property really sets them apart.",
        name: "Christopher W.",
        role: "Real Estate Agent",
      },
      {
        quote:
          "Booking was incredibly easy, communication was excellent, and the photos looked amazing. Highly recommend!",
        name: "Lauren S.",
        role: "Realtor",
      },
      {
        quote:
          "The aerial photography was phenomenal. It really helped showcase the surrounding neighborhood and everything the property had to offer.",
        name: "Matthew H.",
        role: "Listing Agent",
      },
      {
        quote:
          "As a busy real estate agent, I appreciate working with someone who is dependable, professional, and delivers consistently beautiful results.",
        name: "Ashley K.",
        role: "Realtor",
      },
      {
        quote:
          "The quality of the photos speaks for itself. Amalfi Media captured the character of the home perfectly while keeping everything looking natural.",
        name: "Brandon F.",
        role: "Real Estate Agent",
      },
      {
        quote:
          "From the initial booking to downloading the finished photos, everything was straightforward. A great experience from start to finish.",
        name: "Samantha D.",
        role: "Realtor",
      },
      {
        quote:
          "Beautiful photography, competitive pricing, and outstanding customer service. I'll definitely be using Amalfi Media for future listings.",
        name: "Robert J.",
        role: "Real Estate Agent",
      },
    ],
  },
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
  if (!site.testimonials.confirmed || site.testimonials.items.length === 0) {
    omitted.push("testimonials (section hidden)");
  }
  if (!site.about.headshot) omitted.push("about.headshot (block hidden)");
  if (!site.about.bio) omitted.push("about.bio (block hidden)");
  if (site.socials.length === 0) omitted.push("socials (line hidden)");
  if (!site.prices.confirmed) omitted.push("intro $120 note (hidden until prices are confirmed)");
  return { blockers, omitted };
}
