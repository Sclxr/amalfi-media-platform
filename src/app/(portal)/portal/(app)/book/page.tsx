import { EmptyState } from "@/components/data/empty-state";

export const metadata = { title: "Book a shoot" };
export default function BookPage() {
  return <EmptyState title="Booking opens later" body="You will choose a package, add-ons, and a date here. The $120 introductory package is already in the catalog." />;
}
