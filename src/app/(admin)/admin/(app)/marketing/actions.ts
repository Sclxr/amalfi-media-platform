"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import type { CampaignSegment } from "@/lib/segments";
import { getActor } from "@/server/auth/guards";
import { issueApiKey, revokeApiKey } from "@/server/services/api-keys";
import {
  attemptCampaignSend,
  createCampaign,
  saveTemplate,
  suppressEmail,
  transitionCampaign,
} from "@/server/services/campaigns";

export type MarketingState = { error?: string; token?: string; reason?: string };

async function actorOrLogin() {
  const actor = await getActor();
  if (!actor) redirect("/admin/login");
  return actor;
}

function segmentFrom(formData: FormData): CampaignSegment {
  const status = String(formData.get("status") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const tag = String(formData.get("tag") ?? "").trim();
  return {
    statuses: status ? [status] : [],
    cities: city ? [city] : [],
    tags: tag ? [tag] : [],
  };
}

export async function createCampaignAction(_prev: MarketingState, formData: FormData): Promise<MarketingState> {
  const actor = await actorOrLogin();
  try {
    const campaign = await createCampaign(actor, {
      name: String(formData.get("name") ?? ""),
      subject: String(formData.get("subject") ?? ""),
      body: String(formData.get("body") ?? ""),
      segment: segmentFrom(formData),
    });
    redirect(`/admin/marketing/campaigns/${campaign.id}`);
  } catch (error) {
    unstable_rethrow(error);
    return { error: error instanceof Error ? error.message : "Could not save the campaign." };
  }
}

export async function campaignAction(id: string, formData: FormData) {
  const actor = await actorOrLogin();
  const action = String(formData.get("action") ?? "");
  if (action === "send") {
    const result = await attemptCampaignSend(actor, id);
    const reason = "reason" in result ? result.reason : "Not sent.";
    redirect(`/admin/marketing/campaigns/${id}?notice=${encodeURIComponent(reason ?? "Not sent.")}`);
  }
  if (action === "submit" || action === "approve" || action === "cancel") {
    const result = await transitionCampaign(actor, id, action);
    if ("error" in result && result.error) {
      redirect(`/admin/marketing/campaigns/${id}?notice=${encodeURIComponent(result.error)}`);
    }
  }
  redirect(`/admin/marketing/campaigns/${id}`);
}

export async function saveTemplateAction(_prev: MarketingState, formData: FormData): Promise<MarketingState> {
  const actor = await actorOrLogin();
  try {
    await saveTemplate(actor, {
      key: String(formData.get("key") ?? ""),
      subject: String(formData.get("subject") ?? ""),
      body: String(formData.get("body") ?? ""),
      category: "MARKETING",
    });
    redirect("/admin/marketing/templates");
  } catch (error) {
    unstable_rethrow(error);
    return { error: error instanceof Error ? error.message : "Could not save the template." };
  }
}

export async function suppressAction(_prev: MarketingState, formData: FormData): Promise<MarketingState> {
  const actor = await actorOrLogin();
  if (!actor) return { error: "Sign in required." };
  const result = await suppressEmail(String(formData.get("email") ?? ""), "admin");
  if ("error" in result && result.error) return { error: result.error };
  redirect("/admin/marketing/suppression");
}

export async function issueKeyAction(_prev: MarketingState, formData: FormData): Promise<MarketingState> {
  const actor = await actorOrLogin();
  const scopes = ["leads:write", "notes:write", "campaigns:draft"].filter((scope) => formData.get(scope) === "on");
  try {
    const issued = await issueApiKey(actor, { name: String(formData.get("name") ?? ""), scopes });
    return { token: issued.token };
  } catch (error) {
    unstable_rethrow(error);
    return { error: error instanceof Error ? error.message : "Could not issue a key." };
  }
}

export async function revokeKeyAction(formData: FormData) {
  const actor = await actorOrLogin();
  await revokeApiKey(actor, String(formData.get("id") ?? ""));
  redirect("/admin/settings/api-keys");
}
