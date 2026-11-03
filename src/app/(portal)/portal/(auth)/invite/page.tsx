import Link from "next/link";
import { PortalOtpForm } from "@/components/forms/portal-otp-form";
import { PortalAuthShell } from "@/components/shell/portal-auth-shell";
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
    <PortalAuthShell>
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-[1.75rem] leading-tight">Gallery invite</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-base">
          {invite ? (
            <>
              <p>
                {invite.clientName} can open <span className="font-medium">{invite.address}</span>.
              </p>
              <p className="text-muted-foreground">Enter the email on this listing. The code signs you in and uses this link once.</p>
              <PortalOtpForm next={next} invite={token} email={invite.clientEmail} note={null} />
              <Link className="inline-flex min-h-12 items-center text-primary" href={`/portal/register?${query}`}>
                Create an account
              </Link>
            </>
          ) : (
            <p>This invite link is invalid or expired. Ask Amalfi Media for a new one.</p>
          )}
        </CardContent>
      </Card>
    </PortalAuthShell>
  );
}
