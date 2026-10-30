import { readUnsubscribeToken } from "@/lib/canspam";
import { getEnv } from "@/server/env";
import { suppressEmail } from "@/server/services/campaigns";

async function unsubscribe(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const env = getEnv();
  const email = readUnsubscribeToken(token, env.ENCRYPTION_KEY);
  if (!email) return Response.json({ error: "This unsubscribe link is not valid." }, { status: 400 });
  await suppressEmail(email, "one-click");
  return Response.json({ ok: true, email });
}

export async function POST(request: Request) {
  return unsubscribe(request);
}
