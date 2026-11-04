import Link from "next/link";
import { redirect } from "next/navigation";
import { StatusBadge } from "@/components/data/status-badge";
import { formatCents } from "@/lib/money";
import { getActor } from "@/server/auth/guards";
import { billingStatus } from "@/server/services/billing";
import { clientScope } from "@/server/db/scoped";

export const metadata = { title: "Invoices" };

export default async function PortalInvoicesPage() {
  const actor = await getActor();
  if (!actor) redirect("/portal/login");
  const invoices = await clientScope(actor).invoices.list();
  const stripe = billingStatus();
  return (
    <div className="space-y-6">
      <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight sm:text-4xl">Invoices</h1>
      <p className="text-base text-muted-foreground">
        {stripe.configured ? "Pay with Stripe Checkout. Card numbers are not stored here." : "Stripe is not configured."}
      </p>
      <div className="grid gap-3">
        {invoices.map((invoice) => (
          <Link key={invoice.id} href={`/portal/invoices/${invoice.id}`} className="block min-h-12 rounded-2xl border border-border bg-card p-4">
            {invoice.order?.property.addressLine1 ? <p className="text-base font-semibold">{invoice.order.property.addressLine1}</p> : null}
            <p className="mt-1 text-sm">
              {invoice.number} · {formatCents(invoice.totalCents)} <StatusBadge status={invoice.status} />
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
