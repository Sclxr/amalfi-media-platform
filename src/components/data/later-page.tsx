import { EmptyState } from "@/components/data/empty-state";

export function LaterPage({ title, body }: { title: string; body: string }) {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <EmptyState title="Not in this milestone" body={body} />
    </div>
  );
}
