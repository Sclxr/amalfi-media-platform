"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LEAD_STATUSES, type LeadFormValues } from "@/schemas/lead";
import type { ActionState } from "@/app/(admin)/admin/(app)/crm/actions";

export function LeadForm({
  action,
  defaults,
  brokerages,
  sources,
  submitLabel,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  defaults?: Partial<LeadFormValues>;
  brokerages: { id: string; name: string }[];
  sources: { id: string; name: string }[];
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-2">
      <Field label="First name" name="firstName" defaultValue={defaults?.firstName} required />
      <Field label="Last name" name="lastName" defaultValue={defaults?.lastName} required />
      <Field label="Email" name="email" type="email" defaultValue={defaults?.email} required />
      <Field label="Phone" name="phone" defaultValue={defaults?.phone} />
      <Field label="City" name="city" defaultValue={defaults?.city} />
      <Field label="Follow-up date" name="nextFollowUpAt" type="date" defaultValue={defaults?.nextFollowUpAt} />
      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <select id="status" name="status" defaultValue={defaults?.status ?? "NEW"} className="h-10 w-full rounded-sm border border-border bg-background px-3 text-sm">
          {LEAD_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="brokerageId">Brokerage</Label>
        <select id="brokerageId" name="brokerageId" defaultValue={defaults?.brokerageId ?? ""} className="h-10 w-full rounded-sm border border-border bg-background px-3 text-sm">
          <option value="">None</option>
          {brokerages.map((brokerage) => (
            <option key={brokerage.id} value={brokerage.id}>
              {brokerage.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="sourceId">Source</Label>
        <select id="sourceId" name="sourceId" defaultValue={defaults?.sourceId ?? ""} className="h-10 w-full rounded-sm border border-border bg-background px-3 text-sm">
          <option value="">None</option>
          {sources.map((source) => (
            <option key={source.id} value={source.id}>
              {source.name}
            </option>
          ))}
        </select>
      </div>
      <Field label="Tags" name="tags" defaultValue={defaults?.tags} placeholder="waterfront, luxury" />
      {state.error ? (
        <p className="text-sm text-destructive md:col-span-2" role="alert">
          {state.error}
        </p>
      ) : null}
      <div className="md:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  required,
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} defaultValue={defaultValue ?? ""} required={required} placeholder={placeholder} />
    </div>
  );
}

export function BrokerageForm({
  action,
  defaults,
  submitLabel,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  defaults?: { name?: string; phone?: string; website?: string; address?: string; city?: string };
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-2">
      <Field label="Name" name="name" defaultValue={defaults?.name} required />
      <Field label="Phone" name="phone" defaultValue={defaults?.phone} />
      <Field label="Website" name="website" defaultValue={defaults?.website} />
      <Field label="City" name="city" defaultValue={defaults?.city} />
      <div className="md:col-span-2">
        <Field label="Address" name="address" defaultValue={defaults?.address} />
      </div>
      {state.error ? <p className="text-sm text-destructive md:col-span-2">{state.error}</p> : null}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

export function NoteForm({ action }: { action: (prev: ActionState, formData: FormData) => Promise<ActionState> }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="space-y-3">
      <Label htmlFor="summary">Add a note</Label>
      <textarea id="summary" name="summary" required className="min-h-24 w-full rounded-sm border border-border bg-background px-3 py-2 text-sm" />
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save note"}
      </Button>
    </form>
  );
}
