"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { deliverListingAction, updateListingAction } from "@/app/(admin)/admin/(app)/listings/actions";
import { markZellePaidAction } from "@/app/(admin)/admin/(app)/listings/actions";
import { createListingInviteAction, sendListingInviteAction } from "@/app/(admin)/admin/(app)/listings/actions";
import { QuoteSheet, type QuoteChoice } from "@/components/quotes/quote-sheet";
import { RecordMenu } from "@/components/removal/record-menu";
import { Button } from "@/components/ui/button";
import { DialogClose, Modal } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { listingNextLabel, type ListingNextAction } from "@/lib/listing-next";
import { PROPERTY_TYPE_LABELS, propertyTypeLabel } from "@/lib/listing";

const gold = "border border-[#d4bc8c] bg-[#111111] text-[#d4bc8c] hover:bg-[#1c1c1c]";
const itemClass = "flex min-h-12 w-full items-center rounded-xl px-3 text-left hover:bg-accent";

export type ListingEditorValues = {
  leadId: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zip: string;
  propertyType: string;
  sqft: string;
  beds: string;
  bathsHalf: string;
  accessNotes: string;
};

export function ListingActions({
  propertyId,
  address,
  next,
  canEdit,
  canMedia,
  quote,
  delivery,
  zelle,
  editor,
  realtors,
  removal,
}: {
  propertyId: string;
  address: string;
  next: ListingNextAction | null;
  canEdit: boolean;
  canMedia: boolean;
  quote: QuoteChoice | null;
  delivery: { galleryId: string; title: string; statusLabel: string; canMarkDelivered: boolean; orderLabel: string } | null;
  zelle: { invoiceId: string; amount: string; number: string } | null;
  editor: ListingEditorValues;
  realtors: { id: string; name: string }[];
  removal: {
    archived: boolean;
    canArchive: boolean;
    canPermanent: boolean;
    deletable: boolean;
  };
}) {
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deliverOpen, setDeliverOpen] = useState(false);
  const [zelleOpen, setZelleOpen] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const label = next ? listingNextLabel(next) : null;
  const uploadHref = `/admin/listings/${propertyId}?tab=gallery#upload`;
  const downloadHref = `/admin/listings/${propertyId}?tab=gallery`;
  const scheduleHref = `/admin/listings/${propertyId}?tab=overview#schedule`;

  function copyInvite() {
    setInviteError(null);
    setInviteStatus(null);
    setCopied(false);
    startTransition(async () => {
      const result = await createListingInviteAction(propertyId);
      if ("error" in result && result.error) {
        setInviteUrl(null);
        setInviteError(result.error);
        return;
      }
      if ("url" in result && result.url) {
        setInviteUrl(result.url);
        try {
          await navigator.clipboard.writeText(result.url);
          setCopied(true);
        } catch {
          setCopied(false);
        }
      }
    });
  }

  function sendInvite() {
    setInviteError(null);
    setInviteStatus(null);
    startTransition(async () => {
      const result = await sendListingInviteAction(propertyId);
      setInviteStatus(result.notice);
    });
  }

  const primary =
    next === "upload" ? (
      <Button asChild data-testid="listing-next" className={`${gold} w-full sm:w-auto`}>
        <Link href={uploadHref}>{label}</Link>
      </Button>
    ) : next === "downloads" ? (
      <Button asChild data-testid="listing-next" className={`${gold} w-full sm:w-auto`}>
        <Link href={downloadHref}>{label}</Link>
      </Button>
    ) : next === "schedule" ? (
      <Button asChild data-testid="listing-next" className={`${gold} w-full sm:w-auto`}>
        <Link href={scheduleHref}>{label}</Link>
      </Button>
    ) : next === "deliver" ? (
      <Button type="button" data-testid="listing-next" className={`${gold} w-full sm:w-auto`} onClick={() => setDeliverOpen(true)}>
        {label}
      </Button>
    ) : next === "mark-zelle" ? (
      <Button type="button" data-testid="listing-next" className={`${gold} w-full sm:w-auto`} onClick={() => setZelleOpen(true)}>
        {label}
      </Button>
    ) : next === "send-quote" || next === "resend-quote" ? (
      <Button type="button" data-testid="listing-next" className={`${gold} w-full sm:w-auto`} onClick={() => setQuoteOpen(true)}>
        {label}
      </Button>
    ) : null;

  async function copyAgain() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div id="listing-edit" className="flex w-full min-w-0 flex-col gap-3 sm:w-auto sm:items-end">
      <div className="flex w-full items-center gap-2 sm:w-auto">
      {primary ? <div className="min-w-0 flex-1 sm:flex-none">{primary}</div> : null}
      <RecordMenu
        kind="listing"
        id={propertyId}
        name={address}
        archived={removal.archived}
        canArchive={removal.canArchive}
        canPermanent={removal.canPermanent}
        deletable={removal.deletable}
        returnTo="/admin/listings"
        appearance="responsive"
        extra={(close) => (
          <>
            {canEdit ? (
              <button type="button" role="menuitem" className={itemClass} onClick={() => { close(); copyInvite(); }}>
                {pending ? "Working…" : copied ? "Copied invite link" : "Copy invite link"}
              </button>
            ) : null}
            {canEdit ? (
              <button type="button" role="menuitem" className={itemClass} onClick={() => { close(); sendInvite(); }}>
                Send invite by email
              </button>
            ) : null}
            {canEdit ? (
              <button type="button" role="menuitem" className={itemClass} onClick={() => { close(); setEditOpen(true); }}>
                Edit listing
              </button>
            ) : null}
            {canMedia && next !== "upload" ? (
              <Link role="menuitem" href={uploadHref} className={itemClass} onClick={close}>
                Upload photos
              </Link>
            ) : null}
            {canMedia && delivery && next !== "deliver" ? (
              <button type="button" role="menuitem" className={itemClass} onClick={() => { close(); setDeliverOpen(true); }}>
                Deliver gallery
              </button>
            ) : null}
            {quote && next !== "send-quote" && next !== "resend-quote" ? (
              <button type="button" role="menuitem" className={itemClass} onClick={() => { close(); setQuoteOpen(true); }}>
                {quote.sentAt ? "Resend quote" : "Send quote"}
              </button>
            ) : null}
            {zelle && next !== "mark-zelle" ? (
              <button type="button" role="menuitem" className={itemClass} onClick={() => { close(); setZelleOpen(true); }}>
                Mark Zelle paid
              </button>
            ) : null}
            {next !== "downloads" && delivery ? (
              <Link role="menuitem" href={downloadHref} className={itemClass} onClick={close}>
                View downloads
              </Link>
            ) : null}
          </>
        )}
      />
      </div>
      {inviteStatus || inviteUrl || inviteError ? (
        <div className="w-full space-y-2 sm:max-w-md">
          {inviteStatus ? <p className="text-sm">{inviteStatus}</p> : null}
          {inviteUrl ? (
            <div className="space-y-2">
              <label className="grid gap-1 text-sm">
                Invite link
                <Input readOnly value={inviteUrl} aria-label="Invite link" className="font-mono text-xs" />
              </label>
              <Button type="button" variant="secondary" size="sm" onClick={() => void copyAgain()}>
                {copied ? "Copied" : "Copy invite link"}
              </Button>
              <p className="text-sm text-muted-foreground">This link works once and expires in 7 days. A new link replaces the previous one.</p>
            </div>
          ) : null}
          {inviteError ? <p className="text-sm text-destructive">{inviteError}</p> : null}
        </div>
      ) : null}
      {quote ? (
        <QuoteSheet choices={[quote]} presetId={quote.invoiceId} open={quoteOpen} onOpenChange={setQuoteOpen} />
      ) : null}
      <Modal title="Edit listing" description="Moving the realtor also moves gallery access to that realtor." open={editOpen} onOpenChange={setEditOpen}>
        <form action={updateListingAction.bind(null, propertyId)} className="grid gap-3">
          <label className="space-y-2 text-sm">
            <span>Realtor</span>
            <select name="leadId" defaultValue={editor.leadId} required className="h-12 w-full rounded-xl border border-border bg-card px-3 text-base">
              {realtors.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <div className="space-y-2">
            <Label htmlFor="addressLine1">Street</Label>
            <Input id="addressLine1" name="addressLine1" defaultValue={editor.addressLine1} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="addressLine2">Unit</Label>
            <Input id="addressLine2" name="addressLine2" defaultValue={editor.addressLine2} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input id="city" name="city" defaultValue={editor.city} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input id="state" name="state" defaultValue={editor.state} required maxLength={2} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zip">ZIP</Label>
              <Input id="zip" name="zip" defaultValue={editor.zip} required />
            </div>
          </div>
          <label className="space-y-2 text-sm">
            <span>Property type</span>
            <select name="propertyType" defaultValue={editor.propertyType} className="h-12 w-full rounded-xl border border-border bg-card px-3 text-base">
              {Object.entries(PROPERTY_TYPE_LABELS).map(([value, typeLabel]) => (
                <option key={value} value={value}>
                  {typeLabel}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="beds">Beds</Label>
              <Input id="beds" name="beds" inputMode="numeric" defaultValue={editor.beds} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bathsHalf">Half baths</Label>
              <Input id="bathsHalf" name="bathsHalf" inputMode="numeric" defaultValue={editor.bathsHalf} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sqft">Square feet</Label>
              <Input id="sqft" name="sqft" inputMode="numeric" defaultValue={editor.sqft} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="accessNotes">Access notes</Label>
            <Textarea id="accessNotes" name="accessNotes" defaultValue={editor.accessNotes} />
          </div>
          <p className="text-xs text-muted-foreground">Current type: {propertyTypeLabel(editor.propertyType)}</p>
          <Button type="submit" className={gold}>
            Save listing
          </Button>
        </form>
      </Modal>
      <Modal
        title="Deliver gallery"
        description="The client can open a published gallery in the portal. Publishing emails a single-use invite."
        open={deliverOpen}
        onOpenChange={setDeliverOpen}
      >
        {delivery ? (
          <form action={deliverListingAction.bind(null, propertyId)} className="grid gap-3 text-sm">
            <input type="hidden" name="galleryId" value={delivery.galleryId} />
            <p>
              {delivery.title} · {delivery.statusLabel}
            </p>
            <p className="text-muted-foreground">{delivery.orderLabel}</p>
            {delivery.canMarkDelivered ? (
              <label className="flex items-center gap-2">
                <input type="checkbox" name="markDelivered" />
                Mark this order delivered
              </label>
            ) : (
              <p className="text-muted-foreground">Move the order forward before marking it delivered. Publishing still shares the gallery.</p>
            )}
            <Button type="submit" className={gold}>
              Publish for the client
            </Button>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">Upload photos before delivering.</p>
        )}
      </Modal>
      {zelle ? (
        <Modal title="Mark paid (Zelle)" description="Record the Zelle payment and unlock the original downloads. This does not charge a card fee." open={zelleOpen} onOpenChange={setZelleOpen}>
          <form action={markZellePaidAction.bind(null, propertyId)} className="grid gap-3">
            <input type="hidden" name="invoiceId" value={zelle.invoiceId} />
            <label className="grid gap-1 text-sm">
              Amount
              <Input name="amount" defaultValue={zelle.amount} aria-label={`Zelle amount for ${zelle.number}`} />
            </label>
            <label className="grid gap-1 text-sm">
              Note
              <Input name="note" aria-label={`Zelle note for ${zelle.number}`} placeholder="Optional reference" />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" className={gold}>
                Confirm Zelle payment
              </Button>
              <DialogClose className="inline-flex h-12 items-center rounded-xl border border-border bg-surface px-4 text-sm font-medium">Cancel</DialogClose>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

