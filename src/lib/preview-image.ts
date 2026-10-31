import { randomUUID } from "node:crypto";
import sharp from "sharp";

const MAX_EDGE = 1600;

/**
 * 5×7 glyphs drawn as rectangles. Sharp's SVG text needs fontconfig, which the
 * production image does not have, so these outlines do not depend on a font.
 */
const GLYPHS: Record<string, readonly string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10001", "10001", "10001", "10001"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  V: ["10001", "10001", "10001", "10001", "01010", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  "·": ["00000", "00000", "00100", "01110", "00100", "00000", "00000"],
  " ": ["000", "000", "000", "000", "000", "000", "000"],
};

const MARK = "AMALFI MEDIA · PREVIEW";

export function previewObjectKey() {
  return `previews/${randomUUID()}.jpg`;
}

function glyphMarkup(text: string, cell: number, originX: number, originY: number) {
  const stroke = Math.max(2, Math.round(cell / 3));
  const parts: string[] = [];
  let cursor = originX;
  for (const character of text) {
    const rows = GLYPHS[character] ?? GLYPHS[" "];
    const width = (rows[0]?.length ?? 3) * cell;
    rows.forEach((row, rowIndex) => {
      for (let column = 0; column < row.length; column += 1) {
        if (row[column] !== "1") continue;
        const x = cursor + column * cell;
        const y = originY + rowIndex * cell;
        parts.push(
          `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="#ffffff" stroke="#111111" stroke-width="${stroke}"/>`,
        );
      }
    });
    cursor += width + cell;
  }
  return { markup: parts.join(""), width: cursor - originX };
}

/** Diagonal tiles of the preview label, drawn as paths so no system font is required. */
export function watermarkSvg(width: number, height: number) {
  const cell = Math.max(7, Math.round(Math.min(width, height) / 55));
  const letterHeight = cell * 7;
  const tile = glyphMarkup(MARK, cell, 0, 0);
  const stepX = Math.round(tile.width + cell * 6);
  const stepY = Math.round(letterHeight + cell * 8);
  const tiles: string[] = [];
  for (let y = -height; y < height * 2; y += stepY) {
    for (let x = -width; x < width * 2; x += stepX) {
      tiles.push(`<g transform="translate(${x} ${y})">${glyphMarkup(MARK, cell, 0, 0).markup}</g>`);
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
