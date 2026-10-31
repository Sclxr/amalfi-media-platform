/** Next invoice number for a year, skipping numbers already used. `bump` retries after a collision. */
export function nextInvoiceNumber(year: number, existing: readonly string[], bump = 0) {
  const prefix = `INV-${year}-`;
  let max = 0;
  for (const number of existing) {
    if (!number.startsWith(prefix)) continue;
    const parsed = Number(number.slice(prefix.length));
    if (Number.isInteger(parsed) && parsed > max) max = parsed;
  }
  return `${prefix}${String(max + 1 + bump).padStart(4, "0")}`;
}
