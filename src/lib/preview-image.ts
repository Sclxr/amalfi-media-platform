import { existsSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import opentype from "opentype.js";
import sharp from "sharp";

const MAX_EDGE = 1600;
const MARK = "AMALFI MEDIA · PREVIEW";

type LabelOutline = {
  d: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

let cachedLabel: LabelOutline | null = null;

export function previewObjectKey() {
  return `previews/${randomUUID()}.jpg`;
}

function bundledFontPath() {
  const candidates = [
    path.join(process.cwd(), "src/lib/fonts/DejaVuSans.ttf"),
    path.join(process.cwd(), "lib/fonts/DejaVuSans.ttf"),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error("The bundled DejaVu Sans font is missing.");
  return found;
}

/** Glyph outlines from the bundled font. SVG text is not used, so fontconfig is not required. */
export function labelOutline(): LabelOutline {
  if (cachedLabel) return cachedLabel;
  const font = opentype.loadSync(bundledFontPath());
  const size = 100;
  const glyph = font.getPath(MARK, 0, size * 0.8, size);
  const box = glyph.getBoundingBox();
  const d = glyph.toPathData(2);
  if (d.length < 80) throw new Error("The watermark label did not produce glyph outlines.");
  cachedLabel = {
    d,
    x: box.x1,
    y: box.y1,
    width: box.x2 - box.x1,
    height: box.y2 - box.y1,
  };
  return cachedLabel;
}

function tileMarkup(outline: LabelOutline, scale: number) {
  const placed = `translate(${-outline.x} ${-outline.y}) scale(${scale})`;
  return `<g transform="${placed}">
    <path d="${outline.d}" transform="translate(1.4 1.8)" fill="rgba(0,0,0,0.34)"/>
    <path d="${outline.d}" fill="rgba(255,255,255,0.4)" stroke="rgba(0,0,0,0.42)" stroke-width="2.4" stroke-linejoin="round" paint-order="stroke fill"/>
  </g>`;
}

/** Sparse diagonal tiles. White fill stays light; a thin dark edge keeps the words readable. */
export function watermarkSvg(width: number, height: number) {
  const outline = labelOutline();
  const fontSize = Math.max(54, Math.round(Math.min(width, height) / 11));
  const scale = fontSize / 100;
  const tileWidth = outline.width * scale;
  const tileHeight = outline.height * scale;
  const stepX = Math.round(tileWidth + fontSize * 2.2);
  const stepY = Math.round(tileHeight + fontSize * 3.6);
  const tiles: string[] = [];
  for (let y = -height; y < height * 2; y += stepY) {
    for (let x = -width; x < width * 2; x += stepX) {
      tiles.push(`<g transform="translate(${Math.round(x)} ${Math.round(y)})">${tileMarkup(outline, scale)}</g>`);
    }
  }
  return Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <g transform="rotate(-28 ${Math.round(width / 2)} ${Math.round(height / 2)})">
        ${tiles.join("")}
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
