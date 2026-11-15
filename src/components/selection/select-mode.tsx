"use client";

import { createContext, useContext, useState, useTransition, type ReactNode } from "react";
import { bulkArchiveAction } from "@/app/(admin)/admin/(app)/removal/actions";
import { Button } from "@/components/ui/button";
import { selectChrome } from "@/lib/listing-next";

type SelectContextValue = {
  on: boolean;
  toggle: (id: string, checked: boolean) => void;
};

const SelectContext = createContext<SelectContextValue | null>(null);

export function SelectMode({
  kind,
  returnTo,
  canArchive,
  children,
}: {
  kind: string;
  returnTo: string;
  canArchive: boolean;
  children: ReactNode;
}) {
  const [on, setOn] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [, startTransition] = useTransition();
  const chrome = selectChrome(on, selected.length);

  function toggle(id: string, checked: boolean) {
    setSelected((current) => {
      const next = current.filter((item) => item !== id);
      if (checked) next.push(id);
      return next;
    });
  }

  function cancel() {
    setOn(false);
    setSelected([]);
  }

  function archive() {
    if (!selectChrome(on, selected.length).archiveEnabled) return;
    const data = new FormData();
    data.set("kind", kind);
    data.set("returnTo", returnTo);
    for (const id of selected) data.append("recordId", id);
    startTransition(() => {
      void bulkArchiveAction(data);
    });
  }

  return (
    <SelectContext.Provider value={{ on, toggle }}>
      <div className="space-y-4">
        {canArchive && !chrome.barVisible ? (
          <Button type="button" variant="secondary" onClick={() => setOn(true)}>
            Select
          </Button>
        ) : null}
        {chrome.barVisible ? (
          <div
            data-testid="bulk-bar"
            className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-[var(--shadow)]"
          >
            <p className="text-sm">{selected.length === 1 ? "1 selected" : `${selected.length} selected`}</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={!chrome.archiveEnabled} onClick={archive} className="border border-[#d4bc8c] bg-[#111111] text-[#d4bc8c] hover:bg-[#1c1c1c]">
                Archive selected
              </Button>
              <Button type="button" variant="secondary" onClick={cancel}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
        {children}
      </div>
    </SelectContext.Provider>
  );
}

export function SelectBox({ kind, id, label }: { kind: string; id: string; label: string }) {
  const select = useContext(SelectContext);
  if (!select?.on || !selectChrome(true, 0).checksVisible) return null;
  return (
    <label className="flex min-h-12 items-center gap-2 text-sm">
      <input
        type="checkbox"
        data-bulk={kind}
        value={id}
        aria-label={label}
        className="size-4"
        onChange={(event) => select.toggle(id, event.target.checked)}
      />
    </label>
  );
}
