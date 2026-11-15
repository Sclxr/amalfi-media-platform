"use server";

import { getActor } from "@/server/auth/guards";
import { markZellePaid, reverseZellePayment } from "@/server/services/billing";
import { prisma } from "@/server/db/prisma";
import { sendQuote } from "@/server/services/quotes";

export async function sendQuoteAction(invoiceId: string, note: string, to: string) {
  const actor = await getActor();
  if (!actor) return { error: "Sign in again." as const };
  return sendQuote(actor, invoiceId, note, to);
}

export async function markTodayZelleAction(invoiceId: string, note: string) {
  const actor = await getActor();
  if (!actor) return { error: "Sign in again." as const };
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId }, select: { totalCents: true } });
  if (!invoice) return { error: "That invoice was not found." as const };
  return markZellePaid(actor, invoiceId, invoice.totalCents, note || "Marked paid from Today.");
}

export async function undoTodayZelleAction(invoiceId: string) {
  const actor = await getActor();
  if (!actor) return { error: "Sign in again." as const };
  return reverseZellePayment(actor, invoiceId, "Undone from Today.");
}
