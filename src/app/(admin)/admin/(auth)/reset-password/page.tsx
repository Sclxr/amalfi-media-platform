import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/forms/auth-forms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Choose a new password" };

export default function AdminResetPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-surface px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Choose a new password</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense>
            <ResetPasswordForm loginHref="/admin/login" />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}
