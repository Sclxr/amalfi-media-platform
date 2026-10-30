"use client";

import { useActionState } from "react";
import { issueKeyAction, type MarketingState } from "@/app/(admin)/admin/(app)/marketing/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ApiKeyForm() {
  const [state, action, pending] = useActionState(issueKeyAction, {} satisfies MarketingState);
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required placeholder="Marketing bot" />
      </div>
      <fieldset className="space-y-2 text-sm">
        <legend className="font-medium">Scopes</legend>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="leads:write" defaultChecked /> Create realtors
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="notes:write" defaultChecked /> Add notes
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="campaigns:draft" defaultChecked /> Draft campaigns
        </label>
      </fieldset>
      <p className="text-sm text-muted-foreground">Sending is not a scope. The bot cannot approve or send.</p>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.token ? (
        <p data-testid="issued-key" className="break-all rounded-md border border-border bg-accent px-3 py-2 font-mono text-xs">
          {state.token}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        Issue key
      </Button>
    </form>
  );
}
