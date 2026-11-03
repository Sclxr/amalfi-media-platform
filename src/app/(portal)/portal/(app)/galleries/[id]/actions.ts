"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { getActor } from "@/server/auth/guards";
import { chooseZellePayment, startCheckout } from "@/server/services/billing";
import { clientGallery } from "@/server/services/galleries";

export async function chooseZelleAction(galleryId: string) {
  const actor = await getActor();
  if (!actor?.clientId) redirect("/portal/login?next=/portal/galleries");
  const gallery = await clientGallery(actor.clientId, galleryId);
  const back = `/portal/galleries/${galleryId}`;
  if (!gallery) redirect("/portal/galleries");
  const result = await chooseZellePayment(actor, gallery.orderId);
  const notice = "error" in result && result.error ? result.error : "Awaiting Zelle";
  redirect(`${back}?zelle=1&notice=${encodeURIComponent(notice)}`);
}

export async function buyGalleryAction(galleryId: string) {
  const actor = await getActor();
  if (!actor?.clientId) redirect("/portal/login?next=/portal/galleries");
  const gallery = await clientGallery(actor.clientId, galleryId);
  if (!gallery) redirect("/portal/galleries");
  const invoice = gallery.order.invoices.find((item) => item.status === "OPEN");
  const back = `/portal/galleries/${gallery.id}`;
  if (!invoice) redirect(`${back}?notice=${encodeURIComponent("This gallery does not have an open invoice.")}`);
  try {
    const result = await startCheckout(actor, invoice.id, gallery.id);
    if ("url" in result && result.url) redirect(result.url);
    const message = "error" in result && result.error ? result.error : "Checkout did not start.";
    redirect(`${back}?notice=${encodeURIComponent(message)}`);
  } catch (error) {
    unstable_rethrow(error);
    redirect(`${back}?notice=${encodeURIComponent("Checkout did not start.")}`);
  }
}
