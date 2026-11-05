import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { metadataBase, SHARE_DESCRIPTION } from "@/lib/share";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  metadataBase: metadataBase(),
  title: { default: "Amalfi Media", template: "%s · Amalfi Media" },
  description: SHARE_DESCRIPTION,
  applicationName: "Amalfi Media",
  openGraph: {
    siteName: "Amalfi Media",
    type: "website",
    title: "Amalfi Media",
    description: SHARE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "Amalfi Media",
    description: SHARE_DESCRIPTION,
  },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
