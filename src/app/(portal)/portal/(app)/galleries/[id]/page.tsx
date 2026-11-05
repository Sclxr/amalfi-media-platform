import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { buyGalleryAction, chooseZelleAction } from "@/app/(portal)/portal/(app)/galleries/[id]/actions";
import { PortalPhotoGrid } from "@/components/portal/photo-grid";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cardProcessingQuote } from "@/lib/card-fee";
import { pageShare } from "@/lib/share";
import { formatCents } from "@/lib/money";
import { getActor } from "@/server/auth/guards";
import { billingStatus } from "@/server/services/billing";
import { getEnv } from "@/server/env";
import { clientGallery, downloadDecisionFor } from "@/server/services/galleries";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  const { id } = await params;
  if (!actor?.clientId) return pageShare("Gallery", "A photo gallery from Amalfi Media.");
  const gallery = await clientGallery(actor.clientId, id);
  if (!gallery) return pageShare("Gallery", "A photo gallery from Amalfi Media.");
  const address = gallery.property.addressLine1;
  return pageShare(address, `Photos for ${address} from Amalfi Media.`);
}

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
      <h1 className="break-words text-[1.75rem] font-semibold leading-tight tracking-tight sm:text-4xl">{gallery.title}</h1>
      {gallery.title !== gallery.property.addressLine1 ? (
        <p className="break-words text-base text-muted-foreground">{gallery.property.addressLine1}</p>
      ) : (
        <p className="text-sm text-muted-foreground">
          {gallery.property.city}, {gallery.property.state}
        </p>
      )}
      {query.notice ? <p className="rounded-md border border-border px-4 py-3 text-sm">{query.notice}</p> : null}
      {query.cancelled ? <p className="text-sm">Checkout was cancelled. You can buy when you are ready.</p> : null}
      {query.paid && decision.allowed ? <p className="text-sm">Payment received. You can download these photos.</p> : null}
      {query.paid && !decision.allowed ? <p className="text-sm">Payment is processing. Refresh in a moment.</p> : null}
      <PortalPhotoGrid
        photos={gallery.assets.map((asset) => ({
          id: asset.id,
          fileName: asset.fileName,
          src: `/portal/galleries/${gallery.id}/preview/${asset.id}`,
        }))}
      />
      {decision.allowed ? (
        <div className="flex flex-wrap gap-2">
          <a className="inline-flex h-12 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground" href={`/portal/galleries/${gallery.id}/download`}>
            Download
          </a>
          <a className="inline-flex h-12 items-center rounded-xl border border-border bg-surface px-4 text-sm font-medium" href={`/portal/galleries/${gallery.id}/zip`}>
            Download zip
          </a>
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <p>Payment required before download.</p>
          {openInvoice && cardQuote ? (
            <Card>
              <CardHeader>
                <CardTitle>Pay for these photos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p>
                  <Link className="font-medium text-primary" href={`/portal/invoices/${openInvoice.id}`}>
                    Invoice {openInvoice.number}
                  </Link>
                </p>
                <p>Listing price {formatCents(openInvoice.totalCents)}</p>
                <p>Card processing fee {formatCents(cardQuote.feeCents)}</p>
                <p className="text-base font-semibold">Card total {formatCents(cardQuote.totalCents)}</p>
                <div className="flex flex-wrap gap-2">
                  {stripe.configured ? (
                    <form action={buyGalleryAction.bind(null, gallery.id)}>
                      <Button type="submit">Buy</Button>
                    </form>
                  ) : null}
                  {env.zellePhone ? (
                    <form action={chooseZelleAction.bind(null, gallery.id)}>
                      <Button type="submit" variant="secondary">
                        Pay with Zelle, no card fee
                      </Button>
                    </form>
                  ) : null}
                </div>
                <p className="text-muted-foreground">
                  Paying confirms the <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy</Link>.
                </p>
                {!stripe.configured ? <p>Stripe is not configured.</p> : null}
              </CardContent>
            </Card>
          ) : (
            <p className="text-muted-foreground">No open invoice yet.</p>
          )}
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
