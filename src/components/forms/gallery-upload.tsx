"use client";

import { useRef, useState } from "react";
import { registerUploadAction } from "@/app/(admin)/admin/(app)/billing/actions";
import { uploadListingPhotoAction } from "@/app/(admin)/admin/(app)/listings/actions";
import { Button } from "@/components/ui/button";

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
  const signed = useRef(false);
  const action = propertyId ? uploadListingPhotoAction.bind(null, propertyId) : registerUploadAction.bind(null, galleryId ?? "");

  return (
    <form
      action={action}
      className="space-y-3"
      onSubmit={async (event) => {
        if (signed.current) return;
        event.preventDefault();
        const form = event.currentTarget;
        const file = (form.elements.namedItem("file") as HTMLInputElement).files?.[0];
        if (!file) return;
        setPending(true);
        setError(null);
        const response = await fetch("/portal/api/media/sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name }),
        });
        const payload = (await response.json()) as { uploadUrl?: string; key?: string; error?: string };
        if (!response.ok || !payload.uploadUrl || !payload.key) {
          setError(payload.error ?? "Could not sign the upload.");
          setPending(false);
          return;
        }
        const uploaded = await fetch(payload.uploadUrl, { method: "PUT", body: file });
        if (!uploaded.ok) {
          setError("The file was not stored.");
          setPending(false);
          return;
        }
        (form.elements.namedItem("key") as HTMLInputElement).value = payload.key;
        (form.elements.namedItem("fileName") as HTMLInputElement).value = file.name;
        (form.elements.namedItem("mimeType") as HTMLInputElement).value = file.type || "application/octet-stream";
        (form.elements.namedItem("size") as HTMLInputElement).value = String(file.size);
        signed.current = true;
        form.requestSubmit();
      }}
    >
      <input name="file" type="file" required accept={propertyId ? "image/*" : undefined} aria-label="Gallery file" />
      <input type="hidden" name="key" />
      <input type="hidden" name="fileName" />
      <input type="hidden" name="mimeType" />
      <input type="hidden" name="size" />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Uploading" : label}
      </Button>
    </form>
  );
}
