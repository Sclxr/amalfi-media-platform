import "server-only";
import type { Actor } from "@/lib/actor";
import { apiKeyMatches, apiKeyPrefix, assertDraftOnlyScopes, generateApiKey, type BotScope } from "@/lib/api-key";
import { can } from "@/lib/permissions";
import { prisma } from "@/server/db/prisma";
import { writeAudit } from "@/server/audit";

export async function listApiKeys(actor: Actor) {
  if (!can(actor, "settings.manage")) throw new Error("Forbidden");
  return prisma.apiClient.findMany({ orderBy: { createdAt: "desc" } });
}

export async function issueApiKey(actor: Actor, input: { name: string; scopes: string[] }) {
  if (!can(actor, "settings.manage")) throw new Error("Forbidden");
  const name = input.name.trim();
  if (!name) throw new Error("Name the key before issuing it.");
  const scopes = assertDraftOnlyScopes(input.scopes);
  const generated = generateApiKey();
  const client = await prisma.apiClient.create({
    data: { name, keyPrefix: generated.prefix, keyHash: generated.hash, scopes },
  });
  await writeAudit({
    actorId: actor.id,
    action: "apiKey.issue",
    entityType: "ApiClient",
    entityId: client.id,
    after: { name: client.name, prefix: client.keyPrefix, scopes },
  });
  return { id: client.id, token: generated.token, prefix: generated.prefix };
}

export async function revokeApiKey(actor: Actor, id: string) {
  if (!can(actor, "settings.manage")) throw new Error("Forbidden");
  await prisma.apiClient.update({ where: { id }, data: { revokedAt: new Date() } });
  await writeAudit({ actorId: actor.id, action: "apiKey.revoke", entityType: "ApiClient", entityId: id });
}

export async function authenticateBot(authorization: string | null, scope: BotScope) {
  const token = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length).trim() : "";
  const prefix = apiKeyPrefix(token);
  if (!prefix) return { error: "Missing API key." as const, status: 401 as const };
  const client = await prisma.apiClient.findUnique({ where: { keyPrefix: prefix } });
  if (!client || client.revokedAt || !apiKeyMatches(token, client.keyHash)) {
    return { error: "API key was rejected." as const, status: 401 as const };
  }
  if (!client.scopes.includes(scope)) {
    return { error: "This key does not include that scope." as const, status: 403 as const };
  }
  await prisma.apiClient.update({ where: { id: client.id }, data: { lastUsedAt: new Date() } });
  return { client };
}
