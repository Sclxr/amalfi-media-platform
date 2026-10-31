"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { getActor } from "@/server/auth/guards";
import { createInvoiceForOrder, voidUnpaidInvoice } from "@/server/services/billing";
import {
  archiveGallery,
  deleteGalleryPhoto,
  deliverListingGallery,
  movePhotosToGallery,
  prepareListingGallery,
  publishGallery,
  registerUpload,
  reorderGalleryPhotos,
  replaceGalleryPhoto,
  emailPropertyInvite,
  unpublishGallery,
  updateGalleryDetails,
} from "@/server/services/galleries";
import { createListingInvite } from "@/server/services/invites";
import { createListing, setListingCover, updateListing } from "@/server/services/listings";
import { changeOrderStatus, rescheduleBooking, setOrderPrice, setQuotePrices } from "@/server/services/orders";

async function actorOrLogin() {
  const actor = await getActor();
  if (!actor) redirect("/admin/login");
  return actor;
}

function listingPath(propertyId: string, tab: string, shoot?: string) {
  const params = new URLSearchParams({ tab, photos: String(Date.now()) });
  if (shoot) params.set("shoot", shoot);
  return `/admin/listings/${propertyId}?${params.toString()}`;
}

function withNotice(path: string, notice?: string) {
  if (!notice) return path;
  const join = path.includes("?") ? "&" : "?";
  return `${path}${join}notice=${encodeURIComponent(notice)}`;
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
  const result = await updateListing(actor, id, {
    leadId: String(formData.get("leadId") ?? ""),
    addressLine1: String(formData.get("addressLine1") ?? ""),
    addressLine2: String(formData.get("addressLine2") ?? ""),
    city: String(formData.get("city") ?? ""),
    state: String(formData.get("state") ?? ""),
    zip: String(formData.get("zip") ?? ""),
    propertyType: String(formData.get("propertyType") ?? ""),
    sqft: String(formData.get("sqft") ?? ""),
    beds: String(formData.get("beds") ?? ""),
    bathsHalf: String(formData.get("bathsHalf") ?? ""),
    accessNotes: String(formData.get("accessNotes") ?? ""),
  });
  const notice = "error" in result && result.error ? result.error : "";
  redirect(withNotice(`/admin/listings/${id}?tab=overview`, notice));
}

export async function prepareListingGalleryAction(
  propertyId: string,
  input: { orderId?: string; createOrder?: boolean },
): Promise<{ id?: string; error?: string; needsOrder?: boolean }> {
  const actor = await actorOrLogin();
  try {
    const result = await prepareListingGallery(actor, propertyId, input);
    if ("needsOrder" in result && result.needsOrder) return { error: result.error, needsOrder: true };
    if ("error" in result && result.error) return { error: result.error };
    if (!("id" in result)) return { error: "Could not prepare the gallery." };
    return { id: result.id };
  } catch (error) {
    unstable_rethrow(error);
    return { error: error instanceof Error ? error.message : "Could not prepare the gallery." };
  }
}

export async function saveListingPhotoAction(
  galleryId: string,
  input: { key: string; fileName: string; mimeType: string; size: number },
): Promise<{ error?: string }> {
  const actor = await actorOrLogin();
  try {
    const result = await registerUpload(actor, galleryId, {
      key: input.key,
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.size,
    });
    if ("error" in result && result.error) return { error: result.error };
    return {};
  } catch (error) {
    unstable_rethrow(error);
    return { error: "The photo could not be saved. Try again." };
  }
}

export async function replaceListingPhotoAction(
  propertyId: string,
  assetId: string,
  input: { key: string; fileName: string; mimeType: string; size: number },
): Promise<{ error?: string }> {
  const actor = await actorOrLogin();
  try {
    const result = await replaceGalleryPhoto(actor, propertyId, assetId, {
      key: input.key,
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.size,
    });
    if ("error" in result && result.error) return { error: result.error };
    return {};
  } catch (error) {
    unstable_rethrow(error);
    return { error: "The photo could not be replaced. Try again." };
  }
}

export async function reorderListingPhotosAction(propertyId: string, galleryId: string, orderedIds: string[]) {
  const actor = await actorOrLogin();
  const result = await reorderGalleryPhotos(actor, propertyId, galleryId, orderedIds);
  const notice = "error" in result && result.error ? result.error : "";
  redirect(withNotice(listingPath(propertyId, "gallery"), notice));
}

export async function publishListingGalleryAction(formData: FormData) {
  const actor = await actorOrLogin();
  const propertyId = String(formData.get("propertyId") ?? "");
  const galleryId = String(formData.get("galleryId") ?? "");
  if (formData.get("mode") === "unpublish") {
    await unpublishGallery(actor, galleryId);
    redirect(listingPath(propertyId, "gallery"));
  }
  if (formData.get("mode") === "archive") {
    await archiveGallery(actor, galleryId);
    redirect(listingPath(propertyId, "gallery"));
  }
  const result = await publishGallery(actor, galleryId);
  redirect(withNotice(listingPath(propertyId, "gallery"), result.notice));
}

export async function deleteListingPhotosAction(propertyId: string, assetIds: string[]) {
  const actor = await actorOrLogin();
  for (const assetId of assetIds) {
    await deleteGalleryPhoto(actor, propertyId, assetId);
  }
  redirect(listingPath(propertyId, "gallery"));
}

export async function moveListingPhotosAction(propertyId: string, assetIds: string[], targetGalleryId: string) {
  const actor = await actorOrLogin();
  const result = await movePhotosToGallery(actor, propertyId, assetIds, targetGalleryId);
  const notice = "error" in result && result.error ? result.error : "";
  redirect(withNotice(listingPath(propertyId, "gallery"), notice));
}

export async function setListingCoverAction(propertyId: string, assetId: string) {
  const actor = await actorOrLogin();
  const result = await setListingCover(actor, propertyId, assetId);
  const notice = "error" in result && result.error ? result.error : "";
  redirect(withNotice(listingPath(propertyId, "gallery"), notice));
}

export async function updateGalleryDetailsAction(propertyId: string, formData: FormData) {
  const actor = await actorOrLogin();
  const result = await updateGalleryDetails(actor, String(formData.get("galleryId") ?? ""), {
    title: String(formData.get("title") ?? ""),
    requirePaid: formData.get("requirePaid") === "on",
  });
  const notice = "error" in result && result.error ? result.error : "";
  redirect(withNotice(listingPath(propertyId, "gallery"), notice));
}

export async function deliverListingAction(propertyId: string, formData: FormData) {
  const actor = await actorOrLogin();
  const result = await deliverListingGallery(
    actor,
    propertyId,
    String(formData.get("galleryId") ?? ""),
    formData.get("markDelivered") === "on",
  );
  const notice =
    "error" in result && result.error
      ? result.error
      : "notice" in result && result.notice
        ? result.notice
        : "Published for the client.";
  redirect(withNotice(listingPath(propertyId, "gallery"), notice));
}

export async function listingStatusAction(propertyId: string, orderId: string, formData: FormData) {
  const actor = await actorOrLogin();
  const result = await changeOrderStatus(
    actor,
    orderId,
    String(formData.get("status") ?? ""),
    String(formData.get("note") ?? ""),
    String(formData.get("startLocal") ?? ""),
  );
  const notice = "error" in result && result.error ? result.error : "";
  redirect(withNotice(`/admin/listings/${propertyId}?tab=${formData.get("tab") === "bookings" ? "bookings" : "overview"}`, notice));
}

export async function rescheduleListingBookingAction(propertyId: string, formData: FormData) {
  const actor = await actorOrLogin();
  const result = await rescheduleBooking(actor, String(formData.get("bookingId") ?? ""), String(formData.get("startLocal") ?? ""));
  const notice = "error" in result && result.error ? result.error : "";
  redirect(withNotice(`/admin/listings/${propertyId}?tab=bookings`, notice));
}

export async function setListingPriceAction(propertyId: string, formData: FormData) {
  const actor = await actorOrLogin();
  const orderId = String(formData.get("orderId") ?? "");
  const mode = String(formData.get("mode") ?? "");
  const result =
    mode === "package"
      ? await setOrderPrice(actor, propertyId, orderId, { mode: "package", packageId: String(formData.get("packageId") ?? "") })
      : mode === "custom"
        ? await setOrderPrice(actor, propertyId, orderId, {
            mode: "custom",
            label: String(formData.get("label") ?? ""),
            amount: String(formData.get("amount") ?? ""),
          })
        : mode === "lines"
          ? await setOrderPrice(actor, propertyId, orderId, {
              mode: "lines",
              rows: formData.getAll("lineLabel").map((label, index) => ({
                label: String(label),
                quantity: String(formData.getAll("lineQty")[index] ?? ""),
                amount: String(formData.getAll("lineAmount")[index] ?? ""),
              })),
            })
          : { error: "Choose a package, a custom price, or line items." as const };
  const notice = "error" in result && result.error ? result.error : "Price saved.";
  redirect(withNotice(`/admin/listings/${propertyId}?tab=billing`, notice));
}

export async function listingQuoteAction(propertyId: string, orderId: string, formData: FormData) {
  const actor = await actorOrLogin();
  const prices: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("price:")) prices[key.slice("price:".length)] = String(value);
  }
  const result = await setQuotePrices(actor, orderId, prices);
  const notice = "error" in result && result.error ? result.error : "";
  redirect(withNotice(`/admin/listings/${propertyId}?tab=billing`, notice));
}

export async function createListingInvoiceAction(propertyId: string, formData: FormData) {
  const actor = await actorOrLogin();
  const result = await createInvoiceForOrder(actor, String(formData.get("orderId") ?? ""));
  if ("id" in result && result.id) redirect(`/admin/listings/${propertyId}?tab=billing`);
  const notice = "error" in result && result.error ? result.error : "Could not create the invoice.";
  redirect(withNotice(`/admin/listings/${propertyId}?tab=billing`, notice));
}

export async function voidListingInvoiceAction(propertyId: string, formData: FormData) {
  const actor = await actorOrLogin();
  const result = await voidUnpaidInvoice(actor, String(formData.get("invoiceId") ?? ""));
  const notice = "error" in result && result.error ? result.error : "Invoice voided.";
  redirect(withNotice(`/admin/listings/${propertyId}?tab=billing`, notice));
}

export async function sendListingInviteAction(propertyId: string) {
  const actor = await actorOrLogin();
  const result = await emailPropertyInvite(actor, propertyId);
  return { notice: result.notice };
}

export async function createListingInviteAction(propertyId: string) {
  const actor = await actorOrLogin();
  const result = await createListingInvite(actor, propertyId);
  if ("error" in result && result.error) return { error: result.error };
  if (!("url" in result)) return { error: "Could not create an invite link." };
  return { url: result.url };
}

export async function createListingOrderAction(propertyId: string) {
  const actor = await actorOrLogin();
  const result = await prepareListingGallery(actor, propertyId, { createOrder: true });
  const notice = "error" in result && result.error ? result.error : "";
  redirect(withNotice(listingPath(propertyId, "gallery"), notice));
}
