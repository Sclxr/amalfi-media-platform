import { ForgotPasswordForm } from "@/components/forms/auth-forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Forgot password" };

export default function PortalForgotPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-surface px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Reset your password</CardTitle>
        </CardHeader>
        <CardContent>
          <ForgotPasswordForm loginHref="/portal/login" />
        </CardContent>
      </Card>
    </main>
  );
}
