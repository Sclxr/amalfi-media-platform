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
  seo: {
    googleSiteVerification: "RkGWnbZxC9w3-dIwWLB4A6HHcSN9P08bu9cPAR-fz1A",
  },
  portalUrl: "https://staging.amalfimedia.xyz/portal",
  form: {
    action: "https://formsubmit.co/eathen@amalfimedia.xyz",
    subject: "New Amalfi Media Inquiry",
    template: "table",
    captcha: true,
    next: "https://amalfimedia.xyz/book/thanks/",
  },
  phone: {
    display: "(321) 246-6018",
    dial: "+13212466018",
    confirmed: true,
  },
  prices: {
    confirmed: true,
    basic: 149,
    complete: 225,
    photo: 99,
    drone: 75,
    video: 125,
  },
  areas: {
    confirmed: true,
    summary: "Serving the greater Orlando area",
    cities: [
      "Orlando",
      "Winter Park",
      "Winter Garden",
      "Windermere",
      "Dr. Phillips",
      "Lake Nona",
      "Oviedo",
      "Sanford",
      "Kissimmee",
      "Davenport",
    ],
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
    bio: "I'm Eathen, the photographer behind Amalfi Media. I shoot real estate photos, drone aerials, and walkthrough video for agents across the greater Orlando area. My goal is simple: make every listing look its best and make the process easy. You book online, I shoot the home, and your edited files land in your client portal, ready for the MLS and social.",
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
  if (!site.areas.confirmed || !site.areas.summary) {
    blockers.push("areas.confirmed is false (service area)");
  }

  const omitted: string[] = [];
  if (!site.testimonials.confirmed || site.testimonials.items.length === 0) {
    omitted.push("testimonials (section hidden)");
  }
  if (!site.about.headshot) omitted.push("about.headshot (block hidden)");
  if (!site.about.bio) omitted.push("about.bio (block hidden)");
  if (site.socials.length === 0) omitted.push("socials (line hidden)");
  return { blockers, omitted };
}
