import { ForgotPasswordForm } from "@/components/forms/auth-forms";
import { LegalLinks } from "@/components/legal/legal-links";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Forgot password" };

export default function PortalForgotPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-surface px-4">
      <div className="w-full max-w-md">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Reset your password</CardTitle>
        </CardHeader>
        <CardContent>
          <ForgotPasswordForm loginHref="/portal/login" />
        </CardContent>
      </Card>
      <LegalLinks className="mt-6 justify-center" />
      </div>
    </main>
  );
}
