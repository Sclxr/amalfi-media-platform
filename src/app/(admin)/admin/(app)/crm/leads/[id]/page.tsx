import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { NoteForm } from "@/components/forms/record-form";
import { StatusBadge } from "@/components/data/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { addNoteAction } from "@/app/(admin)/admin/(app)/crm/actions";
import { formatDate, formatDateTime } from "@/lib/dates";
import { getActor } from "@/server/auth/guards";
import { getLead } from "@/server/services/leads";

export const metadata = { title: "Realtor" };

export default async function LeadDetailPage({
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
  const lead = await getLead(actor, id);
  if (!lead) notFound();
  const noteAction = addNoteAction.bind(null, lead.id);
  return (
    <div className="space-y-6">
      {query.notice === "duplicate" ? (
        <p className="rounded-md border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
          That email is already on file. Showing the existing realtor instead of creating a duplicate.
        </p>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link className="text-sm text-primary" href="/admin/crm/leads">
            Realtors
          </Link>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {lead.firstName} {lead.lastName}
          </h1>
          <p className="mt-2 text-muted-foreground">{lead.email}</p>
        </div>
        <Button asChild variant="secondary">
          <Link href={`/admin/crm/leads/${lead.id}/edit`}>Edit</Link>
        </Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
            <Info label="Status" value={<StatusBadge status={lead.status} />} />
            <Info label="Phone" value={lead.phone ?? "—"} />
            <Info label="City" value={lead.city ?? "—"} />
            <Info label="Brokerage" value={lead.brokerage?.name ?? "—"} />
            <Info label="Source" value={lead.source?.name ?? "—"} />
            <Info label="Follow-up" value={formatDate(lead.nextFollowUpAt)} />
            <Info label="Tags" value={lead.tags.length ? lead.tags.join(", ") : "—"} />
            <Info label="Owner" value={lead.owner?.name ?? "—"} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Note</CardTitle>
          </CardHeader>
          <CardContent>
            <NoteForm action={noteAction} />
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {lead.activities.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notes yet.</p>
          ) : (
            lead.activities.map((activity) => (
              <article key={activity.id} className="border-b border-border pb-4 last:border-0">
                <p className="text-sm">{activity.summary}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {activity.type.replaceAll("_", " ")} · {activity.actor?.name ?? "System"} · {formatDateTime(activity.createdAt)}
                </p>
              </article>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}
