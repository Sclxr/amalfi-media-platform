import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

function removeDist() {
  rmSync(dist, { recursive: true, force: true });
}

function fail(message) {
  console.error("\nLanding build failed.");
  console.error(message);
  removeDist();
  console.error("Removed the partial dist folder so it cannot be copied to a server.");
  process.exit(1);
}

let astroBin;
try {
  const require = createRequire(join(root, "package.json"));
  astroBin = join(dirname(require.resolve("astro/package.json")), "astro.js");
} catch (error) {
  fail(`Could not find astro. Run pnpm install in landing/ first.\n${error instanceof Error ? error.message : error}`);
}

const result = spawnSync(process.execPath, [astroBin, "build"], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});

if (result.status !== 0) {
  fail(
    `astro build exited with ${result.status ?? result.signal}. The lines above are the reason. Optimized images are not written when this step fails.`,
  );
}

const leftovers = [];
for (const name of ["chunks", "pages"]) {
  if (existsSync(join(dist, name))) leftovers.push(`${name}/`);
}
for (const name of readdirSync(dist)) {
  if (
    /^manifest_.*\.mjs$/.test(name) ||
    name === "renderers.mjs" ||
    name === "noop-entrypoint.mjs" ||
    name === "_noop-middleware.mjs"
  ) {
    leftovers.push(name);
  }
}
if (leftovers.length > 0) {
  fail(`The build left server files in dist: ${leftovers.join(", ")}.`);
}

function htmlFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) htmlFiles(path, out);
    else if (name.endsWith(".html")) out.push(path);
  }
  return out;
}

const missing = [];
const seen = new Set();
const imageRef = /\/_astro\/[A-Za-z0-9._-]+\.(?:webp|avif|png|jpe?g)/g;
for (const file of htmlFiles(dist)) {
  const html = readFileSync(file, "utf8");
  for (const match of html.matchAll(imageRef)) {
    if (seen.has(match[0])) continue;
    seen.add(match[0]);
    if (!existsSync(join(dist, match[0].slice(1)))) missing.push(match[0]);
  }
}
if (missing.length > 0) {
  fail(`These optimized images are missing from dist:\n${missing.map((item) => `  - ${item}`).join("\n")}`);
}

const required = ["hero-2400", "svc-photo", "svc-drone", "svc-video", "g1.", "g2.", "g3."];
const built = existsSync(join(dist, "_astro")) ? readdirSync(join(dist, "_astro")) : [];
const absent = required.filter(
  (prefix) => !built.some((name) => name.startsWith(prefix) && (name.endsWith(".webp") || name.endsWith(".avif"))),
);
if (absent.length > 0) {
  fail(`Expected optimized hero, service, and gallery images. Missing: ${absent.join(", ")}.`);
}

console.log(`Landing build complete. ${seen.size} optimized image paths are in dist.`);
