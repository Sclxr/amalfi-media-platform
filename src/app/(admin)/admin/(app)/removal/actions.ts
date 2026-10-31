"use server";

import { redirect } from "next/navigation";
import { REMOVAL_KINDS, type RemovalKind, archiveRecord, deleteRecord, previewRemoval, restoreRecord } from "@/server/services/removal";
import { getActor } from "@/server/auth/guards";

function kindOf(value: string): RemovalKind | null {
  return (REMOVAL_KINDS as readonly string[]).includes(value) ? (value as RemovalKind) : null;
}

async function actorOrLogin() {
  const actor = await getActor();
  if (!actor) redirect("/admin/login");
  return actor;
}

function back(returnTo: string, notice?: string) {
  if (!notice) redirect(returnTo);
  const join = returnTo.includes("?") ? "&" : "?";
  redirect(`${returnTo}${join}notice=${encodeURIComponent(notice)}`);
}

export async function previewRemovalAction(kind: string, id: string) {
  const actor = await actorOrLogin();
  const parsed = kindOf(kind);
  if (!parsed) return { error: "That record was not found." };
  return previewRemoval(actor, parsed, id);
}

export async function archiveRecordAction(formData: FormData) {
  const actor = await actorOrLogin();
  const parsed = kindOf(String(formData.get("kind") ?? ""));
  const id = String(formData.get("id") ?? "");
  const returnTo = String(formData.get("returnTo") ?? "/admin");
  if (!parsed) back(returnTo, "That record was not found.");
  const result = await archiveRecord(actor, parsed!, id);
  back(returnTo, "error" in result && result.error ? result.error : "Archived.");
}

export async function restoreRecordAction(formData: FormData) {
  const actor = await actorOrLogin();
  const parsed = kindOf(String(formData.get("kind") ?? ""));
  const id = String(formData.get("id") ?? "");
  const returnTo = String(formData.get("returnTo") ?? "/admin");
  if (!parsed) back(returnTo, "That record was not found.");
  const result = await restoreRecord(actor, parsed!, id);
  back(returnTo, "error" in result && result.error ? result.error : "Restored.");
}

export async function deleteRecordAction(formData: FormData) {
  const actor = await actorOrLogin();
  const parsed = kindOf(String(formData.get("kind") ?? ""));
  const id = String(formData.get("id") ?? "");
  const returnTo = String(formData.get("returnTo") ?? "/admin");
  const typed = String(formData.get("confirm") ?? "").trim();
  const expected = String(formData.get("expected") ?? "").trim();
  if (!parsed) back(returnTo, "That record was not found.");
  if (typed !== expected) back(returnTo, `Type ${expected} to confirm.`);
  const result = await deleteRecord(actor, parsed!, id);
  back(returnTo, "error" in result && result.error ? result.error : "Deleted.");
}

export async function bulkArchiveAction(formData: FormData) {
  const actor = await actorOrLogin();
  const parsed = kindOf(String(formData.get("kind") ?? ""));
  const returnTo = String(formData.get("returnTo") ?? "/admin");
  const ids = formData.getAll("recordId").map(String).filter(Boolean);
  if (!parsed) back(returnTo, "Choose records to archive.");
  if (ids.length === 0) back(returnTo, "Choose at least one record.");
  for (const id of ids) {
    const result = await archiveRecord(actor, parsed!, id);
    if ("error" in result && result.error) back(returnTo, result.error);
  }
  back(returnTo, `Archived ${ids.length}.`);
}
