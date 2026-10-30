"use client";

import { useActionState } from "react";
import { requestBookingAction, type BookingState } from "@/app/(admin)/admin/(app)/orders/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCents } from "@/lib/money";

export function BookingRequestForm({
  packages,
  addOns,
}: {
  packages: { id: string; name: string; priceCents: number }[];
  addOns: { id: string; name: string; pricingMode: string }[];
}) {
  const [state, action, pending] = useActionState(requestBookingAction, {} satisfies BookingState);
  return (
    <form action={action} className="grid gap-4">
      <div className="space-y-2">
        <Label htmlFor="addressLine1">Property address</Label>
        <Input id="addressLine1" name="addressLine1" required />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input id="city" name="city" required defaultValue="Orlando" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="zip">ZIP</Label>
          <Input id="zip" name="zip" required placeholder="32801" />
        </div>
      </div>
      <label className="space-y-2 text-sm">
        <span>Property type</span>
        <select name="propertyType" className="h-10 w-full rounded-sm border border-border bg-background px-3" defaultValue="SINGLE_FAMILY">
          <option value="SINGLE_FAMILY">Single family</option>
          <option value="CONDO">Condo</option>
          <option value="TOWNHOUSE">Townhouse</option>
          <option value="LAND">Land</option>
          <option value="COMMERCIAL">Commercial</option>
        </select>
      </label>
      <label className="space-y-2 text-sm">
        <span>Package</span>
        <select name="packageId" className="h-10 w-full rounded-sm border border-border bg-background px-3" required defaultValue={packages[0]?.id}>
          {packages.map((pkg) => (
            <option key={pkg.id} value={pkg.id}>
              {pkg.name} · {formatCents(pkg.priceCents)}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="space-y-2 text-sm">
        <legend className="font-medium">Add-ons</legend>
        {addOns.map((addOn) => (
          <label key={addOn.id} className="flex items-center gap-2">
            <input type="checkbox" name="addOnIds" value={addOn.id} />
            {addOn.name}
            {addOn.pricingMode === "QUOTE" ? " · quote" : ""}
          </label>
        ))}
      </fieldset>
      <div className="space-y-2">
        <Label htmlFor="preferredDate">Preferred date</Label>
        <Input id="preferredDate" name="preferredDate" type="date" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="instructions">Notes</Label>
        <Textarea id="instructions" name="instructions" />
      </div>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" disabled={pending}>
        Request booking
      </Button>
    </form>
  );
}
