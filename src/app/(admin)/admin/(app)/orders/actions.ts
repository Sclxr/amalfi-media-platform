"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { getActor } from "@/server/auth/guards";
import { addAvailabilityRule, addBlackout } from "@/server/services/scheduling";
import { changeOrderStatus, requestBooking, setQuotePrices } from "@/server/services/orders";

async function actorOr(path: string) {
  const actor = await getActor();
  if (!actor) redirect(path);
  return actor;
}

export type BookingState = { error?: string };

export async function requestBookingAction(_prev: BookingState, formData: FormData): Promise<BookingState> {
  const actor = await actorOr("/portal/login");
  try {
    const result = await requestBooking(actor, {
      addressLine1: String(formData.get("addressLine1") ?? ""),
      city: String(formData.get("city") ?? ""),
      zip: String(formData.get("zip") ?? ""),
      propertyType: String(formData.get("propertyType") ?? "SINGLE_FAMILY"),
      packageId: String(formData.get("packageId") ?? ""),
      addOnIds: formData.getAll("addOnIds").map(String),
      preferredDate: String(formData.get("preferredDate") ?? ""),
      instructions: String(formData.get("instructions") ?? ""),
    });
    if ("error" in result && result.error) return { error: result.error };
    if (!("id" in result)) return { error: "Could not request the booking." };
    redirect(`/portal/orders/${result.id}`);
  } catch (error) {
    unstable_rethrow(error);
    return { error: error instanceof Error ? error.message : "Could not request the booking." };
  }
}

export async function quoteOrderAction(orderId: string, formData: FormData) {
  const actor = await actorOr("/admin/login");
  const prices: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("price:")) prices[key.slice("price:".length)] = String(value);
  }
  const result = await setQuotePrices(actor, orderId, prices);
  if ("error" in result && result.error) redirect(`/admin/orders/${orderId}?notice=${encodeURIComponent(result.error)}`);
  redirect(`/admin/orders/${orderId}`);
}

export async function statusOrderAction(orderId: string, formData: FormData) {
  const actor = await actorOr("/admin/login");
  const result = await changeOrderStatus(
    actor,
    orderId,
    String(formData.get("status") ?? ""),
    String(formData.get("note") ?? ""),
    String(formData.get("startLocal") ?? ""),
  );
  const notice = "error" in result && result.error ? result.error : "";
  redirect(`/admin/orders/${orderId}${notice ? `?notice=${encodeURIComponent(notice)}` : ""}`);
}

export async function addRuleAction(formData: FormData) {
  const actor = await actorOr("/admin/login");
  const [startHour, startMinute] = String(formData.get("start") ?? "09:00").split(":").map(Number);
  const [endHour, endMinute] = String(formData.get("end") ?? "17:00").split(":").map(Number);
  await addAvailabilityRule(actor, {
    weekday: Number(formData.get("weekday")),
    startMin: startHour * 60 + startMinute,
    endMin: endHour * 60 + endMinute,
  });
  redirect("/admin/bookings/availability");
}

export async function addBlackoutAction(formData: FormData) {
  const actor = await actorOr("/admin/login");
  await addBlackout(actor, { date: String(formData.get("date") ?? ""), reason: String(formData.get("reason") ?? "") });
  redirect("/admin/bookings/availability");
}
