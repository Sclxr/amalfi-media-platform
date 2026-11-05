import type { Metadata } from "next";

export const SHARE_DESCRIPTION =
  "Real estate photography for Orlando and Central Florida. Clients open galleries, pay, and download from Amalfi Media.";

export function metadataBase(): URL {
  const raw = process.env.APP_URL;
  if (raw) {
    try {
      return new URL(raw);
    } catch {
      // APP_URL is optional at build time. Relative metadata still renders.
    }
  }
  return new URL("http://localhost:3000");
}

export function pageShare(title: string, description: string): Metadata {
  const fullTitle = `${title} · Amalfi Media`;
  return {
    title,
    description,
    openGraph: {
      title: fullTitle,
      description,
      siteName: "Amalfi Media",
      type: "website",
      images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Amalfi Media" }],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: ["/opengraph-image"],
    },
  };
}
