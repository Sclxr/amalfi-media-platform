"use server";

import { redirect } from "next/navigation";
import { shootFieldErrors, shootFormSchema } from "@/schemas/shoot";
import { getActor } from "@/server/auth/guards";
import { bookShoot } from "@/server/services/shoots";

export type ShootFormState = {
  errors: Record<string, string>;
  values: Record<string, string>;
};

function valuesFrom(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") values[key] = value;
  }
  return values;
}

export async function bookShootAction(_prev: ShootFormState, formData: FormData): Promise<ShootFormState> {
  const actor = await getActor();
  if (!actor) redirect("/admin/login");
  const values = valuesFrom(formData);
  const parsed = shootFormSchema.safeParse(values);
  if (!parsed.success) return { errors: shootFieldErrors(parsed.error), values };
  const result = await bookShoot(actor, parsed.data);
  if ("error" in result) {
    return { errors: { [result.field ?? "form"]: result.error }, values };
  }
  const reused = result.reusedRealtor ? "&reused=1" : "";
  redirect(`/admin/listings/${result.propertyId}?booked=1${reused}`);
}
