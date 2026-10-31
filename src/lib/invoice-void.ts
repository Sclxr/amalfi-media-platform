export function canVoidInvoice(invoice: {
  status: string;
  amountPaidCents: number;
  payments: readonly { status: string }[];
}): boolean {
  if (invoice.amountPaidCents > 0) return false;
  if (invoice.payments.some((payment) => payment.status === "SUCCEEDED")) return false;
  return invoice.status === "OPEN" || invoice.status === "DRAFT";
}
