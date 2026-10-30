import { notFound, redirect } from "next/navigation";
import { AreaEditor, PackageEditor, ServiceEditor } from "@/components/forms/catalog-forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { can } from "@/lib/permissions";
import { updateAreaAction, updatePackageAction, updateServiceAction } from "@/app/(admin)/admin/(app)/crm/actions";
import { getActor } from "@/server/auth/guards";
import { getCatalog } from "@/server/services/catalog";

export const metadata = { title: "Catalog" };

export default async function CatalogPage() {
  const actor = await getActor();
  if (!actor) redirect("/admin/login");
  if (!can(actor, "settings.manage")) notFound();
  const catalog = await getCatalog();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Catalog</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          The introductory photography package is $120. Other packages, add-ons, and travel fees stay configurable here. Prices that are still undecided are hidden until you set them.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Packages</CardTitle>
        </CardHeader>
        <CardContent>
          {catalog.packages.map((item) => (
            <PackageEditor key={item.id} action={updatePackageAction} item={item} />
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Add-ons</CardTitle>
        </CardHeader>
        <CardContent>
          {catalog.services.map((item) => (
            <ServiceEditor key={item.id} action={updateServiceAction} item={item} />
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Travel zones</CardTitle>
        </CardHeader>
        <CardContent>
          {catalog.areas.map((item) => (
            <AreaEditor key={item.id} action={updateAreaAction} item={item} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
