import { bookingIcs } from "@/lib/ics";
import { getActor } from "@/server/auth/guards";
import { prisma } from "@/server/db/prisma";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await getActor();
  if (!actor?.clientId) return new Response("Sign in required.", { status: 401 });
  const { id } = await context.params;
  const order = await prisma.order.findFirst({
    where: { id, clientId: actor.clientId },
    include: { property: true, bookings: true },
  });
  if (!order) return new Response("Not found.", { status: 404 });
  const booking = order.bookings[0];
  const body = bookingIcs({
    uid: order.id,
    summary: `Amalfi Media · ${order.property.addressLine1}`,
    description: "Amalfi Media shoot",
    start: booking?.startAt,
    end: booking?.endAt,
    allDay: order.preferredDate ? order.preferredDate.toISOString().slice(0, 10) : null,
  });
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="amalfi-${order.number}.ics"`,
    },
  });
}
