import "server-only";
import { normalizeEmail } from "@/lib/email";
import { prisma } from "@/server/db/prisma";

type ProfileUser = { id: string; email: string; name: string; emailVerified: boolean };

/**
 * A new account gets a client only when that email is unused.
 * An existing client is attached only after the email is verified.
 * An unverified email never claims a client by itself.
 */
export async function ensureClientProfile(user: ProfileUser) {
  const linked = await prisma.client.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (linked) return linked.id;
  const email = normalizeEmail(user.email);
  if (!email) return null;
  const matches = await prisma.client.findMany({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, userId: true },
  });
  if (user.emailVerified && matches.length === 1 && !matches[0]?.userId) {
    await prisma.client.update({ where: { id: matches[0].id }, data: { userId: user.id } });
    return matches[0].id;
  }
  if (matches.length > 0) return null;
  const [firstName, ...rest] = (user.name || "Client").trim().split(/\s+/);
  const created = await prisma.client.create({
    data: {
      userId: user.id,
      firstName: firstName || "Client",
      lastName: rest.join(" "),
      email,
    },
  });
  return created.id;
}
