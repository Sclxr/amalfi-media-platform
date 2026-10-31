import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { quoteOrderAction, statusOrderAction } from "@/app/(admin)/admin/(app)/orders/actions";
import { StatusBadge } from "@/components/data/status-badge";
import { ArchivedBanner } from "@/components/removal/archive-view";
import { RecordMenu } from "@/components/removal/record-menu";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatCents } from "@/lib/money";
import { can } from "@/lib/permissions";
import { hasFinancialHistory } from "@/lib/removal";
import { adminOrderLabel, nextOrderStatuses, type OrderStatus } from "@/lib/order-status";
import { getActor } from "@/server/auth/guards";
import { getOrder } from "@/server/services/orders";

export const metadata = { title: "Order" };

export default async function AdminOrderPage({
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
  const order = await getOrder(actor, id);
  if (!order) notFound();
  const quote = quoteOrderAction.bind(null, order.id);
  const status = statusOrderAction.bind(null, order.id);
  const next = nextOrderStatuses(order.status);
  return (
    <div className="space-y-6">
      <Link className="text-sm text-primary" href="/admin/orders">
        Orders
      </Link>
      {order.archivedAt ? <ArchivedBanner>This order is archived. Restore it to put it back on the active list.</ArchivedBanner> : null}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">{order.property.addressLine1}</h1>
        <StatusBadge status={order.status} />
        <RecordMenu
          kind="order"
          id={order.id}
          name={`Order ${order.number}`}
          archived={Boolean(order.archivedAt)}
          canArchive={can(actor, "orders.write")}
          canPermanent={can(actor, "records.delete")}
          deletable={!hasFinancialHistory(order.invoices)}
          returnTo={`/admin/orders/${order.id}`}
        />
      </div>
      <p className="text-sm text-muted-foreground">
        {order.client.firstName} {order.client.lastName} · {formatCents(order.totalCents)} · travel {formatCents(order.travelFeeCents)} · {order.property.zip}
      </p>
      {query.notice ? <p className="rounded-md border border-border px-4 py-3 text-sm">{query.notice}</p> : null}
      <Card>
        <CardHeader>
          <CardTitle>Quote</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={quote} className="space-y-3 text-sm">
            {order.items.map((item) => (
              <div key={item.id} className="grid items-center gap-2 md:grid-cols-[1fr_160px]">
                <p>
                  {item.label}
                  {item.service?.pricingMode === "QUOTE" ? " · quote" : ""}
                </p>
                {item.service?.pricingMode === "QUOTE" ? (
                  <Input
                    name={`price:${item.id}`}
                    aria-label={`Price for ${item.label}`}
                    placeholder={item.unitPriceCents === null ? "Quote" : String(item.unitPriceCents / 100)}
                    defaultValue={item.unitPriceCents === null ? "" : (item.unitPriceCents / 100).toFixed(2)}
                  />
                ) : (
                  <p>{item.unitPriceCents === null ? "—" : formatCents(item.unitPriceCents)}</p>
                )}
              </div>
            ))}
            <Button type="submit" variant="secondary">
              Save quote
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Lifecycle</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm">{adminOrderLabel(order.status)}</p>
          {next.map((value) => (
            <form key={value} action={status} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="status" value={value} />
              {value === "SCHEDULED" ? (
                <label className="text-sm">
                  Start
                  <input name="startLocal" type="datetime-local" required className="mt-1 block h-10 rounded-sm border border-border bg-background px-3" />
                </label>
              ) : null}
              <Button type="submit" variant="secondary">
                Mark {adminOrderLabel(value as OrderStatus)}
              </Button>
            </form>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {order.history.map((entry) => (
            <p key={entry.id}>
              {entry.fromStatus ? `${adminOrderLabel(entry.fromStatus)} → ` : ""}
              {adminOrderLabel(entry.toStatus)}
              {entry.note ? ` · ${entry.note}` : ""}
            </p>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
