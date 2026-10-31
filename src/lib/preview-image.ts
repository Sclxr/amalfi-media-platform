import { randomUUID } from "node:crypto";
import sharp from "sharp";

const MAX_EDGE = 1600;
const MARK = "AMALFI MEDIA · PREVIEW";

export function previewObjectKey() {
  return `previews/${randomUUID()}.jpg`;
}

/** Diagonal tiles of the preview label. Stroke and fill so it reads on bright and dark photos. */
export function watermarkSvg(width: number, height: number) {
  const font = Math.max(36, Math.round(Math.min(width, height) / 14));
  const stepX = Math.round(font * 11);
  const stepY = Math.round(font * 4.2);
  const stroke = Math.max(3, Math.round(font / 10));
  const labels: string[] = [];
  for (let y = -height; y < height * 2; y += stepY) {
    for (let x = -width; x < width * 2; x += stepX) {
      labels.push(`<text x="${x}" y="${y}">${MARK}</text>`);
    }
  }
  return Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <style>
        text { font: 700 ${font}px sans-serif; fill: rgba(255,255,255,0.82); stroke: rgba(0,0,0,0.78); stroke-width: ${stroke}px; paint-order: stroke fill; }
      </style>
      <g transform="rotate(-28 ${Math.round(width / 2)} ${Math.round(height / 2)})">
        ${labels.join("")}
      </g>
    </svg>`,
  );
}

/** Downscale a photo and burn in a tiled preview watermark. The result is never the original bytes. */
export async function watermarkedPreview(original: Buffer): Promise<Buffer> {
  const source = sharp(original, { failOn: "error" }).rotate();
  const meta = await source.metadata();
  if (!meta.width || !meta.height) throw new Error("This file is not a photo.");
  const scale = Math.min(1, MAX_EDGE / Math.max(meta.width, meta.height));
  const width = Math.max(1, Math.round(meta.width * scale));
  const height = Math.max(1, Math.round(meta.height * scale));
  const preview = await sharp(original, { failOn: "error" })
    .rotate()
    .resize(width, height, { fit: "fill" })
    .composite([{ input: watermarkSvg(width, height) }])
    .jpeg({ quality: 72 })
    .toBuffer();
  if (preview.equals(original)) throw new Error("Preview matched the original.");
  return preview;
}
