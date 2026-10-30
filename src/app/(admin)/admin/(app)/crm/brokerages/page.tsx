import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/data/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getActor } from "@/server/auth/guards";
import { listBrokerages } from "@/server/services/brokerages";

export const metadata = { title: "Brokerages" };

export default async function BrokeragesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const actor = await getActor();
  if (!actor) redirect("/admin/login");
  const { q } = await searchParams;
  const brokerages = await listBrokerages(actor, q);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Brokerages</h1>
          <p className="mt-2 text-muted-foreground">Offices tied to realtors and clients.</p>
        </div>
        <Button asChild>
          <Link href="/admin/crm/brokerages/new">Add brokerage</Link>
        </Button>
      </div>
      <form method="get" className="flex gap-3">
        <Input name="q" defaultValue={q ?? ""} placeholder="Search name or city" aria-label="Search brokerages" />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>
      {brokerages.length === 0 ? (
        <EmptyState title="No brokerages" body="Add an office so realtors can be grouped." />
      ) : (
        <div className="overflow-hidden rounded-md border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">City</th>
                <th className="px-4 py-3 font-medium">Realtors</th>
                <th className="px-4 py-3 font-medium">Clients</th>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
