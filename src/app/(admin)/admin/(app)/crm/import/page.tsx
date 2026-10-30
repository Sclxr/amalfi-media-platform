import Link from "next/link";
import { redirect } from "next/navigation";
import { ImportWizard } from "@/components/forms/import-wizard";
import { Button } from "@/components/ui/button";
import { getActor } from "@/server/auth/guards";
import { can } from "@/lib/permissions";

export const metadata = { title: "Import realtors" };

export default async function ImportPage() {
  const actor = await getActor();
  if (!actor) redirect("/admin/login");
  if (!can(actor, "crm.write")) redirect("/admin/crm/leads");
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
    </div>
  );
}
