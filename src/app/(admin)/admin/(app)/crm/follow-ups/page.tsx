import Link from "next/link";
import { redirect } from "next/navigation";
import { completeTaskAction } from "@/app/(admin)/admin/(app)/crm/growth-actions";
import { StatusBadge } from "@/components/data/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/dates";
import { getActor } from "@/server/auth/guards";
import { listFollowUpQueue } from "@/server/services/outreach";

export const metadata = { title: "Follow-ups" };

export default async function FollowUpsPage() {
  const actor = await getActor();
  if (!actor) redirect("/admin/login");
  const { leads, tasks } = await listFollowUpQueue(actor);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Follow-ups</h1>
        <p className="mt-2 text-muted-foreground">Realtors due in the next seven days, including anything overdue, and open tasks.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Queue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {leads.length === 0 ? <p className="text-sm text-muted-foreground">Nothing is due.</p> : null}
          {leads.map((lead) => (
            <div key={lead.id} className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <div>
                <Link className="font-medium text-primary" href={`/admin/crm/leads/${lead.id}`}>
                  {lead.firstName} {lead.lastName}
                </Link>
                <p className="text-muted-foreground">
                  {formatDate(lead.nextFollowUpAt)} · {lead.brokerage?.name ?? "No brokerage"}
                </p>
              </div>
              <StatusBadge status={lead.status} />
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Tasks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {tasks.length === 0 ? <p className="text-sm text-muted-foreground">No open tasks.</p> : null}
          {tasks.map((task) => (
            <form key={task.id} action={completeTaskAction} className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <div>
                <p className="font-medium">{task.note}</p>
                <p className="text-muted-foreground">
                  {formatDate(task.dueAt)}
                  {task.lead ? ` · ${task.lead.firstName} ${task.lead.lastName}` : ""}
                </p>
              </div>
              <input type="hidden" name="id" value={task.id} />
              <Button type="submit" variant="secondary" size="sm">
                Complete
              </Button>
            </form>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
