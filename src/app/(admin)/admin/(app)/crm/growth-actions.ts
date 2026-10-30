"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { guessImportMapping, type ImportField, IMPORT_FIELDS } from "@/lib/import-preview";
import { getActor } from "@/server/auth/guards";
import { commitImport, buildImportPreview } from "@/server/services/import-leads";
import { completeTask, createTask, logLeadActivity } from "@/server/services/outreach";

export type GrowthState = {
  error?: string;
  headers?: string[];
  mapping?: Record<string, ImportField>;
  csv?: string;
  summary?: { create: number; merge: number; error: number };
  previewRows?: {
    rowNumber: number;
    action: string;
    errors: string[];
    warnings: string[];
    email: string | null;
    name: string;
  }[];
  committed?: { createdRows: number; mergedRows: number; skippedRows: number };
};

async function actorOrLogin() {
  const actor = await getActor();
  if (!actor) redirect("/admin/login");
  return actor;
}

function mappingFromForm(formData: FormData, headers: string[]) {
  const mapping: Record<string, ImportField> = {};
  for (const header of headers) {
    const value = String(formData.get(`map:${header}`) ?? "skip");
    mapping[header] = (IMPORT_FIELDS as readonly string[]).includes(value) ? (value as ImportField) : "skip";
  }
  return mapping;
}

export async function previewImportAction(_prev: GrowthState, formData: FormData): Promise<GrowthState> {
  const actor = await actorOrLogin();
  const csv = String(formData.get("csv") ?? "");
  try {
    const first = await buildImportPreview(actor, csv);
    if ("error" in first && first.error) return { error: first.error, csv };
    if (!("headers" in first) || !first.headers) return { error: "Could not read that CSV.", csv };
    const mapping = formData.get("remap") ? mappingFromForm(formData, first.headers) : guessImportMapping(first.headers);
    const built = await buildImportPreview(actor, csv, mapping);
    if ("error" in built && built.error) return { error: built.error, csv };
    if (!("preview" in built) || !built.preview) return { error: "Could not preview that CSV.", csv };
    return {
      csv,
      headers: built.headers,
      mapping: built.mapping,
      summary: built.preview.summary,
      previewRows: built.preview.rows.map((row) => ({
        rowNumber: row.rowNumber,
        action: row.action,
        errors: row.errors,
        warnings: row.warnings,
        email: row.emailNormalized,
        name: `${row.values.firstName} ${row.values.lastName}`.trim(),
      })),
    };
  } catch (error) {
    unstable_rethrow(error);
    return { error: error instanceof Error ? error.message : "Could not preview the import.", csv };
  }
}

export async function commitImportAction(_prev: GrowthState, formData: FormData): Promise<GrowthState> {
  const actor = await actorOrLogin();
  const raw = String(formData.get("importJson") ?? "");
  let csv = "";
  let mapping: Record<string, ImportField> = {};
  try {
    const parsed = JSON.parse(raw) as { csv?: string; mapping?: Record<string, string> };
    csv = parsed.csv ?? "";
    mapping = Object.fromEntries(
      Object.entries(parsed.mapping ?? {}).map(([header, field]) => [
        header,
        (IMPORT_FIELDS as readonly string[]).includes(field) ? (field as ImportField) : "skip",
      ]),
    );
  } catch {
    return { error: "The import preview expired. Preview the file again." };
  }
  try {
    const result = await commitImport(actor, csv, mapping);
    if ("error" in result) return { error: result.error ?? "Import did not finish.", csv };
    return {
      committed: {
        createdRows: result.createdRows,
        mergedRows: result.mergedRows,
        skippedRows: result.skippedRows,
      },
    };
  } catch (error) {
    unstable_rethrow(error);
    return { error: error instanceof Error ? error.message : "Could not import.", csv };
  }
}

export async function logActivityAction(leadId: string, formData: FormData) {
  const actor = await actorOrLogin();
  const summary = String(formData.get("summary") ?? "").trim();
  if (!summary) redirect(`/admin/crm/leads/${leadId}?notice=activity`);
  await logLeadActivity(actor, leadId, { type: String(formData.get("type") ?? "NOTE"), summary });
  redirect(`/admin/crm/leads/${leadId}`);
}

export async function createTaskAction(leadId: string, formData: FormData) {
  const actor = await actorOrLogin();
  const note = String(formData.get("note") ?? "").trim();
  const due = String(formData.get("dueAt") ?? "");
  if (!note || !due) redirect(`/admin/crm/leads/${leadId}`);
  await createTask(actor, { leadId, note, dueAt: new Date(`${due}T15:00:00.000Z`) });
  redirect(`/admin/crm/follow-ups`);
}

export async function completeTaskAction(formData: FormData) {
  const actor = await actorOrLogin();
  const id = String(formData.get("id") ?? "");
  await completeTask(actor, id);
  redirect("/admin/crm/follow-ups");
}
