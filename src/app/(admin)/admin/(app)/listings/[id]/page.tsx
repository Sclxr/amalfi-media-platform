import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { updateListingAction } from "@/app/(admin)/admin/(app)/listings/actions";
import { ListingPhotos } from "@/components/forms/listing-photos";
import { StatusBadge } from "@/components/data/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { adminOrderLabel } from "@/lib/order-status";
import { getActor } from "@/server/auth/guards";
import { getListing } from "@/server/services/listings";

export const metadata = { title: "Listing" };

export default async function ListingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const actor = await getActor();
  if (!actor) redirect("/admin/login");
  const { id } = await params;
  const query = await searchParams;
  const listing = await getListing(actor, id);
  if (!listing) notFound();
  const { property, card } = listing;
  const update = updateListingAction.bind(null, property.id);
  const photos = property.galleries
    .flatMap((gallery) => gallery.assets)
    .filter((asset) => asset.kind === "PHOTO" && asset.status === "READY")
    .sort((left, right) => left.sortOrder - right.sortOrder || left.createdAt.getTime() - right.createdAt.getTime())
    .map((asset) => ({
      id: asset.id,
      fileName: asset.fileName,
      src: `/admin/listings/${property.id}/photos/${asset.id}`,
    }));
  return (
    <div className="space-y-6">
      <Link className="text-sm text-primary" href="/admin/listings">
        Listings
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{property.addressLine1}</h1>
          <p className="mt-2 text-muted-foreground">
            {property.city}, {property.state} {property.zip}
          </p>
        </div>
        {card.status === "NO_SHOOT" ? (
          <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">No shoot</span>
        ) : (
          <StatusBadge status={card.status} />
        )}
      </div>
      {query.notice ? <p className="text-sm">{query.notice}</p> : null}
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4 text-sm">
          <p>
            Realtor:{" "}
            {property.lead ? (
              <Link className="font-medium text-primary" href={`/admin/crm/leads/${property.lead.id}?tab=listings`}>
                {card.realtorName}
              </Link>
            ) : (
              "Unassigned"
            )}
          </p>
          <p>Shoot date: {formatDateTime(card.shootDate)}</p>
          <div className="overflow-hidden rounded-lg border border-border">
            {card.hasCover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/admin/listings/${property.id}/cover`} alt="" className="h-56 w-full object-cover" />
            ) : (
              <div className="grid h-40 place-items-center bg-accent text-muted-foreground">No cover photo</div>
            )}
          </div>
          <div className="space-y-2">
            <h2 className="font-semibold">Orders</h2>
            {property.orders.length === 0 ? <p className="text-muted-foreground">No orders yet.</p> : null}
            {property.orders.map((order) => (
              <p key={order.id}>
                <Link className="text-primary" href={`/admin/orders/${order.id}`}>
                  Order {order.number}
                </Link>{" "}
                · {adminOrderLabel(order.status)}
                {order.bookings[0]?.startAt ? ` · ${formatDateTime(order.bookings[0].startAt)}` : ""}
                {order.bookings[0] ? (
                  <>
                    {" "}
                    · <Link className="text-primary" href="/admin/bookings">Calendar</Link>
                  </>
                ) : null}
              </p>
            ))}
          </div>
          <ListingPhotos
            propertyId={property.id}
            photos={photos}
            galleries={property.galleries.map((gallery) => ({ id: gallery.id, title: gallery.title, status: gallery.status }))}
            canWrite={can(actor, "media.write")}
          />
          <div className="space-y-2">
            <h2 className="font-semibold">Invoices</h2>
            {property.orders.every((order) => order.invoices.length === 0) ? (
              <p className="text-muted-foreground">No invoice yet.</p>
            ) : null}
            {property.orders.flatMap((order) =>
              order.invoices.map((invoice) => (
                <p key={invoice.id}>
                  <Link className="text-primary" href={`/admin/billing/${invoice.id}`}>
                    {invoice.number}
                  </Link>{" "}
                  · {invoice.status}
                </p>
              )),
            )}
          </div>
        </div>
        {can(actor, "orders.write") ? (
          <form action={update} className="grid gap-4 rounded-lg border border-border p-4">
            <h2 className="font-semibold">Address</h2>
            <div className="space-y-2">
              <Label htmlFor="addressLine1">Street</Label>
              <Input id="addressLine1" name="addressLine1" defaultValue={property.addressLine1} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input id="city" name="city" defaultValue={property.city} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zip">ZIP</Label>
              <Input id="zip" name="zip" defaultValue={property.zip} required />
            </div>
            <Button type="submit" variant="secondary">
              Save address
            </Button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
