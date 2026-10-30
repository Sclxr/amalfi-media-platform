import Link from "next/link";
import { LeadForm } from "@/components/forms/record-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createLeadAction } from "@/app/(admin)/admin/(app)/crm/actions";
import { getActor } from "@/server/auth/guards";
import { listBrokerages } from "@/server/services/brokerages";
import { prisma } from "@/server/db/prisma";
import { redirect } from "next/navigation";

export const metadata = { title: "Add realtor" };

export default async function NewLeadPage() {
  const actor = await getActor();
  if (!actor) redirect("/admin/login");
  const [brokerages, sources] = await Promise.all([
    listBrokerages(actor),
    prisma.leadSource.findMany({ orderBy: { name: "asc" } }),
  ]);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link className="text-sm text-primary" href="/admin/crm/leads">
          Back to realtors
        </Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Add realtor</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Contact</CardTitle>
        </CardHeader>
        <CardContent>
          <LeadForm
            action={createLeadAction}
            brokerages={brokerages}
            sources={sources}
            submitLabel="Create realtor"
          />
        </CardContent>
      </Card>
    </div>
  );
}
