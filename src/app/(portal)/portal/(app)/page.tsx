import { redirect } from "next/navigation";
import { EmptyState } from "@/components/data/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCents } from "@/lib/money";
import { clientOrderLabel } from "@/lib/order-status";
import { getActor } from "@/server/auth/guards";
import { clientScope } from "@/server/db/scoped";

export const metadata = { title: "Your dashboard" };

export default async function PortalHomePage() {
  const actor = await getActor();
  if (!actor) redirect("/portal/login");
  const scope = clientScope(actor);
  const [orders, invoices, galleries] = await Promise.all([scope.orders.list(), scope.invoices.list(), scope.galleries.list()]);
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Hello, {actor.name.split(" ")[0]}</h1>
        <p className="mt-2 text-muted-foreground">Your Amalfi Media listings in Orlando and Central Florida.</p>
      </div>
      <section className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Orders</CardTitle></CardHeader>
          <CardContent className="text-3xl font-semibold tabular-nums">{orders.length}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Invoices</CardTitle></CardHeader>
          <CardContent className="text-3xl font-semibold tabular-nums">{invoices.length}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Galleries</CardTitle></CardHeader>
          <CardContent className="text-3xl font-semibold tabular-nums">{galleries.length}</CardContent>
        </Card>
      </section>
      {orders.length === 0 ? (
        <EmptyState title="No orders yet" body="When Amalfi schedules a shoot, it will show up here." />
      ) : (
        <Card>
          <CardHeader><CardTitle>Recent orders</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {orders.map((order) => (
              <div key={order.id} className="flex items-center justify-between text-sm">
                <span>
                  AM-{String(order.number).padStart(4, "0")} · {order.property.addressLine1}
                </span>
                <span className="text-muted-foreground">
                  {clientOrderLabel(order.status)} · {formatCents(order.totalCents)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
