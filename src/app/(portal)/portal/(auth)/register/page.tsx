import { RegisterForm } from "@/components/forms/auth-forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-surface px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create a client account</CardTitle>
          <p className="text-sm text-muted-foreground">New accounts are clients. Staff accounts are issued by Amalfi.</p>
        </CardHeader>
        <CardContent>
          <RegisterForm />
        </CardContent>
      </Card>
    </main>
  );
}
