"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { IMPORT_FIELDS, type ImportField } from "@/lib/import-preview";
import { commitImportAction, previewImportAction, type GrowthState } from "@/app/(admin)/admin/(app)/crm/growth-actions";

const LABELS: Record<ImportField, string> = {
  skip: "Skip",
  firstName: "First name",
  lastName: "Last name",
  email: "Email",
  phone: "Phone",
  brokerage: "Brokerage",
  city: "City",
  status: "Status",
  tags: "Tags",
};

export function ImportWizard({ initialCsv = "" }: { initialCsv?: string }) {
  const [preview, previewAction, previewPending] = useActionState(previewImportAction, { csv: initialCsv } satisfies GrowthState);
  const [committed, commitAction, commitPending] = useActionState(commitImportAction, {} satisfies GrowthState);
  return (
    <div className="space-y-6">
      <form action={previewAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="csv">CSV</Label>
          <Textarea id="csv" name="csv" required defaultValue={preview.csv ?? initialCsv} className="min-h-40 font-mono text-xs" />
        </div>
        {preview.headers ? (
          <div className="grid gap-3 md:grid-cols-2">
            <input type="hidden" name="remap" value="1" />
            {preview.headers.map((header) => (
              <label key={header} className="space-y-1 text-sm">
                <span className="text-muted-foreground">{header}</span>
                <select name={`map:${header}`} defaultValue={preview.mapping?.[header] ?? "skip"} className="h-10 w-full rounded-sm border border-border bg-background px-3">
                  {IMPORT_FIELDS.map((field) => (
                    <option key={field} value={field}>
                      {LABELS[field]}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        ) : null}
        {preview.error ? <p className="text-sm text-destructive">{preview.error}</p> : null}
        <Button type="submit" disabled={previewPending}>
          {previewPending ? "Previewing" : "Preview import"}
        </Button>
      </form>
      {preview.summary ? (
        <div data-testid="import-preview" className="space-y-3">
          <p className="text-sm">
            {preview.summary.create} to create, {preview.summary.merge} to merge, {preview.summary.error} errors.
          </p>
          <ul className="space-y-2 text-sm">
            {preview.previewRows?.map((row) => (
              <li key={row.rowNumber} className="rounded-md border border-border px-3 py-2">
                <span className="font-medium">Row {row.rowNumber}</span> {row.name || "Unnamed"} {row.email ? `(${row.email})` : ""} — {row.action}
                {row.errors.map((error) => (
                  <span key={error} className="mt-1 block text-destructive">
                    {error}
                  </span>
                ))}
                {row.warnings.map((warning) => (
                  <span key={warning} className="mt-1 block text-muted-foreground">
                    {warning}
                  </span>
                ))}
              </li>
            ))}
          </ul>
          <form action={commitAction}>
            <input
              type="hidden"
              name="importJson"
              value={JSON.stringify({ csv: preview.csv ?? "", mapping: preview.mapping ?? {} })}
            />
            <Button type="submit" disabled={commitPending}>
              {commitPending ? "Importing" : "Commit import"}
            </Button>
          </form>
        </div>
      ) : null}
      {committed.committed ? (
        <p data-testid="import-result" className="text-sm">
          Created {committed.committed.createdRows}, merged {committed.committed.mergedRows}, skipped {committed.committed.skippedRows}.
        </p>
      ) : null}
      {committed.error ? <p className="text-sm text-destructive">{committed.error}</p> : null}
    </div>
  );
}
