import "server-only";
import { botRateDecision, botWindowKeys, BOT_RATE_PER_DAY, BOT_RATE_PER_MINUTE } from "@/lib/bot-rate";
import { prisma } from "@/server/db/prisma";

async function bump(clientId: string, bucket: string) {
  const row = await prisma.apiRateBucket.upsert({
    where: { clientId_bucket: { clientId, bucket } },
    create: { clientId, bucket, count: 1 },
    update: { count: { increment: 1 } },
  });
  return row.count;
}

/** Shared by every app process. A request counts against both the minute and the UTC day. */
export async function consumeBotRate(clientId: string, now = Date.now()) {
  const keys = botWindowKeys(now);
  const [minuteCount, dayCount] = await Promise.all([bump(clientId, keys.minute), bump(clientId, keys.day)]);
  await prisma.apiRateBucket.deleteMany({
    where: {
      clientId,
      OR: [
        { bucket: { startsWith: "m:" }, NOT: { bucket: keys.minute } },
        { bucket: { startsWith: "d:" }, NOT: { bucket: keys.day } },
      ],
    },
  });
  const decision = botRateDecision({ minuteCount, dayCount, now });
  return decision.allowed ? decision : { ...decision, limit: minuteCount > BOT_RATE_PER_MINUTE ? BOT_RATE_PER_MINUTE : BOT_RATE_PER_DAY };
}
