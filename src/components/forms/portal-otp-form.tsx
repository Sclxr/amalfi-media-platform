"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { claimListingInviteAction, preparePortalSignInCode } from "@/app/(portal)/portal/(auth)/invite/actions";
import { LoginForm } from "@/components/forms/auth-forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

function codeError(message: string | undefined) {
  if (!message) return "That code was not accepted.";
  if (/expired/i.test(message)) return "That code has expired. Send a new one.";
  if (/too many/i.test(message)) return "Too many attempts. Send a new code.";
  if (/invalid otp/i.test(message)) return "That code is not valid.";
  return message;
}

export function PortalOtpForm({
  next,
  invite,
  email: initialEmail,
  registerHref,
  note = "We email a 6-digit code. This form does not open a new client.",
}: {
  next: string;
  invite?: string;
  email?: string;
  registerHref?: string;
  note?: string | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"email" | "code" | "password">("email");
  const [email, setEmail] = useState(initialEmail ?? "");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function sendCode() {
    setError(null);
    setPending(true);
    const prepared = await preparePortalSignInCode({ email, invite });
    if ("error" in prepared && prepared.error) {
      setPending(false);
      setError(prepared.error);
      return;
    }
    const sent = await authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" });
    setPending(false);
    if (sent.error) {
      setError(sent.error.message ?? "Could not send a code.");
      return;
    }
    setMode("code");
  }

  async function submitCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const result = await authClient.signIn.emailOtp({ email, otp: code.trim() });
    if (result.error) {
      setPending(false);
      setError(codeError(result.error.message));
      return;
    }
    if (invite) {
      const claimed = await claimListingInviteAction({ token: invite });
      if ("error" in claimed && claimed.error) {
        setPending(false);
        setError(claimed.error);
        return;
      }
      const destination = "next" in claimed && claimed.next?.startsWith("/portal/") ? claimed.next : next;
      router.push(destination);
      router.refresh();
      return;
    }
    setPending(false);
    router.push(next);
    router.refresh();
  }

  if (mode === "password") {
    return (
      <div className="space-y-4">
        <LoginForm next={next} invite={invite} registerHref={registerHref} />
        <button type="button" className="text-sm text-primary" onClick={() => { setError(null); setMode("email"); }}>
          Email me a code instead
        </button>
      </div>
    );
  }

  if (mode === "code") {
    return (
      <form onSubmit={submitCode} className="space-y-4" data-testid="portal-otp-code">
        <p className="text-sm text-muted-foreground">
          Enter the 6-digit code sent to <span className="font-medium text-foreground">{email}</span>. It expires in 10 minutes.
        </p>
        <div className="space-y-2">
          <Label htmlFor="code">Sign-in code</Label>
          <Input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            required
            autoFocus
          />
        </div>
        {error ? (
          <p className="text-sm text-destructive" role="alert" data-testid="portal-otp-error">
            {error}
          </p>
        ) : null}
        <Button className="w-full" type="submit" disabled={pending || code.length !== 6}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
        <div className="flex justify-between text-sm">
          <button type="button" className="text-primary" disabled={pending} onClick={() => void sendCode()}>
            Resend code
          </button>
          <button type="button" className="text-primary" onClick={() => { setError(null); setMode("password"); }}>
            Use password instead
          </button>
        </div>
      </form>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void sendCode();
      }}
      className="space-y-4"
      data-testid="portal-otp-email"
    >
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>
      {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert" data-testid="portal-otp-error">
          {error}
        </p>
      ) : null}
      <Button className="w-full" type="submit" disabled={pending}>
        {pending ? "Sending…" : "Email me a code"}
      </Button>
      <div className="flex justify-between text-sm">
        <button type="button" className="text-primary" onClick={() => { setError(null); setMode("password"); }}>
          Use password instead
        </button>
        {registerHref ? (
          <Link className="text-primary" href={registerHref}>
            Create an account
          </Link>
        ) : null}
      </div>
    </form>
  );
}
