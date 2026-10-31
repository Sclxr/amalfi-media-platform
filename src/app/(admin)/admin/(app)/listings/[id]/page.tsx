import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createListingInvoiceAction, listingQuoteAction, listingStatusAction, rescheduleListingBookingAction, voidListingInvoiceAction } from "@/app/(admin)/admin/(app)/listings/actions";
import { StatusBadge } from "@/components/data/status-badge";
import { GalleryManager } from "@/components/listings/gallery-manager";
import { InviteLink } from "@/components/listings/invite-link";
import { ListingHeader } from "@/components/listings/listing-header";
import { ListingPrice } from "@/components/listings/listing-price";
import { ArchivedBanner } from "@/components/removal/archive-view";
import { RecordMenu } from "@/components/removal/record-menu";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/dates";
import { canVoidInvoice } from "@/lib/invoice-void";
import { orderPriceLock } from "@/lib/order-price";
import { hasFinancialHistory } from "@/lib/removal";
import { canMarkOrderDelivered, pickUploadOrder, propertyTypeLabel } from "@/lib/listing";
import { formatCents } from "@/lib/money";
import { adminOrderLabel, nextOrderStatuses, type OrderStatus } from "@/lib/order-status";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { getActor } from "@/server/auth/guards";
import { billingStatus } from "@/server/services/billing";
import { listActivePackages } from "@/server/services/catalog";
import { getListing, listRealtorOptions } from "@/server/services/listings";

export const metadata = { title: "Listing" };

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "gallery", label: "Gallery" },
  { id: "bookings", label: "Bookings" },
  { id: "billing", label: "Orders & Billing" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function blank(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "Not set";
  return String(value);
}

export default async function ListingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string; tab?: string; shoot?: string }>;
}) {
  const actor = await getActor();
  if (!actor) redirect("/admin/login");
  const { id } = await params;
  const query = await searchParams;
  const listing = await getListing(actor, id);
  if (!listing) notFound();
  const { property, card } = listing;
  const tab: TabId = TABS.some((item) => item.id === query.tab) ? (query.tab as TabId) : "overview";
  const canEdit = can(actor, "orders.write");
  const canMedia = can(actor, "media.write");
  const canSeeMoney = can(actor, "billing.read");
  const stripe = billingStatus();
  const realtors = canEdit ? await listRealtorOptions(actor) : [];
  const packages = canEdit ? await listActivePackages(actor) : [];
  const active = pickUploadOrder(property.orders);
  const shoot = property.orders.find((order) => order.id === query.shoot) ?? active ?? property.orders[0] ?? null;
  const shootGalleries = shoot ? property.galleries.filter((gallery) => gallery.orderId === shoot.id) : [];
  const deliverGallery = shootGalleries[0] ?? null;
  const current = property.orders.find((order) => order.id === card.orderId) ?? null;
  const currentGallery = current ? property.galleries.find((gallery) => gallery.orderId === current.id) : null;
  const currentInvoice = current?.invoices[0];

  return (
    <div className="space-y-6">
      <Link className="text-sm text-primary" href="/admin/listings">
        Listings
      </Link>
      {property.archivedAt ? <ArchivedBanner>This listing is archived. Restore it to put it back on the active list.</ArchivedBanner> : null}
      <ListingHeader
        propertyId={property.id}
        addressLine1={property.addressLine1}
        cityLine={`${property.city}, ${property.state} ${property.zip}`}
        realtor={property.lead ? { id: property.lead.id, name: card.realtorName } : null}
        status={card.status}
        shootLabel={card.shootDate ? formatDateTime(card.shootDate) : "Not scheduled"}
        coverSrc={card.hasCover ? `/admin/listings/${property.id}/cover` : null}
        canEdit={canEdit}
        canMedia={canMedia}
        menu={
          <RecordMenu
            kind="listing"
            id={property.id}
            name={property.addressLine1}
            archived={Boolean(property.archivedAt)}
            canArchive={canEdit}
            canPermanent={can(actor, "records.delete")}
            deletable={!hasFinancialHistory(property.orders.flatMap((order) => order.invoices))}
            returnTo="/admin/listings"
          />
        }
        realtors={realtors.map((realtor) => ({
          id: realtor.id,
          name: `${realtor.firstName ?? ""} ${realtor.lastName ?? ""}`.trim() || realtor.email || "Realtor",
        }))}
        editor={{
          leadId: property.leadId ?? "",
          addressLine1: property.addressLine1,
          addressLine2: property.addressLine2 ?? "",
          city: property.city,
          state: property.state,
          zip: property.zip,
          propertyType: property.propertyType,
          sqft: property.sqft?.toString() ?? "",
          beds: property.beds?.toString() ?? "",
          bathsHalf: property.bathsHalf?.toString() ?? "",
          accessNotes: property.accessNotes ?? "",
        }}
        delivery={
          deliverGallery && shoot
            ? {
                galleryId: deliverGallery.id,
                title: deliverGallery.title,
                statusLabel: deliverGallery.status === "PUBLISHED" ? "Published" : deliverGallery.status === "ARCHIVED" ? "Archived" : "Draft",
                canMarkDelivered: canMarkOrderDelivered(shoot.status),
                orderLabel: `Order ${shoot.number} · ${adminOrderLabel(shoot.status)}`,
              }
            : null
        }
      />
      {query.notice ? <p className="rounded-md border border-border px-4 py-3 text-sm">{query.notice}</p> : null}
      <nav aria-label="Listing sections" role="tablist" className="flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((item) => (
          <Link
            key={item.id}
            role="tab"
            aria-selected={tab === item.id}
            href={`/admin/listings/${property.id}?tab=${item.id}${shoot ? `&shoot=${shoot.id}` : ""}`}
            className={cn(
              "whitespace-nowrap px-3 py-2 text-sm",
              tab === item.id ? "border-b-2 border-primary font-medium" : "text-muted-foreground",
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {tab === "overview" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Property</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>{property.addressLine1}{property.addressLine2 ? `, ${property.addressLine2}` : ""}</p>
              <p>{property.city}, {property.state} {property.zip}</p>
              <p>{propertyTypeLabel(property.propertyType)}</p>
              <p>{blank(property.beds)} beds · {blank(property.bathsHalf)} half baths · {blank(property.sqft)} sq ft</p>
              <p>Access notes: {blank(property.accessNotes)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Realtor</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>{card.realtorName}</p>
              <p>{property.lead?.email ?? property.client.email}</p>
              <p>{blank(property.lead?.phone ?? property.client.phone)}</p>
              <p>{blank(property.lead?.brokerage?.name)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>This shoot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {current ? (
                <>
                  <p>
                    <Link className="text-primary" href={`/admin/orders/${current.id}`}>
                      Order {current.number}
                    </Link>{" "}
                    · {adminOrderLabel(current.status)}
                    {canSeeMoney ? ` · ${formatCents(current.totalCents)}` : ""}
                  </p>
                  <p>Shoot date: {card.shootDate ? formatDateTime(card.shootDate) : "Not scheduled"}</p>
                  {canEdit
                    ? nextOrderStatuses(current.status).map((value) => (
                        <form key={value} action={listingStatusAction.bind(null, property.id, current.id)} className="flex flex-wrap items-end gap-2">
                          <input type="hidden" name="status" value={value} />
                          <input type="hidden" name="tab" value="overview" />
                          {value === "SCHEDULED" ? (
                            <label className="text-sm">
                              Start
                              <input name="startLocal" type="datetime-local" required aria-label="Start" className="mt-1 block h-10 rounded-sm border border-border bg-background px-3" />
                            </label>
                          ) : null}
                          {value === "CANCELLED" ? null : (
                            <Button type="submit" variant="secondary" size="sm">
                              Mark {adminOrderLabel(value as OrderStatus)}
                            </Button>
                          )}
                        </form>
                      ))
                    : null}
                </>
              ) : (
                <p className="text-muted-foreground">No shoot yet.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Delivery and payment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>{currentGallery ? (currentGallery.status === "PUBLISHED" ? "Published for the client." : currentGallery.status === "ARCHIVED" ? "Archived" : "Draft") : "No gallery yet."}</p>
              {currentInvoice ? (
                <p>
                  <Link className="text-primary" href={`/admin/billing/${currentInvoice.id}`}>
                    {currentInvoice.number}
                  </Link>{" "}
                  · <StatusBadge status={currentInvoice.status} />
                  {canSeeMoney ? ` · ${formatCents(currentInvoice.totalCents)}` : ""}
                </p>
              ) : (
                <p className="text-muted-foreground">No invoice</p>
              )}
              <Link className="text-primary" href={`/admin/listings/${property.id}?tab=billing`}>
                Orders and billing
              </Link>
              {canEdit ? <InviteLink propertyId={property.id} /> : null}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {tab === "gallery" ? (
        <div className="space-y-4">
          {property.orders.length > 0 ? (
            <div className="flex gap-2 overflow-x-auto text-sm">
              {property.orders.map((order) => (
                <Link
                  key={order.id}
                  href={`/admin/listings/${property.id}?tab=gallery&shoot=${order.id}`}
                  className={cn(
                    "whitespace-nowrap rounded-full border px-3 py-1",
                    shoot?.id === order.id ? "border-primary bg-primary/10" : "border-border text-muted-foreground",
                  )}
                >
                  Order {order.number} · {adminOrderLabel(order.status)}
                </Link>
              ))}
            </div>
          ) : null}
          <GalleryManager
            propertyId={property.id}
            orderId={shoot && shoot.status !== "CANCELLED" ? shoot.id : null}
            cancelled={shoot?.status === "CANCELLED"}
            canWrite={canMedia}
            canDeleteGallery={Boolean(shoot) && can(actor, "records.delete") && !hasFinancialHistory(shoot?.invoices ?? [])}
            galleries={shootGalleries.map((gallery) => ({
              id: gallery.id,
              title: gallery.title,
              status: gallery.status,
              requirePaid: gallery.requirePaid,
              photos: gallery.assets
                .filter((asset) => asset.kind === "PHOTO" && asset.status === "READY")
                .map((asset) => ({
                  id: asset.id,
                  fileName: asset.fileName,
                  src: `/admin/listings/${property.id}/photos/${asset.id}`,
                  cover: property.coverAssetId === asset.id,
                })),
            }))}
          />
        </div>
      ) : null}

      {tab === "bookings" ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Link className="text-sm text-primary" href="/admin/bookings">
              Open calendar
            </Link>
          </div>
          {property.orders.every((order) => order.bookings.length === 0) ? (
            <p className="text-sm text-muted-foreground">No appointments yet.</p>
          ) : null}
          {property.orders.flatMap((order) =>
            order.bookings.map((booking) => (
              <Card key={booking.id}>
                <CardHeader>
                  <CardTitle>
                    Order {order.number} · <StatusBadge status={booking.status} />
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p>{booking.startAt ? formatDateTime(booking.startAt) : "Not scheduled"}</p>
                  <p>{booking.photographer ? booking.photographer.name : "No photographer assigned"}</p>
                  {canEdit && booking.startAt ? (
                    <form action={rescheduleListingBookingAction.bind(null, property.id)} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="bookingId" value={booking.id} />
                      <label className="text-sm">
                        New time
                        <input name="startLocal" type="datetime-local" required aria-label={`New time for order ${order.number}`} className="mt-1 block h-10 rounded-sm border border-border bg-background px-3" />
                      </label>
                      <Button type="submit" variant="secondary" size="sm">
                        Change time
                      </Button>
                    </form>
                  ) : null}
                  {canEdit && nextOrderStatuses(order.status).includes("CANCELLED") ? (
                    <ConfirmDialog
                      title="Cancel this shoot"
                      body={`Cancel order ${order.number} at ${property.addressLine1}? The history of the order is kept.`}
                      confirmLabel="Cancel shoot"
                      destructive
                      action={listingStatusAction.bind(null, property.id, order.id)}
                      hidden={{ status: "CANCELLED", note: "Cancelled from the listing.", tab: "bookings" }}
                      trigger={<Button type="button" variant="destructive" size="sm">Cancel shoot</Button>}
                    />
                  ) : null}
                </CardContent>
              </Card>
            )),
          )}
        </div>
      ) : null}

      {tab === "billing" ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {stripe.configured
              ? "Refunds run through Stripe. Recorded payments stay unchanged on this page."
              : "Refunds run through Stripe. Stripe is not configured."}
          </p>
          {property.orders.length === 0 ? <p className="text-sm text-muted-foreground">No orders yet.</p> : null}
          {property.orders.map((order) => {
            const paid = order.invoices.some(
              (invoice) => invoice.amountPaidCents > 0 || invoice.payments.some((payment) => payment.status === "SUCCEEDED"),
            );
            const priceLock = orderPriceLock(order.invoices);
            const liveInvoice = order.invoices.some((invoice) => invoice.status !== "VOID");
            const quoteItems = order.items.filter((item) => item.service?.pricingMode === "QUOTE");
            return (
              <Card key={order.id}>
                <CardHeader>
                  <CardTitle>
                    <Link className="text-primary" href={`/admin/orders/${order.id}`}>
                      Order {order.number}
                    </Link>{" "}
                    · {adminOrderLabel(order.status)}
                    {canSeeMoney ? ` · ${formatCents(order.totalCents)}` : ""}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {order.items.length === 0 ? <p className="text-muted-foreground">No price yet.</p> : null}
                  {order.items.map((item) => (
                    <p key={item.id}>
                      {item.label}
                      {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                      {canSeeMoney ? ` · ${item.unitPriceCents === null ? "Quote" : formatCents(item.unitPriceCents)}` : ""}
                    </p>
                  ))}
                  {canEdit && priceLock === null ? (
                    <ListingPrice propertyId={property.id} orderId={order.id} orderNumber={order.number} packages={packages} />
                  ) : null}
                  {canEdit && priceLock === "Void the open invoice before changing the price." ? (
                    <p className="text-muted-foreground">{priceLock}</p>
                  ) : null}
                  {canEdit && !paid && quoteItems.length > 0 ? (
                    <form action={listingQuoteAction.bind(null, property.id, order.id)} className="grid gap-2">
                      {quoteItems.map((item) => (
                        <label key={item.id} className="grid gap-1">
                          Price for {item.label}
                          <Input name={`price:${item.id}`} aria-label={`Price for ${item.label}`} placeholder="0.00" />
                        </label>
                      ))}
                      <Button type="submit" variant="secondary" size="sm">
                        Save quote
                      </Button>
                    </form>
                  ) : null}
                  {order.history.slice(0, 4).map((entry) => (
                    <p key={entry.id} className="text-muted-foreground">
                      {entry.fromStatus ? `${adminOrderLabel(entry.fromStatus)} → ` : ""}
                      {adminOrderLabel(entry.toStatus)}
                      {entry.note ? ` · ${entry.note}` : ""}
                    </p>
                  ))}
                  {order.invoices.length === 0 ? <p className="text-muted-foreground">No invoice</p> : null}
                  {order.invoices.map((invoice) => (
                    <div key={invoice.id} className="flex flex-wrap items-center gap-3">
                      <Link className="text-primary" href={`/admin/billing/${invoice.id}`}>
                        {invoice.number}
                      </Link>
                      <StatusBadge status={invoice.status} />
                      {canSeeMoney ? <span>{formatCents(invoice.amountPaidCents)} paid of {formatCents(invoice.totalCents)}</span> : null}
                      {canEdit && canVoidInvoice(invoice) ? (
                        <ConfirmDialog
                          title="Void invoice"
                          body={`Void ${invoice.number}? An unpaid invoice can be replaced. A recorded payment cannot be changed here.`}
                          confirmLabel="Void invoice"
                          destructive
                          action={voidListingInvoiceAction.bind(null, property.id)}
                          hidden={{ invoiceId: invoice.id }}
                          trigger={<Button type="button" variant="secondary" size="sm">Void</Button>}
                        />
                      ) : null}
                    </div>
                  ))}
                  {canEdit && !liveInvoice && order.items.some((item) => item.unitPriceCents !== null) && order.items.every((item) => item.unitPriceCents !== null) ? (
                    <form action={createListingInvoiceAction.bind(null, property.id)}>
                      <input type="hidden" name="orderId" value={order.id} />
                      <Button type="submit" variant="secondary" size="sm">
                        Create invoice
                      </Button>
                    </form>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
