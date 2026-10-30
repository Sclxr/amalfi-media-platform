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
      <h1 className="text-3xl font-semibold tracking-tight">Invoices</h1>
      <p className="text-sm text-muted-foreground">
        {stripe.configured ? "Pay with Stripe Checkout. Card numbers are not stored here." : "Stripe is not configured."}
      </p>
      <div className="space-y-3 text-sm">
        {invoices.map((invoice) => (
          <div key={invoice.id} className="flex flex-wrap items-center justify-between gap-3">
            <Link className="font-medium text-primary" href={`/portal/invoices/${invoice.id}`}>
              {invoice.number}
            </Link>
            <span>
              {formatCents(invoice.totalCents)} <StatusBadge status={invoice.status} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
