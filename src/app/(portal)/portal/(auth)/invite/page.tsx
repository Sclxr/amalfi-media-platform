import Link from "next/link";
import { PortalOtpForm } from "@/components/forms/portal-otp-form";
import { ThemeToggle } from "@/components/shell/theme-toggle";
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
    <main className="relative grid min-h-screen place-items-center bg-surface px-4 py-12">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
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
              <p className="text-muted-foreground">Enter the email on this listing. The code signs you in and uses this link once.</p>
              <PortalOtpForm next={next} invite={token} email={invite.clientEmail} note={null} />
              <Link className="block text-primary" href={`/portal/register?${query}`}>
                Create an account
              </Link>
            </>
          ) : (
            <p>This invite link is invalid or expired. Ask Amalfi Media for a new one.</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
