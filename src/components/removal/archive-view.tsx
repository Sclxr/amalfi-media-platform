import Link from "next/link";
import { cn } from "@/lib/utils";

export function ArchiveView({ href, view }: { href: string; view?: string }) {
  const archived = view === "archived";
  const join = href.includes("?") ? "&" : "?";
  return (
    <nav aria-label="Record state" className="flex gap-3 text-sm">
      <Link href={href} className={cn(!archived && "font-medium text-primary")} aria-current={!archived ? "page" : undefined}>
        Active
      </Link>
      <Link
        href={`${href}${join}view=archived`}
        className={cn(archived && "font-medium text-primary")}
        aria-current={archived ? "page" : undefined}
      >
        Archived
      </Link>
    </nav>
  );
}

export function ArchivedBanner({ children }: { children: string }) {
  return <p className="rounded-md border border-border bg-accent px-4 py-3 text-sm">{children}</p>;
}
