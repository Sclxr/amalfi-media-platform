"use client";

import {
  Building2,
  Calendar,
  ClipboardList,
  Clock,
  Contact,
  Home,
  ImageIcon,
  KeyRound,
  LayoutDashboard,
  Megaphone,
  Menu,
  MoreHorizontal,
  Package,
  Receipt,
  Search,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CrumbProvider, useCrumbLabels } from "@/components/shell/crumbs";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { UserMenu } from "@/components/shell/user-menu";
import { Button } from "@/components/ui/button";
import type { ShellUser } from "@/lib/actor";
import { crumbTrail } from "@/lib/crumbs";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  permission?: ShellUser["permissions"][number];
};

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Today",
    items: [
      { href: "/admin", label: "Today", icon: LayoutDashboard, exact: true },
      { href: "/admin/bookings", label: "Shoots", icon: Calendar },
      { href: "/admin/listings", label: "Listings", icon: Home },
      { href: "/admin/billing", label: "Money", icon: Receipt },
      { href: "/admin/crm/leads", label: "Realtors", icon: Users },
    ],
  },
  {
    label: "More",
    items: [
      { href: "/admin/orders", label: "Orders", icon: ClipboardList },
      { href: "/admin/crm/brokerages", label: "Brokerages", icon: Building2 },
      { href: "/admin/clients", label: "Clients", icon: Contact },
      { href: "/admin/crm/follow-ups", label: "Follow-ups", icon: Clock },
      { href: "/admin/bookings/availability", label: "Availability", icon: Calendar },
      { href: "/admin/marketing", label: "Marketing", icon: Megaphone },
      { href: "/admin/media", label: "Media", icon: ImageIcon },
      { href: "/admin/settings/catalog", label: "Catalog", icon: Package, permission: "settings.manage" },
      { href: "/admin/settings/api-keys", label: "API keys", icon: KeyRound, permission: "settings.manage" },
    ],
  },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  return (
    <CrumbProvider>
      <AdminFrame user={user}>{children}</AdminFrame>
    </CrumbProvider>
  );
}

function AdminFrame({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const crumbLabels = useCrumbLabels();
  const [open, setOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const items = useMemo(
    () =>
      NAV_GROUPS.flatMap((group) => group.items).filter(
        (item) => !item.permission || user.permissions.includes(item.permission),
      ),
    [user.permissions],
  );
  const groups = useMemo(
    () =>
      NAV_GROUPS.map((group) => ({
        label: group.label,
        items: group.items.filter((item) => !item.permission || user.permissions.includes(item.permission)),
      })).filter((group) => group.items.length > 0),
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

  const crumbs = crumbTrail(pathname, crumbLabels);
  const onToday = pathname === "/admin";
  const onShoots = pathname.startsWith("/admin/bookings");
  const onListings = pathname.startsWith("/admin/listings");
  const onMoney = pathname.startsWith("/admin/billing");

  return (
    <div className="min-h-screen bg-background">
      <div className="flex min-h-screen">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-white/10 bg-[#111111] px-3 py-4 text-[#f7f5f0] transition-transform md:static md:translate-x-0",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="flex items-center justify-between px-2">
            <Link href="/admin" className="flex items-center gap-3">
              <span className="grid size-12 place-items-center rounded-xl bg-white/10 text-sm font-semibold tracking-widest text-[#d4bc8c]">
                A
              </span>
              <span>
                <span className="block text-sm font-semibold leading-none tracking-[0.14em]">AMALFI</span>
                <span className="mt-1 block text-xs text-[#d4bc8c]">MEDIA</span>
              </span>
            </Link>
            <Button className="text-[#f7f5f0] hover:bg-white/10 md:hidden" variant="ghost" size="icon" aria-label="Close menu" onClick={() => setOpen(false)}>
              <X />
            </Button>
          </div>
          <nav className="mt-8 flex flex-1 flex-col gap-4 overflow-y-auto" aria-label="Admin">
            {groups.map((group) => (
              <div key={group.label}>
                <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-[#bdb7ae]">{group.label}</p>
                <div className="flex flex-col gap-1">
                  {group.items.map((item) => {
                    const active = isActive(pathname, item.href, "exact" in item ? item.exact : false);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex h-12 items-center gap-3 rounded-xl px-3 text-sm text-[#bdb7ae] hover:bg-white/10 hover:text-white",
                          active && "bg-white/10 font-medium text-[#d4bc8c]",
                        )}
                      >
                        <Icon className="size-5" strokeWidth={1.75} />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
          <p className="px-3 pb-2 text-xs text-[#bdb7ae]">Orlando · Central Florida</p>
        </aside>
        {open ? (
          <button className="fixed inset-0 z-30 bg-black/40 md:hidden" aria-label="Close menu" onClick={() => setOpen(false)} />
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-white/10 bg-[#111111] px-3 text-[#f7f5f0] md:px-6">
            <Button className="text-[#f7f5f0] hover:bg-white/10 md:hidden" variant="ghost" size="icon" aria-label="Open menu" onClick={() => setOpen(true)}>
              <Menu />
            </Button>
            <p className="hidden min-w-0 flex-1 truncate text-sm text-[#bdb7ae] sm:block">
              {crumbs.join(" / ")}
            </p>
            <div className="ml-auto flex items-center gap-1">
              <Button type="button" variant="ghost" size="icon" className="text-[#f7f5f0] hover:bg-white/10 sm:w-auto sm:px-3" aria-label="Open search" onClick={() => setCommandOpen(true)}>
                <Search />
                <span className="hidden sm:inline">Search</span>
              </Button>
              <ThemeToggle className="text-[#f7f5f0] hover:bg-white/10" />
              <UserMenu user={user} />
            </div>
          </header>
          <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 pb-28 md:px-6 md:py-8 md:pb-8">{children}</main>
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
                  className="flex min-h-12 items-center rounded-xl px-3 text-sm hover:bg-accent"
                  onClick={() => setCommandOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-white/10 bg-[#111111] px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 text-[#bdb7ae] md:hidden" aria-label="Admin mobile">
        <Link href="/admin" className={cn("flex min-h-12 flex-col items-center justify-center gap-0.5 text-[10px]", onToday && "text-[#d4bc8c]")} aria-current={onToday ? "page" : undefined}>
          <LayoutDashboard className="size-5" />
          Today
        </Link>
        <Link href="/admin/bookings" className={cn("flex min-h-12 flex-col items-center justify-center gap-0.5 text-[10px]", onShoots && "text-[#d4bc8c]")} aria-current={onShoots ? "page" : undefined}>
          <Calendar className="size-5" />
          Shoots
        </Link>
        <Link href="/admin/listings" className={cn("flex min-h-12 flex-col items-center justify-center gap-0.5 text-[10px]", onListings && "text-[#d4bc8c]")} aria-current={onListings ? "page" : undefined}>
          <Home className="size-5" />
          Listings
        </Link>
        <Link href="/admin/billing" className={cn("flex min-h-12 flex-col items-center justify-center gap-0.5 text-[10px]", onMoney && "text-[#d4bc8c]")} aria-current={onMoney ? "page" : undefined}>
          <Receipt className="size-5" />
          Money
        </Link>
        <button type="button" className={cn("flex min-h-12 flex-col items-center justify-center gap-0.5 text-[10px]", open && "text-[#d4bc8c]")} onClick={() => setOpen(true)}>
          <MoreHorizontal className="size-5" />
          More
        </button>
      </nav>
    </div>
  );
}
