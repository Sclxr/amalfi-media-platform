"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { getActor } from "@/server/auth/guards";
import { createListing, updateListingAddress } from "@/server/services/listings";
import {
  deleteGalleryPhoto,
  ensureListingUploadGallery,
  moveGalleryPhoto,
  publishGallery,
  registerUpload,
  unpublishGallery,
} from "@/server/services/galleries";

async function actorOrLogin() {
  const actor = await getActor();
  if (!actor) redirect("/admin/login");
  return actor;
}

export type ListingState = { error?: string };

export async function createListingAction(_prev: ListingState, formData: FormData): Promise<ListingState> {
  const actor = await actorOrLogin();
  try {
    const result = await createListing(actor, {
      leadId: String(formData.get("leadId") ?? ""),
      addressLine1: String(formData.get("addressLine1") ?? ""),
      city: String(formData.get("city") ?? ""),
      zip: String(formData.get("zip") ?? ""),
      propertyType: String(formData.get("propertyType") ?? "SINGLE_FAMILY"),
      email: String(formData.get("email") ?? ""),
    });
    if ("error" in result && result.error) return { error: result.error };
    if (!("id" in result)) return { error: "Could not create the listing." };
    redirect(`/admin/listings/${result.id}`);
  } catch (error) {
    unstable_rethrow(error);
    return { error: error instanceof Error ? error.message : "Could not create the listing." };
  }
}

export async function updateListingAction(id: string, formData: FormData) {
  const actor = await actorOrLogin();
  const result = await updateListingAddress(actor, id, {
    addressLine1: String(formData.get("addressLine1") ?? ""),
    city: String(formData.get("city") ?? ""),
    zip: String(formData.get("zip") ?? ""),
  });
  if ("error" in result && result.error) redirect(`/admin/listings/${id}?notice=${encodeURIComponent(result.error)}`);
  redirect(`/admin/listings/${id}`);
}

function photosPath(propertyId: string) {
  return `/admin/listings/${propertyId}?photos=${Date.now()}#photos`;
}

export async function uploadListingPhotoAction(propertyId: string, formData: FormData) {
  const actor = await actorOrLogin();
  const ensured = await ensureListingUploadGallery(actor, propertyId);
  if ("error" in ensured && ensured.error) {
    redirect(`/admin/listings/${propertyId}?notice=${encodeURIComponent(ensured.error)}#photos`);
  }
  if (!("id" in ensured)) redirect(photosPath(propertyId));
  await registerUpload(actor, ensured.id, {
    key: String(formData.get("key") ?? ""),
    fileName: String(formData.get("fileName") ?? "upload"),
    mimeType: String(formData.get("mimeType") ?? "application/octet-stream"),
    sizeBytes: Number(formData.get("size") ?? 0),
  });
  redirect(photosPath(propertyId));
}

export async function publishListingGalleryAction(formData: FormData) {
  const actor = await actorOrLogin();
  const propertyId = String(formData.get("propertyId") ?? "");
  const galleryId = String(formData.get("galleryId") ?? "");
  if (formData.get("mode") === "unpublish") await unpublishGallery(actor, galleryId);
  else await publishGallery(actor, galleryId);
  redirect(photosPath(propertyId));
}

export async function deleteListingPhotoAction(formData: FormData) {
  const actor = await actorOrLogin();
  const propertyId = String(formData.get("propertyId") ?? "");
  await deleteGalleryPhoto(actor, propertyId, String(formData.get("assetId") ?? ""));
  redirect(photosPath(propertyId));
}

export async function moveListingPhotoAction(formData: FormData) {
  const actor = await actorOrLogin();
  const propertyId = String(formData.get("propertyId") ?? "");
  const direction = formData.get("direction") === "earlier" ? "earlier" : "later";
  await moveGalleryPhoto(actor, propertyId, String(formData.get("assetId") ?? ""), direction);
  redirect(photosPath(propertyId));
}
