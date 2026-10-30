import Link from "next/link";
import { BrokerageForm } from "@/components/forms/record-form";
import { Card, CardContent } from "@/components/ui/card";
import { createBrokerageAction } from "@/app/(admin)/admin/(app)/crm/actions";

export const metadata = { title: "Add brokerage" };

export default function NewBrokeragePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link className="text-sm text-primary" href="/admin/crm/brokerages">
        Back to brokerages
      </Link>
      <h1 className="text-3xl font-semibold tracking-tight">Add brokerage</h1>
      <Card>
        <CardContent className="pt-5">
          <BrokerageForm action={createBrokerageAction} submitLabel="Create brokerage" />
        </CardContent>
      </Card>
    </div>
  );
}
