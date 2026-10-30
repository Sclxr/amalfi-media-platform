import Link from "next/link";
import { redirect } from "next/navigation";
import { createGalleryAction } from "@/app/(admin)/admin/(app)/billing/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/data/status-badge";
import { getActor } from "@/server/auth/guards";
import { listGalleries } from "@/server/services/galleries";
import { listOrders } from "@/server/services/orders";
import { getEnv } from "@/server/env";

export const metadata = { title: "Media" };

export default async function MediaPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const actor = await getActor();
  if (!actor) redirect("/admin/login");
  const query = await searchParams;
  const [galleries, orders] = await Promise.all([listGalleries(actor), listOrders(actor)]);
  const media = Boolean(getEnv().MEDIA_ROOT);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Media</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Uploads use a signed link into local storage. Previews are the original file with no watermark. Downloads wait for payment unless the client is trusted.
        </p>
        {media ? null : <p className="mt-2 text-sm">Media storage is not configured.</p>}
      </div>
      {query.notice ? <p className="text-sm">{query.notice}</p> : null}
      <div className="space-y-3 text-sm">
        {galleries.map((gallery) => (
          <div key={gallery.id} className="flex flex-wrap items-center justify-between gap-3">
            <Link className="font-medium text-primary" href={`/admin/media/${gallery.id}`}>
              {gallery.title}
            </Link>
            <StatusBadge status={gallery.status} />
          </div>
        ))}
      </div>
      <form action={createGalleryAction} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <label className="text-sm">
          Order
          <select name="orderId" className="mt-1 h-10 w-full rounded-sm border border-border bg-background px-3" required>
            {orders.map((order) => (
              <option key={order.id} value={order.id}>
                {order.status} · {order.property.addressLine1}
              </option>
            ))}
          </select>
        </label>
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input id="title" name="title" required />
        </div>
        <Button className="self-end" type="submit">
          Create gallery
        </Button>
      </form>
    </div>
  );
}
