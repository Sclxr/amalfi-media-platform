import "server-only";
import type { Actor } from "@/lib/actor";
import { prisma } from "@/server/db/prisma";

export function clientScope(actor: Actor) {
  if (actor.role !== "CLIENT" || !actor.clientId) {
    throw new Error("Client data requires a client profile on the signed-in user.");
  }
  const clientId = actor.clientId;
  return {
    orders: {
      list: () =>
        prisma.order.findMany({
          where: { clientId },
          orderBy: { createdAt: "desc" },
          include: { property: true },
        }),
      get: (id: string) => prisma.order.findFirst({ where: { id, clientId } }),
      updateInstructions: (id: string, instructions: string) =>
        prisma.order.updateMany({ where: { id, clientId }, data: { instructions } }),
    },
    invoices: {
      list: () => prisma.invoice.findMany({ where: { clientId }, orderBy: { createdAt: "desc" } }),
      get: (id: string) => prisma.invoice.findFirst({ where: { id, clientId } }),
    },
    galleries: {
      list: () =>
        prisma.gallery.findMany({
          where: { clientId, status: "PUBLISHED" },
          orderBy: { createdAt: "desc" },
        }),
      get: (id: string) => prisma.gallery.findFirst({ where: { id, clientId, status: "PUBLISHED" } }),
    },
    properties: {
      list: () => prisma.property.findMany({ where: { clientId }, orderBy: { createdAt: "desc" } }),
      get: (id: string) => prisma.property.findFirst({ where: { id, clientId } }),
    },
  };
}
