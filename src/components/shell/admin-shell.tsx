"use client";

import {
  Building2,
  Calendar,
  ClipboardList,
  Contact,
  Images,
  KeyRound,
  LayoutDashboard,
  Megaphone,
  Menu,
  Package,
  Receipt,
  Search,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { UserMenu } from "@/components/shell/user-menu";
import { Button } from "@/components/ui/button";
import type { ShellUser } from "@/lib/actor";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/crm/leads", label: "Realtors", icon: Users },
  { href: "/admin/crm/brokerages", label: "Brokerages", icon: Building2 },
  { href: "/admin/marketing", label: "Marketing", icon: Megaphone },
  { href: "/admin/bookings", label: "Bookings", icon: Calendar },
  { href: "/admin/orders", label: "Orders", icon: ClipboardList },
  { href: "/admin/clients", label: "Clients", icon: Contact },
  { href: "/admin/billing", label: "Billing", icon: Receipt },
  { href: "/admin/media", label: "Media", icon: Images },
  { href: "/admin/settings/catalog", label: "Catalog", icon: Package, permission: "settings.manage" },
  { href: "/admin/settings/api-keys", label: "API keys", icon: KeyRound, permission: "settings.manage" },
] as const;

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const items = useMemo(
    () => NAV.filter((item) => !("permission" in item) || user.permissions.includes(item.permission)),
    [user.permissions],
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((value) => !value);
      }
      if (event.key === "Escape") setCommandOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const crumbs = pathname
    .split("/")
    .filter(Boolean)
    .map((part) => part.replaceAll("-", " "));

  return (
    <div className="min-h-screen bg-background">
      <div className="flex min-h-screen">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-sidebar px-3 py-4 transition-transform md:static md:translate-x-0",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="flex items-center justify-between px-2">
            <Link href="/admin" className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
                A
              </span>
              <span>
                <span className="block text-sm font-semibold leading-none">Amalfi</span>
                <span className="mt-1 block text-xs text-muted-foreground">Media</span>
              </span>
            </Link>
            <Button className="md:hidden" variant="ghost" size="icon" aria-label="Close menu" onClick={() => setOpen(false)}>
              <X />
            </Button>
          </div>
          <nav className="mt-8 flex flex-1 flex-col gap-1" aria-label="Admin">
            {items.map((item) => {
              const active = isActive(pathname, item.href, "exact" in item ? item.exact : false);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex h-10 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground",
                    active && "bg-primary/10 font-medium text-primary",
                  )}
                >
                  <Icon className="size-5" strokeWidth={1.75} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <p className="px-3 pb-2 text-xs text-muted-foreground">Orlando · Central Florida</p>
        </aside>
        {open ? (
          <button className="fixed inset-0 z-30 bg-black/40 md:hidden" aria-label="Close menu" onClick={() => setOpen(false)} />
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur md:px-6">
            <Button className="md:hidden" variant="ghost" size="icon" aria-label="Open menu" onClick={() => setOpen(true)}>
              <Menu />
            </Button>
            <p className="hidden min-w-0 flex-1 truncate text-sm text-muted-foreground capitalize sm:block">
              {crumbs.join(" / ")}
            </p>
            <div className="ml-auto flex items-center gap-1">
              <Button type="button" variant="secondary" size="sm" onClick={() => setCommandOpen(true)}>
                <Search />
                <span className="hidden sm:inline">Search</span>
                <kbd className="hidden rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline">⌘K</kbd>
              </Button>
              <ThemeToggle />
              <UserMenu user={user} />
            </div>
          </header>
          <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 md:px-6 md:py-8">{children}</main>
        </div>
      </div>
      {commandOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-start bg-black/40 px-4 pt-[15vh]" onClick={() => setCommandOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Command menu"
            className="w-full max-w-lg rounded-lg border border-border bg-card p-2 shadow-[var(--shadow)]"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Go to</p>
            <div className="flex flex-col">
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-3 py-2 text-sm hover:bg-accent"
                  onClick={() => setCommandOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
