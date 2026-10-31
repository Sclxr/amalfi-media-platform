"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { getActor } from "@/server/auth/guards";
import { createListing, updateListingAddress } from "@/server/services/listings";

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
