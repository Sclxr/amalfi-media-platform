import { notFound, redirect } from "next/navigation";
import { trustedAction } from "@/app/(admin)/admin/(app)/billing/actions";
import { ArchiveView } from "@/components/removal/archive-view";
import { BulkBar, RecordMenu } from "@/components/removal/record-menu";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/permissions";
import { clientRemoval } from "@/lib/removal";
import { getActor } from "@/server/auth/guards";
import { listClients } from "@/server/services/galleries";

export const metadata = { title: "Clients" };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ view?: string; notice?: string }> }) {
  const actor = await getActor();
  if (!actor) redirect("/admin/login");
  if (!can(actor, "settings.manage")) notFound();
  const params = await searchParams;
  const clients = await listClients(actor, params.view);
  const returnTo = params.view === "archived" ? "/admin/clients?view=archived" : "/admin/clients";
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Clients</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Trusted clients may download before an invoice is paid. Everyone else is blocked on the server.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <ArchiveView href="/admin/clients" view={params.view} />
        {can(actor, "crm.write") ? <BulkBar kind="client" returnTo={returnTo} canArchive /> : null}
      </div>
      {params.notice ? <p className="text-sm">{params.notice}</p> : null}
      <div className="space-y-3">
        {clients.map((client) => (
          <div key={client.id} className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <label className="text-xs">
              <input type="checkbox" data-bulk="client" value={client.id} aria-label={`Select ${client.firstName} ${client.lastName}`} />
            </label>
            <RecordMenu
              kind="client"
              id={client.id}
              name={`${client.firstName} ${client.lastName}`}
              archived={Boolean(client.archivedAt)}
              canArchive={can(actor, "crm.write")}
              canPermanent={can(actor, "records.delete")}
              deletable={clientRemoval(client._count).canDelete}
              returnTo={returnTo}
            />
            <form action={trustedAction} className="flex flex-1 flex-wrap items-center justify-between gap-3">
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
          </div>
        ))}
      </div>
    </div>
  );
}
