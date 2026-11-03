import Link from "next/link";
import { EmptyState } from "@/components/data/empty-state";
import { ArchiveView } from "@/components/removal/archive-view";
import { BulkBar, RecordMenu } from "@/components/removal/record-menu";
import { StatusBadge } from "@/components/data/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { hasFinancialHistory, leadRemoval } from "@/lib/removal";
import { LEAD_STATUSES } from "@/schemas/lead";
import { getActor } from "@/server/auth/guards";
import { listBrokerages } from "@/server/services/brokerages";
import { listLeads } from "@/server/services/leads";
import { redirect } from "next/navigation";

export const metadata = { title: "Realtors" };

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; brokerageId?: string; view?: string; notice?: string }>;
}) {
  const actor = await getActor();
  if (!actor) redirect("/admin/login");
  const params = await searchParams;
  const returnTo = params.view === "archived" ? "/admin/crm/leads?view=archived" : "/admin/crm/leads";
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
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <Link href="/admin/crm/import">Import CSV</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/admin/crm/follow-ups">Follow-ups</Link>
          </Button>
          <Button asChild>
            <Link href="/admin/crm/leads/new">Add realtor</Link>
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <ArchiveView href="/admin/crm/leads" view={params.view} />
        {can(actor, "crm.write") ? <BulkBar kind="lead" returnTo={returnTo} canArchive /> : null}
      </div>
      {params.notice ? <p className="text-sm">{params.notice}</p> : null}
      <form className="grid gap-3 md:grid-cols-[1fr_180px_220px_auto]" method="get">
        <Input name="q" defaultValue={params.q ?? ""} placeholder="Search name, email, phone, city" aria-label="Search realtors" />
        <select name="status" defaultValue={params.status ?? ""} className="h-12 rounded-xl border border-border bg-card px-3 text-base" aria-label="Status">
          <option value="">All statuses</option>
          {LEAD_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        <select name="brokerageId" defaultValue={params.brokerageId ?? ""} className="h-12 rounded-xl border border-border bg-card px-3 text-base" aria-label="Brokerage">
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
        <>
        <div className="grid gap-3 md:hidden" data-testid="lead-table">
          {leads.map((lead) => (
            <article key={lead.id} className="rounded-2xl border border-border bg-card p-4">
              <Link className="block min-h-12 text-base font-medium text-primary" href={`/admin/crm/leads/${lead.id}`}>
                {lead.firstName} {lead.lastName}
              </Link>
              <p className="break-all text-sm text-muted-foreground">{lead.email}</p>
              <p className="mt-2 text-sm">{lead.brokerage?.name ?? "No brokerage"} · {lead.city ?? "No city"}</p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <StatusBadge status={lead.status} />
                <span className="text-sm text-muted-foreground">{formatDate(lead.nextFollowUpAt)}</span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" data-bulk="lead" value={lead.id} aria-label={`Select ${lead.firstName} ${lead.lastName}`} />
                  Select
                </label>
                <RecordMenu
                  kind="lead"
                  id={lead.id}
                  name={`${lead.firstName ?? ""} ${lead.lastName ?? ""}`.trim() || "Realtor"}
                  archived={Boolean(lead.deletedAt)}
                  canArchive={can(actor, "crm.write")}
                  canPermanent={can(actor, "records.delete")}
                  deletable={
                    leadRemoval({
                      listings: lead._count.properties,
                      sentEmails: lead.emails.length,
                      financial: hasFinancialHistory(lead.client?.invoices ?? []),
                    }).canDelete
                  }
                  returnTo={returnTo}
                />
              </div>
            </article>
          ))}
        </div>
        <div className="hidden overflow-x-auto rounded-2xl border border-border md:block" data-testid="lead-table-desktop">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-surface text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Brokerage</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">City</th>
                <th className="px-4 py-3 font-medium">Follow-up</th>
                <th className="px-4 py-3 font-medium">Actions</th>
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
                  <td className="px-4 py-3">
                    <label className="mr-2 text-xs">
                      <input type="checkbox" data-bulk="lead" value={lead.id} aria-label={`Select ${lead.firstName} ${lead.lastName}`} />
                    </label>
                    <RecordMenu
                      kind="lead"
                      id={lead.id}
                      name={`${lead.firstName ?? ""} ${lead.lastName ?? ""}`.trim() || "Realtor"}
                      archived={Boolean(lead.deletedAt)}
                      canArchive={can(actor, "crm.write")}
                      canPermanent={can(actor, "records.delete")}
                      deletable={
                        leadRemoval({
                          listings: lead._count.properties,
                          sentEmails: lead.emails.length,
                          financial: hasFinancialHistory(lead.client?.invoices ?? []),
                        }).canDelete
                      }
                      returnTo={returnTo}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  );
}
