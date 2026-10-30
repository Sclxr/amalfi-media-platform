import { readUnsubscribeToken } from "@/lib/canspam";
import { Button } from "@/components/ui/button";
import { getEnv } from "@/server/env";

export const metadata = { title: "Unsubscribe" };

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const query = await searchParams;
  const token = query.token ?? "";
  const env = getEnv();
  const email = token ? readUnsubscribeToken(token, env.ENCRYPTION_KEY) : null;
  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">Unsubscribe</h1>
      {email ? (
        <form className="mt-6 space-y-4" action={`/api/unsubscribe?token=${encodeURIComponent(token)}`} method="post">
          <p className="text-sm text-muted-foreground">Stop marketing email to {email}. Order updates are separate from this list.</p>
          <Button type="submit">Unsubscribe</Button>
        </form>
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">This unsubscribe link is not valid.</p>
      )}
    </main>
  );
}
