import Link from "next/link";
import { EmptyState } from "@/components/data/empty-state";
import { StatusBadge } from "@/components/data/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/dates";
import { LEAD_STATUSES } from "@/schemas/lead";
import { getActor } from "@/server/auth/guards";
import { listBrokerages } from "@/server/services/brokerages";
import { listLeads } from "@/server/services/leads";
import { redirect } from "next/navigation";

export const metadata = { title: "Realtors" };

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; brokerageId?: string }>;
}) {
  const actor = await getActor();
  if (!actor) redirect("/admin/login");
  const params = await searchParams;
  const [leads, brokerages] = await Promise.all([
    listLeads(actor, params),
    listBrokerages(actor),
  ]);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Realtors</h1>
          <p className="mt-2 text-muted-foreground">Leads, follow-ups, and brokerage relationships.</p>
        </div>
        <Button asChild>
          <Link href="/admin/crm/leads/new">Add realtor</Link>
        </Button>
      </div>
      <form className="grid gap-3 md:grid-cols-[1fr_180px_220px_auto]" method="get">
        <Input name="q" defaultValue={params.q ?? ""} placeholder="Search name, email, phone, city" aria-label="Search realtors" />
        <select name="status" defaultValue={params.status ?? ""} className="h-10 rounded-sm border border-border bg-background px-3 text-sm" aria-label="Status">
          <option value="">All statuses</option>
          {LEAD_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        <select name="brokerageId" defaultValue={params.brokerageId ?? ""} className="h-10 rounded-sm border border-border bg-background px-3 text-sm" aria-label="Brokerage">
          <option value="">All brokerages</option>
          {brokerages.map((brokerage) => (
            <option key={brokerage.id} value={brokerage.id}>
              {brokerage.name}
            </option>
          ))}
        </select>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
      </form>
      {leads.length === 0 ? (
        <EmptyState title="No realtors match" body="Try another search, or add a realtor to the pipeline." />
      ) : (
        <div className="overflow-x-auto rounded-md border border-border" data-testid="lead-table">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-surface text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Brokerage</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">City</th>
                <th className="px-4 py-3 font-medium">Follow-up</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-t border-border hover:bg-surface">
                  <td className="px-4 py-3">
                    <Link className="font-medium text-primary" href={`/admin/crm/leads/${lead.id}`}>
                      {lead.firstName} {lead.lastName}
                    </Link>
                    <div className="text-muted-foreground">{lead.email}</div>
                  </td>
                  <td className="px-4 py-3">{lead.brokerage?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={lead.status} />
                  </td>
                  <td className="px-4 py-3">{lead.city ?? "—"}</td>
                  <td className="px-4 py-3 tabular-nums">{formatDate(lead.nextFollowUpAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
