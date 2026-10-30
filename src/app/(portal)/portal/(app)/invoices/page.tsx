import { EmptyState } from "@/components/data/empty-state";

export const metadata = { title: "Invoices" };
export default function InvoicesPage() {
  return <EmptyState title="Invoices come with checkout" body="Card payments will use Stripe. Staging only accepts Stripe test keys." />;
}
