import Link from "next/link";
import { redirect } from "next/navigation";
import { StatusBadge } from "@/components/data/status-badge";
import { ArchiveView } from "@/components/removal/archive-view";
import { BulkBar, RecordMenu } from "@/components/removal/record-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCents } from "@/lib/money";
import { hasFinancialHistory } from "@/lib/removal";
import { can } from "@/lib/permissions";
import { getActor } from "@/server/auth/guards";
import { listOrders } from "@/server/services/orders";

export const metadata = { title: "Orders" };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ view?: string; notice?: string }> }) {
  const actor = await getActor();
  if (!actor) redirect("/admin/login");
  const params = await searchParams;
  const orders = await listOrders(actor, params.view);
  const returnTo = params.view === "archived" ? "/admin/orders?view=archived" : "/admin/orders";
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Orders</h1>
        <p className="mt-2 text-muted-foreground">Requested, quoted, scheduled, shot, editing, delivered, or cancelled.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <ArchiveView href="/admin/orders" view={params.view} />
        {can(actor, "orders.write") ? <BulkBar kind="order" returnTo={returnTo} canArchive /> : null}
      </div>
      {params.notice ? <p className="text-sm">{params.notice}</p> : null}
      <Card>
        <CardHeader>
          <CardTitle>All orders</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {orders.length === 0 ? <p className="text-muted-foreground">No orders yet.</p> : null}
          {orders.map((order) => (
            <div key={order.id} data-testid="order-row" className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" data-bulk="order" value={order.id} aria-label={`Select order ${order.number}`} />
              </label>
              <div>
                <Link className="font-medium text-primary" href={`/admin/orders/${order.id}`}>
                  {order.property.addressLine1}
                </Link>
                <p className="text-muted-foreground">
                  {order.client.firstName} {order.client.lastName} · {formatCents(order.totalCents)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={order.status} />
                <RecordMenu
                  kind="order"
                  id={order.id}
                  name={`Order ${order.number}`}
                  archived={Boolean(order.archivedAt)}
                  canArchive={can(actor, "orders.write")}
                  canPermanent={can(actor, "records.delete")}
                  deletable={!hasFinancialHistory(order.invoices)}
                  returnTo={returnTo}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <Link className="text-sm text-primary" href="/admin/orders/email">
        Transactional email preview
      </Link>
    </div>
  );
}
