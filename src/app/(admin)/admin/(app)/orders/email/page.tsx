import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { transactionalSendDecision, renderTransactionalPreview } from "@/lib/transactional-email";
import { getActor } from "@/server/auth/guards";
import { getEnv } from "@/server/env";
import { prisma } from "@/server/db/prisma";

export const metadata = { title: "Transactional email" };

export default async function TransactionalEmailPage() {
  const actor = await getActor();
  if (!actor) redirect("/admin/login");
  const env = getEnv();
  const decision = transactionalSendDecision({
    appEnv: env.APP_ENV,
    emailTransactionalEnabled: env.emailTransactionalEnabled,
    stagingSend: env.emailStagingSend,
  });
  const templates = await prisma.emailTemplate.findMany({ where: { category: "TRANSACTIONAL" }, orderBy: { key: "asc" } });
  return (
    <div className="space-y-6">
      <Link className="text-sm text-primary" href="/admin/orders">
        Orders
      </Link>
      <h1 className="text-3xl font-semibold tracking-tight">Transactional email</h1>
      <p className="max-w-2xl text-sm text-muted-foreground">{decision.reason}</p>
      {templates.map((template) => {
        const preview = renderTransactionalPreview({
          subject: template.subject,
          body: template.bodyMjml,
          address: "1842 Lake Conway Shore, Orlando, FL",
        });
        return (
          <Card key={template.id}>
            <CardHeader>
              <CardTitle>{template.key}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="font-medium">{preview.subject}</p>
              <p>{preview.body}</p>
              <p className="text-muted-foreground">Preview only. Nothing is sent from this page.</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
