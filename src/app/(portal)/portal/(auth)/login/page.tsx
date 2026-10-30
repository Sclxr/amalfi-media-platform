import { LoginForm } from "@/components/forms/auth-forms";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Client sign in" };

export default async function PortalLoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const params = await searchParams;
  const next = params.next?.startsWith("/portal") ? params.next : "/portal";
  return (
    <main className="relative grid min-h-screen place-items-center bg-surface px-4 py-12" data-testid="portal-login">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <p className="text-sm font-medium text-primary">Amalfi Media</p>
          <CardTitle className="text-2xl">Client portal</CardTitle>
          <p className="text-sm text-muted-foreground">Orders, galleries, and invoices for your listings.</p>
        </CardHeader>
        <CardContent>
          <LoginForm next={next} registerHref="/portal/register" />
        </CardContent>
      </Card>
    </main>
  );
}
