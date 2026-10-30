"use client";

import { useActionState } from "react";
import { suppressAction, type MarketingState } from "@/app/(admin)/admin/(app)/marketing/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SuppressionForm() {
  const [state, action, pending] = useActionState(suppressAction, {} satisfies MarketingState);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <Button type="submit" disabled={pending}>
        Suppress
      </Button>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
    </form>
  );
}
