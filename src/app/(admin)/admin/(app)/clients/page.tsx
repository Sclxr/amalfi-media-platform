import { notFound, redirect } from "next/navigation";
import { trustedAction } from "@/app/(admin)/admin/(app)/billing/actions";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/permissions";
import { getActor } from "@/server/auth/guards";
import { listClients } from "@/server/services/galleries";

export const metadata = { title: "Clients" };

export default async function ClientsPage() {
  const actor = await getActor();
  if (!actor) redirect("/admin/login");
  if (!can(actor, "settings.manage")) notFound();
  const clients = await listClients(actor);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Clients</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Trusted clients may download before an invoice is paid. Everyone else is blocked on the server.
        </p>
      </div>
      <div className="space-y-3">
        {clients.map((client) => (
          <form key={client.id} action={trustedAction} className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <div>
              <p className="font-medium">
                {client.firstName} {client.lastName}
              </p>
              <p className="text-muted-foreground">{client.email}</p>
            </div>
            <input type="hidden" name="clientId" value={client.id} />
            <label className="flex items-center gap-2">
              <input type="checkbox" name="allow" defaultChecked={client.allowUnpaidDownloads} />
              Allow unpaid downloads
            </label>
            <Button type="submit" variant="secondary" size="sm">
              Save
            </Button>
          </form>
        ))}
      </div>
    </div>
  );
}
