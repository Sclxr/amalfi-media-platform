"use client";

import { useMemo, useState, useTransition } from "react";
import { sendQuoteAction } from "@/app/(admin)/admin/(app)/quotes/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/dialog";
import { formatCents } from "@/lib/money";
import { quoteMessage } from "@/lib/email-messages";

export type QuoteChoice = {
  invoiceId: string;
  propertyId: string;
  address: string;
  email: string;
  recipientName: string;
  lines: { description: string; totalCents: number }[];
  totalCents: number;
  cardFeeCents: number;
  cardTotalCents: number;
  sentAt: string | null;
  sentTo: string | null;
  status: string;
};

export type QuoteSent = {
  invoiceId: string;
  propertyId: string;
  address: string;
  amountCents: number;
  sentAt: string;
  sentTo: string;
  delivered: boolean;
  mode: string;
};

function sentLabel(sentAt: string, sentTo: string) {
  const when = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(sentAt));
  return `Sent to ${sentTo} at ${when}`;
}

export function QuoteSheet({
  choices,
  trigger,
  presetId,
  onSent,
}: {
  choices: QuoteChoice[];
  trigger: React.ReactNode;
  presetId?: string | null;
  onSent?: (result: QuoteSent) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string | null>(presetId ?? null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QuoteSent | null>(null);
  const [pending, startTransition] = useTransition();
  const choice = choices.find((item) => item.invoiceId === (picked ?? presetId)) ?? (presetId ? choices.find((item) => item.invoiceId === presetId) : null);
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = needle ? choices.filter((item) => item.address.toLowerCase().includes(needle)) : choices;
    return rows.slice(0, 8);
  }, [choices, query]);
  const preview = choice
    ? quoteMessage({
        to: choice.email,
        name: choice.recipientName,
        address: choice.address,
        lines: choice.lines,
        totalCents: choice.totalCents,
        cardFeeCents: choice.cardFeeCents,
        cardTotalCents: choice.cardTotalCents,
        note,
        payUrl: "#pay",
      })
    : null;

  function send() {
    if (!choice) return;
    setError(null);
    startTransition(async () => {
      const response = await sendQuoteAction(choice.invoiceId, note, choice.email);
      if ("error" in response && response.error) {
        setError(response.error);
        return;
      }
      if ("ok" in response && response.ok) {
        setResult(response);
        onSent?.(response);
      }
    });
  }

  return (
    <Modal
      title={choice?.sentAt ? "Resend quote" : "Send quote"}
      description="Nothing is emailed until you press Send."
      trigger={trigger}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setPicked(presetId ?? null);
          setError(null);
          setResult(null);
          setNote("");
          setQuery("");
        }
      }}
    >
      <div className="space-y-4">
        {!presetId ? (
          <label className="grid gap-1 text-sm">
            Listing
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by address" />
          </label>
        ) : null}
        {!presetId && !choice ? (
          <div className="space-y-2">
            {matches.length === 0 ? <p className="text-sm text-muted-foreground">No priced quote matches that address.</p> : null}
            {matches.map((item) => (
              <button
                key={item.invoiceId}
                type="button"
                className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-border px-3 text-left"
                onClick={() => setPicked(item.invoiceId)}
              >
                <span className="min-w-0 truncate font-medium">{item.address}</span>
                <span className="shrink-0 tabular-nums text-gold">{formatCents(item.totalCents)}</span>
              </button>
            ))}
          </div>
        ) : null}
        {choice ? (
          <>
            <p className="text-sm">
              <span className="font-medium">{choice.address}</span>
              <span className="mt-1 block text-muted-foreground">{choice.email}</span>
            </p>
            <ul className="space-y-1 text-sm">
              {choice.lines.map((line) => (
                <li key={line.description} className="flex justify-between gap-3">
                  <span className="min-w-0">{line.description}</span>
                  <span className="shrink-0 tabular-nums">{formatCents(line.totalCents)}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm">Listing total <span className="font-semibold tabular-nums">{formatCents(choice.totalCents)}</span></p>
            <p className="text-sm">
              Card total <span className="font-semibold tabular-nums text-gold">{formatCents(choice.cardTotalCents)}</span>
              <span className="text-muted-foreground"> including a {formatCents(choice.cardFeeCents)} card fee</span>
            </p>
            <p className="text-sm">Zelle <span className="font-semibold tabular-nums">{formatCents(choice.totalCents)}</span> <span className="text-muted-foreground">no card fee</span></p>
            {choice.sentAt && choice.sentTo ? <p className="text-sm text-muted-foreground">{sentLabel(choice.sentAt, choice.sentTo)}</p> : null}
            <label className="grid gap-1 text-sm">
              Note
              <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} className="min-h-24 w-full rounded-xl border border-border bg-card px-3 py-3 text-base" placeholder="Optional note for the realtor" />
            </label>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            {result ? (
              <p className="text-sm">
                {result.delivered ? sentLabel(result.sentAt, result.sentTo) : `Logged for ${result.sentTo}. This environment previews email and did not deliver it.`}
              </p>
            ) : (
              <Button type="button" disabled={pending} onClick={send} className="border border-[#d4bc8c] bg-[#111111] text-[#d4bc8c] hover:bg-[#1c1c1c]">
                {pending ? "Sending…" : choice.sentAt ? "Resend" : "Send"}
              </Button>
            )}
            {preview?.html ? (
              <iframe title="Email preview" sandbox="" srcDoc={preview.html} className="h-56 w-full rounded-xl border border-border bg-white" />
            ) : null}
          </>
        ) : null}
      </div>
    </Modal>
  );
}

export function sentQuoteLabel(sentAt: string, sentTo: string) {
  return sentLabel(sentAt, sentTo);
}
