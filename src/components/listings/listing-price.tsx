"use client";

import { useState } from "react";
import { setListingPriceAction } from "@/app/(admin)/admin/(app)/listings/actions";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatCents } from "@/lib/money";

const selectClass = "h-12 w-full rounded-xl border border-border bg-card px-3 text-base text-foreground";

export function ListingPrice({
  propertyId,
  orderId,
  orderNumber,
  packages,
  totalCents,
  lines,
  locked = false,
}: {
  propertyId: string;
  orderId: string;
  orderNumber: number;
  packages: { id: string; name: string; priceCents: number }[];
  totalCents: number;
  lines: { id: string; label: string; quantity: number; unitPriceCents: number | null }[];
  locked?: boolean;
}) {
  const action = setListingPriceAction.bind(null, propertyId);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"package" | "custom" | "lines">(packages.length > 0 ? "package" : "custom");
  const modes = [
    ...(packages.length > 0 ? [{ id: "package" as const, label: "Package" }] : []),
    { id: "custom" as const, label: "Custom amount" },
    { id: "lines" as const, label: "Line items" },
  ];

  return (
    <div className="rounded-2xl border border-border p-4">
      <p className="text-sm text-muted-foreground">Price</p>
      {lines.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No price yet.</p> : null}
      <ul className="mt-2 space-y-1 text-sm">
        {lines.map((item) => (
          <li key={item.id}>
            {item.label}
            {item.quantity > 1 ? ` × ${item.quantity}` : ""}
            {item.unitPriceCents === null ? " · Quote" : ` · ${formatCents(item.unitPriceCents)}`}
          </li>
        ))}
      </ul>
      {lines.length > 0 ? <p className="mt-3 text-sm font-semibold tabular-nums">{formatCents(totalCents)}</p> : null}
      {locked ? null : (
        <Button type="button" variant="secondary" className="mt-4" onClick={() => setOpen(true)}>
          Edit price
        </Button>
      )}
      <Modal title="Edit price" description="Saving replaces the current price." open={open} onOpenChange={setOpen}>
        <div className="mb-4 flex flex-wrap gap-2">
          {modes.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={mode === item.id}
              className={
                mode === item.id
                  ? "inline-flex h-12 items-center rounded-full bg-[#111111] px-4 text-sm font-medium text-[#d4bc8c]"
                  : "inline-flex h-12 items-center rounded-full border border-border px-4 text-sm"
              }
              onClick={() => setMode(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        {mode === "package" && packages.length > 0 ? (
          <form action={action} className="grid gap-3">
            <input type="hidden" name="orderId" value={orderId} />
            <input type="hidden" name="mode" value="package" />
            <label className="grid gap-1 text-sm">
              Package
              <select name="packageId" required aria-label={`Package for order ${orderNumber}`} className={selectClass} defaultValue={packages[0]?.id}>
                {packages.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {formatCents(item.priceCents)}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" className="border border-[#d4bc8c] bg-[#111111] text-[#d4bc8c] hover:bg-[#1c1c1c]">
              Use package
            </Button>
          </form>
        ) : null}
        {mode === "custom" ? (
          <form action={action} className="grid gap-3">
            <input type="hidden" name="orderId" value={orderId} />
            <input type="hidden" name="mode" value="custom" />
            <label className="grid gap-1 text-sm">
              Description
              <Input name="label" aria-label={`Custom description for order ${orderNumber}`} defaultValue="Photography" />
            </label>
            <label className="grid gap-1 text-sm">
              Amount
              <Input name="amount" inputMode="decimal" placeholder="120.00" aria-label={`Custom price for order ${orderNumber}`} />
            </label>
            <Button type="submit" className="border border-[#d4bc8c] bg-[#111111] text-[#d4bc8c] hover:bg-[#1c1c1c]">
              Save custom price
            </Button>
          </form>
        ) : null}
        {mode === "lines" ? (
          <form action={action} className="grid gap-3">
            <input type="hidden" name="orderId" value={orderId} />
            <input type="hidden" name="mode" value="lines" />
            {[1, 2, 3].map((row) => (
              <div key={row} className="grid gap-2 sm:grid-cols-[1fr_5rem_8rem]">
                <Input name="lineLabel" aria-label={`Line ${row} description for order ${orderNumber}`} placeholder="Description" />
                <Input name="lineQty" aria-label={`Line ${row} quantity for order ${orderNumber}`} placeholder="Qty" inputMode="numeric" />
                <Input name="lineAmount" aria-label={`Line ${row} amount for order ${orderNumber}`} placeholder="0.00" inputMode="decimal" />
              </div>
            ))}
            <Button type="submit" className="border border-[#d4bc8c] bg-[#111111] text-[#d4bc8c] hover:bg-[#1c1c1c]">
              Save line items
            </Button>
          </form>
        ) : null}
      </Modal>
    </div>
  );
}
