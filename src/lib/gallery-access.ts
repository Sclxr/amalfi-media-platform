export const PAID_INVOICE_STATUSES = ["PAID"] as const;

export type InvoiceStatus =
  | "DRAFT"
  | "OPEN"
  | "PAID"
  | "PARTIALLY_PAID"
  | "VOID"
  | "UNCOLLECTIBLE"
  | "PARTIALLY_REFUNDED"
  | "REFUNDED";

export type CoveringInvoice = {
  status: string;
  createdAt: number;
  amountRefundedCents: number;
};

/** The newest invoice that was not voided is the one that covers this gallery. */
export function coveringInvoiceStatus(invoices: readonly CoveringInvoice[]): InvoiceStatus | null {
  const live = invoices.filter((invoice) => invoice.status !== "VOID");
  const latest = [...live].sort((left, right) => right.createdAt - left.createdAt)[0];
  if (!latest) return null;
  if (latest.status === "PAID" && latest.amountRefundedCents > 0) return "PARTIALLY_REFUNDED";
  return latest.status as InvoiceStatus;
}

export type GalleryDownloadInput = {
  requirePaid: boolean;
  allowUnpaidDownloads: boolean;
  invoiceStatus: InvoiceStatus | null;
};

/**
 * Full-resolution and ZIP downloads are allowed when the gallery does not
 * require payment, the client has an admin-controlled trusted exception, or
 * the related invoice has been paid.
 */
export function galleryDownloadDecision(input: GalleryDownloadInput): {
  allowed: boolean;
  reason: "gallery-open" | "trusted-client" | "invoice-paid" | "payment-required";
} {
  if (!input.requirePaid) return { allowed: true, reason: "gallery-open" };
  if (input.allowUnpaidDownloads) return { allowed: true, reason: "trusted-client" };
  if (
    input.invoiceStatus &&
    (PAID_INVOICE_STATUSES as readonly string[]).includes(input.invoiceStatus)
  ) {
    return { allowed: true, reason: "invoice-paid" };
  }
  return { allowed: false, reason: "payment-required" };
}
