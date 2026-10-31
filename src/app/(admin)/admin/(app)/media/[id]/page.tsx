import { notFound, redirect } from "next/navigation";
import { prisma } from "@/server/db/prisma";

export default async function GalleryAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gallery = await prisma.gallery.findUnique({ where: { id }, select: { propertyId: true } });
  if (!gallery) notFound();
  redirect(`/admin/listings/${gallery.propertyId}?photos=1#photos`);
}
