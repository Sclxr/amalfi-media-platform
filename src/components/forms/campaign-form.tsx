"use client";

import { useActionState } from "react";
import { createCampaignAction, type MarketingState } from "@/app/(admin)/admin/(app)/marketing/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LEAD_STATUSES } from "@/schemas/lead";

export function CampaignForm() {
  const [state, action, pending] = useActionState(createCampaignAction, {} satisfies MarketingState);
  return (
    <form action={action} className="grid gap-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="subject">Subject</Label>
        <Input id="subject" name="subject" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="body">Body</Label>
        <Textarea id="body" name="body" required className="min-h-40" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <label className="space-y-2 text-sm">
          <span>Status segment</span>
          <select name="status" className="h-10 w-full rounded-sm border border-border bg-background px-3" defaultValue="">
            <option value="">Any contactable status</option>
            {LEAD_STATUSES.filter((status) => status !== "DO_NOT_CONTACT").map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input id="city" name="city" placeholder="Orlando" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tag">Tag</Label>
          <Input id="tag" name="tag" />
        </div>
      </div>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" disabled={pending}>
        Save draft
      </Button>
    </form>
  );
}
