import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BrokerageForm } from "@/components/forms/record-form";
import { Card, CardContent } from "@/components/ui/card";
import { updateBrokerageAction } from "@/app/(admin)/admin/(app)/crm/actions";
import { getActor } from "@/server/auth/guards";
import { getBrokerage } from "@/server/services/brokerages";

export const metadata = { title: "Edit brokerage" };

export default async function EditBrokeragePage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  if (!actor) redirect("/admin/login");
  const { id } = await params;
  const brokerage = await getBrokerage(actor, id);
  if (!brokerage) notFound();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link className="text-sm text-primary" href={`/admin/crm/brokerages/${brokerage.id}`}>
        Back to {brokerage.name}
      </Link>
      <h1 className="text-3xl font-semibold tracking-tight">Edit brokerage</h1>
      <Card>
        <CardContent className="pt-5">
          <BrokerageForm
            action={updateBrokerageAction.bind(null, brokerage.id)}
            submitLabel="Save brokerage"
            defaults={{
              name: brokerage.name,
              phone: brokerage.phone ?? "",
              website: brokerage.website ?? "",
              address: brokerage.address ?? "",
              city: brokerage.city ?? "",
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
