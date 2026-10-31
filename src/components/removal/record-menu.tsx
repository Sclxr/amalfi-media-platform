"use client";

import { useState, useTransition } from "react";
import { archiveRecordAction, bulkArchiveAction, deleteRecordAction, previewRemovalAction, restoreRecordAction } from "@/app/(admin)/admin/(app)/removal/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/dialog";

export function RecordMenu({
  kind,
  id,
  name,
  archived,
  canArchive,
  canPermanent,
  deletable,
  returnTo,
  label,
}: {
  kind: string;
  id: string;
  name: string;
  archived: boolean;
  canArchive: boolean;
  canPermanent: boolean;
  deletable: boolean;
  returnTo: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const [blocked, setBlocked] = useState<string | null>(null);
  const archive = archived ? restoreRecordAction : archiveRecordAction;

  async function openDelete() {
    setOpen(false);
    const preview = await previewRemovalAction(kind, id);
    if ("error" in preview && preview.error) {
      setBlocked(preview.error);
      setLines([]);
    } else if ("decision" in preview) {
      setBlocked(preview.decision.reason);
      setLines(preview.decision.lines);
    }
    setDeleteOpen(true);
  }

  if (!canArchive && !canPermanent) return null;
  return (
    <div className="relative">
      <Button type="button" variant="secondary" size="sm" aria-haspopup="menu" aria-expanded={open} aria-label={label ?? `Actions for ${name}`} onClick={() => setOpen((value) => !value)}>
        Actions
      </Button>
      {open ? (
        <div role="menu" className="absolute right-0 z-30 mt-1 w-52 rounded-md border border-border bg-card p-1 text-sm shadow-lg">
          {canArchive ? (
            <form action={archive}>
              <input type="hidden" name="kind" value={kind} />
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <button type="submit" role="menuitem" className="block w-full rounded-sm px-3 py-2 text-left hover:bg-accent">
                {archived ? "Restore" : "Archive"}
              </button>
            </form>
          ) : null}
          {canPermanent && deletable ? (
            <button type="button" role="menuitem" className="block w-full rounded-sm px-3 py-2 text-left text-destructive hover:bg-accent" onClick={() => void openDelete()}>
              Delete permanently
            </button>
          ) : null}
        </div>
      ) : null}
      <Modal title={`Delete ${name}`} description="This cannot be undone." open={deleteOpen} onOpenChange={setDeleteOpen}>
        {blocked ? <p className="text-sm">{blocked}</p> : null}
        {lines.length > 0 ? (
          <ul className="mb-3 list-disc pl-5 text-sm text-muted-foreground">
            {lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
        {blocked ? null : (
          <form action={deleteRecordAction} className="grid gap-3">
            <input type="hidden" name="kind" value={kind} />
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <input type="hidden" name="expected" value={name} />
            <label className="text-sm">
              Type {name} to confirm
              <Input name="confirm" aria-label="Type the name to confirm" className="mt-1" autoComplete="off" />
            </label>
            <Button type="submit" variant="destructive">
              Delete permanently
            </Button>
          </form>
        )}
      </Modal>
    </div>
  );
}

export function BulkBar({ kind, returnTo, canArchive }: { kind: string; returnTo: string; canArchive: boolean }) {
  const [, startTransition] = useTransition();
  if (!canArchive) return null;
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={() => {
        const ids = [...document.querySelectorAll<HTMLInputElement>(`input[data-bulk="${kind}"]:checked`)].map((box) => box.value);
        const data = new FormData();
        data.set("kind", kind);
        data.set("returnTo", returnTo);
        for (const id of ids) data.append("recordId", id);
        startTransition(() => {
          void bulkArchiveAction(data);
        });
      }}
    >
      Archive selected
    </Button>
  );
}
