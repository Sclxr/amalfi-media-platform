"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createListingOrderAction,
  deleteListingPhotosAction,
  moveListingPhotosAction,
  prepareListingGalleryAction,
  publishListingGalleryAction,
  reorderListingPhotosAction,
  replaceListingPhotoAction,
  saveListingPhotoAction,
  setListingCoverAction,
  updateGalleryDetailsAction,
} from "@/app/(admin)/admin/(app)/listings/actions";
import { AskConfirm } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { movePhotoOrder, stepPhotoOrder } from "@/lib/listing";
import { putSignedPhoto } from "@/lib/upload-photo";
import { cn } from "@/lib/utils";

export type ManagedPhoto = { id: string; fileName: string; src: string; cover: boolean };

export type ManagedGallery = {
  id: string;
  title: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  requirePaid: boolean;
  photos: ManagedPhoto[];
};

function isNextRedirect(error: unknown) {
  return typeof error === "object" && error !== null && "digest" in error && String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT");
}

export function GalleryManager({
  propertyId,
  orderId,
  cancelled,
  galleries,
  canWrite,
}: {
  propertyId: string;
  orderId: string | null;
  cancelled: boolean;
  galleries: ManagedGallery[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef(galleries[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [rows, setRows] = useState<{ name: string; state: string }[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [orders, setOrders] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(galleries.map((gallery) => [gallery.id, gallery.photos.map((photo) => photo.id)])),
  );
  const incoming = galleries.map((gallery) => gallery.photos.map((photo) => photo.id).join(",")).join("|");
  useEffect(() => {
    setOrders(Object.fromEntries(galleries.map((gallery) => [gallery.id, gallery.photos.map((photo) => photo.id)])));
  }, [incoming, galleries]);

  const photos = galleries.flatMap((gallery) => gallery.photos.map((photo) => ({ ...photo, galleryId: gallery.id })));
  const open = photos.find((photo) => photo.id === openId) ?? null;
  const openGallery = galleries.find((gallery) => gallery.id === open?.galleryId) ?? null;

  async function uploadFiles(files: File[]) {
    if (!orderId) return;
    setPending(true);
    setError(null);
    setRows(files.map((file) => ({ name: file.name, state: "Waiting" })));
    let galleryId = galleryRef.current;
    try {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index]!;
        setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, state: "Uploading" } : row)));
        if (!galleryId) {
          const prepared = await prepareListingGalleryAction(propertyId, { orderId });
          if (prepared.error || !prepared.id) {
            setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, state: "Failed" } : row)));
            setError(prepared.error ?? "Could not prepare the gallery.");
            break;
          }
          galleryId = prepared.id;
          galleryRef.current = galleryId;
        }
        const stored = await putSignedPhoto(file);
        if (stored.error || !stored.photo) {
          setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, state: "Failed" } : row)));
          setError(stored.error ?? "The photo was not stored. Try again.");
          break;
        }
        const saved = await saveListingPhotoAction(galleryId, stored.photo);
        if (saved.error) {
          setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, state: "Failed" } : row)));
          setError(saved.error);
          break;
        }
        setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, state: "Saved" } : row)));
      }
      router.refresh();
    } catch (caught) {
      if (isNextRedirect(caught)) throw caught;
      setError("The photo could not be saved. Try again.");
    } finally {
      setPending(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function applyOrder(galleryId: string, next: string[]) {
    setOrders((current) => ({ ...current, [galleryId]: next }));
    startTransition(() => {
      void reorderListingPhotosAction(propertyId, galleryId, next);
    });
  }

  async function replaceOpen(file: File) {
    if (!open) return;
    setPending(true);
    setError(null);
    try {
      const stored = await putSignedPhoto(file);
      if (stored.error || !stored.photo) {
        setError(stored.error ?? "The photo was not stored. Try again.");
        return;
      }
      const saved = await replaceListingPhotoAction(propertyId, open.id, stored.photo);
      if (saved.error) {
        setError(saved.error);
        return;
      }
      router.refresh();
    } catch (caught) {
      if (isNextRedirect(caught)) throw caught;
      setError("The photo could not be replaced. Try again.");
    } finally {
      setPending(false);
    }
  }

  if (!orderId && !cancelled) {
    return (
      <div className="rounded-md border border-dashed border-border px-4 py-10 text-center">
        <p className="text-sm text-muted-foreground">No shoot yet. Photos stay with an order so jobs do not mix.</p>
        {canWrite ? (
          <div className="mt-4">
            <AskConfirm
              title="Create an order"
              body="This listing has no order. Create one for these photos?"
              confirmLabel="Create order"
              onConfirm={() => createListingOrderAction(propertyId)}
              trigger={<Button type="button">Create an order for these photos</Button>}
            />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {cancelled ? <p className="text-sm text-muted-foreground">This shoot was cancelled. Choose another shoot to add photos.</p> : null}
      {canWrite && !cancelled ? (
        <div id="upload" className="space-y-3 rounded-md border border-border p-4">
          <input ref={inputRef} id="gallery-file" type="file" accept="image/*" multiple aria-label="Gallery file" />
          {rows.length > 0 ? (
            <ul className="space-y-1 text-sm" aria-live="polite">
              {rows.map((row) => (
                <li key={row.name}>
                  {row.name} · {row.state}
                </li>
              ))}
            </ul>
          ) : null}
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <Button
            type="button"
            disabled={pending}
            onClick={() => {
              const files = [...(inputRef.current?.files ?? [])];
              if (files.length === 0) {
                setError("Choose a photo to upload.");
                return;
              }
              void uploadFiles(files);
            }}
          >
            {pending ? "Uploading" : "Upload photos"}
          </Button>
        </div>
      ) : null}
      {galleries.length === 0 ? <p className="text-sm text-muted-foreground">No photos for this shoot yet.</p> : null}
      {galleries.map((gallery) => {
        const ids = orders[gallery.id] ?? gallery.photos.map((photo) => photo.id);
        const ordered = ids.map((id) => gallery.photos.find((photo) => photo.id === id)).filter((photo): photo is ManagedPhoto => Boolean(photo));
        const otherGalleries = galleries.filter((item) => item.id !== gallery.id);
        return (
          <section key={gallery.id} className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">{gallery.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {gallery.status === "PUBLISHED" ? "Published for the client." : gallery.status === "ARCHIVED" ? "Archived" : "Draft"}
                  {gallery.requirePaid ? " · Payment required before download" : " · Downloads are open"}
                </p>
              </div>
              {canWrite ? (
                <div className="flex flex-wrap gap-2">
                  <form action={publishListingGalleryAction}>
                    <input type="hidden" name="propertyId" value={propertyId} />
                    <input type="hidden" name="galleryId" value={gallery.id} />
                    <input type="hidden" name="mode" value={gallery.status === "PUBLISHED" ? "unpublish" : "publish"} />
                    <Button type="submit" variant="secondary" size="sm">
                      {gallery.status === "PUBLISHED" ? "Unpublish" : "Publish"}
                    </Button>
                  </form>
                  {gallery.status !== "ARCHIVED" ? (
                    <AskConfirm
                      title="Archive gallery"
                      body="Archive this gallery? It stays on the shoot and is hidden from the client."
                      confirmLabel="Archive"
                      onConfirm={() => {
                        const data = new FormData();
                        data.set("propertyId", propertyId);
                        data.set("galleryId", gallery.id);
                        data.set("mode", "archive");
                        return publishListingGalleryAction(data);
                      }}
                      trigger={<Button type="button" variant="secondary" size="sm">Archive</Button>}
                    />
                  ) : null}
                  <details className="text-sm">
                    <summary className="cursor-pointer text-primary">Gallery details</summary>
                    <form action={updateGalleryDetailsAction.bind(null, propertyId)} className="mt-3 grid gap-3 rounded-md border border-border p-3">
                      <input type="hidden" name="galleryId" value={gallery.id} />
                      <div className="space-y-2">
                        <Label htmlFor={`title-${gallery.id}`}>Title</Label>
                        <Input id={`title-${gallery.id}`} name="title" defaultValue={gallery.title} />
                      </div>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" name="requirePaid" defaultChecked={gallery.requirePaid} />
                        Require payment before download
                      </label>
                      <Button type="submit" variant="secondary" size="sm">
                        Save gallery
                      </Button>
                    </form>
                  </details>
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              <a className="text-primary" href={`/admin/listings/${propertyId}/preview/${gallery.id}`}>
                Preview as client
              </a>
              {canWrite && selected.length > 0 ? (
                <>
                  <AskConfirm
                    title="Delete photos"
                    body={`Delete ${selected.length} selected photo${selected.length === 1 ? "" : "s"}? This cannot be undone.`}
                    confirmLabel="Delete"
                    destructive
                    onConfirm={() => deleteListingPhotosAction(propertyId, selected)}
                    trigger={<Button type="button" variant="destructive" size="sm">Delete selected</Button>}
                  />
                  {otherGalleries.length > 0 ? (
                    <label className="flex items-center gap-2">
                      Move to
                      <select
                        aria-label="Move selected photos"
                        className="h-8 rounded-sm border border-border bg-background px-2"
                        defaultValue=""
                        onChange={(event) => {
                          const target = event.target.value;
                          if (!target) return;
                          startTransition(() => {
                            void moveListingPhotosAction(propertyId, selected, target);
                          });
                        }}
                      >
                        <option value="">Choose a gallery</option>
                        {otherGalleries.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.title}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                </>
              ) : null}
            </div>
            {ordered.length === 0 ? <p className="text-sm text-muted-foreground">No photos for this shoot yet.</p> : null}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" data-testid="listing-photos">
              {ordered.map((photo) => (
                <figure
                  key={photo.id}
                  draggable={canWrite}
                  onDragStart={() => setDragId(photo.id)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (!dragId) return;
                    applyOrder(gallery.id, movePhotoOrder(ids, dragId, photo.id));
                    setDragId(null);
                  }}
                  className={cn("space-y-2 rounded-md border border-border p-2", selected.includes(photo.id) && "ring-2 ring-primary")}
                >
                  <button type="button" className="block w-full" onClick={() => setOpenId(photo.id)} aria-label={photo.fileName}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.src} alt={photo.fileName} className="aspect-[4/3] w-full rounded-md object-cover" />
                  </button>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    {canWrite ? (
                      <label className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          aria-label={`Select ${photo.fileName}`}
                          checked={selected.includes(photo.id)}
                          onChange={(event) => {
                            setSelected((current) =>
                              event.target.checked ? [...current, photo.id] : current.filter((id) => id !== photo.id),
                            );
                          }}
                        />
                        Select
                      </label>
                    ) : <span />}
                    {photo.cover ? <span className="text-muted-foreground">Cover</span> : null}
                  </div>
                  {canWrite ? (
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="secondary" size="sm" onClick={() => applyOrder(gallery.id, stepPhotoOrder(ids, photo.id, "earlier"))}>
                        Earlier
                      </Button>
                      <Button type="button" variant="secondary" size="sm" onClick={() => applyOrder(gallery.id, stepPhotoOrder(ids, photo.id, "later"))}>
                        Later
                      </Button>
                    </div>
                  ) : null}
                </figure>
              ))}
            </div>
          </section>
        );
      })}
      {open && openGallery ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label="Photo">
          <div className="flex max-h-full w-full max-w-4xl flex-col items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={open.src} alt={open.fileName} className="max-h-[70vh] max-w-full rounded-md object-contain" />
            <p className="text-sm text-white">{open.fileName}{open.cover ? " · Listing cover" : ""}</p>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="flex flex-wrap justify-center gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpenId(stepId(openGallery.photos, open.id, -1))}>
                Previous
              </Button>
              <Button type="button" variant="secondary" onClick={() => setOpenId(stepId(openGallery.photos, open.id, 1))}>
                Next
              </Button>
              {canWrite ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    startTransition(() => {
                      void setListingCoverAction(propertyId, open.id);
                    });
                  }}
                >
                  Set as cover
                </Button>
              ) : null}
              <a className="inline-flex h-10 items-center rounded-md border border-border bg-surface px-4 text-sm font-medium" href={open.src} download={open.fileName}>
                Download
              </a>
              {canWrite ? (
                <label className="inline-flex h-10 cursor-pointer items-center rounded-md border border-border bg-surface px-4 text-sm font-medium">
                  Replace
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    aria-label={`Replace ${open.fileName}`}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void replaceOpen(file);
                    }}
                  />
                </label>
              ) : null}
              {canWrite ? (
                <AskConfirm
                  title="Delete this photo"
                  body={`Delete ${open.fileName}? This cannot be undone.`}
                  confirmLabel="Delete"
                  destructive
                  onConfirm={() => deleteListingPhotosAction(propertyId, [open.id])}
                  trigger={<Button type="button" variant="destructive">Delete</Button>}
                />
              ) : null}
              <Button type="button" variant="secondary" onClick={() => setOpenId(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function stepId(photos: ManagedPhoto[], id: string, delta: number) {
  const index = photos.findIndex((photo) => photo.id === id);
  if (index < 0 || photos.length === 0) return id;
  return photos[(index + delta + photos.length) % photos.length]!.id;
}
