"use client";

import { useState, useTransition } from "react";
import { createListingInviteAction } from "@/app/(admin)/admin/(app)/listings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function InviteLink({ propertyId }: { propertyId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  function create() {
    setError(null);
    setCopied(false);
    startTransition(async () => {
      const result = await createListingInviteAction(propertyId);
      if ("error" in result && result.error) {
        setUrl(null);
        setError(result.error);
        return;
      }
      if ("url" in result && result.url) setUrl(result.url);
    });
  }

  async function copy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="secondary" size="sm" onClick={create} disabled={pending}>
        {pending ? "Creating link…" : "Create invite link"}
      </Button>
      {url ? (
        <div className="space-y-2">
          <label className="grid gap-1 text-sm">
            Invite link
            <Input readOnly value={url} aria-label="Invite link" className="font-mono text-xs" />
          </label>
          <Button type="button" variant="secondary" size="sm" onClick={copy}>
            {copied ? "Copied" : "Copy invite link"}
          </Button>
          <p className="text-muted-foreground">This link works once and expires in 7 days. A new link replaces the previous one. Email is not sent yet.</p>
        </div>
      ) : null}
      {error ? <p className="text-destructive">{error}</p> : null}
    </div>
  );
}
