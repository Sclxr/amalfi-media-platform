import { randomUUID } from "node:crypto";
import sharp from "sharp";

const MAX_EDGE = 1600;

export function previewObjectKey() {
  return `previews/${randomUUID()}.jpg`;
}

/** Downscale a photo and burn in a visible preview watermark. The result is never the original bytes. */
export async function watermarkedPreview(original: Buffer): Promise<Buffer> {
  const source = sharp(original, { failOn: "error" }).rotate();
  const meta = await source.metadata();
  if (!meta.width || !meta.height) throw new Error("This file is not a photo.");
  const scale = Math.min(1, MAX_EDGE / Math.max(meta.width, meta.height));
  const width = Math.max(1, Math.round(meta.width * scale));
  const height = Math.max(1, Math.round(meta.height * scale));
  const font = Math.max(22, Math.round(Math.min(width, height) / 10));
  const svg = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <style>.mark { font: 700 ${font}px sans-serif; fill: rgba(255,255,255,0.55); }</style>
      <g transform="translate(${width / 2} ${height / 2}) rotate(-28)">
        <text class="mark" text-anchor="middle" dominant-baseline="middle">AMALFI MEDIA</text>
        <text class="mark" y="${font + 8}" text-anchor="middle" dominant-baseline="middle">PREVIEW</text>
      </g>
    </svg>`,
  );
  const preview = await sharp(original, { failOn: "error" })
    .rotate()
    .resize(width, height, { fit: "fill" })
    .composite([{ input: svg }])
    .jpeg({ quality: 72 })
    .toBuffer();
  if (preview.equals(original)) throw new Error("Preview matched the original.");
  return preview;
}
