import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { clientMayPreview, listingAccessMove, needsPreviewBackfill, previewServable, shouldWritePreview } from "@/lib/preview-access";
import { previewObjectKey, watermarkedPreview } from "@/lib/preview-image";
import { streamStoredZip, uniqueZipKey } from "@/lib/zip-store";

describe("client preview access", () => {
  it("serves a preview only to the owning realtor of a published active gallery", () => {
    const allowed = {
      actorClientId: "client-a",
      galleryClientId: "client-a",
      status: "PUBLISHED",
      propertyArchived: false,
      orderArchived: false,
    };
    expect(clientMayPreview(allowed)).toBe(true);
    expect(clientMayPreview({ ...allowed, actorClientId: "client-b" })).toBe(false);
    expect(clientMayPreview({ ...allowed, actorClientId: null })).toBe(false);
    expect(clientMayPreview({ ...allowed, status: "DRAFT" })).toBe(false);
    expect(clientMayPreview({ ...allowed, propertyArchived: true })).toBe(false);
    expect(clientMayPreview({ ...allowed, orderArchived: true })).toBe(false);
  });

  it("never treats the original as a preview", () => {
    expect(previewServable({ previewKey: "previews/a.jpg", storageKey: "uploads/a.png" })).toBe(true);
    expect(previewServable({ previewKey: "uploads/a.png", storageKey: "uploads/a.png" })).toBe(false);
    expect(previewServable({ previewKey: null, storageKey: "uploads/a.png" })).toBe(false);
    expect(
      needsPreviewBackfill({ kind: "PHOTO", mimeType: "image/png", previewKey: "uploads/a.png", storageKey: "uploads/a.png" }),
    ).toBe(true);
    expect(
      needsPreviewBackfill({ kind: "PHOTO", mimeType: "image/png", previewKey: "previews/a.jpg", storageKey: "uploads/a.png" }),
    ).toBe(false);
    expect(needsPreviewBackfill({ kind: "VIDEO", mimeType: "video/mp4", previewKey: null, storageKey: "clip.mp4" })).toBe(false);
    const ready = { kind: "PHOTO", mimeType: "image/jpeg", previewKey: "previews/a.jpg", storageKey: "uploads/a.jpg" };
    expect(shouldWritePreview(ready, false)).toBe(false);
    expect(shouldWritePreview(ready, true)).toBe(true);
    expect(shouldWritePreview({ ...ready, previewKey: "uploads/a.jpg" }, false)).toBe(true);
  });

  it("moves every gallery and invoice id with the listing", () => {
    expect(listingAccessMove({ orderIds: ["o1"], galleryIds: ["g1", "g2"], invoiceIds: ["i1"] })).toEqual({
      orders: ["o1"],
      galleries: ["g1", "g2"],
      invoices: ["i1"],
    });
  });
});

describe("watermarked previews", () => {
  it("writes a smaller jpeg that is not the original", async () => {
    const raw = Buffer.alloc(1800 * 1200 * 3);
    for (let i = 0; i < raw.length; i += 3) {
      raw[i] = i % 255;
      raw[i + 1] = (i * 3) % 255;
      raw[i + 2] = (i * 7) % 255;
    }
    const original = await sharp(raw, { raw: { width: 1800, height: 1200, channels: 3 } }).png().toBuffer();
    const preview = await watermarkedPreview(original);
    expect(preview.equals(original)).toBe(false);
    expect(preview[0]).toBe(0xff);
    expect(preview[1]).toBe(0xd8);
    const white = await sharp({
      create: { width: 900, height: 600, channels: 3, background: { r: 250, g: 250, b: 248 } },
    })
      .png()
      .toBuffer();
    const marked = await watermarkedPreview(white);
    const plain = await sharp(white).resize(900, 600).jpeg({ quality: 72 }).toBuffer();
    const markedMean = (await sharp(marked).stats()).channels[0]?.mean ?? 255;
    const plainMean = (await sharp(plain).stats()).channels[0]?.mean ?? 255;
    expect(plainMean - markedMean).toBeGreaterThan(8);
    const meta = await sharp(preview).metadata();
    expect(meta.width).toBeLessThanOrEqual(1600);
    expect(meta.height).toBeLessThanOrEqual(1600);
    expect(previewObjectKey()).toMatch(/^previews\/.+\.jpg$/);
    expect(previewObjectKey()).not.toBe(previewObjectKey());
  });
});

describe("preview backfill script", () => {
  it("loads under tsx in the production container's module format", () => {
    try {
      execFileSync("pnpm", ["exec", "tsx", "scripts/backfill-previews.ts"], {
        env: { ...process.env, MEDIA_ROOT: "" },
        encoding: "utf8",
      });
      throw new Error("The backfill should stop when MEDIA_ROOT is missing.");
    } catch (error) {
      const failed = error as { status?: number; stdout?: string; stderr?: string };
      expect(failed.status).toBe(1);
      expect(`${failed.stdout ?? ""}${failed.stderr ?? ""}`).toContain("Set MEDIA_ROOT");
    }
  });
});

describe("gallery zip files", () => {
  it("streams each download to its own path", async () => {
    expect(uniqueZipKey()).toMatch(/^tmp\/zips\/.+\.zip$/);
    expect(uniqueZipKey()).not.toBe(uniqueZipKey());
    const dir = await mkdtemp(path.join(tmpdir(), "amalfi-zip-"));
    const source = path.join(dir, "a.txt");
    await writeFile(source, "amalfi-original");
    const output = path.join(dir, "out.zip");
    await streamStoredZip(output, [{ name: "a.txt", sourcePath: source }]);
    const zipped = await readFile(output);
    expect(zipped.subarray(0, 2).toString("utf8")).toBe("PK");
    expect(zipped.includes(Buffer.from("amalfi-original"))).toBe(true);
    await rm(dir, { recursive: true, force: true });
  });
});
