import { spawn } from "node:child_process";
import path from "node:path";

const mock = spawn(process.execPath, [path.resolve("scripts/stripe-mock.mjs")], {
  stdio: "inherit",
  env: process.env,
});
const app = spawn(process.execPath, [path.resolve("scripts/start-production.mjs")], {
  stdio: "inherit",
  env: process.env,
});

function stop() {
  mock.kill("SIGTERM");
  app.kill("SIGTERM");
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
app.on("exit", (code) => {
  mock.kill("SIGTERM");
  process.exit(code ?? 0);
});
