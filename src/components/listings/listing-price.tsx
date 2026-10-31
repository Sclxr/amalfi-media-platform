import { setListingPriceAction } from "@/app/(admin)/admin/(app)/listings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCents } from "@/lib/money";

const selectClass = "h-10 w-full rounded-sm border border-border bg-background px-3 text-sm";

export function ListingPrice({
  propertyId,
  orderId,
  orderNumber,
  packages,
}: {
  propertyId: string;
  orderId: string;
  orderNumber: number;
  packages: { id: string; name: string; priceCents: number }[];
}) {
  const action = setListingPriceAction.bind(null, propertyId);
  return (
    <div className="space-y-4 rounded-md border border-border p-4">
      <div>
        <p className="font-medium">Set a price</p>
        <p className="text-muted-foreground">Use a package, a custom amount, or line items. Saving replaces the current price.</p>
      </div>
      {packages.length > 0 ? (
        <form action={action} className="grid gap-2">
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="mode" value="package" />
          <label className="grid gap-1">
            Package
            <select name="packageId" required aria-label={`Package for order ${orderNumber}`} className={selectClass} defaultValue={packages[0]?.id}>
              {packages.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · {formatCents(item.priceCents)}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" variant="secondary" size="sm" className="w-fit">
            Use package
          </Button>
        </form>
      ) : (
        <p className="text-muted-foreground">No active packages. Set a custom price or line items.</p>
      )}
      <form action={action} className="grid gap-2 sm:grid-cols-[1fr_8rem_auto] sm:items-end">
        <input type="hidden" name="orderId" value={orderId} />
        <input type="hidden" name="mode" value="custom" />
        <label className="grid gap-1">
          Description
          <Input name="label" aria-label={`Custom description for order ${orderNumber}`} defaultValue="Photography" />
        </label>
        <label className="grid gap-1">
          Amount
          <Input name="amount" inputMode="decimal" placeholder="120.00" aria-label={`Custom price for order ${orderNumber}`} />
        </label>
        <Button type="submit" variant="secondary" size="sm">
          Save custom price
        </Button>
      </form>
      <form action={action} className="grid gap-2">
        <input type="hidden" name="orderId" value={orderId} />
        <input type="hidden" name="mode" value="lines" />
        <p>Line items</p>
        {[1, 2, 3].map((row) => (
          <div key={row} className="grid gap-2 sm:grid-cols-[1fr_5rem_8rem]">
            <Input name="lineLabel" aria-label={`Line ${row} description for order ${orderNumber}`} placeholder="Description" />
            <Input name="lineQty" aria-label={`Line ${row} quantity for order ${orderNumber}`} placeholder="Qty" inputMode="numeric" />
            <Input name="lineAmount" aria-label={`Line ${row} amount for order ${orderNumber}`} placeholder="0.00" inputMode="decimal" />
          </div>
        ))}
        <Button type="submit" variant="secondary" size="sm" className="w-fit">
          Save line items
        </Button>
      </form>
    </div>
  );
}
