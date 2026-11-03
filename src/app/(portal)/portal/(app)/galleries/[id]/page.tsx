import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { buyGalleryAction, chooseZelleAction } from "@/app/(portal)/portal/(app)/galleries/[id]/actions";
import { Button } from "@/components/ui/button";
import { cardProcessingQuote } from "@/lib/card-fee";
import { formatCents } from "@/lib/money";
import { getActor } from "@/server/auth/guards";
import { billingStatus } from "@/server/services/billing";
import { getEnv } from "@/server/env";
import { clientGallery, downloadDecisionFor } from "@/server/services/galleries";

export const metadata = { title: "Gallery" };

export default async function PortalGalleryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ paid?: string; cancelled?: string; notice?: string }>;
}) {
  const actor = await getActor();
  if (!actor?.clientId) redirect("/portal/login");
  const { id } = await params;
  const query = await searchParams;
  const gallery = await clientGallery(actor.clientId, id);
  if (!gallery) notFound();
  const decision = downloadDecisionFor(gallery);
  const openInvoice = gallery.order.invoices.find((invoice) => invoice.status === "OPEN");
  const stripe = billingStatus();
  const env = getEnv();
  const cardQuote = openInvoice
    ? cardProcessingQuote({ priceCents: openInvoice.totalCents, percentBps: env.cardFeePercentBps, fixedCents: env.cardFeeFixedCents })
    : null;
  const awaitingZelle = gallery.order.collection === "AWAITING_ZELLE" && !decision.allowed;
  return (
    <div className="space-y-6">
      <Link className="text-sm text-primary" href="/portal/galleries">
        Galleries
      </Link>
      <h1 className="text-3xl font-semibold tracking-tight">{gallery.title}</h1>
      <p className="text-sm text-muted-foreground">{gallery.property.addressLine1}</p>
      {query.notice ? <p className="rounded-md border border-border px-4 py-3 text-sm">{query.notice}</p> : null}
      {query.cancelled ? <p className="text-sm">Checkout was cancelled. You can buy when you are ready.</p> : null}
      {query.paid && decision.allowed ? <p className="text-sm">Payment received. You can download these photos.</p> : null}
      {query.paid && !decision.allowed ? <p className="text-sm">Payment is processing. Refresh in a moment.</p> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        {gallery.assets.map((asset) => (
          <figure key={asset.id} className="space-y-2">
            {/* Watermarked preview only. The original is never used as a thumbnail. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/portal/galleries/${gallery.id}/preview/${asset.id}`}
              alt={asset.fileName}
              className="max-h-64 w-full rounded-md border border-border object-contain"
            />
            <figcaption className="text-xs text-muted-foreground">{asset.fileName}</figcaption>
          </figure>
        ))}
      </div>
      {decision.allowed ? (
        <div className="flex gap-4 text-sm">
          <a className="text-primary" href={`/portal/galleries/${gallery.id}/download`}>
            Download
          </a>
          <a className="text-primary" href={`/portal/galleries/${gallery.id}/zip`}>
            Download zip
          </a>
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <p>Payment required before download.</p>
          {openInvoice && cardQuote ? (
            <div className="space-y-1">
              <p>
                <Link className="text-primary" href={`/portal/invoices/${openInvoice.id}`}>
                  Invoice {openInvoice.number}
                </Link>
              </p>
              <p>Listing price {formatCents(openInvoice.totalCents)}</p>
              <p>Card processing fee {formatCents(cardQuote.feeCents)}</p>
              <p>Card total {formatCents(cardQuote.totalCents)}</p>
            </div>
          ) : (
            <p className="text-muted-foreground">No open invoice yet.</p>
          )}
          <div className="flex flex-wrap gap-2">
            {openInvoice && stripe.configured ? (
              <form action={buyGalleryAction.bind(null, gallery.id)}>
                <Button type="submit">Buy</Button>
              </form>
            ) : null}
            {openInvoice && env.zellePhone ? (
              <form action={chooseZelleAction.bind(null, gallery.id)}>
                <Button type="submit" variant="secondary">
                  Pay with Zelle, no card fee
                </Button>
              </form>
            ) : null}
          </div>
          {openInvoice && !stripe.configured ? <p>Stripe is not configured.</p> : null}
          {awaitingZelle && env.zellePhone ? (
            <div className="space-y-2 rounded-md border border-border p-4" data-testid="zelle-instructions">
              <p className="font-medium">Pay with Zelle, no card fee</p>
              <p>Send {formatCents(openInvoice?.totalCents ?? gallery.order.totalCents)} via Zelle to {env.zellePhone}.</p>
              <p>Then text that number once you have sent it.</p>
              <p>Put {gallery.property.addressLine1} and order {gallery.order.number} in the memo.</p>
              <p className="text-muted-foreground">Downloads stay locked until Amalfi confirms the Zelle payment.</p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
