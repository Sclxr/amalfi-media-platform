"use client";

import { useActionState, useMemo, useState } from "react";
import { bookShootAction, type ShootFormState } from "@/app/(admin)/admin/(app)/bookings/new/actions";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/ui/control";
import { Input } from "@/components/ui/input";
import { propertyTypeLabel } from "@/lib/listing";
import { formatCents } from "@/lib/money";
import { SHOOT_PROPERTY_TYPES } from "@/schemas/shoot";

type Realtor = { id: string; firstName: string | null; lastName: string | null; email: string | null };
type Priced = { id: string; name: string; priceCents: number | null; durationMin: number };

const empty: ShootFormState = { errors: {}, values: {} };

function realtorName(realtor: Realtor) {
  const name = `${realtor.firstName ?? ""} ${realtor.lastName ?? ""}`.trim();
  return name || realtor.email || "Realtor";
}

export function ShootForm({
  realtors,
  packages,
  addOns,
  defaultStart,
}: {
  realtors: Realtor[];
  packages: Priced[];
  addOns: Priced[];
  defaultStart: string;
}) {
  const [state, action, pending] = useActionState(bookShootAction, empty);
  const value = (name: string, fallback = "") => (name in state.values ? state.values[name] : fallback);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState(
    state.values.realtorMode === "new" || state.values.realtorMode === "existing"
      ? state.values.realtorMode
      : realtors.length > 0
        ? "existing"
        : "new",
  );
  const [priceMode, setPriceMode] = useState(value("priceMode", "package") === "custom" ? "custom" : "package");
  const [leadId, setLeadId] = useState(value("leadId"));
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = needle
      ? realtors.filter((realtor) => `${realtorName(realtor)} ${realtor.email ?? ""}`.toLowerCase().includes(needle))
      : realtors;
    return rows.slice(0, 8);
  }, [query, realtors]);
  const selected = realtors.find((realtor) => realtor.id === leadId);

  return (
    <form action={action} data-testid="new-shoot" className="min-w-0 space-y-4 pb-[calc(9rem+env(safe-area-inset-bottom))] md:pb-0">
      {state.errors.form ? <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">{state.errors.form}</p> : null}
      <input type="hidden" name="realtorMode" value={mode} />
      <input type="hidden" name="leadId" value={mode === "existing" ? leadId : ""} />
      <input type="hidden" name="priceMode" value={priceMode} />

      <section className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow)] sm:p-5">
        <h2 className="text-lg font-semibold tracking-tight">Realtor</h2>
        {mode === "existing" ? (
          <div key="existing-realtor" className="mt-4 space-y-3">
            <label className="grid gap-1 text-sm">
              Search by name or email
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Jordan Hale" />
            </label>
            <div className="space-y-2">
              {matches.length === 0 ? <p className="text-sm text-muted-foreground">No realtor matches that search.</p> : null}
              {matches.map((realtor) => (
                <button
                  key={realtor.id}
                  type="button"
                  onClick={() => setLeadId(realtor.id)}
                  className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border px-3 text-left ${leadId === realtor.id ? "border-gold bg-gold/10" : "border-border"}`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{realtorName(realtor)}</span>
                    <span className="block truncate text-sm text-muted-foreground">{realtor.email}</span>
                  </span>
                </button>
              ))}
            </div>
            {selected ? <p className="text-sm text-muted-foreground">Booking for {realtorName(selected)}.</p> : null}
            {state.errors.leadId ? <p className="text-sm text-destructive">{state.errors.leadId}</p> : null}
            <Button type="button" variant="secondary" onClick={() => setMode("new")}>
              Add new realtor
            </Button>
          </div>
        ) : (
          <div key="new-realtor" className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              First name
              <Input name="firstName" defaultValue={value("firstName")} autoComplete="given-name" aria-invalid={Boolean(state.errors.firstName)} />
              {state.errors.firstName ? <span className="text-destructive">{state.errors.firstName}</span> : null}
            </label>
            <label className="grid gap-1 text-sm">
              Last name
              <Input name="lastName" defaultValue={value("lastName")} autoComplete="family-name" aria-invalid={Boolean(state.errors.lastName)} />
              {state.errors.lastName ? <span className="text-destructive">{state.errors.lastName}</span> : null}
            </label>
            <label className="grid gap-1 text-sm sm:col-span-2">
              Email
              <Input name="email" type="email" defaultValue={value("email")} autoComplete="email" aria-invalid={Boolean(state.errors.email)} />
              {state.errors.email ? <span className="text-destructive">{state.errors.email}</span> : null}
            </label>
            <label className="grid gap-1 text-sm">
              Phone
              <Input name="phone" defaultValue={value("phone")} autoComplete="tel" />
            </label>
            <label className="grid gap-1 text-sm">
              Brokerage
              <Input name="brokerage" defaultValue={value("brokerage")} placeholder="Optional" />
            </label>
            <div className="sm:col-span-2">
              <Button type="button" variant="secondary" onClick={() => setMode("existing")}>
                Use an existing realtor
              </Button>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow)] sm:p-5">
        <h2 className="text-lg font-semibold tracking-tight">Property</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm sm:col-span-2">
            Street address
            <Input name="addressLine1" defaultValue={value("addressLine1")} aria-invalid={Boolean(state.errors.addressLine1)} />
            {state.errors.addressLine1 ? <span className="text-destructive">{state.errors.addressLine1}</span> : null}
          </label>
          <label className="grid gap-1 text-sm">
            City
            <Input name="city" defaultValue={value("city", "Orlando")} />
            {state.errors.city ? <span className="text-destructive">{state.errors.city}</span> : null}
          </label>
          <label className="grid gap-1 text-sm">
            ZIP
            <Input name="zip" inputMode="numeric" defaultValue={value("zip")} aria-invalid={Boolean(state.errors.zip)} />
            {state.errors.zip ? <span className="text-destructive">{state.errors.zip}</span> : null}
          </label>
          <label className="grid gap-1 text-sm sm:col-span-2">
            Property type
            <select name="propertyType" defaultValue={value("propertyType", "SINGLE_FAMILY")} className={controlClass}>
              {SHOOT_PROPERTY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {propertyTypeLabel(type)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow)] sm:p-5">
        <h2 className="text-lg font-semibold tracking-tight">Package and price</h2>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant={priceMode === "package" ? "default" : "secondary"} onClick={() => setPriceMode("package")}>
            Package
          </Button>
          <Button type="button" variant={priceMode === "custom" ? "default" : "secondary"} onClick={() => setPriceMode("custom")}>
            Custom amount
          </Button>
        </div>
        {priceMode === "package" ? (
          <div key="package-price" className="mt-4 grid gap-3">
            <label className="grid gap-1 text-sm">
              Package
              <select name="packageId" defaultValue={value("packageId", packages[0]?.id ?? "")} className={controlClass} aria-invalid={Boolean(state.errors.packageId)}>
                {packages.length === 0 ? <option value="">No active packages</option> : null}
                {packages.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {formatCents(item.priceCents ?? 0)}
                  </option>
                ))}
              </select>
              {state.errors.packageId ? <span className="text-destructive">{state.errors.packageId}</span> : null}
            </label>
            <label className="grid gap-1 text-sm">
              Add a service
              <select name="addOnId" defaultValue={value("addOnId")} className={controlClass}>
                <option value="">None</option>
                {addOns.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {formatCents(item.priceCents ?? 0)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : (
          <div key="custom-price" className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              What it is
              <Input name="customLabel" defaultValue={value("customLabel")} placeholder="Twilight shoot" aria-invalid={Boolean(state.errors.customLabel)} />
              {state.errors.customLabel ? <span className="text-destructive">{state.errors.customLabel}</span> : null}
            </label>
            <label className="grid gap-1 text-sm">
              Amount
              <Input name="customAmount" inputMode="decimal" defaultValue={value("customAmount")} placeholder="250.00" aria-invalid={Boolean(state.errors.customAmount)} />
              {state.errors.customAmount ? <span className="text-destructive">{state.errors.customAmount}</span> : null}
            </label>
          </div>
        )}
        <p className="mt-3 text-sm text-muted-foreground">A travel fee is added when the ZIP is outside the usual area. The quote stays a draft until you send it.</p>
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow)] sm:p-5">
        <h2 className="text-lg font-semibold tracking-tight">When</h2>
        <label className="mt-4 grid gap-1 text-sm">
          Date and time
          <Input name="startLocal" type="datetime-local" defaultValue={value("startLocal", defaultStart)} aria-invalid={Boolean(state.errors.startLocal)} />
          <span className="text-muted-foreground">Orlando time. The next open hour is filled in.</span>
          {state.errors.startLocal ? <span className="text-destructive">{state.errors.startLocal}</span> : null}
        </label>
        <label className="mt-4 grid gap-1 text-sm">
          Notes
          <textarea name="notes" defaultValue={value("notes")} rows={3} className="min-h-24 w-full rounded-xl border border-border bg-card px-3 py-3 text-base" placeholder="Gate code, lockbox, twilight" />
        </label>
      </section>

      <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-20 border-t border-border bg-card px-4 py-3 md:static md:bottom-auto md:rounded-2xl md:border md:px-5 md:shadow-[var(--shadow)]">
        <Button type="submit" disabled={pending} className="w-full border border-[#d4bc8c] bg-[#111111] text-[#d4bc8c] hover:bg-[#1c1c1c] md:w-auto">
          {pending ? "Saving…" : "Save shoot"}
        </Button>
      </div>
    </form>
  );
}
