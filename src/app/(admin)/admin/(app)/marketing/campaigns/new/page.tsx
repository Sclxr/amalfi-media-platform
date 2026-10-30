import Link from "next/link";
import { redirect } from "next/navigation";
import { CampaignForm } from "@/components/forms/campaign-form";
import { getActor } from "@/server/auth/guards";

export const metadata = { title: "New campaign" };

export default async function NewCampaignPage() {
  const actor = await getActor();
  if (!actor) redirect("/admin/login");
  return (
    <div className="space-y-6">
      <Link className="text-sm text-primary" href="/admin/marketing">
        Marketing
      </Link>
      <h1 className="text-3xl font-semibold tracking-tight">New campaign</h1>
      <p className="max-w-2xl text-sm text-muted-foreground">
        Drafts include the Orlando postal address and an unsubscribe link when you preview them. They are not sent from this screen.
      </p>
      <CampaignForm />
    </div>
  );
}
