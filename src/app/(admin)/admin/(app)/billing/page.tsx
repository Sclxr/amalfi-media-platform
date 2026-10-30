import { LaterPage } from "@/components/data/later-page";

export const metadata = { title: "Billing" };
export default function BillingPage() {
  return <LaterPage title="Billing" body="Stripe stays in test mode on staging. Invoices and refunds are modeled, and refunds stay admin-only." />;
}
