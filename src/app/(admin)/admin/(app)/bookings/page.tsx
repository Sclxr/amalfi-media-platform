import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/dates";
import { getActor } from "@/server/auth/guards";
import { listCalendar } from "@/server/services/scheduling";

export const metadata = { title: "Bookings" };

export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ view?: string; date?: string }> }) {
  const actor = await getActor();
  if (!actor) redirect("/admin/login");
  const query = await searchParams;
  const view = query.view === "day" || query.view === "month" ? query.view : "week";
  const anchor = query.date && /^\d{4}-\d{2}-\d{2}$/.test(query.date) ? new Date(`${query.date}T15:00:00.000Z`) : new Date();
  const { range, bookings } = await listCalendar(actor, view, anchor);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Bookings</h1>
          <p className="mt-2 text-muted-foreground">{range.label} · Orlando time</p>
        </div>
        <div className="flex gap-3 text-sm">
          <Link className="text-primary" href="/admin/bookings?view=day">
            Day
          </Link>
          <Link className="text-primary" href="/admin/bookings?view=week">
            Week
          </Link>
          <Link className="text-primary" href="/admin/bookings?view=month">
            Month
          </Link>
          <Link className="text-primary" href="/admin/bookings/availability">
            Availability
          </Link>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{view[0]?.toUpperCase()}{view.slice(1)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {bookings.length === 0 ? <p className="text-muted-foreground">Nothing on the calendar in this range.</p> : null}
          {bookings.map((booking) => (
            <div key={booking.id} className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Link className="font-medium text-primary" href={`/admin/orders/${booking.orderId}`}>
                  {booking.order.property.addressLine1}
                </Link>
                <p className="text-muted-foreground">
                  {booking.startAt ? formatDateTime(booking.startAt) : "Preferred date, not scheduled"} · {booking.order.client.firstName} {booking.order.client.lastName}
                </p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
