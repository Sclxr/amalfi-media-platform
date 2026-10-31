"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { getActor } from "@/server/auth/guards";
import { prisma } from "@/server/db/prisma";
import { createInvoiceForOrder, startCheckout } from "@/server/services/billing";
import { createGallery, publishGallery, registerUpload, setTrustedDownloads } from "@/server/services/galleries";

async function actorOr(path: string) {
  const actor = await getActor();
  if (!actor) redirect(path);
  return actor;
}

export async function createInvoiceAction(formData: FormData) {
  const actor = await actorOr("/admin/login");
  const result = await createInvoiceForOrder(actor, String(formData.get("orderId") ?? ""));
  if ("error" in result && result.error) redirect(`/admin/billing?notice=${encodeURIComponent(result.error)}`);
  if ("id" in result) redirect(`/admin/billing/${result.id}`);
}

export async function checkoutAction(invoiceId: string) {
  const actor = await actorOr("/portal/login");
  try {
    const result = await startCheckout(actor, invoiceId);
    if ("url" in result && result.url) redirect(result.url);
    const message = "error" in result ? result.error : "Stripe is not configured.";
    redirect(`/portal/invoices/${invoiceId}?notice=${encodeURIComponent(message ?? "Stripe is not configured.")}`);
  } catch (error) {
    unstable_rethrow(error);
    redirect(`/portal/invoices/${invoiceId}?notice=${encodeURIComponent("Checkout did not start.")}`);
  }
}

export async function createGalleryAction(formData: FormData) {
  const actor = await actorOr("/admin/login");
  const result = await createGallery(actor, {
    orderId: String(formData.get("orderId") ?? ""),
    title: String(formData.get("title") ?? ""),
  });
  if ("error" in result && result.error) redirect(`/admin/listings?notice=${encodeURIComponent(result.error)}`);
  if ("id" in result) {
    const gallery = await prisma.gallery.findUnique({ where: { id: result.id }, select: { propertyId: true } });
    redirect(gallery ? `/admin/listings/${gallery.propertyId}?photos=${Date.now()}#photos` : "/admin/listings");
  }
}

export async function registerUploadAction(galleryId: string, formData: FormData) {
  const actor = await actorOr("/admin/login");
  await registerUpload(actor, galleryId, {
    key: String(formData.get("key") ?? ""),
    fileName: String(formData.get("fileName") ?? "upload"),
    mimeType: String(formData.get("mimeType") ?? "application/octet-stream"),
    sizeBytes: Number(formData.get("size") ?? 0),
  });
  const gallery = await prisma.gallery.findUnique({ where: { id: galleryId }, select: { propertyId: true } });
  redirect(gallery ? `/admin/listings/${gallery.propertyId}?photos=${Date.now()}#photos` : "/admin/listings");
}

export async function publishGalleryAction(formData: FormData) {
  const actor = await actorOr("/admin/login");
  const id = String(formData.get("id") ?? "");
  await publishGallery(actor, id);
  const gallery = await prisma.gallery.findUnique({ where: { id }, select: { propertyId: true } });
  redirect(gallery ? `/admin/listings/${gallery.propertyId}?photos=${Date.now()}#photos` : "/admin/listings");
}

export async function trustedAction(formData: FormData) {
  const actor = await actorOr("/admin/login");
  await setTrustedDownloads(actor, String(formData.get("clientId") ?? ""), formData.get("allow") === "on");
  redirect("/admin/clients");
}
