import { describe, expect, it } from "vitest";
import { DEFAULT_MEDIA_MAX_UPLOAD_BYTES, formatMegabytes, mediaMaxUploadBytes } from "@/lib/media-limit";

describe("media upload limit", () => {
  it("defaults to 50 MB and keeps an explicit byte cap", () => {
    expect(mediaMaxUploadBytes(undefined)).toBe(DEFAULT_MEDIA_MAX_UPLOAD_BYTES);
    expect(mediaMaxUploadBytes("")).toBe(DEFAULT_MEDIA_MAX_UPLOAD_BYTES);
    expect(mediaMaxUploadBytes("nope")).toBe(DEFAULT_MEDIA_MAX_UPLOAD_BYTES);
    expect(mediaMaxUploadBytes(String(5 * 1024 * 1024))).toBe(5 * 1024 * 1024);
    expect(formatMegabytes(DEFAULT_MEDIA_MAX_UPLOAD_BYTES)).toBe("50 MB");
  });
});
