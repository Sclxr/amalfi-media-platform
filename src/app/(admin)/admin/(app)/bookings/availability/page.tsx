import Link from "next/link";
import { redirect } from "next/navigation";
import { addBlackoutAction, addRuleAction } from "@/app/(admin)/admin/(app)/orders/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getActor } from "@/server/auth/guards";
import { listAvailability } from "@/server/services/scheduling";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function minutes(value: number) {
  const hour = Math.floor(value / 60);
  const minute = value % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export const metadata = { title: "Availability" };

export default async function AvailabilityPage() {
  const actor = await getActor();
  if (!actor) redirect("/admin/login");
  const { rules, blackouts } = await listAvailability(actor);
  return (
    <div className="space-y-6">
      <Link className="text-sm text-primary" href="/admin/bookings">
        Bookings
      </Link>
      <h1 className="text-3xl font-semibold tracking-tight">Availability</h1>
      <Card>
        <CardHeader>
          <CardTitle>Working hours</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {rules.map((rule) => (
            <p key={rule.id}>
              {DAYS[rule.weekday]} {minutes(rule.startMin)}–{minutes(rule.endMin)}
            </p>
          ))}
          <form action={addRuleAction} className="grid gap-3 md:grid-cols-4">
            <label className="text-sm">
              Weekday
              <select name="weekday" className="mt-1 h-10 w-full rounded-sm border border-border bg-background px-3" defaultValue="1">
                {DAYS.map((day, index) => (
                  <option key={day} value={index}>
                    {day}
                  </option>
                ))}
              </select>
            </label>
            <div className="space-y-2">
              <Label htmlFor="start">Start</Label>
              <Input id="start" name="start" type="time" defaultValue="09:00" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end">End</Label>
              <Input id="end" name="end" type="time" defaultValue="17:00" required />
            </div>
            <Button className="self-end" type="submit" variant="secondary">
              Add hours
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Blackout dates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {blackouts.length === 0 ? <p className="text-muted-foreground">No blackout dates.</p> : null}
          {blackouts.map((blackout) => (
            <p key={blackout.id}>
              {blackout.date.toISOString().slice(0, 10)} {blackout.reason ? `· ${blackout.reason}` : ""}
            </p>
          ))}
          <form action={addBlackoutAction} className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input id="date" name="date" type="date" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <Input id="reason" name="reason" placeholder="Holiday" />
            </div>
            <Button type="submit" variant="secondary">
              Add blackout
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
