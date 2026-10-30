import { LoginForm } from "@/components/forms/auth-forms";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Admin sign in" };

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = params.next?.startsWith("/admin") ? params.next : "/admin";
  return (
    <main className="relative grid min-h-screen place-items-center bg-surface px-4 py-12">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <p className="text-sm font-medium text-primary">Amalfi Media</p>
          <CardTitle className="text-2xl">Admin sign in</CardTitle>
          <p className="text-sm text-muted-foreground">Orlando and Central Florida operations.</p>
        </CardHeader>
        <CardContent>
          <LoginForm next={next} />
        </CardContent>
      </Card>
    </main>
  );
}
