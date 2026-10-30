import { redirect } from "next/navigation";
import { BookingRequestForm } from "@/components/forms/booking-request-form";
import { getActor } from "@/server/auth/guards";
import { getCatalog } from "@/server/services/catalog";

export const metadata = { title: "Book a shoot" };

export default async function BookPage() {
  const actor = await getActor();
  if (!actor) redirect("/portal/login");
  const catalog = await getCatalog();
  const packages = catalog.packages.filter((pkg) => pkg.active);
  const addOns = catalog.services.filter((service) => service.isAddOn && service.active);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Book a shoot</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          The introductory photography package is $120. Drone and video add-ons are quoted after the request. Travel fee follows the ZIP code service area.
        </p>
      </div>
      <BookingRequestForm
        packages={packages.map((pkg) => ({ id: pkg.id, name: pkg.name, priceCents: pkg.priceCents }))}
        addOns={addOns.map((service) => ({ id: service.id, name: service.name, pricingMode: service.pricingMode }))}
      />
    </div>
  );
}
