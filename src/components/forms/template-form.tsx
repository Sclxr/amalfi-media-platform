"use client";

import { useActionState } from "react";
import { saveTemplateAction, type MarketingState } from "@/app/(admin)/admin/(app)/marketing/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function TemplateForm() {
  const [state, action, pending] = useActionState(saveTemplateAction, {} satisfies MarketingState);
  return (
    <form action={action} className="grid gap-4">
      <div className="space-y-2">
        <Label htmlFor="key">Template key</Label>
        <Input id="key" name="key" required placeholder="intro-photo" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="subject">Subject</Label>
        <Input id="subject" name="subject" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="body">Body</Label>
        <Textarea id="body" name="body" required />
      </div>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" disabled={pending}>
        Save template
      </Button>
    </form>
  );
}
