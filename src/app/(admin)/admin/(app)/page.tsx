import Link from "next/link";
import { Camera } from "lucide-react";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/money";
import { getActor } from "@/server/auth/guards";
import { getToday } from "@/server/services/today";

export const metadata = { title: "Today" };

function greeting(now: Date) {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hourCycle: "h23" }).format(now),
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function easternDate(now: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(now);
}

function shootWhen(when: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(when);
}

function Thumb({ src }: { src: string | null }) {
  if (!src) {
    return (
      <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-accent text-muted-foreground" aria-hidden>
        <Camera className="size-5" strokeWidth={1.5} />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
  );
}

function Address({ children }: { children: string }) {
  return <span className="line-clamp-2 font-medium leading-5 [overflow-wrap:anywhere]">{children}</span>;
}

export default async function TodayPage() {
  const actor = await getActor();
  if (!actor) redirect("/admin/login");
  const now = new Date();
  const today = await getToday(actor, now);
  const first = actor.name.split(" ")[0] || actor.name;
  return (
    <div data-testid="overview" className="min-w-0 space-y-8">
      <div>
        <p className="text-sm font-medium tracking-wide text-gold">{greeting(now)}</p>
        <h1 className="mt-1 text-[2rem] font-semibold leading-none tracking-tight sm:text-4xl">Today</h1>
        <p className="mt-3 text-base text-muted-foreground">
          {easternDate(now)} · {first}
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild className="border border-[#d4bc8c] bg-[#111111] text-[#d4bc8c] hover:bg-[#1c1c1c]">
          <Link href={today.newShootHref}>New shoot</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href={today.sendQuoteHref}>Send quote</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href={today.uploadHref}>Upload photos</Link>
        </Button>
      </div>
      <div className="grid min-w-0 items-start gap-4 xl:grid-cols-3">
        <section
          className={`min-w-0 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow)] sm:p-5 ${today.shoots.length === 0 ? "xl:self-start" : ""}`}
          aria-labelledby="upcoming-shoots"
        >
          <h2 id="upcoming-shoots" className="text-lg font-semibold tracking-tight">Upcoming shoots</h2>
          {today.shoots.length === 0 ? (
            <div className="mt-3">
              <p className="text-sm leading-6 text-muted-foreground">Nothing on the calendar yet.</p>
              <Link href={today.newShootHref} className="mt-2 inline-flex min-h-12 items-center text-sm font-medium text-gold">
                New shoot
              </Link>
            </div>
          ) : (
            <div className="mt-2">
              {today.shoots.map((shoot) => (
                <Link key={shoot.id} href={shoot.href} className="flex min-w-0 items-center gap-3 border-t border-border py-3 first:border-t-0">
                  <Thumb src={shoot.imageSrc} />
                  <span className="min-w-0 flex-1">
                    <Address>{`${shootWhen(shoot.when)} · ${shoot.address}`}</Address>
                    <span className="mt-0.5 block truncate text-sm text-muted-foreground">{shoot.who} · {shoot.detail}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
        <section className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow)] sm:p-5" aria-labelledby="unpaid">
          <h2 id="unpaid" className="text-lg font-semibold tracking-tight">Unpaid</h2>
          {!today.showMoney ? (
            <p className="mt-3 text-sm leading-6 text-muted-foreground">Invoice amounts stay with the admin account.</p>
          ) : today.unpaid.length === 0 ? (
            <p className="mt-3 text-sm leading-6 text-muted-foreground">Nothing unpaid. Paid work stays off this list.</p>
          ) : (
            <div className="mt-2">
              {today.unpaid.map((row) => (
                <Link key={row.id} href={row.href} className="flex min-w-0 items-center gap-3 border-t border-border py-3 first:border-t-0">
                  <Thumb src={row.imageSrc} />
                  <span className="min-w-0 flex-1">
                    <Address>{row.address}</Address>
                    <span className="mt-0.5 block text-sm text-muted-foreground">Open invoice</span>
                  </span>
                  <span className="shrink-0 whitespace-nowrap tabular-nums text-base font-semibold text-gold">{formatCents(row.amountCents)}</span>
                </Link>
              ))}
            </div>
          )}
        </section>
        <section className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow)] sm:p-5" aria-labelledby="galleries-to-send">
          <h2 id="galleries-to-send" className="text-lg font-semibold tracking-tight">Galleries to send</h2>
          {today.galleries.length === 0 ? (
            <p className="mt-3 text-sm leading-6 text-muted-foreground">Every gallery with photos has already been sent.</p>
          ) : (
            <div className="mt-2">
              {today.galleries.map((gallery) => (
                <Link key={gallery.id} href={gallery.href} className="flex min-w-0 items-center gap-3 border-t border-border py-3 first:border-t-0">
                  <Thumb src={gallery.imageSrc} />
                  <span className="min-w-0 flex-1">
                    <Address>{gallery.address}</Address>
                    <span className="mt-0.5 block text-sm text-muted-foreground">{gallery.detail}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
