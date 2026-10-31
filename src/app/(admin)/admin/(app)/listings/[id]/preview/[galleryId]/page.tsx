import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { downloadDecisionFor, getGalleryForStaff } from "@/server/services/galleries";
import { getActor } from "@/server/auth/guards";

export const metadata = { title: "Client preview" };

export default async function ListingClientPreviewPage({ params }: { params: Promise<{ id: string; galleryId: string }> }) {
  const actor = await getActor();
  if (!actor) redirect("/admin/login");
  const { id, galleryId } = await params;
  const gallery = await getGalleryForStaff(actor, galleryId);
  if (!gallery || gallery.propertyId !== id) notFound();
  const published = gallery.status === "PUBLISHED";
  const decision = published ? downloadDecisionFor(gallery) : null;
  const photos = gallery.assets.filter((asset) => asset.kind === "PHOTO" && asset.status === "READY");
  return (
    <div className="space-y-6">
      <Link className="text-sm text-primary" href={`/admin/listings/${id}?tab=gallery`}>
        Back to listing
      </Link>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{gallery.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{gallery.property.addressLine1}</p>
      </div>
      {published ? null : <p className="rounded-md border border-border px-4 py-3 text-sm">Not visible to the client yet.</p>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {photos.map((asset) => (
          <figure key={asset.id} className="space-y-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/admin/listings/${id}/photos/${asset.id}`} alt={asset.fileName} className="aspect-[4/3] w-full rounded-md border border-border object-cover" />
            <figcaption className="text-xs text-muted-foreground">{asset.fileName}</figcaption>
          </figure>
        ))}
      </div>
      {published && decision?.allowed ? <p className="text-sm">The client can download these photos.</p> : null}
      {published && decision && !decision.allowed ? <p className="text-sm">Payment required before download.</p> : null}
    </div>
  );
}
