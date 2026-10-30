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
      <h1 className="text-3xl font-semibold tracking-tight">Galleries</h1>
      <p className="text-sm text-muted-foreground">Previews are watermark-free. Full downloads follow the invoice.</p>
      <div className="space-y-3 text-sm">
        {galleries.length === 0 ? <p className="text-muted-foreground">No published galleries yet.</p> : null}
        {galleries.map((gallery) => (
          <Link key={gallery.id} className="block font-medium text-primary" href={`/portal/galleries/${gallery.id}`}>
            {gallery.title}
          </Link>
        ))}
      </div>
    </div>
  );
}
