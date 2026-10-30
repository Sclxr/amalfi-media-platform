import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { checkoutAction } from "@/app/(admin)/admin/(app)/billing/actions";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/money";
import { getActor } from "@/server/auth/guards";
import { billingStatus } from "@/server/services/billing";
import { prisma } from "@/server/db/prisma";

export const metadata = { title: "Invoice" };

export default async function PortalInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const actor = await getActor();
  if (!actor?.clientId) redirect("/portal/login");
  const { id } = await params;
  const query = await searchParams;
  const invoice = await prisma.invoice.findFirst({
    where: { id, clientId: actor.clientId },
    include: { lineItems: true, payments: true },
  });
  if (!invoice) notFound();
  const stripe = billingStatus();
  const pay = checkoutAction.bind(null, invoice.id);
  return (
    <div className="space-y-6">
      <Link className="text-sm text-primary" href="/portal/invoices">
        Invoices
      </Link>
      <h1 className="text-3xl font-semibold tracking-tight">{invoice.number}</h1>
      <p className="text-sm text-muted-foreground">
        {formatCents(invoice.totalCents)} · {invoice.status}
      </p>
      {query.notice ? <p className="text-sm">{query.notice}</p> : null}
      {!stripe.configured ? <p className="text-sm">Stripe is not configured.</p> : null}
      {invoice.lineItems.map((line) => (
        <p key={line.id} className="text-sm">
          {line.description} · {formatCents(line.totalCents)}
        </p>
      ))}
      {invoice.payments.map((payment) =>
        payment.receiptUrl ? (
          <a key={payment.id} className="text-sm text-primary" href={payment.receiptUrl}>
            Receipt
          </a>
        ) : null,
      )}
      {stripe.configured && invoice.status !== "PAID" ? (
        <form action={pay}>
          <Button type="submit">Pay with Stripe</Button>
        </form>
      ) : null}
    </div>
  );
}
