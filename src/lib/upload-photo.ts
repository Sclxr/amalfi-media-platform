export type SignedPhoto = {
  key: string;
  fileName: string;
  mimeType: string;
  size: number;
};

function isNextRedirect(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
  );
}

/** PUT the file to the signed upload route. The caller stores only the key and filename. */
export async function putSignedPhoto(file: File): Promise<{ error?: string; photo?: SignedPhoto }> {
  try {
    const response = await fetch("/portal/api/media/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name }),
    });
    const payload = (await response.json()) as {
      uploadUrl?: string;
      key?: string;
      error?: string;
      maxBytes?: number;
      maxLabel?: string;
    };
    if (!response.ok || !payload.uploadUrl || !payload.key) {
      return { error: payload.error ?? "Could not prepare the upload." };
    }
    if (typeof payload.maxBytes === "number" && file.size > payload.maxBytes) {
      return { error: `This photo is too large. The limit is ${payload.maxLabel ?? "50 MB"}.` };
    }
    const uploaded = await fetch(payload.uploadUrl, { method: "PUT", body: file });
    const stored = (await uploaded.json().catch(() => null)) as { error?: string } | null;
    if (!uploaded.ok) return { error: stored?.error ?? "The photo was not stored. Try again." };
    return {
      photo: {
        key: payload.key,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
      },
    };
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    return { error: "The photo was not stored. Try again." };
  }
}
