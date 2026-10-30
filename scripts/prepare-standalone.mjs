import { cpSync, existsSync, mkdirSync } from "node:fs";

const standalone = ".next/standalone";
if (!existsSync(`${standalone}/server.js`)) {
  console.error("Missing .next/standalone/server.js. Build with output: standalone.");
  process.exit(1);
}

if (existsSync("public")) {
  cpSync("public", `${standalone}/public`, { recursive: true });
}

mkdirSync(`${standalone}/.next`, { recursive: true });
cpSync(".next/static", `${standalone}/.next/static`, { recursive: true });
console.log("Standalone server is ready: node .next/standalone/server.js");
