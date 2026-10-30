export const PAID_INVOICE_STATUSES = ["PAID", "PARTIALLY_REFUNDED"] as const;

export type InvoiceStatus =
  | "DRAFT"
  | "OPEN"
  | "PAID"
  | "PARTIALLY_PAID"
  | "VOID"
  | "UNCOLLECTIBLE"
  | "PARTIALLY_REFUNDED"
  | "REFUNDED";

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
