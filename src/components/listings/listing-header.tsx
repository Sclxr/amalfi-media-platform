"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { deliverListingAction, updateListingAction } from "@/app/(admin)/admin/(app)/listings/actions";
import { StatusBadge } from "@/components/data/status-badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PROPERTY_TYPE_LABELS, propertyTypeLabel } from "@/lib/listing";

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

export function ListingHeader({
  propertyId,
  addressLine1,
  cityLine,
  realtor,
  status,
  shootLabel,
  coverSrc,
  canEdit,
  canMedia,
  menu,
  editor,
  realtors,
  delivery,
}: {
  propertyId: string;
  addressLine1: string;
  cityLine: string;
  realtor: { id: string; name: string } | null;
  status: string;
  shootLabel: string;
  coverSrc: string | null;
  canEdit: boolean;
  canMedia: boolean;
  menu?: ReactNode;
  editor: ListingEditorValues;
  realtors: { id: string; name: string }[];
  delivery: { galleryId: string; title: string; statusLabel: string; canMarkDelivered: boolean; orderLabel: string } | null;
}) {
  const save = updateListingAction.bind(null, propertyId);
  const deliver = deliverListingAction.bind(null, propertyId);
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 gap-4">
        {coverSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverSrc} alt="" className="h-16 w-24 shrink-0 rounded-md border border-border object-cover" />
        ) : (
          <div className="grid h-16 w-24 shrink-0 place-items-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
            No cover
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-tight">{addressLine1}</h1>
          <p className="mt-1 text-muted-foreground">{cityLine}</p>
          <p className="mt-2 text-sm">
            Realtor:{" "}
            {realtor ? (
              <Link className="font-medium text-primary" href={`/admin/crm/leads/${realtor.id}?tab=listings`}>
                {realtor.name}
              </Link>
            ) : (
              "Unassigned"
            )}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            {status === "NO_SHOOT" ? (
              <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">No shoot</span>
            ) : (
              <StatusBadge status={status} />
            )}
            <span className="text-muted-foreground">Shoot date: {shootLabel}</span>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {menu}
        {canEdit ? (
          <Modal title="Edit listing" description="Moving the realtor also moves gallery access to that realtor." trigger={<Button type="button" variant="secondary">Edit listing</Button>}>
            <form action={save} className="grid gap-3">
              <label className="space-y-2 text-sm">
                <span>Realtor</span>
                <select name="leadId" defaultValue={editor.leadId} required className="h-10 w-full rounded-sm border border-border bg-background px-3">
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
                <select name="propertyType" defaultValue={editor.propertyType} className="h-10 w-full rounded-sm border border-border bg-background px-3">
                  {Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
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
              <Button type="submit">Save listing</Button>
            </form>
          </Modal>
        ) : null}
        {canMedia ? (
          <Button asChild variant="secondary">
            <Link href={`/admin/listings/${propertyId}?tab=gallery#upload`}>Upload photos</Link>
          </Button>
        ) : null}
        {canMedia ? (
          <Modal
            title="Deliver gallery"
            description="The client can open a published gallery in the portal. Publishing emails a single-use invite."
            trigger={<Button type="button">Deliver gallery</Button>}
          >
            {delivery ? (
              <form action={deliver} className="grid gap-3 text-sm">
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
                <Button type="submit">Publish for the client</Button>
              </form>
            ) : (
              <p className="text-sm text-muted-foreground">Upload photos before delivering.</p>
            )}
          </Modal>
        ) : null}
      </div>
    </div>
  );
}
