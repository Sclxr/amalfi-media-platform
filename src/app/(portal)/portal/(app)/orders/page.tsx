import { EmptyState } from "@/components/data/empty-state";

export const metadata = { title: "Orders" };
export default function PortalOrdersPage() {
  return <EmptyState title="Order details come next" body="Your dashboard already lists the orders that belong to you." />;
}
