import { PrismaClient } from "@prisma/client";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { needsPreviewBackfill } from "../src/lib/preview-access";
import { previewObjectKey, watermarkedPreview } from "../src/lib/preview-image";
import { isSafeMediaKey } from "../src/lib/media-sign";

const root = process.env.MEDIA_ROOT;
if (!root) {
  console.error("Set MEDIA_ROOT to the photo directory before running the preview backfill.");
  process.exit(1);
}

const prisma = new PrismaClient();
const assets = await prisma.mediaAsset.findMany({
  select: { id: true, kind: true, mimeType: true, storageKey: true, previewKey: true },
});
let updated = 0;
let skipped = 0;
for (const asset of assets) {
  if (!needsPreviewBackfill(asset)) {
    skipped += 1;
    continue;
  }
  if (!isSafeMediaKey(asset.storageKey)) {
    console.error(`Skipping unsafe key ${asset.id}`);
    continue;
  }
  try {
    const original = await readFile(path.resolve(root, asset.storageKey));
    const preview = await watermarkedPreview(original);
    const key = previewObjectKey();
    const dest = path.resolve(root, key);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, preview);
    await prisma.mediaAsset.update({ where: { id: asset.id }, data: { previewKey: key } });
    updated += 1;
  } catch (error) {
    await prisma.mediaAsset.update({ where: { id: asset.id }, data: { previewKey: null } });
    console.error(`Could not preview ${asset.id}: ${error instanceof Error ? error.message : "unknown error"}`);
  }
}
console.log(`Preview backfill updated ${updated} photos and left ${skipped} alone.`);
await prisma.$disconnect();
