"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { brokerageFormSchema } from "@/schemas/brokerage";
import { areaUpdateSchema, packageUpdateSchema, serviceUpdateSchema } from "@/schemas/catalog";
import { leadFormSchema, leadNoteSchema } from "@/schemas/lead";
import { getActor } from "@/server/auth/guards";
import { createBrokerage, updateBrokerage } from "@/server/services/brokerages";
import { updatePackage, updateService, updateServiceArea } from "@/server/services/catalog";
import { addLeadNote, createLead, updateLead } from "@/server/services/leads";

export type ActionState = { error?: string };

async function actorOrLogin() {
  const actor = await getActor();
  if (!actor) redirect("/admin/login");
  return actor;
}

function firstIssue(error: { issues: { message: string }[] }) {
  return error.issues[0]?.message ?? "Check the form and try again.";
}

export async function createLeadAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await actorOrLogin();
  const parsed = leadFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  try {
    const result = await createLead(actor, parsed.data);
    if ("duplicateOf" in result) redirect(`/admin/crm/leads/${result.duplicateOf}?notice=duplicate`);
    redirect(`/admin/crm/leads/${result.id}`);
  } catch (error) {
    unstable_rethrow(error);
    return { error: error instanceof Error ? error.message : "Could not save the realtor." };
  }
}

export async function updateLeadAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await actorOrLogin();
  const parsed = leadFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  try {
    const result = await updateLead(actor, id, parsed.data);
    if ("duplicateOf" in result) redirect(`/admin/crm/leads/${result.duplicateOf}?notice=duplicate`);
    if ("error" in result) return { error: result.error };
    redirect(`/admin/crm/leads/${id}`);
  } catch (error) {
    unstable_rethrow(error);
    return { error: error instanceof Error ? error.message : "Could not update the realtor." };
  }
}

export async function addNoteAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await actorOrLogin();
  const parsed = leadNoteSchema.safeParse({ summary: formData.get("summary") });
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const result = await addLeadNote(actor, id, parsed.data.summary);
  if ("error" in result) return { error: result.error };
  redirect(`/admin/crm/leads/${id}`);
}

export async function createBrokerageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await actorOrLogin();
  const parsed = brokerageFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const result = await createBrokerage(actor, parsed.data);
  if ("duplicateOf" in result) redirect(`/admin/crm/brokerages/${result.duplicateOf}?notice=duplicate`);
  redirect(`/admin/crm/brokerages/${result.id}`);
}

export async function updateBrokerageAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await actorOrLogin();
  const parsed = brokerageFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const result = await updateBrokerage(actor, id, parsed.data);
  if ("duplicateOf" in result) redirect(`/admin/crm/brokerages/${result.duplicateOf}?notice=duplicate`);
  if ("error" in result) return { error: result.error };
  redirect(`/admin/crm/brokerages/${id}`);
}

export async function updatePackageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await actorOrLogin();
  const parsed = packageUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const result = await updatePackage(actor, parsed.data);
  if ("error" in result) return { error: result.error };
  redirect("/admin/settings/catalog");
}

export async function updateServiceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await actorOrLogin();
  const parsed = serviceUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const result = await updateService(actor, parsed.data);
  if ("error" in result) return { error: result.error };
  redirect("/admin/settings/catalog");
}

export async function updateAreaAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await actorOrLogin();
  const parsed = areaUpdateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const result = await updateServiceArea(actor, parsed.data);
  if ("error" in result) return { error: result.error };
  redirect("/admin/settings/catalog");
}
