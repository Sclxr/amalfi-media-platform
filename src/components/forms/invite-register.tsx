"use client";

import { useState } from "react";
import { RegisterForm } from "@/components/forms/auth-forms";
import { PortalOtpForm } from "@/components/forms/portal-otp-form";

export function InviteRegister({ next, invite }: { next: string; invite: string }) {
  const [password, setPassword] = useState(false);
  if (password) {
    return (
      <div className="space-y-4">
        <RegisterForm next={next} invite={invite} />
        <button type="button" className="text-sm text-primary" onClick={() => setPassword(false)}>
          Email me a code instead
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <PortalOtpForm next={next} invite={invite} />
      <button type="button" className="text-sm text-primary" onClick={() => setPassword(true)}>
        Create a password instead
      </button>
    </div>
  );
}
