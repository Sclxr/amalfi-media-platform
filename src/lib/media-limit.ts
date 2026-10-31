/** Default photo upload cap. Override with MEDIA_MAX_UPLOAD_BYTES. Hard ceiling is 512 MB. */
export const DEFAULT_MEDIA_MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const MAX_MEDIA_MAX_UPLOAD_BYTES = 512 * 1024 * 1024;

export function mediaMaxUploadBytes(raw: string | undefined): number {
  if (!raw) return DEFAULT_MEDIA_MAX_UPLOAD_BYTES;
  if (!/^\d+$/.test(raw)) return DEFAULT_MEDIA_MAX_UPLOAD_BYTES;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > MAX_MEDIA_MAX_UPLOAD_BYTES) {
    return DEFAULT_MEDIA_MAX_UPLOAD_BYTES;
  }
  return parsed;
}

export function formatMegabytes(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}
