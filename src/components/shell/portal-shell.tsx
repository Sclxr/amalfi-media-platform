"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { LegalLinks } from "@/components/legal/legal-links";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/portal", label: "Home", exact: true },
  { href: "/portal/galleries", label: "Gallery" },
  { href: "/portal/orders", label: "Orders" },
  { href: "/portal/book", label: "Book" },
  { href: "/portal/invoices", label: "Invoices" },
];

export function PortalShell({ name, email, children }: { name: string; email: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [accountOpen, setAccountOpen] = useState(false);
  const home = pathname === "/portal";
  const gallery = pathname.startsWith("/portal/galleries");
  const orders = pathname.startsWith("/portal/orders");

  async function signOut() {
    await authClient.signOut();
    router.push("/portal/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-white/10 bg-[#111111] text-[#f7f5f0]">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4">
          <Link href="/portal" className="text-xs font-semibold tracking-[0.16em]">
            AMALFI <span className="text-[#d4bc8c]">MEDIA</span>
          </Link>
          <nav className="hidden flex-1 items-center gap-1 md:flex" aria-label="Portal">
            {LINKS.map((link) => {
              const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex h-12 items-center rounded-xl px-3 text-sm text-[#bdb7ae] hover:text-white",
                    active && "font-medium text-[#d4bc8c]",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <span className="hidden text-sm text-[#bdb7ae] sm:inline">{name}</span>
            <ThemeToggle className="text-[#f7f5f0] hover:bg-white/10" />
            <Button variant="secondary" className="hidden md:inline-flex" onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 md:py-8">{children}</main>
      <footer className="mx-auto max-w-5xl px-4 pb-28 md:pb-10">
        <div className="border-t border-border pt-2">
          <LegalLinks />
        </div>
      </footer>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-white/10 bg-[#111111] px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 text-[#bdb7ae] md:hidden" aria-label="Portal">
        <Link href="/portal" className={cn("flex min-h-12 flex-col items-center justify-center text-[11px]", home && "text-[#d4bc8c]")} aria-current={home ? "page" : undefined}>Home</Link>
        <Link href="/portal/galleries" className={cn("flex min-h-12 flex-col items-center justify-center text-[11px]", gallery && "text-[#d4bc8c]")} aria-current={gallery ? "page" : undefined}>Gallery</Link>
        <Link href="/portal/orders" className={cn("flex min-h-12 flex-col items-center justify-center text-[11px]", orders && "text-[#d4bc8c]")} aria-current={orders ? "page" : undefined}>Orders</Link>
        <button type="button" className={cn("flex min-h-12 flex-col items-center justify-center text-[11px]", accountOpen && "text-[#d4bc8c]")} onClick={() => setAccountOpen(true)}>
          Account
        </button>
      </nav>
      {accountOpen ? (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setAccountOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="Account" className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-card p-5 pb-8 text-foreground" onClick={(event) => event.stopPropagation()}>
            <p className="text-lg font-semibold">{name}</p>
            <p className="mt-1 text-sm text-muted-foreground">{email}</p>
            <LegalLinks className="mt-4" />
            <Button className="mt-2 w-full" onClick={() => void signOut()}>Sign out</Button>
            <Button className="mt-2 w-full" variant="secondary" onClick={() => setAccountOpen(false)}>Close</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
