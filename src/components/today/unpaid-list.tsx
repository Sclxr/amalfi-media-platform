"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Camera } from "lucide-react";
import { markTodayZelleAction, undoTodayZelleAction } from "@/app/(admin)/admin/(app)/quotes/actions";
import { QuoteSheet, sentQuoteLabel, type QuoteChoice, type QuoteSent } from "@/components/quotes/quote-sheet";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/money";

export type UnpaidRow = {
  id: string;
  address: string;
  amountCents: number;
  href: string;
  imageSrc: string | null;
  email: string;
  sentAt: string | null;
  sentTo: string | null;
  status: string;
};

function Thumb({ src }: { src: string | null }) {
  if (!src) {
    return (
      <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-accent text-muted-foreground" aria-hidden>
        <Camera className="size-5" strokeWidth={1.5} />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
  );
}

export function UnpaidList({
  rows,
  choices,
  canMarkZelle,
}: {
  rows: UnpaidRow[];
  choices: QuoteChoice[];
  canMarkZelle: boolean;
}) {
  const [items, setItems] = useState(rows);
  const [paid, setPaid] = useState<UnpaidRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSent(result: QuoteSent) {
    setItems((current) => {
      const existing = current.find((row) => row.id === result.invoiceId);
      const next = {
        id: result.invoiceId,
        address: result.address,
        amountCents: result.amountCents,
        href: `/admin/listings/${result.propertyId}?tab=billing`,
        imageSrc: existing?.imageSrc ?? null,
        email: result.sentTo,
        sentAt: result.sentAt,
        sentTo: result.sentTo,
        status: "OPEN",
      };
      if (!existing) return [next, ...current];
      return current.map((row) => (row.id === result.invoiceId ? next : row));
    });
  }

  function markPaid(row: UnpaidRow) {
    setError(null);
    startTransition(async () => {
      const response = await markTodayZelleAction(row.id, "Marked paid from Today.");
      if ("error" in response && response.error) {
        setError(response.error);
        return;
      }
      setItems((current) => current.filter((item) => item.id !== row.id));
      setPaid(row);
      setConfirmId(null);
    });
  }

  function undo() {
    if (!paid) return;
    const row = paid;
    setError(null);
    startTransition(async () => {
      const response = await undoTodayZelleAction(row.id);
      if ("error" in response && response.error) {
        setError(response.error);
        return;
      }
      setItems((current) => [row, ...current.filter((item) => item.id !== row.id)]);
      setPaid(null);
    });
  }

  return (
    <div className="mt-2">
      {paid ? (
        <p className="mb-3 text-sm text-muted-foreground">
          Marked {paid.address} paid by Zelle.{" "}
          <button type="button" className="font-medium text-gold" onClick={undo} disabled={pending}>
            Undo
          </button>
        </p>
      ) : null}
      {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}
      {items.length === 0 ? <p className="text-sm leading-6 text-muted-foreground">Nothing unpaid. Paid work stays off this list.</p> : null}
      {items.map((row) => (
        <div key={row.id} className="border-t border-border py-3 first:border-t-0">
          <Link href={row.href} className="flex min-w-0 items-center gap-3">
            <Thumb src={row.imageSrc} />
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 font-medium leading-5 [overflow-wrap:anywhere]">{row.address}</span>
              <span className="mt-0.5 block text-sm text-muted-foreground">
                {row.sentAt && row.sentTo ? sentQuoteLabel(row.sentAt, row.sentTo) : "Not sent yet"}
              </span>
            </span>
            <span className="shrink-0 whitespace-nowrap tabular-nums text-base font-semibold text-gold">{formatCents(row.amountCents)}</span>
          </Link>
          <div className="mt-2 flex flex-wrap gap-2">
            <QuoteSheet
              choices={choices.filter((choice) => choice.invoiceId === row.id)}
              presetId={row.id}
              onSent={onSent}
              trigger={<Button type="button" variant="secondary" size="sm">{row.sentAt ? "Resend" : "Send quote"}</Button>}
            />
            {canMarkZelle && row.status === "OPEN" ? (
              confirmId === row.id ? (
                <>
                  <Button type="button" size="sm" disabled={pending} onClick={() => markPaid(row)}>
                    Confirm Zelle
                  </Button>
                  <Button type="button" variant="secondary" size="sm" onClick={() => setConfirmId(null)}>
                    Cancel
                  </Button>
                </>
              ) : (
                <Button type="button" variant="secondary" size="sm" onClick={() => setConfirmId(row.id)}>
                  Mark Zelle paid
                </Button>
              )
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
