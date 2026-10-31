import "server-only";
import type { Actor } from "@/lib/actor";
import { can } from "@/lib/permissions";
import { stripeBilling } from "@/lib/stripe-billing";
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
    include: { items: true, client: true },
  });
  if (!order) return { error: "That order was not found." as const };
  const priced = order.items.filter((item) => item.unitPriceCents !== null);
  if (priced.length === 0) return { error: "Price the order before creating an invoice." as const };
  const count = await prisma.invoice.count();
  const invoice = await prisma.invoice.create({
    data: {
      number: `INV-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`,
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

export async function startCheckout(actor: Actor, invoiceId: string) {
  const status = billingStatus();
  if (!status.configured) return { error: status.reason, configured: false as const };
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, ...(actor.role === "CLIENT" ? { clientId: actor.clientId ?? "__none__" } : {}) },
  });
  if (!invoice) return { error: "That invoice was not found." as const };
  if (invoice.status === "PAID") return { error: "This invoice is already paid." as const };
  const env = getEnv();
  const origin = env.APP_URL.replace(/\/$/, "");
  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.set("success_url", `${origin}/portal/invoices/${invoice.id}?paid=1`);
  body.set("cancel_url", `${origin}/portal/invoices/${invoice.id}?cancelled=1`);
  body.set("client_reference_id", invoice.id);
  body.set("metadata[invoiceId]", invoice.id);
  body.set("line_items[0][quantity]", "1");
  body.set("line_items[0][price_data][currency]", "usd");
  body.set("line_items[0][price_data][unit_amount]", String(invoice.totalCents));
  body.set("line_items[0][price_data][product_data][name]", `Amalfi Media ${invoice.number}`);
  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
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
  await prisma.invoice.update({ where: { id: invoice.id }, data: { stripeCheckoutSessionId: payload.id } });
  return { url: payload.url };
}
