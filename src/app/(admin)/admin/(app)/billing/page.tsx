import Link from "next/link";
import { redirect } from "next/navigation";
import { createInvoiceAction } from "@/app/(admin)/admin/(app)/billing/actions";
import { StatusBadge } from "@/components/data/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCents } from "@/lib/money";
import { getActor } from "@/server/auth/guards";
import { billingStatus, listInvoices } from "@/server/services/billing";
import { listOrders } from "@/server/services/orders";

export const metadata = { title: "Billing" };

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const actor = await getActor();
  if (!actor) redirect("/admin/login");
  const query = await searchParams;
  const [invoices, orders, stripe] = await Promise.all([listInvoices(actor), listOrders(actor), Promise.resolve(billingStatus())]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Billing</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          {stripe.configured
            ? "Checkout uses Stripe. Card numbers stay at Stripe."
            : "Stripe is not configured. Invoices can still be created. Checkout stays off until keys are set."}
        </p>
      </div>
      {query.notice ? <p className="text-sm">{query.notice}</p> : null}
      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {invoices.map((invoice) => (
            <div key={invoice.id} className="flex flex-wrap items-center justify-between gap-3">
              <Link className="font-medium text-primary" href={`/admin/billing/${invoice.id}`}>
                {invoice.number}
              </Link>
              <span>
                {formatCents(invoice.totalCents)} · <StatusBadge status={invoice.status} />
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
      <form action={createInvoiceAction} className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          Order
          <select name="orderId" className="mt-1 block h-10 rounded-sm border border-border bg-background px-3" required>
            {orders.map((order) => (
              <option key={order.id} value={order.id}>
                {order.property.addressLine1}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="secondary">
          Create invoice
        </Button>
      </form>
    </div>
  );
}
