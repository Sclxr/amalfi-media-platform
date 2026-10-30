import { EmptyState } from "@/components/data/empty-state";

export const metadata = { title: "Galleries" };
export default function GalleriesPage() {
  return <EmptyState title="Galleries are locked until delivery" body="Full-size downloads wait for payment unless Amalfi has marked your account as trusted." />;
}
