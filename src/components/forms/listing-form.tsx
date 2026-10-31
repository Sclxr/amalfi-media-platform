"use client";

import { useActionState } from "react";
import { createListingAction, type ListingState } from "@/app/(admin)/admin/(app)/listings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ListingForm({
  leadId,
  realtorName,
  needsEmail,
  realtors,
}: {
  leadId?: string;
  realtorName?: string;
  needsEmail?: boolean;
  realtors: { id: string; firstName: string | null; lastName: string | null; email: string | null }[];
}) {
  const [state, action, pending] = useActionState(createListingAction, {} satisfies ListingState);
  return (
    <form action={action} className="grid max-w-xl gap-4">
      {leadId ? (
        <>
          <input type="hidden" name="leadId" value={leadId} />
          <p className="text-sm">
            Realtor: <span className="font-medium">{realtorName}</span>
          </p>
        </>
      ) : (
        <label className="space-y-2 text-sm">
          <span>Realtor</span>
          <select name="leadId" required className="h-10 w-full rounded-sm border border-border bg-background px-3">
            <option value="">Choose a realtor</option>
            {realtors.map((realtor) => (
              <option key={realtor.id} value={realtor.id}>
                {realtor.firstName} {realtor.lastName}
                {realtor.email ? ` · ${realtor.email}` : ""}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="space-y-2">
        <Label htmlFor="addressLine1">Address</Label>
        <Input id="addressLine1" name="addressLine1" required />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input id="city" name="city" required defaultValue="Orlando" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="zip">ZIP</Label>
          <Input id="zip" name="zip" required />
        </div>
      </div>
      <label className="space-y-2 text-sm">
        <span>Property type</span>
        <select name="propertyType" defaultValue="SINGLE_FAMILY" className="h-10 w-full rounded-sm border border-border bg-background px-3">
          <option value="SINGLE_FAMILY">Single family</option>
          <option value="CONDO">Condo</option>
          <option value="TOWNHOUSE">Townhouse</option>
          <option value="LAND">Land</option>
          <option value="COMMERCIAL">Commercial</option>
        </select>
      </label>
      {needsEmail ? (
        <div className="space-y-2">
          <Label htmlFor="email">Realtor email</Label>
          <Input id="email" name="email" type="email" required />
          <p className="text-xs text-muted-foreground">Saved on the realtor. No invite email is sent.</p>
        </div>
      ) : null}
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" disabled={pending}>
        Create listing
      </Button>
    </form>
  );
}
