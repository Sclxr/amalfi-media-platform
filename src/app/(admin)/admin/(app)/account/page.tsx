import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SecurityPanel } from "@/app/(admin)/admin/(app)/account/security-panel";
import { getActor } from "@/server/auth/guards";
import { prisma } from "@/server/db/prisma";

export const metadata = { title: "Account" };

export default async function AccountPage() {
  const actor = await getActor();
  if (!actor) redirect("/admin/login");
  const user = await prisma.user.findUnique({ where: { id: actor.id } });
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Account</h1>
      <Card>
        <CardHeader>
          <CardTitle>{actor.name}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {actor.email} · {actor.role.toLowerCase()}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Two-factor authentication</CardTitle>
        </CardHeader>
        <CardContent>
          <SecurityPanel enabled={Boolean(user?.twoFactorEnabled)} />
        </CardContent>
      </Card>
    </div>
  );
}
