import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { StatusBadge } from "@/components/data/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getActor } from "@/server/auth/guards";
import { getBrokerage } from "@/server/services/brokerages";

export const metadata = { title: "Brokerage" };

export default async function BrokeragePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const actor = await getActor();
  if (!actor) redirect("/admin/login");
  const { id } = await params;
  const query = await searchParams;
  const brokerage = await getBrokerage(actor, id);
  if (!brokerage) notFound();
  return (
    <div className="space-y-6">
      {query.notice === "duplicate" ? (
        <p className="rounded-md border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
          A brokerage with that name already exists. Showing the existing record.
        </p>
      ) : null}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link className="text-sm text-primary" href="/admin/crm/brokerages">
            Brokerages
          </Link>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{brokerage.name}</h1>
          <p className="mt-2 text-muted-foreground">{[brokerage.address, brokerage.city].filter(Boolean).join(", ") || "No address yet"}</p>
        </div>
        <Button asChild variant="secondary">
          <Link href={`/admin/crm/brokerages/${brokerage.id}/edit`}>Edit</Link>
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Realtors</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {brokerage.leads.length === 0 ? (
            <p className="text-sm text-muted-foreground">No realtors linked yet.</p>
          ) : (
            brokerage.leads.map((lead) => (
              <Link key={lead.id} href={`/admin/crm/leads/${lead.id}`} className="flex items-center justify-between rounded-md px-2 py-2 hover:bg-surface">
                <span>
                  {lead.firstName} {lead.lastName}
                </span>
                <StatusBadge status={lead.status} />
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
