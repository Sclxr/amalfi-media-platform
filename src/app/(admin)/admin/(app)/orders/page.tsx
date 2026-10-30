import Link from "next/link";
import { redirect } from "next/navigation";
import { StatusBadge } from "@/components/data/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCents } from "@/lib/money";
import { getActor } from "@/server/auth/guards";
import { listOrders } from "@/server/services/orders";

export const metadata = { title: "Orders" };

export default async function OrdersPage() {
  const actor = await getActor();
  if (!actor) redirect("/admin/login");
  const orders = await listOrders(actor);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Orders</h1>
        <p className="mt-2 text-muted-foreground">Requested, quoted, scheduled, shot, editing, delivered, or cancelled.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>All orders</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {orders.length === 0 ? <p className="text-muted-foreground">No orders yet.</p> : null}
          {orders.map((order) => (
            <div key={order.id} className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Link className="font-medium text-primary" href={`/admin/orders/${order.id}`}>
                  {order.property.addressLine1}
                </Link>
                <p className="text-muted-foreground">
                  {order.client.firstName} {order.client.lastName} · {formatCents(order.totalCents)}
                </p>
              </div>
              <StatusBadge status={order.status} />
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
