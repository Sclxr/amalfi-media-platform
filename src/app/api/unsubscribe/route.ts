import { readUnsubscribeToken } from "@/lib/canspam";
import { getEnv } from "@/server/env";
import { suppressEmail } from "@/server/services/campaigns";
import { prisma } from "@/server/db/prisma";

async function unsubscribe(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const env = getEnv();
  const email = readUnsubscribeToken(token, env.ENCRYPTION_KEY);
  if (!email) return Response.json({ error: "This unsubscribe link is not valid." }, { status: 400 });
  await suppressEmail(email, "one-click");
  const leads = await prisma.lead.findMany({
    where: { emailNormalized: email, deletedAt: null, status: { not: "DO_NOT_CONTACT" } },
    select: { id: true },
  });
  for (const lead of leads) {
    await prisma.lead.update({ where: { id: lead.id }, data: { status: "DO_NOT_CONTACT" } });
    await prisma.leadActivity.create({
      data: { leadId: lead.id, type: "STATUS_CHANGE", summary: "Marked do not contact from an unsubscribe link." },
    });
  }
  return Response.json({ ok: true, email });
}

export async function POST(request: Request) {
  return unsubscribe(request);
}
