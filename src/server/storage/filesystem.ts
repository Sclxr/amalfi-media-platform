import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { isSafeMediaKey } from "@/lib/media-sign";

export function resolveMediaPath(root: string, key: string) {
  if (!isSafeMediaKey(key)) throw new Error("Unsafe media key.");
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, key);
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error("Media path escapes the storage root.");
  }
  return resolved;
}

export async function writeMediaFile(root: string, key: string, bytes: Uint8Array) {
  const file = resolveMediaPath(root, key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, bytes);
  return file;
}

export async function readMediaFile(root: string, key: string) {
  return readFile(resolveMediaPath(root, key));
}
