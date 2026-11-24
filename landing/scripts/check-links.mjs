import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const dist = path.resolve("dist");
const files = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full);
    else if (entry.name.endsWith(".html")) files.push(full);
  }
}
await walk(dist);
const pages = new Set(files.map((file) => {
  const rel = path.relative(dist, file).replaceAll(path.sep, "/");
  if (rel === "index.html") return "/";
  if (rel.endsWith("/index.html")) return `/${rel.slice(0, -"index.html".length)}`;
  return `/${rel}`;
}));
pages.add("/404.html");
const missing = [];
for (const file of files) {
  const html = await readFile(file, "utf8");
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
  for (const href of hrefs) {
    if (href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("#")) continue;
    const clean = href.split("#")[0].split("?")[0];
    if (!clean.startsWith("/")) {
      missing.push(`${file} -> ${href}`);
      continue;
    }
    const normalized = clean.endsWith("/") ? clean : `${clean}/`;
    if (!pages.has(normalized) && !pages.has(clean) && !clean.includes(".")) missing.push(`${path.relative(dist, file)} -> ${href}`);
  }
}
if (missing.length) {
  console.error(missing.join("\n"));
  process.exit(1);
}
console.log(`Checked ${files.length} pages, no dead internal links.`);
