import Link from "next/link";
import { redirect } from "next/navigation";
import { StatusBadge } from "@/components/data/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LISTING_STATUSES, listingStatusLabel } from "@/lib/listing";
import { formatDate } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { getActor } from "@/server/auth/guards";
import { listListings } from "@/server/services/listings";

export const metadata = { title: "Listings" };

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const actor = await getActor();
  if (!actor) redirect("/admin/login");
  const params = await searchParams;
  const listings = await listListings(actor, params);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Listings</h1>
          <p className="mt-2 text-muted-foreground">One property record, shared with orders, galleries, and invoices.</p>
        </div>
        {can(actor, "orders.write") ? (
          <Button asChild>
            <Link href="/admin/listings/new">Add listing</Link>
          </Button>
        ) : null}
      </div>
      <form className="grid gap-3 md:grid-cols-[1fr_220px_auto]" method="get">
        <Input name="q" defaultValue={params.q ?? ""} placeholder="Search address or realtor" aria-label="Search listings" />
        <select
          name="status"
          defaultValue={params.status ?? ""}
          aria-label="Status"
          className="h-10 rounded-sm border border-border bg-background px-3 text-sm"
        >
          <option value="">All statuses</option>
          {LISTING_STATUSES.map((status) => (
            <option key={status} value={status}>
              {listingStatusLabel(status)}
            </option>
          ))}
        </select>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>
      {listings.length === 0 ? (
        <p className="text-sm text-muted-foreground">No listings match.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {listings.map((listing) => (
            <article key={listing.id} className="overflow-hidden rounded-lg border border-border bg-card">
              <Link href={`/admin/listings/${listing.id}`} className="block">
                <div className="relative h-40 bg-accent">
                  {listing.hasCover ? (
                    // Staff preview of the stored file. next/image would re-process it.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/admin/listings/${listing.id}/cover`} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center text-sm text-muted-foreground">No cover photo</div>
                  )}
                </div>
                <div className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-base font-semibold leading-snug">{listing.addressLine1}</h2>
                    {listing.status === "NO_SHOOT" ? (
                      <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">No shoot</span>
                    ) : (
                      <StatusBadge status={listing.status} />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {listing.city}, {listing.state} {listing.zip}
                  </p>
                  <p className="text-sm">
                    {listing.leadId ? (
                      <span className="text-primary">{listing.realtorName}</span>
                    ) : (
                      <span className="text-muted-foreground">Unassigned</span>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {listing.statusLabel}
                    {listing.shootDate ? ` · ${formatDate(listing.shootDate)}` : ""}
                  </p>
                </div>
              </Link>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
