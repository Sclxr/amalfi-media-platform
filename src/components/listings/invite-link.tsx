"use client";

import { useState, useTransition } from "react";
import { createListingInviteAction, sendListingInviteAction } from "@/app/(admin)/admin/(app)/listings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function InviteLink({ propertyId, copyOnly = false }: { propertyId: string; copyOnly?: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function create() {
    setError(null);
    setStatus(null);
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

  function send() {
    setError(null);
    setStatus(null);
    startTransition(async () => {
      const result = await sendListingInviteAction(propertyId);
      setStatus(result.notice);
    });
  }

  async function copy() {
    if (copyOnly && !url) {
      createAndCopy();
      return;
    }
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
  }

  function createAndCopy() {
    setError(null);
    startTransition(async () => {
      const result = await createListingInviteAction(propertyId);
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      if ("url" in result && result.url) {
        setUrl(result.url);
        await navigator.clipboard.writeText(result.url);
        setCopied(true);
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={copyOnly ? copy : create} disabled={pending}>
          {pending ? "Working…" : copyOnly ? (copied ? "Copied" : "Copy invite link") : "Create invite link"}
        </Button>
        {copyOnly ? null : (
          <Button type="button" variant="secondary" size="sm" onClick={send} disabled={pending}>
            {pending ? "Working…" : "Send invite by email"}
          </Button>
        )}
      </div>
      {status ? <p>{status}</p> : null}
      {url ? (
        <div className="space-y-2">
          <label className="grid gap-1 text-sm">
            Invite link
            <Input readOnly value={url} aria-label="Invite link" className="font-mono text-xs" />
          </label>
          <Button type="button" variant="secondary" size="sm" onClick={copy}>
            {copied ? "Copied" : "Copy invite link"}
          </Button>
          <p className="text-muted-foreground">This link works once and expires in 7 days. A new link replaces the previous one.</p>
        </div>
      ) : null}
      {error ? <p className="text-destructive">{error}</p> : null}
    </div>
  );
}
