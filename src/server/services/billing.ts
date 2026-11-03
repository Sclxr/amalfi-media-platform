import "server-only";
import { Prisma } from "@prisma/client";
import type { Actor } from "@/lib/actor";
import { can } from "@/lib/permissions";
import { cardProcessingQuote } from "@/lib/card-fee";
import { receiptMessage } from "@/lib/email-messages";
import { storedCheckoutAction, stripeBilling } from "@/lib/stripe-billing";
import { sendTransactional } from "@/server/email/send";
import { logger } from "@/server/logger";
import { nextInvoiceNumber } from "@/lib/invoice-number";
import { orderPriceLock } from "@/lib/order-price";
import { prisma } from "@/server/db/prisma";
import { getEnv } from "@/server/env";
import { canVoidInvoice } from "@/lib/invoice-void";
import { writeAudit } from "@/server/audit";

export function billingStatus() {
  const env = getEnv();
  return stripeBilling({
    appEnv: env.APP_ENV,
    secretKey: env.STRIPE_SECRET_KEY,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET,
  });
}

export async function listInvoices(actor: Actor) {
  if (!can(actor, "billing.read")) throw new Error("Forbidden");
  return prisma.invoice.findMany({
    orderBy: { createdAt: "desc" },
    include: { client: true, payments: true },
  });
}

export async function getInvoice(actor: Actor, id: string) {
  if (!can(actor, "billing.read")) throw new Error("Forbidden");
  return prisma.invoice.findUnique({
    where: { id },
    include: { client: true, lineItems: { orderBy: { sortOrder: "asc" } }, payments: true, order: { include: { property: true } } },
  });
}

export async function createInvoiceForOrder(actor: Actor, orderId: string) {
  if (!can(actor, "orders.write")) throw new Error("Forbidden");
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, client: true, invoices: { include: { payments: true } } },
  });
  if (!order) return { error: "That order was not found." as const };
  if (order.invoices.some((invoice) => invoice.status !== "VOID")) {
    return { error: "This order already has an invoice. Void it before creating another." as const };
  }
  if (order.items.some((item) => item.unitPriceCents === null)) {
    return { error: "Price every line before creating an invoice." as const };
  }
  const priced = order.items.filter((item) => item.unitPriceCents !== null);
  if (priced.length === 0) return { error: "Price the order before creating an invoice." as const };
  if (orderPriceLock(order.invoices)) return { error: "This order already has a recorded payment." as const };
  const invoice = await createWithUniqueNumber(order, priced);
  await writeAudit({
    actorId: actor.id,
    action: "invoice.create",
    entityType: "Invoice",
    entityId: invoice.id,
    after: { number: invoice.number, totalCents: invoice.totalCents },
  });
  return { id: invoice.id };
}

export async function voidUnpaidInvoice(actor: Actor, invoiceId: string) {
  if (!can(actor, "orders.write")) throw new Error("Forbidden");
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId }, include: { payments: true } });
  if (!invoice) return { error: "That invoice was not found." as const };
  if (!canVoidInvoice(invoice)) return { error: "Only an unpaid invoice can be voided." as const };
  await prisma.invoice.update({ where: { id: invoice.id }, data: { status: "VOID" } });
  await writeAudit({
    actorId: actor.id,
    action: "invoice.void",
    entityType: "Invoice",
    entityId: invoice.id,
    before: { status: invoice.status },
    after: { status: "VOID" },
  });
  return { ok: true as const };
}

async function returnGallery(invoice: { clientId: string; orderId: string | null }, galleryId?: string) {
  if (galleryId) {
    const match = await prisma.gallery.findFirst({
      where: { id: galleryId, clientId: invoice.clientId, ...(invoice.orderId ? { orderId: invoice.orderId } : {}) },
      select: { id: true },
    });
    if (match) return match;
  }
  if (!invoice.orderId) return null;
  return prisma.gallery.findFirst({
    where: { orderId: invoice.orderId, clientId: invoice.clientId, status: "PUBLISHED" },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
}

function stripeApi(path: string) {
  const base = (getEnv().STRIPE_API_BASE ?? "https://api.stripe.com").replace(/\/$/, "");
  return `${base}${path}`;
}

export async function startCheckout(actor: Actor, invoiceId: string, galleryId?: string) {
  const status = billingStatus();
  if (!status.configured) return { error: status.reason, configured: false as const };
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, ...(actor.role === "CLIENT" ? { clientId: actor.clientId ?? "__none__" } : {}) },
  });
  if (!invoice) return { error: "That invoice was not found." as const };
  if (invoice.status !== "OPEN") return { error: "Only an open invoice can be paid." as const };
  if (invoice.stripeCheckoutSessionId) {
    const decision = storedCheckoutAction(await readCheckoutSession(status.secretKey, invoice.stripeCheckoutSessionId));
    if (decision.action === "reuse") return { url: decision.url };
    if (decision.action === "complete") return { error: "This checkout is already complete. Refresh the invoice." as const };
    if (decision.action === "unavailable") return { error: "Stripe could not reopen the existing checkout." as const };
  }
  const env = getEnv();
  const quote = cardProcessingQuote({
    priceCents: invoice.totalCents,
    percentBps: env.cardFeePercentBps,
    fixedCents: env.cardFeeFixedCents,
  });
  const origin = env.APP_URL.replace(/\/$/, "");
  const gallery = await returnGallery(invoice, galleryId);
  const returnPath = gallery ? `/portal/galleries/${gallery.id}` : `/portal/invoices/${invoice.id}`;
  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.set("success_url", `${origin}${returnPath}?paid=1`);
  body.set("cancel_url", `${origin}${returnPath}?cancelled=1`);
  body.set("client_reference_id", invoice.id);
  body.set("metadata[invoiceId]", invoice.id);
  body.set("payment_intent_data[metadata][invoiceId]", invoice.id);
  body.set("line_items[0][quantity]", "1");
  body.set("line_items[0][price_data][currency]", invoice.currency.toLowerCase());
  body.set("line_items[0][price_data][unit_amount]", String(invoice.totalCents));
  body.set("line_items[0][price_data][product_data][name]", `Amalfi Media ${invoice.number}`);
  if (quote.feeCents > 0) {
    body.set("line_items[1][quantity]", "1");
    body.set("line_items[1][price_data][currency]", invoice.currency.toLowerCase());
    body.set("line_items[1][price_data][unit_amount]", String(quote.feeCents));
    body.set("line_items[1][price_data][product_data][name]", "Card processing fee");
  }
  const response = await fetch(stripeApi("/v1/checkout/sessions"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${status.secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const payload = (await response.json()) as { url?: string; id?: string; error?: { message?: string } };
  if (!response.ok || !payload.url || !payload.id) {
    return { error: payload.error?.message ?? "Stripe did not start checkout." };
  }
  const claimed = await prisma.invoice.updateMany({
    where: { id: invoice.id, status: "OPEN", stripeCheckoutSessionId: invoice.stripeCheckoutSessionId },
    data: { stripeCheckoutSessionId: payload.id, cardFeeCents: quote.feeCents },
  });
  if (claimed.count === 1) return { url: payload.url };
  const current = await prisma.invoice.findUnique({ where: { id: invoice.id } });
  if (!current || current.status !== "OPEN") return { error: "Only an open invoice can be paid." as const };
  if (current.stripeCheckoutSessionId) {
    const decision = storedCheckoutAction(await readCheckoutSession(status.secretKey, current.stripeCheckoutSessionId));
    if (decision.action === "reuse") return { url: decision.url };
  }
  return { error: "Checkout was already started. Refresh and try again." as const };
}

async function createWithUniqueNumber(
  order: { id: string; clientId: string; subtotalCents: number; totalCents: number },
  priced: { label: string; quantity: number; unitPriceCents: number | null }[],
) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const year = new Date().getFullYear();
    const existing = await prisma.invoice.findMany({
      where: { number: { startsWith: `INV-${year}-` } },
      select: { number: true },
    });
    const number = nextInvoiceNumber(year, existing.map((invoice) => invoice.number), attempt);
    try {
      return await prisma.invoice.create({
        data: {
          number,
          clientId: order.clientId,
          orderId: order.id,
          status: "OPEN",
          subtotalCents: order.subtotalCents,
          totalCents: order.totalCents,
          issuedAt: new Date(),
          lineItems: {
            create: priced.map((item, index) => ({
              description: item.label,
              quantity: item.quantity,
              unitPriceCents: item.unitPriceCents ?? 0,
              totalCents: (item.unitPriceCents ?? 0) * item.quantity,
              sortOrder: index,
            })),
          },
        },
      });
    } catch (error) {
      const unique = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
      if (!unique || attempt === 4) throw error;
    }
  }
  throw new Error("Could not allocate an invoice number.");
}

export async function chooseZellePayment(actor: Actor, orderId: string) {
  if (!actor.clientId) return { error: "Sign in as the client to choose Zelle." as const };
  if (!getEnv().zellePhone) return { error: "Zelle is not configured." as const };
  const order = await prisma.order.findFirst({
    where: { id: orderId, clientId: actor.clientId },
    include: { invoices: true },
  });
  if (!order) return { error: "That order was not found." as const };
  const open = order.invoices.find((invoice) => invoice.status === "OPEN");
  if (!open) return { error: "This order does not have an open invoice." as const };
  if (order.collection === "PAID" || order.invoices.some((invoice) => invoice.status === "PAID")) {
    return { error: "This order is already paid." as const };
  }
  await prisma.order.update({ where: { id: order.id }, data: { collection: "AWAITING_ZELLE" } });
  await writeAudit({
    actorId: actor.id,
    action: "order.zelle.awaiting",
    entityType: "Order",
    entityId: order.id,
    after: { invoiceId: open.id },
  });
  return { ok: true as const };
}

export async function markZellePaid(actor: Actor, invoiceId: string, amountCents: number, note: string) {
  if (actor.role !== "ADMIN") throw new Error("Forbidden");
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      client: true,
      order: { include: { property: true, galleries: { where: { status: "PUBLISHED" }, orderBy: { createdAt: "desc" }, take: 1 } } },
    },
  });
  if (!invoice) return { error: "That invoice was not found." as const };
  if (invoice.status !== "OPEN") return { error: "Only an open invoice can be marked paid." as const };
  if (amountCents !== invoice.totalCents) return { error: "Enter the listing price. Zelle does not include the card fee." as const };
  const trimmed = note.trim().slice(0, 240);
  await prisma.$transaction(async (tx) => {
    await tx.invoice.update({
      where: { id: invoice.id },
      data: { status: "PAID", amountPaidCents: invoice.totalCents, paidAt: new Date(), cardFeeCents: 0 },
    });
    if (invoice.orderId) {
      await tx.order.update({ where: { id: invoice.orderId }, data: { collection: "PAID", cardFeeCents: 0 } });
    }
    await tx.payment.create({
      data: {
        invoiceId: invoice.id,
        status: "SUCCEEDED",
        amountCents: invoice.totalCents,
        baseCents: invoice.totalCents,
        feeCents: 0,
        method: "zelle",
        note: trimmed || null,
        createdById: actor.id,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "payment.zelle",
        entityType: "Invoice",
        entityId: invoice.id,
        after: { amountCents: invoice.totalCents, note: trimmed || null, method: "zelle" },
      },
    });
  });
  await sendRecordedReceipt(invoice, "zelle");
  return { ok: true as const };
}

export async function reverseZellePayment(actor: Actor, invoiceId: string, note: string) {
  if (actor.role !== "ADMIN") throw new Error("Forbidden");
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId }, include: { payments: true } });
  if (!invoice) return { error: "That invoice was not found." as const };
  if (invoice.payments.some((item) => item.status === "SUCCEEDED" && item.method === "card")) {
    return { error: "A card payment has to be refunded in Stripe." as const };
  }
  const payment = invoice.payments.find((item) => item.status === "SUCCEEDED" && item.method === "zelle" && !item.stripeChargeId);
  if (!payment) return { error: "Only a manual Zelle payment can be reversed here." as const };
  const trimmed = note.trim().slice(0, 240) || "Zelle payment reversed.";
  await prisma.$transaction(async (tx) => {
    await tx.refund.create({
      data: { paymentId: payment.id, amountCents: payment.baseCents || payment.amountCents, status: "SUCCEEDED", reason: trimmed, createdById: actor.id },
    });
    await tx.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
    await tx.invoice.update({
      where: { id: invoice.id },
      data: { status: "OPEN", amountPaidCents: 0, paidAt: null },
    });
    if (invoice.orderId) {
      await tx.order.update({ where: { id: invoice.orderId }, data: { collection: "AWAITING_ZELLE" } });
    }
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "payment.zelle.reversed",
        entityType: "Invoice",
        entityId: invoice.id,
        after: { amountCents: payment.amountCents, note: trimmed },
      },
    });
  });
  return { ok: true as const };
}

async function sendRecordedReceipt(
  invoice: {
    id: string;
    number: string;
    totalCents: number;
    cardFeeCents: number;
    client: { email: string | null };
    order: { galleries: { id: string }[] } | null;
  },
  method: "zelle" | "card",
) {
  try {
    if (!invoice.client.email) return;
    const origin = getEnv().APP_URL.replace(/\/$/, "");
    const gallery = invoice.order?.galleries[0];
    const fee = method === "zelle" ? 0 : invoice.cardFeeCents;
    await sendTransactional(
      receiptMessage({
        to: invoice.client.email,
        number: invoice.number,
        totalCents: invoice.totalCents + fee,
        baseCents: invoice.totalCents,
        feeCents: fee,
        method,
        receiptUrl: null,
        galleryUrl: gallery ? `${origin}/portal/galleries/${gallery.id}` : null,
      }),
    );
  } catch (error) {
    logger.error({ err: error, invoiceId: invoice.id }, "receipt email failed");
  }
}

async function readCheckoutSession(secret: string, sessionId: string) {
  const response = await fetch(stripeApi(`/v1/checkout/sessions/${encodeURIComponent(sessionId)}`), {
    headers: { Authorization: `Bearer ${secret}` },
  });
  if (!response.ok) return null;
  return (await response.json()) as { status?: string; url?: string | null };
}
