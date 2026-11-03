"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PortalPhotoGrid({ photos }: { photos: { id: string; fileName: string; src: string }[] }) {
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    if (open === null) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const photo = open === null ? null : photos[open];

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {photos.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className={cn("overflow-hidden rounded-2xl border border-border text-left", photos.length === 1 && "col-span-2 sm:col-span-3")}
            aria-label={item.fileName}
            onClick={() => setOpen(index)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.src} alt={item.fileName} className="aspect-[4/3] w-full object-cover" />
          </button>
        ))}
      </div>
      {photo ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-4" role="dialog" aria-modal="true" aria-label="Photo">
          <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col items-center justify-center gap-4 py-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.src} alt={photo.fileName} className="max-h-[50vh] max-w-full rounded-xl object-contain" />
            <p className="max-w-full break-words text-center text-sm text-white">{photo.fileName}</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setOpen((current) => (current === null ? 0 : (current - 1 + photos.length) % photos.length))}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setOpen((current) => (current === null ? 0 : (current + 1) % photos.length))}
              >
                Next
              </Button>
              <Button type="button" variant="secondary" onClick={() => setOpen(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
