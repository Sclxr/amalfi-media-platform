import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeEmail } from "@/lib/email";
import { normalizePhoneE164 } from "@/lib/phone";
import { authenticateBot } from "@/server/services/api-keys";
import { addBotNote, lookupBotLeads, saveBotLead } from "@/server/services/bot-leads";
import { consumeBotRate } from "@/server/services/bot-rate";
import { createCampaign } from "@/server/services/campaigns";
import { prisma } from "@/server/db/prisma";
import { writeAudit } from "@/server/audit";

const leadSchema = z
  .object({
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    email: z.string().trim().email().optional(),
    phone: z.string().trim().max(40).optional(),
    city: z.string().trim().max(80).optional(),
    brokerage: z.string().trim().max(120).optional(),
    source: z.string().trim().max(80).optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
    note: z.string().trim().max(2000).optional(),
    website: z.string().trim().max(300).optional(),
    profileUrl: z.string().trim().max(300).optional(),
    externalRef: z.string().trim().min(1).max(120).optional(),
  })
  .refine((input) => Boolean(normalizeEmail(input.email) || normalizePhoneE164(input.phone)), {
    message: "A realtor needs an email or a recognizable phone number.",
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

function botTail(request: Request) {
  const parts = new URL(request.url).pathname.split("/").filter(Boolean);
  return parts.slice(2).join("/");
}

async function limited(clientId: string) {
  const decision = await consumeBotRate(clientId);
  if (decision.allowed) return null;
  return NextResponse.json(
    { error: "Too many requests." },
    { status: 429, headers: { "Retry-After": String(decision.retryAfter) } },
  );
}

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

export async function GET(request: Request) {
  if (botTail(request) !== "leads") return NextResponse.json({ error: "Not found." }, { status: 404 });
  const auth = await authenticateBot(request.headers.get("authorization"), "leads:read");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const blocked = await limited(auth.client.id);
  if (blocked) return blocked;
  const url = new URL(request.url);
  const result = await lookupBotLeads({
    email: url.searchParams.get("email"),
    phone: url.searchParams.get("phone"),
    externalRef: url.searchParams.get("externalRef"),
    q: url.searchParams.get("q"),
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const tail = botTail(request);
  if (tail === "send" || tail.endsWith("/send")) {
    return NextResponse.json({ error: "Marketing bot keys are draft-only and cannot send." }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  if (tail === "notes") {
    const auth = await authenticateBot(request.headers.get("authorization"), "notes:write");
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const blocked = await limited(auth.client.id);
    if (blocked) return blocked;
    const parsed = noteSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Check the note fields." }, { status: 400 });
    const note = await addBotNote(auth.client.id, parsed.data.leadId, parsed.data.summary);
    if ("error" in note) return NextResponse.json({ error: note.error }, { status: note.status });
    return NextResponse.json(note);
  }
  if (tail === "campaigns") {
    const auth = await authenticateBot(request.headers.get("authorization"), "campaigns:draft");
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const blocked = await limited(auth.client.id);
    if (blocked) return blocked;
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
  if (tail !== "" && tail !== "leads") return NextResponse.json({ error: "Not found." }, { status: 404 });
  const auth = await authenticateBot(request.headers.get("authorization"), "leads:write");
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const blocked = await limited(auth.client.id);
  if (blocked) return blocked;
  const parsed = leadSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Check the realtor fields." }, { status: 400 });
  const result = await saveBotLead(auth.client.id, parsed.data);
  return NextResponse.json(result);
}
