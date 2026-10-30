import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/data/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCents } from "@/lib/money";
import { clientOrderLabel } from "@/lib/order-status";
import { getActor } from "@/server/auth/guards";
import { clientScope } from "@/server/db/scoped";

export const metadata = { title: "Orders" };

export default async function PortalOrdersPage() {
  const actor = await getActor();
  if (!actor) redirect("/portal/login");
  const orders = await clientScope(actor).orders.list();
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Orders</h1>
      {orders.length === 0 ? (
        <EmptyState title="No orders yet" body="Request a shoot and it will show up here." />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Your shoots</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {orders.map((order) => (
              <div key={order.id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <Link className="font-medium text-primary" href={`/portal/orders/${order.id}`}>
                    {order.property.addressLine1}
                  </Link>
                  <p className="text-muted-foreground">
                    {clientOrderLabel(order.status)} · {formatCents(order.totalCents)}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
