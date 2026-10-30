import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/forms/auth-forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "New password" };

export default function PortalResetPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-surface px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Choose a new password</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense>
            <ResetPasswordForm loginHref="/portal/login" />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}
