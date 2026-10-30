import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { publishGalleryAction } from "@/app/(admin)/admin/(app)/billing/actions";
import { GalleryUpload } from "@/components/forms/gallery-upload";
import { Button } from "@/components/ui/button";
import { getActor } from "@/server/auth/guards";
import { getGalleryForStaff } from "@/server/services/galleries";

export const metadata = { title: "Gallery" };

export default async function GalleryAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  if (!actor) redirect("/admin/login");
  const { id } = await params;
  const gallery = await getGalleryForStaff(actor, id);
  if (!gallery) notFound();
  return (
    <div className="space-y-6">
      <Link className="text-sm text-primary" href="/admin/media">
        Media
      </Link>
      <h1 className="text-3xl font-semibold tracking-tight">{gallery.title}</h1>
      <p className="text-sm text-muted-foreground">
        {gallery.status} · {gallery.property.addressLine1} · previews are watermark-free
      </p>
      <ul className="space-y-1 text-sm">
        {gallery.assets.map((asset) => (
          <li key={asset.id}>{asset.fileName}</li>
        ))}
      </ul>
      <GalleryUpload galleryId={gallery.id} />
      {gallery.status !== "PUBLISHED" ? (
        <form action={publishGalleryAction}>
          <input type="hidden" name="id" value={gallery.id} />
          <Button type="submit">Publish</Button>
        </form>
      ) : (
        <p className="text-sm">Published for the client.</p>
      )}
    </div>
  );
}
