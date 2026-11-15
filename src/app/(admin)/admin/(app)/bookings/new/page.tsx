import Link from "next/link";
import { redirect } from "next/navigation";
import { ShootForm } from "@/components/shoots/shoot-form";
import { can } from "@/lib/permissions";
import { getActor } from "@/server/auth/guards";
import { shootFormOptions } from "@/server/services/shoots";

export const metadata = { title: "New shoot" };

export default async function NewShootPage() {
  const actor = await getActor();
  if (!actor) redirect("/admin/login");
  if (!can(actor, "orders.write")) redirect("/admin/bookings");
  const options = await shootFormOptions(actor);
  return (
    <div className="mx-auto min-w-0 max-w-3xl space-y-6">
      <div>
        <Link href="/admin/bookings" className="text-sm text-gold">
          Shoots
        </Link>
        <h1 className="mt-2 text-[2rem] font-semibold leading-none tracking-tight">New shoot</h1>
        <p className="mt-3 text-muted-foreground">One save books the realtor, the listing, the time, and a draft quote. Nothing is emailed.</p>
      </div>
      <ShootForm
        realtors={options.realtors}
        packages={options.packages}
        addOns={options.addOns}
        defaultStart={options.defaultStart}
      />
    </div>
  );
}
