import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LeadForm } from "@/components/forms/record-form";
import { Card, CardContent } from "@/components/ui/card";
import { updateLeadAction } from "@/app/(admin)/admin/(app)/crm/actions";
import { toDateInputValue } from "@/lib/dates";
import { getActor } from "@/server/auth/guards";
import { listBrokerages } from "@/server/services/brokerages";
import { getLead } from "@/server/services/leads";
import { prisma } from "@/server/db/prisma";

export const metadata = { title: "Edit realtor" };

export default async function EditLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  if (!actor) redirect("/admin/login");
  const { id } = await params;
  const [lead, brokerages, sources] = await Promise.all([
    getLead(actor, id),
    listBrokerages(actor),
    prisma.leadSource.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!lead) notFound();
  const action = updateLeadAction.bind(null, lead.id);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link className="text-sm text-primary" href={`/admin/crm/leads/${lead.id}`}>
          Back to {lead.firstName}
        </Link>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Edit realtor</h1>
      </div>
      <Card>
        <CardContent className="pt-5">
          <LeadForm
            action={action}
            brokerages={brokerages}
            sources={sources}
            submitLabel="Save changes"
            defaults={{
              firstName: lead.firstName ?? "",
              lastName: lead.lastName ?? "",
              email: lead.email ?? "",
              phone: lead.phone ?? "",
              city: lead.city ?? "",
              status: lead.status,
              brokerageId: lead.brokerageId ?? "",
              sourceId: lead.sourceId ?? "",
              tags: lead.tags.join(", "),
              nextFollowUpAt: toDateInputValue(lead.nextFollowUpAt),
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
