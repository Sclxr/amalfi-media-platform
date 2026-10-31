"use client";

import { useState } from "react";
import {
  deleteListingPhotoAction,
  moveListingPhotoAction,
  publishListingGalleryAction,
} from "@/app/(admin)/admin/(app)/listings/actions";
import { GalleryUpload } from "@/components/forms/gallery-upload";
import { Button } from "@/components/ui/button";

export type ListingPhoto = { id: string; fileName: string; src: string };

export function ListingPhotos({
  propertyId,
  photos,
  galleries,
  canWrite,
}: {
  propertyId: string;
  photos: ListingPhoto[];
  galleries: { id: string; title: string; status: string }[];
  canWrite: boolean;
}) {
  const [index, setIndex] = useState<number | null>(null);
  const photo = index === null ? null : photos[index];
  return (
    <section id="photos" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Photos</h2>
          <p className="text-sm text-muted-foreground">Every ready photo on this listing. Uploads use the latest order.</p>
        </div>
        {canWrite ? <GalleryUpload propertyId={propertyId} label="Upload photo" /> : null}
      </div>
      {canWrite ? (
        <div className="space-y-2 text-sm">
          {galleries.length === 0 ? <p className="text-muted-foreground">No gallery yet. The first upload creates one.</p> : null}
          {galleries.map((gallery) => (
            <form key={gallery.id} action={publishListingGalleryAction} className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="propertyId" value={propertyId} />
              <input type="hidden" name="galleryId" value={gallery.id} />
              <input type="hidden" name="mode" value={gallery.status === "PUBLISHED" ? "unpublish" : "publish"} />
              <span>
                {gallery.title} · {gallery.status === "PUBLISHED" ? "Published for the client." : gallery.status}
              </span>
              <Button type="submit" variant="secondary" size="sm">
                {gallery.status === "PUBLISHED" ? "Unpublish" : "Publish"}
              </Button>
            </form>
          ))}
        </div>
      ) : null}
      {photos.length === 0 ? <p className="text-sm text-muted-foreground">No photos yet.</p> : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" data-testid="listing-photos">
        {photos.map((item, photoIndex) => (
          <figure key={item.id} className="space-y-2">
            <button type="button" className="block w-full" onClick={() => setIndex(photoIndex)} aria-label={item.fileName}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.src} alt={item.fileName} className="h-36 w-full rounded-md border border-border object-cover" />
            </button>
            {canWrite ? (
              <div className="flex flex-wrap gap-2">
                <form action={moveListingPhotoAction}>
                  <input type="hidden" name="propertyId" value={propertyId} />
                  <input type="hidden" name="assetId" value={item.id} />
                  <input type="hidden" name="direction" value="earlier" />
                  <Button type="submit" variant="secondary" size="sm">
                    Earlier
                  </Button>
                </form>
                <form action={moveListingPhotoAction}>
                  <input type="hidden" name="propertyId" value={propertyId} />
                  <input type="hidden" name="assetId" value={item.id} />
                  <input type="hidden" name="direction" value="later" />
                  <Button type="submit" variant="secondary" size="sm">
                    Later
                  </Button>
                </form>
                <form action={deleteListingPhotoAction}>
                  <input type="hidden" name="propertyId" value={propertyId} />
                  <input type="hidden" name="assetId" value={item.id} />
                  <Button type="submit" variant="secondary" size="sm" aria-label={`Delete ${item.fileName}`}>
                    Delete
                  </Button>
                </form>
              </div>
            ) : null}
          </figure>
        ))}
      </div>
      {photo ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label="Photo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.src} alt={photo.fileName} className="max-h-[75vh] max-w-full rounded-md object-contain" />
          <div className="absolute bottom-6 flex gap-2">
            <Button type="button" variant="secondary" onClick={() => setIndex((photoIndex) => (photoIndex === null ? 0 : (photoIndex + photos.length - 1) % photos.length))}>
              Previous
            </Button>
            <Button type="button" variant="secondary" onClick={() => setIndex((photoIndex) => (photoIndex === null ? 0 : (photoIndex + 1) % photos.length))}>
              Next
            </Button>
            <Button type="button" variant="secondary" onClick={() => setIndex(null)}>
              Close
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
