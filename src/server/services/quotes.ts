import "server-only";
import type { Actor } from "@/lib/actor";
import { cardProcessingQuote } from "@/lib/card-fee";
import { quoteMessage } from "@/lib/email-messages";
import { normalizeEmail } from "@/lib/email";
import { can } from "@/lib/permissions";
import { prisma } from "@/server/db/prisma";
import { getEnv } from "@/server/env";
import { sendTransactional } from "@/server/email/send";
import { writeAudit } from "@/server/audit";

const SENDABLE = ["DRAFT", "OPEN"] as const;

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

function moneyQuote(totalCents: number) {
  const env = getEnv();
  return cardProcessingQuote({
    priceCents: totalCents,
    percentBps: env.cardFeePercentBps,
    fixedCents: env.cardFeeFixedCents,
  });
}

function toChoice(invoice: {
  id: string;
  status: string;
  totalCents: number;
  quoteSentAt: Date | null;
  quoteSentTo: string | null;
  lineItems: { description: string; totalCents: number; sortOrder: number }[];
  client: { firstName: string | null; lastName: string | null; email: string | null };
  order: { property: { id: string; addressLine1: string } | null } | null;
}): QuoteChoice | null {
  const property = invoice.order?.property;
  const email = normalizeEmail(invoice.client.email);
  if (!property || !email) return null;
  const card = moneyQuote(invoice.totalCents);
  const name = `${invoice.client.firstName ?? ""} ${invoice.client.lastName ?? ""}`.trim() || "there";
  return {
    invoiceId: invoice.id,
    propertyId: property.id,
    address: property.addressLine1,
    email,
    recipientName: name,
    lines: [...invoice.lineItems].sort((a, b) => a.sortOrder - b.sortOrder).map((line) => ({
      description: line.description,
      totalCents: line.totalCents,
    })),
    totalCents: invoice.totalCents,
    cardFeeCents: card.feeCents,
    cardTotalCents: card.totalCents,
    sentAt: invoice.quoteSentAt?.toISOString() ?? null,
    sentTo: invoice.quoteSentTo,
    status: invoice.status,
  };
}

const quoteInclude = {
  lineItems: true,
  client: { select: { firstName: true, lastName: true, email: true } },
  order: { select: { property: { select: { id: true, addressLine1: true, archivedAt: true } } } },
} as const;

export async function listQuoteChoices(actor: Actor) {
  if (!can(actor, "orders.read")) throw new Error("Forbidden");
  const invoices = await prisma.invoice.findMany({
    where: {
      status: { in: [...SENDABLE] },
      totalCents: { gt: 0 },
      order: { is: { archivedAt: null, property: { archivedAt: null } } },
    },
    orderBy: { updatedAt: "desc" },
    take: 30,
    include: quoteInclude,
  });
  return invoices.flatMap((invoice) => {
    const choice = toChoice(invoice);
    return choice ? [choice] : [];
  });
}

export async function quoteChoiceForProperty(actor: Actor, propertyId: string) {
  if (!can(actor, "orders.read")) throw new Error("Forbidden");
  const invoice = await prisma.invoice.findFirst({
    where: {
      status: { in: [...SENDABLE] },
      totalCents: { gt: 0 },
      order: { is: { propertyId, archivedAt: null } },
    },
    orderBy: { createdAt: "desc" },
    include: quoteInclude,
  });
  return invoice ? toChoice(invoice) : null;
}

export async function sendQuote(actor: Actor, invoiceId: string, note: string, to?: string) {
  if (!can(actor, "orders.write")) throw new Error("Forbidden");
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: quoteInclude,
  });
  if (!invoice || !invoice.order?.property || invoice.order.property.archivedAt) {
    return { error: "That quote was not found." as const };
  }
  if (invoice.status === "PAID" || invoice.status === "PARTIALLY_PAID" || invoice.amountPaidCents > 0) {
    return { error: "This quote is already paid." as const };
  }
  if (!(SENDABLE as readonly string[]).includes(invoice.status)) {
    return { error: "This quote can no longer be sent." as const };
  }
  if (invoice.totalCents <= 0) return { error: "Add a price before sending the quote." as const };
  const recipient = normalizeEmail(to || invoice.client.email);
  if (!recipient) return { error: "This realtor needs an email." as const };
  const choice = toChoice({ ...invoice, client: { ...invoice.client, email: recipient } });
  if (!choice) return { error: "This realtor needs an email." as const };
  const origin = getEnv().APP_URL.replace(/\/$/, "");
  const payPath = `/portal/invoices/${invoice.id}`;
  const payUrl = `${origin}/portal/login?next=${encodeURIComponent(payPath)}`;
  const message = quoteMessage({
    to: recipient,
    name: choice.recipientName,
    address: choice.address,
    lines: choice.lines,
    totalCents: choice.totalCents,
    cardFeeCents: choice.cardFeeCents,
    cardTotalCents: choice.cardTotalCents,
    note,
    payUrl,
  });
  const mail = await sendTransactional(message);
  if (mail.mode === "skip" || (mail.mode === "send" && !mail.delivered)) {
    return { error: mail.reason ?? "The quote email could not be sent." as const };
  }
  const sentAt = new Date();
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      status: "OPEN",
      issuedAt: invoice.issuedAt ?? sentAt,
      quoteSentAt: sentAt,
      quoteSentTo: recipient,
    },
  });
  await writeAudit({
    actorId: actor.id,
    action: "quote.send",
    entityType: "Invoice",
    entityId: invoice.id,
    after: { to: recipient, mode: mail.mode, delivered: mail.delivered },
  });
  return {
    ok: true as const,
    invoiceId: invoice.id,
    propertyId: choice.propertyId,
    address: choice.address,
    amountCents: choice.totalCents,
    sentAt: sentAt.toISOString(),
    sentTo: recipient,
    delivered: mail.delivered,
    mode: mail.mode,
  };
}
