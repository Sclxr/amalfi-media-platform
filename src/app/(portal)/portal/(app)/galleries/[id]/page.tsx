import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getActor } from "@/server/auth/guards";
import { clientGallery, downloadDecisionFor } from "@/server/services/galleries";

export const metadata = { title: "Gallery" };

export default async function PortalGalleryPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  if (!actor?.clientId) redirect("/portal/login");
  const { id } = await params;
  const gallery = await clientGallery(actor.clientId, id);
  if (!gallery) notFound();
  const decision = downloadDecisionFor(gallery);
  return (
    <div className="space-y-6">
      <Link className="text-sm text-primary" href="/portal/galleries">
        Galleries
      </Link>
      <h1 className="text-3xl font-semibold tracking-tight">{gallery.title}</h1>
      <p className="text-sm text-muted-foreground">{gallery.property.addressLine1}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {gallery.assets.map((asset) => (
          <figure key={asset.id} className="space-y-2">
            {/* Authenticated original bytes. next/image would re-process the file. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/portal/galleries/${gallery.id}/preview/${asset.id}`}
              alt={asset.fileName}
              className="max-h-64 w-full rounded-md border border-border object-contain"
            />
            <figcaption className="text-xs text-muted-foreground">{asset.fileName}</figcaption>
          </figure>
        ))}
      </div>
      {decision.allowed ? (
        <div className="flex gap-4 text-sm">
          <a className="text-primary" href={`/portal/galleries/${gallery.id}/download`}>
            Download
          </a>
          <a className="text-primary" href={`/portal/galleries/${gallery.id}/zip`}>
            Download zip
          </a>
        </div>
      ) : (
        <p className="text-sm">Payment required before download.</p>
      )}
    </div>
  );
}
