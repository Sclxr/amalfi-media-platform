import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { readInvite } from "@/server/services/invites";

export const metadata = { title: "Gallery invite" };
export const dynamic = "force-dynamic";

export default async function InvitePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const params = await searchParams;
  const token = params.token?.trim() ?? "";
  const invite = token ? await readInvite(token) : null;
  const next = invite?.next ?? "/portal/galleries";
  const query = new URLSearchParams({ next, invite: token });
  return (
    <main className="grid min-h-screen place-items-center bg-surface px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <p className="text-sm font-medium text-primary">Amalfi Media</p>
          <CardTitle className="text-2xl">Gallery invite</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {invite ? (
            <>
              <p>
                {invite.clientName} can open <span className="font-medium">{invite.address}</span>.
              </p>
              <p className="text-muted-foreground">Create an account or sign in with the email on this listing. The link works once.</p>
              <div className="flex flex-col gap-2">
                <Link className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground" href={`/portal/register?${query}`}>
                  Create an account
                </Link>
                <Link className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-surface px-4 text-sm font-medium" href={`/portal/login?${query}`}>
                  Sign in
                </Link>
              </div>
            </>
          ) : (
            <p>This invite link is invalid or expired. Ask Amalfi Media for a new one.</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
