import { verifyStripeSignature } from "@/lib/stripe-billing";
import { applyCheckoutEvent } from "@/lib/stripe-webhook";
import { billingStatus } from "@/server/services/billing";
import { prismaCheckoutWriter } from "@/server/billing/checkout-writer";

export async function POST(request: Request) {
  const status = billingStatus();
  if (!status.configured) return Response.json({ error: "Stripe is not configured." }, { status: 503 });
  const payload = await request.text();
  const verified = verifyStripeSignature(payload, request.headers.get("stripe-signature"), status.webhookSecret);
  if (!verified.ok) return Response.json({ error: verified.reason }, { status: 400 });
  try {
    return Response.json(await applyCheckoutEvent(verified.event, prismaCheckoutWriter));
  } catch {
    return Response.json({ error: "Webhook processing failed. Stripe can retry." }, { status: 500 });
  }
}
