import { notFound, redirect } from "next/navigation";
import { AdminShell } from "@/components/shell/admin-shell";
import { toShellUser } from "@/lib/actor";
import { getActor } from "@/server/auth/guards";

export const dynamic = "force-dynamic";

export default async function AdminAppLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActor();
  if (!actor) redirect("/admin/login");
  if (actor.role === "CLIENT") notFound();
  return <AdminShell user={toShellUser(actor)}>{children}</AdminShell>;
}
