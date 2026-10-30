import { redirect } from "next/navigation";
import { PortalShell } from "@/components/shell/portal-shell";
import { getActor } from "@/server/auth/guards";

export const dynamic = "force-dynamic";

export default async function PortalAppLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActor();
  if (!actor) redirect("/portal/login");
  if (actor.role !== "CLIENT") redirect("/admin");
  return <PortalShell name={actor.name}>{children}</PortalShell>;
}
