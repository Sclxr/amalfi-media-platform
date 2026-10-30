import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { marketingSendDecision } from "@/lib/marketing";
import { getEnv } from "@/server/env";
import { getActor } from "@/server/auth/guards";
import { redirect } from "next/navigation";
import { listCampaigns } from "@/server/services/campaigns";
import { StatusBadge } from "@/components/data/status-badge";

export const metadata = { title: "Marketing" };

export default async function MarketingPage() {
  const actor = await getActor();
  if (!actor) redirect("/admin/login");
  const env = getEnv();
  const decision = marketingSendDecision({
    appEnv: env.APP_ENV,
    emailMarketingEnabled: env.emailMarketingEnabled,
  });
  const campaigns = await listCampaigns(actor);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Marketing</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Draft campaigns, ask an admin to approve them, and keep a suppression list. Sending stays off outside production.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <Link href="/admin/marketing/templates">Templates</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/admin/marketing/suppression">Suppression</Link>
          </Button>
          <Button asChild>
            <Link href="/admin/marketing/campaigns/new">New campaign</Link>
          </Button>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Email sending</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            Environment: <span className="font-medium">{env.APP_ENV}</span>
          </p>
          <p>
            EMAIL_MARKETING_ENABLED: <span className="font-medium">{env.emailMarketingEnabled ? "true" : "false"}</span>
          </p>
          <p className={decision.allowed ? "text-success" : "text-warning"}>{decision.reason}</p>
          <p className="text-muted-foreground">Gmail is stubbed. No message leaves this server.</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Campaigns</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {campaigns.length === 0 ? <p className="text-sm text-muted-foreground">No campaigns yet.</p> : null}
          {campaigns.map((campaign) => (
            <div key={campaign.id} className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <Link className="font-medium text-primary" href={`/admin/marketing/campaigns/${campaign.id}`}>
                {campaign.name}
              </Link>
              <StatusBadge status={campaign.status} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
