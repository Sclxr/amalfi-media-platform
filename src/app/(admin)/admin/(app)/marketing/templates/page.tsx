import Link from "next/link";
import { redirect } from "next/navigation";
import { TemplateForm } from "@/components/forms/template-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getActor } from "@/server/auth/guards";
import { listTemplates } from "@/server/services/campaigns";

export const metadata = { title: "Templates" };

export default async function TemplatesPage() {
  const actor = await getActor();
  if (!actor) redirect("/admin/login");
  const templates = await listTemplates(actor);
  return (
    <div className="space-y-6">
      <Link className="text-sm text-primary" href="/admin/marketing">
        Marketing
      </Link>
      <h1 className="text-3xl font-semibold tracking-tight">Templates</h1>
      <Card>
        <CardHeader>
          <CardTitle>Saved</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {templates.length === 0 ? <p className="text-muted-foreground">No templates yet.</p> : null}
          {templates.map((template) => (
            <p key={template.id}>
              <span className="font-medium">{template.key}</span> · {template.subject}
            </p>
          ))}
        </CardContent>
      </Card>
      <TemplateForm />
    </div>
  );
}
