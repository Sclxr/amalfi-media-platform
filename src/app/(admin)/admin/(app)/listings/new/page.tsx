import Link from "next/link";
import { redirect } from "next/navigation";
import { ListingForm } from "@/components/forms/listing-form";
import { can } from "@/lib/permissions";
import { getActor } from "@/server/auth/guards";
import { prisma } from "@/server/db/prisma";
import { listRealtorOptions } from "@/server/services/listings";

export const metadata = { title: "New listing" };

export default async function NewListingPage({ searchParams }: { searchParams: Promise<{ leadId?: string }> }) {
  const actor = await getActor();
  if (!actor) redirect("/admin/login");
  if (!can(actor, "orders.write")) redirect("/admin/listings");
  const { leadId } = await searchParams;
  const lead = leadId
    ? await prisma.lead.findFirst({ where: { id: leadId, deletedAt: null }, select: { id: true, firstName: true, lastName: true, email: true } })
    : null;
  if (leadId && !lead) redirect("/admin/listings/new");
  const realtors = lead ? [] : await listRealtorOptions(actor);
  return (
    <div className="space-y-6">
      <Link className="text-sm text-primary" href={lead ? `/admin/crm/leads/${lead.id}?tab=listings` : "/admin/listings"}>
        {lead ? "Realtor listings" : "Listings"}
      </Link>
      <h1 className="text-3xl font-semibold tracking-tight">New listing</h1>
      <ListingForm
        leadId={lead?.id}
        realtorName={lead ? `${lead.firstName ?? ""} ${lead.lastName ?? ""}`.trim() : undefined}
        needsEmail={Boolean(lead && !lead.email)}
        realtors={realtors}
      />
    </div>
  );
}
