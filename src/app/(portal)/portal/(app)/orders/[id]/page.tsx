import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCents } from "@/lib/money";
import { clientOrderLabel } from "@/lib/order-status";
import { getActor } from "@/server/auth/guards";
import { prisma } from "@/server/db/prisma";

export const metadata = { title: "Order" };

export default async function PortalOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  if (!actor?.clientId) redirect("/portal/login");
  const { id } = await params;
  const order = await prisma.order.findFirst({
    where: { id, clientId: actor.clientId },
    include: { property: true, items: true, history: { orderBy: { createdAt: "asc" } } },
  });
  if (!order) notFound();
  return (
    <div className="space-y-6">
      <Link className="text-sm text-primary" href="/portal/orders">
        Orders
      </Link>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{order.property.addressLine1}</h1>
        <p className="mt-2 text-muted-foreground">
          {clientOrderLabel(order.status)} · {formatCents(order.totalCents)} · travel {formatCents(order.travelFeeCents)}
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {order.items.map((item) => (
            <p key={item.id}>
              {item.label}
              {item.unitPriceCents === null ? " · quote" : ` · ${formatCents(item.unitPriceCents)}`}
            </p>
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
              {clientOrderLabel(entry.toStatus)}
              {entry.note ? ` · ${entry.note}` : ""}
            </p>
          ))}
        </CardContent>
      </Card>
      <Link className="text-sm text-primary" href={`/portal/orders/${order.id}/calendar`}>
        Download calendar
      </Link>
    </div>
  );
}
