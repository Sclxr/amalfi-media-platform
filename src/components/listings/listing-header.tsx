import type { ReactNode } from "react";
import Link from "next/link";
import { Camera } from "lucide-react";
import { StatusBadge } from "@/components/data/status-badge";

export function ListingHeader({
  addressLine1,
  cityLine,
  realtor,
  status,
  shootLabel,
  coverSrc,
  actions,
}: {
  addressLine1: string;
  cityLine: string;
  realtor: { id: string; name: string } | null;
  status: string;
  shootLabel: string;
  coverSrc: string | null;
  actions?: ReactNode;
}) {
  return (
    <div className="space-y-4">
      {coverSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={coverSrc} alt="" className="h-44 w-full rounded-2xl border border-border object-cover sm:h-64" />
      ) : null}
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 gap-4">
          {coverSrc ? null : (
            <div className="grid size-16 shrink-0 place-items-center rounded-xl bg-accent text-muted-foreground" aria-hidden>
              <Camera className="size-5" strokeWidth={1.5} />
            </div>
          )}
          <div className="min-w-0">
          <h1 className="break-words text-2xl font-semibold tracking-tight sm:text-3xl">{addressLine1}</h1>
          <p className="mt-1 text-muted-foreground">{cityLine}</p>
          <p className="mt-2 text-sm">
            Realtor:{" "}
            {realtor ? (
              <Link className="font-medium text-primary" href={`/admin/crm/leads/${realtor.id}?tab=listings`}>
                {realtor.name}
              </Link>
            ) : (
              "Unassigned"
            )}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            {status === "NO_SHOOT" ? (
              <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">No shoot</span>
            ) : (
              <StatusBadge status={status} />
            )}
            <span className="text-muted-foreground">Shoot date: {shootLabel}</span>
          </div>
          </div>
        </div>
        {actions}
      </div>
    </div>
  );
}
