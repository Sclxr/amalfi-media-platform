"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/data/empty-state";

function label(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function OverviewCharts({
  leads,
  orders,
}: {
  leads: { status: string; count: number }[];
  orders: { status: string; count: number }[];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title="Realtors by status" data={leads} empty="No realtors yet. Add the first one from CRM." />
      <ChartCard title="Orders" data={orders} empty="No orders yet. The pipeline will fill in as shoots are booked." />
    </div>
  );
}

function ChartCard({
  title,
  data,
  empty,
}: {
  title: string;
  data: { status: string; count: number }[];
  empty: string;
}) {
  const rows = data.map((row) => ({ name: label(row.status), count: row.count }));
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <div className="h-64 px-2 pb-4">
        {rows.length === 0 ? (
          <EmptyState title="Nothing to chart" body={empty} className="border-0 bg-transparent py-8" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} interval={0} angle={-20} height={50} />
              <YAxis allowDecimals={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} width={32} />
              <Tooltip
                cursor={{ fill: "var(--accent)" }}
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  color: "var(--foreground)",
                }}
              />
              <Bar dataKey="count" fill="var(--primary)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
