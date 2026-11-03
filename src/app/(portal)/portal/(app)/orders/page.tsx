import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/data/empty-state";
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
      <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight sm:text-4xl">Orders</h1>
      {orders.length === 0 ? (
        <EmptyState title="No orders yet" body="Request a shoot and it will show up here." />
      ) : (
        <div className="grid gap-3">
          {orders.map((order) => (
            <Link key={order.id} href={`/portal/orders/${order.id}`} className="block min-h-12 rounded-2xl border border-border bg-card p-4">
              <p className="text-base font-semibold">{order.property.addressLine1}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {clientOrderLabel(order.status)} · {formatCents(order.totalCents)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
