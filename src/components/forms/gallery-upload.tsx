"use client";

import { useRef, useState } from "react";
import { registerUploadAction } from "@/app/(admin)/admin/(app)/billing/actions";
import { uploadListingPhotoAction } from "@/app/(admin)/admin/(app)/listings/actions";
import { Button } from "@/components/ui/button";

function isNextRedirect(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
  );
}

export function GalleryUpload({
  galleryId,
  propertyId,
  label = "Upload",
}: {
  galleryId?: string;
  propertyId?: string;
  label?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const action = propertyId ? uploadListingPhotoAction.bind(null, propertyId) : registerUploadAction.bind(null, galleryId ?? "");

  async function upload() {
    const file = inputRef.current?.files?.[0];
    if (!file) {
      setError("Choose a photo to upload.");
      return;
    }
    setPending(true);
    setError(null);
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
        setError(payload.error ?? "Could not prepare the upload.");
        return;
      }
      if (typeof payload.maxBytes === "number" && file.size > payload.maxBytes) {
        setError(`This photo is too large. The limit is ${payload.maxLabel ?? "50 MB"}.`);
        return;
      }
      const uploaded = await fetch(payload.uploadUrl, { method: "PUT", body: file });
      const stored = (await uploaded.json().catch(() => null)) as { error?: string } | null;
      if (!uploaded.ok) {
        setError(stored?.error ?? "The photo was not stored. Try again.");
        return;
      }
      const data = new FormData();
      data.set("key", payload.key);
      data.set("fileName", file.name);
      data.set("mimeType", file.type || "application/octet-stream");
      data.set("size", String(file.size));
      await action(data);
    } catch (caught) {
      if (isNextRedirect(caught)) throw caught;
      setError("The photo could not be saved. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <input ref={inputRef} type="file" accept={propertyId ? "image/*" : undefined} aria-label="Gallery file" />
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="button" disabled={pending} onClick={() => void upload()}>
        {pending ? "Uploading" : label}
      </Button>
    </div>
  );
}
