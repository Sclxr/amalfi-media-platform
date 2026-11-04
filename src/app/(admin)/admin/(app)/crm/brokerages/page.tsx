import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/data/empty-state";
import { ArchiveView } from "@/components/removal/archive-view";
import { BulkBar, RecordMenu } from "@/components/removal/record-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { can } from "@/lib/permissions";
import { brokerageRemoval } from "@/lib/removal";
import { getActor } from "@/server/auth/guards";
import { listBrokerages } from "@/server/services/brokerages";

export const metadata = { title: "Brokerages" };

export default async function BrokeragesPage({ searchParams }: { searchParams: Promise<{ q?: string; view?: string; notice?: string }> }) {
  const actor = await getActor();
  if (!actor) redirect("/admin/login");
  const { q, view, notice } = await searchParams;
  const brokerages = await listBrokerages(actor, q, view);
  const returnTo = view === "archived" ? "/admin/crm/brokerages?view=archived" : "/admin/crm/brokerages";
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Brokerages</h1>
          <p className="mt-2 text-muted-foreground">Offices tied to realtors and clients.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ArchiveView href="/admin/crm/brokerages" view={view} />
          {can(actor, "crm.write") ? <BulkBar kind="brokerage" returnTo={returnTo} canArchive /> : null}
          <Button asChild>
            <Link href="/admin/crm/brokerages/new">Add brokerage</Link>
          </Button>
        </div>
      </div>
      {notice ? <p className="text-sm">{notice}</p> : null}
      <form method="get" className="flex min-w-0 flex-wrap gap-3">
        <Input name="q" defaultValue={q ?? ""} placeholder="Search name or city" aria-label="Search brokerages" className="min-w-0 flex-1" />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>
      {brokerages.length === 0 ? (
        <EmptyState title="No brokerages" body="Add an office so realtors can be grouped." />
      ) : (
        <>
        <div className="grid gap-3 md:hidden">
          {brokerages.map((brokerage) => (
            <article key={brokerage.id} className="rounded-2xl border border-border bg-card p-4">
              <Link className="block min-h-12 text-base font-medium text-primary" href={`/admin/crm/brokerages/${brokerage.id}`}>
                {brokerage.name}
              </Link>
              <p className="text-sm text-muted-foreground">{brokerage.city ?? "No city"} · {brokerage._count.leads} realtors · {brokerage._count.clients} clients</p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" data-bulk="brokerage" value={brokerage.id} aria-label={`Select ${brokerage.name}`} />
                  Select
                </label>
                <RecordMenu
                  kind="brokerage"
                  id={brokerage.id}
                  name={brokerage.name}
                  archived={Boolean(brokerage.archivedAt)}
                  canArchive={can(actor, "crm.write")}
                  canPermanent={can(actor, "records.delete")}
                  deletable={brokerageRemoval(brokerage._count).canDelete}
                  returnTo={returnTo}
                />
              </div>
            </article>
          ))}
        </div>
        <div className="hidden overflow-x-auto rounded-2xl border border-border md:block">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">City</th>
                <th className="px-4 py-3 font-medium">Realtors</th>
                <th className="px-4 py-3 font-medium">Clients</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {brokerages.map((brokerage) => (
                <tr key={brokerage.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <Link className="font-medium text-primary" href={`/admin/crm/brokerages/${brokerage.id}`}>
                      {brokerage.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{brokerage.city ?? "—"}</td>
                  <td className="px-4 py-3 tabular-nums">{brokerage._count.leads}</td>
                  <td className="px-4 py-3 tabular-nums">{brokerage._count.clients}</td>
                  <td className="px-4 py-3">
                    <label className="mr-2 text-xs">
                      <input type="checkbox" data-bulk="brokerage" value={brokerage.id} aria-label={`Select ${brokerage.name}`} />
                    </label>
                    <RecordMenu
                      kind="brokerage"
                      id={brokerage.id}
                      name={brokerage.name}
                      archived={Boolean(brokerage.archivedAt)}
                      canArchive={can(actor, "crm.write")}
                      canPermanent={can(actor, "records.delete")}
                      deletable={brokerageRemoval(brokerage._count).canDelete}
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
