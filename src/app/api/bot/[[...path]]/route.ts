import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeEmail } from "@/lib/email";
import { normalizePhoneE164 } from "@/lib/phone";
import { authenticateBot } from "@/server/services/api-keys";
import { createCampaign } from "@/server/services/campaigns";
import { prisma } from "@/server/db/prisma";
import { writeAudit } from "@/server/audit";

const leadSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().email(),
  phone: z.string().trim().max(40).optional(),
  city: z.string().trim().max(80).optional(),
});

const noteSchema = z.object({
  leadId: z.string().min(1),
  summary: z.string().trim().min(1).max(2000),
});

const campaignSchema = z.object({
  name: z.string().trim().min(1).max(120),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(20000),
});

async function botActor(clientId: string) {
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN", disabledAt: null }, orderBy: { createdAt: "asc" } });
  if (!admin) return null;
  const { applyOverrides, ROLE_PERMISSIONS } = await import("@/lib/permissions");
  return {
    id: admin.id,
    email: admin.email,
    name: admin.name,
    role: "ADMIN" as const,
    clientId: null,
    permissions: applyOverrides(ROLE_PERMISSIONS.ADMIN, []),
    apiClientId: clientId,
  };
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  if (url.pathname.endsWith("/send")) {
    return NextResponse.json({ error: "Marketing bot keys are draft-only and cannot send." }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  if (url.pathname.endsWith("/notes")) {
    const auth = await authenticateBot(request.headers.get("authorization"), "notes:write");
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const parsed = noteSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Check the note fields." }, { status: 400 });
    const lead = await prisma.lead.findFirst({ where: { id: parsed.data.leadId, deletedAt: null } });
    if (!lead) return NextResponse.json({ error: "That realtor was not found." }, { status: 404 });
    const activity = await prisma.leadActivity.create({
      data: { leadId: lead.id, type: "NOTE", summary: parsed.data.summary },
    });
    await writeAudit({
      apiClientId: auth.client.id,
      action: "bot.note",
      entityType: "Lead",
      entityId: lead.id,
      after: { summary: parsed.data.summary },
    });
    return NextResponse.json({ id: activity.id, draft: true });
  }
  if (url.pathname.endsWith("/campaigns")) {
    const auth = await authenticateBot(request.headers.get("authorization"), "campaigns:draft");
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const parsed = campaignSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Check the campaign fields." }, { status: 400 });
    const actor = await botActor(auth.client.id);
    if (!actor) return NextResponse.json({ error: "No admin is available to own the draft." }, { status: 503 });
    const campaign = await createCampaign(actor, { ...parsed.data, segment: {}, source: "bot" });
    await writeAudit({
      apiClientId: auth.client.id,
      actorId: actor.id,
      action: "bot.campaign.draft",
      entityType: "Campaign",
      entityId: campaign.id,
    });
    return NextResponse.json({ id: campaign.id, status: campaign.status });
  }
  const auth = await authenticateBot(request.headers.get("authorization"), "leads:write");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Check the realtor fields." }, { status: 400 });
  const emailNormalized = normalizeEmail(parsed.data.email);
  const existing = emailNormalized ? await prisma.lead.findUnique({ where: { emailNormalized } }) : null;
  if (existing) return NextResponse.json({ id: existing.id, merged: true });
  const lead = await prisma.lead.create({
    data: {
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      email: emailNormalized,
      emailNormalized,
      phone: parsed.data.phone ?? null,
      phoneE164: normalizePhoneE164(parsed.data.phone),
      city: parsed.data.city ?? null,
    },
  });
  await prisma.leadActivity.create({
    data: { leadId: lead.id, type: "NOTE", summary: "Created by the marketing bot." },
  });
  await writeAudit({
    apiClientId: auth.client.id,
    action: "bot.lead.create",
    entityType: "Lead",
    entityId: lead.id,
    after: { email: lead.email },
  });
  return NextResponse.json({ id: lead.id, merged: false });
}
