import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { marketingSendDecision } from "@/lib/marketing";
import { getEnv } from "@/server/env";

export const metadata = { title: "Marketing" };

export default function MarketingPage() {
  const env = getEnv();
  const decision = marketingSendDecision({
    appEnv: env.APP_ENV,
    emailMarketingEnabled: env.emailMarketingEnabled,
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Marketing</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">Campaigns are not built yet. Sending is blocked until a later milestone, and it cannot run outside production.</p>
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
        </CardContent>
      </Card>
    </div>
  );
}
