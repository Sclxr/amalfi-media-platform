import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
let stopped = false;

process.on("SIGTERM", () => {
  stopped = true;
});
process.on("SIGINT", () => {
  stopped = true;
});

const appEnv = process.env.APP_ENV ?? "development";
const marketingEnabled = process.env.EMAIL_MARKETING_ENABLED === "true";
if (appEnv !== "production" || !marketingEnabled) {
  console.log("worker: marketing email is disabled in this environment");
}

await prisma.$queryRaw`SELECT 1`;
console.log("worker ready");

while (!stopped) {
  await new Promise((resolve) => setTimeout(resolve, 30_000));
  if (stopped) break;
  await prisma.$queryRaw`SELECT 1`;
}

await prisma.$disconnect();
console.log("worker stopped");
