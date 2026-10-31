import Link from "next/link";
import { redirect } from "next/navigation";
import { ImportWizard } from "@/components/forms/import-wizard";
import { ArchiveView } from "@/components/removal/archive-view";
import { RecordMenu } from "@/components/removal/record-menu";
import { Button } from "@/components/ui/button";
import { getActor } from "@/server/auth/guards";
import { can } from "@/lib/permissions";
import { listImportBatches } from "@/server/services/import-leads";

export const metadata = { title: "Import realtors" };

export default async function ImportPage({ searchParams }: { searchParams: Promise<{ view?: string; notice?: string }> }) {
  const actor = await getActor();
  if (!actor) redirect("/admin/login");
  if (!can(actor, "crm.write")) redirect("/admin/crm/leads");
  const params = await searchParams;
  const batches = await listImportBatches(actor, params.view);
  const returnTo = params.view === "archived" ? "/admin/crm/import?view=archived" : "/admin/crm/import";
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Import realtors</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Map columns, preview duplicates on email and phone, then commit. Rows with errors stay out of the database.
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/admin/crm/leads">Back to realtors</Link>
        </Button>
      </div>
      <ImportWizard />
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold">Past imports</h2>
          <ArchiveView href="/admin/crm/import" view={params.view} />
        </div>
        {params.notice ? <p className="text-sm">{params.notice}</p> : null}
        {batches.length === 0 ? <p className="text-sm text-muted-foreground">No imports yet.</p> : null}
        {batches.map((batch) => (
          <div key={batch.id} className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <p>
              {batch.fileName} · {batch.createdRows} added
            </p>
            <RecordMenu
              kind="import"
              id={batch.id}
              name={batch.fileName}
              archived={Boolean(batch.archivedAt)}
              canArchive
              canPermanent={can(actor, "records.delete")}
              deletable
              returnTo={returnTo}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
