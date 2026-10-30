import { CalendarClock, ClipboardList, DollarSign, Users } from "lucide-react";
import Link from "next/link";
import { OverviewCharts } from "@/components/data/overview-charts";
import { StatCard } from "@/components/data/stat-card";
import { StatusBadge } from "@/components/data/status-badge";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/dates";
import { formatCents } from "@/lib/money";
import { getActor } from "@/server/auth/guards";
import { getOverview } from "@/server/services/overview";
import { redirect } from "next/navigation";

export const metadata = { title: "Overview" };

export default async function OverviewPage() {
  const actor = await getActor();
  if (!actor) redirect("/admin/login");
  const overview = await getOverview(actor);
  return (
    <div data-testid="overview" className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Overview</h1>
        <p className="mt-2 text-muted-foreground">Amalfi Media · Orlando, Central Florida</p>
      </div>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Open realtors" value={String(overview.openLeads)} hint="Not converted or closed" icon={Users} />
        <StatCard label="Follow-ups due" value={String(overview.followUps)} hint="Through today, Eastern time" icon={CalendarClock} />
        <StatCard label="Active orders" value={String(overview.activeOrders)} hint={`${overview.openInvoices} open invoices`} icon={ClipboardList} />
        {overview.showRevenue ? (
          <StatCard
            testId="revenue-card"
            label="Collected"
            value={formatCents(overview.collectedCents ?? 0)}
            hint="Paid invoices"
            icon={DollarSign}
          />
        ) : null}
      </section>
      <OverviewCharts leads={overview.leadsByStatus} orders={overview.ordersByStatus} />
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4">
          <h2 className="font-semibold">Recent realtors</h2>
          <Link className="text-sm text-primary" href="/admin/crm/leads">
            View all
          </Link>
        </div>
        <div className="divide-y divide-border">
          {overview.recentLeads.length === 0 ? (
            <p className="px-5 py-8 text-sm text-muted-foreground">No realtors yet.</p>
          ) : (
            overview.recentLeads.map((lead) => (
              <Link key={lead.id} href={`/admin/crm/leads/${lead.id}`} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-surface">
                <span>
                  <span className="block font-medium">
                    {lead.firstName} {lead.lastName}
                  </span>
                  <span className="text-sm text-muted-foreground">{lead.brokerage?.name ?? lead.city ?? "No brokerage"}</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="hidden text-sm text-muted-foreground sm:inline">{formatDate(lead.updatedAt)}</span>
                  <StatusBadge status={lead.status} />
                </span>
              </Link>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
