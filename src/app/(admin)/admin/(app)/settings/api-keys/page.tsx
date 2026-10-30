import { notFound, redirect } from "next/navigation";
import { revokeKeyAction } from "@/app/(admin)/admin/(app)/marketing/actions";
import { ApiKeyForm } from "@/components/forms/api-key-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { can } from "@/lib/permissions";
import { getActor } from "@/server/auth/guards";
import { listApiKeys } from "@/server/services/api-keys";

export const metadata = { title: "API keys" };

export default async function ApiKeysPage() {
  const actor = await getActor();
  if (!actor) redirect("/admin/login");
  if (!can(actor, "settings.manage")) notFound();
  const keys = await listApiKeys(actor);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">API keys</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Keys for the marketing bot. They can create realtors, notes, and draft campaigns. They cannot send email.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Issued</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {keys.length === 0 ? <p className="text-muted-foreground">No keys yet.</p> : null}
          {keys.map((key) => (
            <form key={key.id} action={revokeKeyAction} className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium">{key.name}</p>
                <p className="text-muted-foreground">
                  amalfi_{key.keyPrefix}_… · {key.scopes.join(", ")}
                  {key.revokedAt ? " · revoked" : ""}
                </p>
              </div>
              <input type="hidden" name="id" value={key.id} />
              {key.revokedAt ? null : (
                <Button type="submit" variant="secondary" size="sm">
                  Revoke
                </Button>
              )}
            </form>
          ))}
        </CardContent>
      </Card>
      <ApiKeyForm />
    </div>
  );
}
