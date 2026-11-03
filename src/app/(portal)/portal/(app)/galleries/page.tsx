import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor } from "@/server/auth/guards";
import { clientScope } from "@/server/db/scoped";

export const metadata = { title: "Galleries" };

export default async function GalleriesPage() {
  const actor = await getActor();
  if (!actor) redirect("/portal/login");
  const galleries = await clientScope(actor).galleries.list();
  return (
    <div className="space-y-6">
      <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight sm:text-4xl">Galleries</h1>
      <p className="text-base text-muted-foreground">Previews carry a watermark. Full downloads follow the invoice.</p>
      {galleries.length === 0 ? <p className="text-muted-foreground">No published galleries yet.</p> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        {galleries.map((gallery) => {
          const cover = gallery.assets[0];
          return (
            <Link key={gallery.id} className="block overflow-hidden rounded-2xl border border-border bg-card" href={`/portal/galleries/${gallery.id}`}>
              {cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/portal/galleries/${gallery.id}/preview/${cover.id}`} alt="" className="aspect-[4/3] w-full object-cover" />
              ) : (
                <div className="grid aspect-[4/3] place-items-center bg-accent text-sm text-muted-foreground">No preview</div>
              )}
              <div className="space-y-1 p-4">
                <p className="text-base font-semibold">{gallery.property.addressLine1}</p>
                {gallery.title !== gallery.property.addressLine1 ? <p className="text-sm text-muted-foreground">{gallery.title}</p> : null}
                <p className="text-sm text-muted-foreground">
                  {gallery.property.city}, {gallery.property.state}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
