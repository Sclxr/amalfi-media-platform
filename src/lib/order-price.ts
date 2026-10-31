import { parseDollarsToCents } from "@/lib/money";
import { hasFinancialHistory, type MoneyRow } from "@/lib/removal";

export type PricedLine = { quantity: number; unitPriceCents: number };

/** Subtotal is the lines. Travel is added and a discount is subtracted. The total does not go below zero. */
export function orderPriceTotals(input: { lines: readonly PricedLine[]; travelFeeCents: number; discountCents: number }) {
  let subtotalCents = 0;
  for (const line of input.lines) {
    const lineTotal = line.unitPriceCents * line.quantity;
    if (!Number.isSafeInteger(lineTotal)) return null;
    subtotalCents += lineTotal;
  }
  if (!Number.isSafeInteger(subtotalCents)) return null;
  const totalCents = subtotalCents + input.travelFeeCents - input.discountCents;
  if (!Number.isSafeInteger(totalCents)) return null;
  return { subtotalCents, totalCents: Math.max(0, totalCents) };
}

export type PriceRow = { label: string; quantity: string; amount: string };

/** Blank rows are skipped. A row with any text must have a description, a quantity, and a dollar amount. */
export function parsePriceRows(rows: readonly PriceRow[]): { ok: true; lines: { label: string; quantity: number; unitPriceCents: number }[] } | { ok: false; error: string } {
  const lines: { label: string; quantity: number; unitPriceCents: number }[] = [];
  for (const row of rows) {
    const label = row.label.trim();
    const amount = row.amount.trim();
    const quantity = row.quantity.trim();
    if (!label && !amount && !quantity) continue;
    if (!label) return { ok: false, error: "Each line needs a description." };
    const cents = parseDollarsToCents(amount);
    if (cents === null) return { ok: false, error: `Enter a dollar amount for ${label}.` };
    const qty = quantity === "" ? 1 : Number(quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) return { ok: false, error: `Enter a quantity from 1 to 99 for ${label}.` };
    lines.push({ label: label.slice(0, 160), quantity: qty, unitPriceCents: cents });
    if (lines.length > 12) return { ok: false, error: "Use at most 12 line items." };
  }
  if (lines.length === 0) return { ok: false, error: "Add at least one line item." };
  if (!orderPriceTotals({ lines, travelFeeCents: 0, discountCents: 0 })) return { ok: false, error: "That total is too large." };
  return { ok: true, lines };
}

/** A price can change only when nothing has been paid and no invoice is still open. */
export function orderPriceLock(invoices: readonly (MoneyRow & { status: string })[]): string | null {
  if (hasFinancialHistory(invoices)) return "This order already has a recorded payment.";
  if (invoices.some((invoice) => invoice.status !== "VOID")) return "Void the open invoice before changing the price.";
  return null;
}
