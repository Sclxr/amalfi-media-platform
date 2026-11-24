import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { GET, POST } from "@/app/api/bot/[[...path]]/route";
import { POST as unsubscribe } from "@/app/api/unsubscribe/route";
import { generateApiKey } from "@/lib/api-key";
import { botRateDecision } from "@/lib/bot-rate";
import { signUnsubscribeToken } from "@/lib/canspam";
import { stagingBasicAuthBypass } from "@/lib/staging-gate";

const prisma = new PrismaClient();
const stamp = Date.now().toString();
const createdClients: string[] = [];

async function issue(scopes: string[]) {
  const key = generateApiKey();
  const client = await prisma.apiClient.create({
    data: { name: `bot-test-${stamp}-${key.prefix}`, keyPrefix: key.prefix, keyHash: key.hash, scopes },
  });
  createdClients.push(client.id);
  return key.token;
}

function call(method: "GET" | "POST", path: string, token: string | null, body?: unknown) {
  const headers = new Headers();
  if (token) headers.set("authorization", `Bearer ${token}`);
  const request = new Request(`http://localhost:3000${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return method === "GET" ? GET(request) : POST(request);
}

describe("bot API", () => {
  const email = `ada-${stamp}@example.com`;
  const phone = `407555${stamp.slice(-4)}`;

  afterAll(async () => {
    const leads = await prisma.lead.findMany({
      where: {
        OR: [{ email: { contains: stamp } }, { externalRef: { startsWith: `bot-${stamp}` } }, { phone: { contains: stamp.slice(-4) } }],
      },
      select: { id: true },
    });
    const ids = leads.map((lead) => lead.id);
    if (ids.length > 0) await prisma.lead.deleteMany({ where: { id: { in: ids } } });
    await prisma.emailSuppression.deleteMany({ where: { emailNormalized: { contains: stamp } } });
    if (createdClients.length > 0) {
      await prisma.apiRateBucket.deleteMany({ where: { clientId: { in: createdClients } } });
      await prisma.apiClient.deleteMany({ where: { id: { in: createdClients } } });
    }
    await prisma.$disconnect();
  });

  it("creates, merges without overwriting the name, and dedupes the phone and external id", async () => {
    const token = await issue(["leads:write", "leads:read", "notes:write"]);
    const created = await call("POST", "/api/bot/leads", token, {
      firstName: "Ada",
      lastName: "Lovelace",
      email: `Ada-${stamp}@Example.com`,
      city: "Orlando",
      brokerage: `Bot Office ${stamp}`,
      tags: ["waterfront"],
      externalRef: `bot-${stamp}-email`,
      website: "https://ada.example",
      note: "Met at a showing.",
    });
    expect(created.status).toBe(200);
    const body = await created.json();
    expect(body.merged).toBe(false);
    const lead = await prisma.lead.findUnique({ where: { id: body.id }, include: { brokerage: true, source: true, activities: true } });
    expect(lead?.email).toBe(email);
    expect(lead?.brokerage?.name).toBe(`Bot Office ${stamp}`);
    expect(lead?.source?.name).toBe("Lead bot");
    expect(lead?.tags).toEqual(["waterfront"]);
    expect(lead?.activities.some((activity) => activity.summary.includes("https://ada.example"))).toBe(true);

    const merged = await call("POST", "/api/bot/leads", token, {
      firstName: "Changed",
      lastName: "Person",
      email,
      phone,
      city: "Winter Park",
      tags: ["luxury"],
    });
    expect((await merged.json()).merged).toBe(true);
    const after = await prisma.lead.findUnique({ where: { id: body.id } });
    expect(after?.firstName).toBe("Ada");
    expect(after?.lastName).toBe("Lovelace");
    expect(after?.city).toBe("Orlando");
    expect(after?.phoneE164).toBe(`+1${phone}`);
    expect(after?.tags.sort()).toEqual(["luxury", "waterfront"]);

    const byPhone = await call("POST", "/api/bot/leads", token, {
      firstName: "Other",
      lastName: "Name",
      phone: `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}`,
    });
    expect((await byPhone.json()).id).toBe(body.id);

    const ref = await call("POST", "/api/bot/leads", token, {
      firstName: "Bea",
      lastName: "Knox",
      phone: "3215550199",
      externalRef: `bot-${stamp}-ref`,
    });
    const refBody = await ref.json();
    const again = await call("POST", "/api/bot/leads", token, {
      firstName: "Nope",
      lastName: "Nope",
      phone: "3215550188",
      externalRef: `bot-${stamp}-ref`,
    });
    expect((await again.json()).id).toBe(refBody.id);
    expect((await prisma.lead.findUnique({ where: { id: refBody.id } }))?.firstName).toBe("Bea");
  });

  it("does not resurrect a soft-deleted realtor", async () => {
    const token = await issue(["leads:write"]);
    const hiddenEmail = `hidden-${stamp}@example.com`;
    const created = await call("POST", "/api/bot/leads", token, { firstName: "Hidden", lastName: "Realtor", email: hiddenEmail });
    const id = (await created.json()).id as string;
    await prisma.lead.update({ where: { id }, data: { deletedAt: new Date(), firstName: "Hidden" } });
    const response = await call("POST", "/api/bot/leads", token, { firstName: "New", lastName: "Person", email: hiddenEmail, city: "Tampa" });
    expect(await response.json()).toEqual({ id, merged: true, hidden: true });
    const lead = await prisma.lead.findUnique({ where: { id } });
    expect(lead?.firstName).toBe("Hidden");
    expect(lead?.city).toBeNull();
  });

  it("skips a suppressed email and a do-not-contact realtor", async () => {
    const token = await issue(["leads:write", "notes:write"]);
    const blocked = `stop-${stamp}@example.com`;
    await prisma.emailSuppression.create({ data: { emailNormalized: blocked, reason: "UNSUBSCRIBED", source: "test" } });
    const skipped = await call("POST", "/api/bot/leads", token, { firstName: "Stop", lastName: "Here", email: blocked });
    expect(await skipped.json()).toEqual({ skipped: true, reason: "suppressed" });
    expect(await prisma.lead.findUnique({ where: { emailNormalized: blocked } })).toBeNull();

    const dncEmail = `dnc-${stamp}@example.com`;
    const created = await call("POST", "/api/bot/leads", token, { firstName: "Dana", lastName: "No", email: dncEmail });
    const id = (await created.json()).id as string;
    await prisma.lead.update({ where: { id }, data: { status: "DO_NOT_CONTACT" } });
    const again = await call("POST", "/api/bot/leads", token, { firstName: "Dana", lastName: "No", email: dncEmail, city: "Miami" });
    expect(await again.json()).toEqual({ skipped: true, reason: "do-not-contact" });
    expect((await prisma.lead.findUnique({ where: { id } }))?.city).toBeNull();

    const note = await call("POST", "/api/bot/notes", token, { leadId: id, summary: "They asked not to be called." });
    expect(note.status).toBe(200);
    expect(await note.json()).toMatchObject({ flagged: true, reason: "do-not-contact" });
  });

  it("looks up one realtor and refuses a search with no query", async () => {
    const token = await issue(["leads:read"]);
    const missing = await call("GET", "/api/bot/leads", token);
    expect(missing.status).toBe(400);
    const found = await call("GET", `/api/bot/leads?email=${encodeURIComponent(email)}`, token);
    expect(found.status).toBe(200);
    const body = await found.json();
    expect(body.leads).toHaveLength(1);
    expect(body.leads[0]).toMatchObject({ name: "Ada Lovelace", status: "NEW", brokerage: `Bot Office ${stamp}` });
    expect([...body.leads[0].tags].sort()).toEqual(["luxury", "waterfront"]);
    expect(body.leads[0].email).toBeUndefined();
    const search = await call("GET", `/api/bot/leads?q=${encodeURIComponent(`Bot Office ${stamp}`)}`, token);
    const rows = await search.json();
    expect(rows.leads.length).toBeGreaterThan(0);
    expect(rows.leads.length).toBeLessThanOrEqual(25);
  });

  it("returns 403 for the wrong scope and for send", async () => {
    const token = await issue(["notes:write"]);
    const denied = await call("POST", "/api/bot/leads", token, { firstName: "No", lastName: "Scope", email: `scope-${stamp}@example.com` });
    expect(denied.status).toBe(403);
    const reader = await issue(["leads:read"]);
    const send = await call("POST", "/api/bot/send", reader, { subject: "Hello" });
    expect(send.status).toBe(403);
    expect(stagingBasicAuthBypass("/api/bot/leads")).toBe(true);
  });

  it("returns 429 after the per-minute limit", async () => {
    const token = await issue(["leads:read"]);
    let last = await call("GET", "/api/bot/leads", token);
    for (let i = 0; i < 59; i += 1) last = await call("GET", "/api/bot/leads", token);
    expect(last.status).toBe(400);
    const blocked = await call("GET", "/api/bot/leads", token);
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(botRateDecision({ minuteCount: 61, dayCount: 61, now: Date.now() }).allowed).toBe(false);
    expect(botRateDecision({ minuteCount: 1, dayCount: 1001, now: Date.parse("2026-11-24T12:00:00Z") }).retryAfter).toBeGreaterThan(60);
  });

  it("marks the realtor do-not-contact when they unsubscribe", async () => {
    const address = `unsub-${stamp}@example.com`;
    const lead = await prisma.lead.create({
      data: { firstName: "Una", lastName: "Sub", email: address, emailNormalized: address, status: "ENGAGED" },
    });
    const token = signUnsubscribeToken(address, "test-only-encryption-key-32chars!");
    const response = await unsubscribe(new Request(`http://localhost:3000/api/unsubscribe?token=${encodeURIComponent(token)}`, { method: "POST" }));
    expect(response.status).toBe(200);
    expect((await prisma.lead.findUnique({ where: { id: lead.id } }))?.status).toBe("DO_NOT_CONTACT");
    const activity = await prisma.leadActivity.findFirst({ where: { leadId: lead.id, type: "STATUS_CHANGE" } });
    expect(activity?.summary).toContain("unsubscribe");
    expect(await prisma.emailSuppression.findUnique({ where: { emailNormalized: address } })).not.toBeNull();
  });
});
