export type MoneyRow = {
  amountPaidCents: number;
  amountRefundedCents: number;
  payments: readonly { status: string }[];
};

export type RemovalDecision = {
  canDelete: boolean;
  reason: string | null;
  lines: string[];
};

/** Paid, refunded, or succeeded payments are financial history. Void and unpaid invoices are not. */
export function hasFinancialHistory(invoices: readonly MoneyRow[]): boolean {
  return invoices.some(
    (invoice) =>
      invoice.amountPaidCents > 0 ||
      invoice.amountRefundedCents > 0 ||
      invoice.payments.some((payment) => payment.status === "SUCCEEDED"),
  );
}

function decision(canDelete: boolean, reason: string | null, lines: string[]): RemovalDecision {
  return { canDelete, reason: canDelete ? null : reason, lines };
}

function countLine(count: number, singular: string, plural = `${singular}s`): string | null {
  if (count <= 0) return null;
  return `${count} ${count === 1 ? singular : plural}`;
}

export function listingRemoval(input: {
  orders: number;
  bookings: number;
  galleries: number;
  photos: number;
  invoices: number;
  financial: boolean;
}): RemovalDecision {
  const lines = [
    countLine(input.orders, "order"),
    countLine(input.bookings, "booking"),
    countLine(input.galleries, "gallery", "galleries"),
    countLine(input.photos, "photo"),
    countLine(input.invoices, "unpaid invoice"),
  ].filter((line): line is string => Boolean(line));
  if (input.financial) {
    return decision(false, "This listing has a paid invoice. Archive it instead.", lines);
  }
  return decision(true, null, lines.length > 0 ? lines : ["The listing"]);
}

export function orderRemoval(input: {
  bookings: number;
  galleries: number;
  photos: number;
  invoices: number;
  financial: boolean;
}): RemovalDecision {
  const lines = [
    countLine(input.bookings, "booking"),
    countLine(input.galleries, "gallery", "galleries"),
    countLine(input.photos, "photo"),
    countLine(input.invoices, "unpaid invoice"),
  ].filter((line): line is string => Boolean(line));
  if (input.financial) return decision(false, "This order has a paid invoice. Archive it instead.", lines);
  return decision(true, null, lines.length > 0 ? lines : ["The order"]);
}

export function galleryRemoval(input: { photos: number; financial: boolean }): RemovalDecision {
  const lines = [countLine(input.photos, "photo")].filter((line): line is string => Boolean(line));
  if (input.financial) return decision(false, "This shoot has a paid invoice. Archive the gallery instead.", lines);
  return decision(true, null, lines.length > 0 ? lines : ["The gallery"]);
}

export function leadRemoval(input: { listings: number; sentEmails: number; financial: boolean }): RemovalDecision {
  if (input.financial) return decision(false, "This realtor has a paid invoice. Archive them instead.", []);
  if (input.listings > 0) return decision(false, "This realtor still has listings. Archive them, or remove the listings first.", []);
  if (input.sentEmails > 0) return decision(false, "Sent email stays on the record. Archive this realtor instead.", []);
  return decision(true, null, ["Notes and reminders"]);
}

export function clientRemoval(input: { properties: number; orders: number; invoices: number; galleries: number }): RemovalDecision {
  if (input.properties + input.orders + input.invoices + input.galleries > 0) {
    return decision(false, "This client still has listings or billing. Archive them, or remove that work first.", []);
  }
  return decision(true, null, ["The client profile"]);
}

export function brokerageRemoval(input: { leads: number; clients: number }): RemovalDecision {
  if (input.leads + input.clients > 0) {
    return decision(false, "Realtors or clients still use this brokerage. Archive it instead.", []);
  }
  return decision(true, null, ["The brokerage"]);
}

export function campaignRemoval(input: { status: string; sentMessages: number }): RemovalDecision {
  if (input.status === "SENT" || input.status === "SENDING" || input.status === "SCHEDULED" || input.status === "PAUSED" || input.sentMessages > 0) {
    return decision(false, "Sent or scheduled campaigns stay on record. Archive this campaign instead.", []);
  }
  return decision(true, null, ["The draft campaign"]);
}

export function importRemoval(): RemovalDecision {
  return decision(true, null, ["The import batch and its file. Realtors stay."]);
}
