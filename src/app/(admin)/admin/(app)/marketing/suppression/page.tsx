import Link from "next/link";
import { redirect } from "next/navigation";
import { SuppressionForm } from "@/components/forms/suppression-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getActor } from "@/server/auth/guards";
import { listSuppressions } from "@/server/services/campaigns";

export const metadata = { title: "Suppression" };

export default async function SuppressionPage() {
  const actor = await getActor();
  if (!actor) redirect("/admin/login");
  const rows = await listSuppressions(actor);
  return (
    <div className="space-y-6">
      <Link className="text-sm text-primary" href="/admin/marketing">
        Marketing
      </Link>
      <h1 className="text-3xl font-semibold tracking-tight">Suppression list</h1>
      <p className="max-w-2xl text-sm text-muted-foreground">
        Unsubscribed, bounced, and manual addresses are skipped when a campaign is prepared. One-click unsubscribe writes here.
      </p>
      <SuppressionForm />
      <Card>
        <CardHeader>
          <CardTitle>Addresses</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {rows.length === 0 ? <p className="text-muted-foreground">The list is empty.</p> : null}
          {rows.map((row) => (
            <p key={row.id}>
              {row.emailNormalized} · {row.reason}
            </p>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
