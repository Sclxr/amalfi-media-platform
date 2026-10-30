import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { SEED_MARKER_KEY, shouldRunStartupSeed } from "../src/lib/seed-marker.mjs";

const require = createRequire(import.meta.url);
const prismaCli = require.resolve("prisma/build/index.js");

function runNode(script, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      stdio: "inherit",
      env: process.env,
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${path.basename(script)} ${args.join(" ")} exited ${code ?? signal}`));
    });
  });
}

const appEnv = process.env.APP_ENV ?? "development";
if (!process.env.DIRECT_URL) {
  if (appEnv === "staging" || appEnv === "production") {
    console.error("DIRECT_URL is required so prisma migrate deploy does not use the Neon pooler.");
    process.exit(1);
  }
  process.env.DIRECT_URL = process.env.DATABASE_URL;
}

process.env.HOSTNAME = "0.0.0.0";
if (!process.env.PORT) process.env.PORT = "3000";
process.env.PATH = `${path.resolve("node_modules/.bin")}${path.delimiter}${process.env.PATH ?? ""}`;

const started = Date.now();
console.log("Applying database migrations.");
await runNode(prismaCli, ["migrate", "deploy"]);

const prisma = new PrismaClient();
let runSeed = false;
try {
  const marker = await prisma.appSetting.findUnique({ where: { key: SEED_MARKER_KEY } });
  runSeed = shouldRunStartupSeed(marker);
} finally {
  await prisma.$disconnect();
}

if (runSeed) {
  console.log("No seed marker. Seeding once.");
  await runNode(prismaCli, ["db", "seed"]);
} else {
  console.log("Seed marker present. Skipping seed so existing rows stay unchanged.");
}

console.log(`Database ready in ${Date.now() - started}ms. Starting server.`);
const server = spawn(process.execPath, [path.resolve(".next/standalone/server.js")], {
  stdio: "inherit",
  env: process.env,
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.kill(signal));
}
server.on("exit", (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0));
});
