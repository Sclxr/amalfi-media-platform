import { RegisterForm } from "@/components/forms/auth-forms";
import { portalNext } from "@/lib/invite";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Create account" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string; invite?: string }> }) {
  const params = await searchParams;
  const next = params.next ? portalNext(params.next, "/portal") : "/portal";
  const invite = params.invite?.trim() || undefined;
  return (
    <main className="grid min-h-screen place-items-center bg-surface px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create a client account</CardTitle>
          <p className="text-sm text-muted-foreground">New accounts are clients. Staff accounts are issued by Amalfi.</p>
        </CardHeader>
        <CardContent>
          <RegisterForm next={next} invite={invite} />
        </CardContent>
      </Card>
    </main>
  );
}
