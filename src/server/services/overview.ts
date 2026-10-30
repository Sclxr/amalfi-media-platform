import "server-only";
import type { Actor } from "@/lib/actor";
import { can } from "@/lib/permissions";
import { prisma } from "@/server/db/prisma";

const CLOSED_LEAD = ["CONVERTED", "LOST", "DO_NOT_CONTACT"] as const;
const ACTIVE_ORDER = ["REQUESTED", "CONFIRMED", "SCHEDULED", "SHOOT_COMPLETE", "EDITING", "READY_FOR_DELIVERY"] as const;

export async function getOverview(actor: Actor) {
  const now = new Date();
  const [leadGroups, orderGroups, followUps, recentLeads, collected, openInvoices] = await Promise.all([
    prisma.lead.groupBy({
      by: ["status"],
      where: { deletedAt: null },
      _count: { _all: true },
    }),
    prisma.order.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.lead.count({
      where: {
        deletedAt: null,
        nextFollowUpAt: { lte: now },
        status: { notIn: [...CLOSED_LEAD] },
      },
    }),
    prisma.lead.findMany({
      where: { deletedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 6,
      include: { brokerage: true },
    }),
    can(actor, "overview.revenue")
      ? prisma.invoice.aggregate({
          where: { status: { in: ["PAID", "PARTIALLY_REFUNDED"] } },
          _sum: { amountPaidCents: true },
        })
      : Promise.resolve(null),
    prisma.invoice.count({ where: { status: { in: ["OPEN", "PARTIALLY_PAID"] } } }),
  ]);

  const leadsByStatus = leadGroups.map((row) => ({ status: row.status, count: row._count._all }));
  const ordersByStatus = orderGroups.map((row) => ({ status: row.status, count: row._count._all }));
  const openLeads = leadsByStatus
    .filter((row) => !CLOSED_LEAD.includes(row.status as (typeof CLOSED_LEAD)[number]))
    .reduce((sum, row) => sum + row.count, 0);
  const activeOrders = ordersByStatus
    .filter((row) => ACTIVE_ORDER.includes(row.status as (typeof ACTIVE_ORDER)[number]))
    .reduce((sum, row) => sum + row.count, 0);

  return {
    openLeads,
    followUps,
    activeOrders,
    openInvoices,
    collectedCents: collected ? (collected._sum.amountPaidCents ?? 0) : null,
    leadsByStatus,
    ordersByStatus,
    recentLeads,
    showRevenue: can(actor, "overview.revenue"),
  };
}
