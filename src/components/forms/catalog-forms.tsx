"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ActionState } from "@/app/(admin)/admin/(app)/crm/actions";

export function PackageEditor({
  action,
  item,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  item: { id: string; name: string; description: string | null; priceCents: number; durationMin: number; maxSqft: number | null; active: boolean };
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="grid gap-3 border-t border-border py-4 md:grid-cols-6">
      <input type="hidden" name="id" value={item.id} />
      <Input name="name" defaultValue={item.name} aria-label="Package name" />
      <Input name="description" defaultValue={item.description ?? ""} aria-label="Description" />
      <Input name="price" defaultValue={(item.priceCents / 100).toFixed(2)} aria-label="Price in dollars" />
      <Input name="durationMin" type="number" defaultValue={item.durationMin} aria-label="Duration minutes" />
      <Input name="maxSqft" defaultValue={item.maxSqft ?? ""} aria-label="Max square feet" placeholder="sqft" />
      <div className="flex items-center gap-2">
        <select name="active" defaultValue={String(item.active)} className="h-10 rounded-sm border border-border bg-background px-2 text-sm" aria-label="Active">
          <option value="true">Active</option>
          <option value="false">Hidden</option>
        </select>
        <Button type="submit" size="sm" disabled={pending}>
          Save
        </Button>
      </div>
      {state.error ? <p className="text-sm text-destructive md:col-span-6">{state.error}</p> : null}
    </form>
  );
}

export function ServiceEditor({
  action,
  item,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  item: { id: string; name: string; pricingMode: "FIXED" | "QUOTE"; priceCents: number | null; active: boolean };
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="grid gap-3 border-t border-border py-4 md:grid-cols-5">
      <input type="hidden" name="id" value={item.id} />
      <Input name="name" defaultValue={item.name} aria-label="Add-on name" />
      <select name="pricingMode" defaultValue={item.pricingMode} className="h-10 rounded-sm border border-border bg-background px-2 text-sm" aria-label="Pricing mode">
        <option value="QUOTE">Quote</option>
        <option value="FIXED">Fixed</option>
      </select>
      <Input name="price" defaultValue={item.priceCents === null ? "" : (item.priceCents / 100).toFixed(2)} aria-label="Price" placeholder="Price if fixed" />
      <select name="active" defaultValue={String(item.active)} className="h-10 rounded-sm border border-border bg-background px-2 text-sm" aria-label="Active">
        <option value="true">Active</option>
        <option value="false">Hidden</option>
      </select>
      <Button type="submit" size="sm" disabled={pending}>
        Save
      </Button>
      {state.error ? <p className="text-sm text-destructive md:col-span-5">{state.error}</p> : null}
    </form>
  );
}

export function AreaEditor({
  action,
  item,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  item: { id: string; name: string; zipCodes: string[]; travelFeeCents: number; active: boolean };
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="grid gap-3 border-t border-border py-4 md:grid-cols-5">
      <input type="hidden" name="id" value={item.id} />
      <Input name="name" defaultValue={item.name} aria-label="Zone name" />
      <Input name="zipCodes" defaultValue={item.zipCodes.join(", ")} aria-label="ZIP codes" />
      <Input name="travelFee" defaultValue={(item.travelFeeCents / 100).toFixed(2)} aria-label="Travel fee" />
      <select name="active" defaultValue={String(item.active)} className="h-10 rounded-sm border border-border bg-background px-2 text-sm" aria-label="Active">
        <option value="true">Active</option>
        <option value="false">Hidden</option>
      </select>
      <Button type="submit" size="sm" disabled={pending}>
        Save
      </Button>
      {state.error ? <p className="text-sm text-destructive md:col-span-5">{state.error}</p> : null}
    </form>
  );
}
