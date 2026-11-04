import { PortalOtpForm } from "@/components/forms/portal-otp-form";
import { portalNext } from "@/lib/invite";
import { PortalAuthShell } from "@/components/shell/portal-auth-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Client sign in" };

export default async function PortalLoginPage({ searchParams }: { searchParams: Promise<{ next?: string; invite?: string }> }) {
  const params = await searchParams;
  const next = params.next ? portalNext(params.next, "/portal") : "/portal";
  const invite = params.invite?.trim() || undefined;
  const registerQuery = new URLSearchParams({ next });
  if (invite) registerQuery.set("invite", invite);
  return (
    <PortalAuthShell testId="portal-login">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-[1.75rem] leading-tight">Client portal</CardTitle>
          <p className="text-base text-muted-foreground">Orders, galleries, and invoices for your listings.</p>
        </CardHeader>
        <CardContent>
          <PortalOtpForm next={next} invite={invite} registerHref={`/portal/register?${registerQuery}`} />
        </CardContent>
      </Card>
    </PortalAuthShell>
  );
}
