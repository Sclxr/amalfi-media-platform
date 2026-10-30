import { ForgotPasswordForm } from "@/components/forms/auth-forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Reset password" };

export default function AdminForgotPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-surface px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Reset your password</CardTitle>
        </CardHeader>
        <CardContent>
          <ForgotPasswordForm loginHref="/admin/login" />
        </CardContent>
      </Card>
    </main>
  );
}
