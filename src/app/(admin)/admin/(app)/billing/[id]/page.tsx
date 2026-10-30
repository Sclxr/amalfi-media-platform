import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { checkoutAction } from "@/app/(admin)/admin/(app)/billing/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCents } from "@/lib/money";
import { getActor } from "@/server/auth/guards";
import { billingStatus, getInvoice } from "@/server/services/billing";

export const metadata = { title: "Invoice" };

export default async function InvoiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const actor = await getActor();
  if (!actor) redirect("/admin/login");
  const { id } = await params;
  const query = await searchParams;
  const invoice = await getInvoice(actor, id);
  if (!invoice) notFound();
  const stripe = billingStatus();
  const pay = checkoutAction.bind(null, invoice.id);
  return (
    <div className="space-y-6">
      <Link className="text-sm text-primary" href="/admin/billing">
        Billing
      </Link>
      <h1 className="text-3xl font-semibold tracking-tight">{invoice.number}</h1>
      <p className="text-sm text-muted-foreground">
        {invoice.client.firstName} {invoice.client.lastName} · {formatCents(invoice.totalCents)} · {invoice.status}
      </p>
      {query.notice ? <p className="text-sm">{query.notice}</p> : null}
      {!stripe.configured ? <p className="text-sm">Stripe is not configured.</p> : null}
      <Card>
        <CardHeader>
          <CardTitle>Lines</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {invoice.lineItems.map((line) => (
            <p key={line.id}>
              {line.description} · {formatCents(line.totalCents)}
            </p>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Receipts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {invoice.payments.length === 0 ? <p className="text-muted-foreground">No receipt yet.</p> : null}
          {invoice.payments.map((payment) =>
            payment.receiptUrl ? (
              <a key={payment.id} className="text-primary" href={payment.receiptUrl}>
                Receipt
              </a>
            ) : (
              <p key={payment.id}>Payment recorded. Stripe did not include a receipt URL.</p>
            ),
          )}
        </CardContent>
      </Card>
      {stripe.configured && invoice.status !== "PAID" ? (
        <form action={pay}>
          <Button type="submit">Pay with Stripe</Button>
        </form>
      ) : null}
    </div>
  );
}
