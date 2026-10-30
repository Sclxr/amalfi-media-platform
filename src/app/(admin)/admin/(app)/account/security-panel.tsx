"use client";

import Image from "next/image";
import { useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export function SecurityPanel({ enabled }: { enabled: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [uri, setUri] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [done, setDone] = useState(enabled);

  async function enable(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const password = String(new FormData(event.currentTarget).get("password") ?? "");
    const result = await authClient.twoFactor.enable({ password, method: "totp" });
    if (result.error || !result.data) {
      setError(result.error?.message ?? "Could not start two-factor setup.");
      return;
    }
    if (result.data.method !== "totp") return;
    setUri(result.data.totpURI);
    setCodes(result.data.backupCodes);
    setQr(await QRCode.toDataURL(result.data.totpURI));
  }

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code") ?? "");
    const result = await authClient.twoFactor.verifyTotp({ code });
    if (result.error) {
      setError(result.error.message ?? "That code was not accepted.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return <p className="text-sm">Two-factor authentication is on for this account.</p>;
  }

  return (
    <div className="space-y-6">
      {!uri ? (
        <form onSubmit={enable} className="max-w-sm space-y-3">
          <Label htmlFor="password">Confirm your password to turn on an authenticator app</Label>
          <Input id="password" name="password" type="password" required />
          <Button type="submit">Start setup</Button>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-4">
          {qr ? <Image src={qr} alt="Authenticator QR code" width={180} height={180} unoptimized /> : null}
          <p className="break-all text-xs text-muted-foreground">{uri}</p>
          <div>
            <p className="text-sm font-medium">Backup codes</p>
            <ul className="mt-2 grid gap-1 text-sm tabular-nums">
              {codes.map((code) => (
                <li key={code}>{code}</li>
              ))}
            </ul>
          </div>
          <Label htmlFor="code">Code from the app</Label>
          <Input id="code" name="code" inputMode="numeric" required />
          <Button type="submit">Verify and enable</Button>
        </form>
      )}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
