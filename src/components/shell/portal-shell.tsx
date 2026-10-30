"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/portal", label: "Dashboard" },
  { href: "/portal/book", label: "Book a shoot" },
  { href: "/portal/orders", label: "Orders" },
  { href: "/portal/galleries", label: "Galleries" },
  { href: "/portal/invoices", label: "Invoices" },
];

export function PortalShell({ name, children }: { name: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-4">
          <Link href="/portal" className="text-sm font-semibold">
            Amalfi Media
          </Link>
          <nav className="hidden flex-1 items-center gap-1 md:flex" aria-label="Portal">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground",
                  pathname === link.href && "bg-primary/10 font-medium text-primary",
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground sm:inline">{name}</span>
            <ThemeToggle />
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                await authClient.signOut();
                router.push("/portal/login");
                router.refresh();
              }}
            >
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
