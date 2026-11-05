import Link from "next/link";
import { LegalLinks } from "@/components/legal/legal-links";

export const LEGAL_UPDATED = "November 5, 2026";

export function LegalDocument({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-white/10 bg-[#111111] text-[#f7f5f0]">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <Link href="/" className="text-xs font-semibold tracking-[0.16em]">
            AMALFI <span className="text-[#d4bc8c]">MEDIA</span>
          </Link>
          <LegalLinks tone="on-dark" />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-muted-foreground">Amalfi Media · Orlando, Florida</p>
        <h1 className="mt-2 text-[1.75rem] font-semibold leading-tight tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated {LEGAL_UPDATED}</p>
        <p className="mt-4 rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          This is a plain-language draft for the photography business. A lawyer can review it before it is treated as final.
        </p>
        <div className="mt-8 space-y-8 text-base leading-7">{children}</div>
      </main>
    </div>
  );
}

export function LegalSection({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-xl font-semibold tracking-tight">{heading}</h2>
      {children}
    </section>
  );
}
