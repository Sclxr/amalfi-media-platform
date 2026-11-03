import Link from "next/link";
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
        <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight sm:text-4xl">Hello, {actor.name.split(" ")[0]}</h1>
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
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Recent orders</h2>
          {orders.map((order) => (
            <Link key={order.id} href={`/portal/orders/${order.id}`} className="block min-h-12 rounded-2xl border border-border bg-card p-4">
              <p className="text-base font-semibold">{order.property.addressLine1}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                AM-{String(order.number).padStart(4, "0")} · {clientOrderLabel(order.status)} · {formatCents(order.totalCents)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
