import "server-only";
import { once } from "node:events";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { isSafeMediaKey } from "@/lib/media-sign";

export class MediaTooLargeError extends Error {
  constructor() {
    super("File is too large.");
  }
}

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

/** Stream an upload onto disk and stop once it passes maxBytes. A failed write removes the partial file. */
export async function writeMediaStream(root: string, key: string, webStream: ReadableStream<Uint8Array>, maxBytes: number) {
  const file = resolveMediaPath(root, key);
  await mkdir(path.dirname(file), { recursive: true });
  const handle = createWriteStream(file);
  let received = 0;
  try {
    const reader = webStream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > maxBytes) throw new MediaTooLargeError();
      if (!handle.write(value)) await once(handle, "drain");
    }
    handle.end();
    await once(handle, "finish");
  } catch (error) {
    handle.destroy();
    await rm(file, { force: true });
    throw error;
  }
  if (received === 0) {
    await rm(file, { force: true });
    throw new Error("File is empty.");
  }
  return received;
}

export async function readMediaFile(root: string, key: string) {
  return readFile(resolveMediaPath(root, key));
}

export async function deleteMediaFile(root: string, key: string) {
  await rm(resolveMediaPath(root, key), { force: true });
}

