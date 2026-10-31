# Changelog

## 0.14.0 — 2026-10-31

### Fixed

- The preview watermark is drawn as letter shapes, not SVG text, so it still reads in the Docker image where fontconfig has no fonts. The runner image also installs fontconfig and DejaVu. `pnpm previews:backfill -- --force` rewrites the blank bars.

## 0.13.0 — 2026-10-31

### Fixed

- Portal thumbnails never serve the original. A missing preview is generated or the image is not found. The watermark is a tiled diagonal "AMALFI MEDIA · PREVIEW" that stays readable on bright photos. `pnpm previews:backfill -- --force` runs in the production container and rewrites existing previews.

## 0.12.0 — 2026-10-31

### Added

- Transactional email uses Resend or SMTP when production is configured, and only logs a preview otherwise. Marketing email stays disabled. Publishing a gallery emails a single-use invite. Verification, password reset, and payment receipts use the same sender.
- The gallery has a Buy button and an invoice link. Checkout returns to that gallery with a paid confirmation.

## 0.11.0 — 2026-10-31

### Added

- A listing has a single-use invite link an admin can copy. Signing up or signing in through it attaches the account to the existing client and keeps the gallery address. Email verification is required. An unverified email does not claim a client by itself. Client emails are unique.

## 0.10.0 — 2026-10-31

### Added

- An order created from a listing can be priced with an active package (including the $120 introductory package), a custom amount, or line items. The invoice is created from that price. A recorded payment or an open invoice blocks a price change.

## 0.9.0 — 2026-10-31

### Fixed

- Stripe checkout is accepted only when the session is paid, the amount and currency match the open invoice, and the session id is the one stored on that invoice. Void and refunded invoices stay unpaid.
- Refunds, disputes, and failed asynchronous payments are applied. A refund or dispute locks downloads again. The newest live invoice on the order is the one that unlocks a gallery, and a partial refund does not.
- Paying an invoice reuses an open Checkout session and does not open a second one when that session is already complete. Invoice numbers retry instead of colliding. Receipt links are read from the charge. Webhook signatures accept every `v1` value and every configured secret.

## 0.8.0 — 2026-10-31

### Added

- Uploads and replacements store a downscaled watermarked preview that is a different file from the original. `pnpm previews:backfill` creates those previews for photos already on disk.
- Client previews require the signed-in realtor, a published gallery, and an active listing. Downloads and ZIP files include every photo, are written to a unique temporary file, and no longer return a reusable media token.
- Moving a listing to another realtor moves the orders, galleries, and invoices with it.

## 0.7.0 — 2026-10-31

### Added

- Listings, orders, realtors, clients, brokerages, campaigns, and import batches can be archived and restored. An Archived filter shows the hidden records.
- Admins can permanently delete a record that has no paid invoice. The confirmation names what will be removed. Photo files are deleted after the database commit. Staff cannot delete.

## 0.6.0 — 2026-10-31

### Added

- The listing page is a header plus Overview, Gallery, Bookings, and Orders & Billing. Edits, delivery, and destructive actions open dialogs.
- Galleries stay with one order. Uploads still use the signed route, including several files with progress. Staff reorder photos by dragging, including with a short press on a touch screen, and can set a cover, replace a photo, and preview what the client sees.
- An unpaid invoice can be voided. A recorded payment is left unchanged, and refunds are not started when Stripe is not configured.

## 0.5.0 — 2026-10-31

### Added

- Admin listings use the existing property records and the CRM realtor. Status, shoot date, and cover photo come from the related order, booking, and gallery.
- A listing page is where staff upload, reorder, delete, and publish photos. The Media menu item now sends people to listings.
- Photo bytes go through the signed upload route. The listing form only sends the file name and storage key. The default limit is 50 MB per file. Next's proxy body clone is 512 MB so a photo is not cut off at 10 MB.

## 0.4.0 — 2026-10-30

### Added

- Stripe Checkout for invoices when keys are set. The app still boots when they are absent and shows billing as not configured. Live keys stay refused outside production.
- Webhook verification, idempotent event storage, invoice pages, and receipt links. Card numbers are not stored.
- Galleries with signed uploads, watermark-free previews, pay-before-download, a trusted-client override, zip download, and an audit row on download.

### Fixed

- A Stripe webhook records the event id in the same transaction as the invoice and payment. A failed update does not consume the event, so Stripe's retry can mark the invoice paid.

## 0.3.0 — 2026-10-30

### Added

- Availability rules, blackout dates, and a day, week, and month bookings calendar.
- Portal booking requests with the $120 introductory package, quote-only drone and video add-ons, and a travel fee from the service area.
- Order lifecycle from requested through quoted, scheduled, shot, editing, and delivered, with history and a quote builder.
- Transactional email templates that preview only outside production.
- `.ics` download for a booking.

## 0.2.0 — 2026-10-30

### Added

- CSV import for realtors and brokerages, with column mapping, email and phone dedupe, a preview, and an error report.
- Follow-up queue, outreach activity on a realtor, and tasks.
- Campaign drafts, segments, templates, admin approval, CAN-SPAM footer (Orlando, FL), one-click unsubscribe, and a suppression list.
- Gmail API client stub. No live Google calls. OAuth plan is in `docs/GMAIL_OAUTH.md`.
- Marketing bot API keys from Settings. Keys can create realtors, notes, and draft campaigns, and cannot send.

## 0.1.0 — 2026-10-30

### Added

- Milestone 1 foundation for the Amalfi Media platform.
- Postgres schema for identity, CRM, catalog, orders, billing, galleries, and audit, including pay-before-download and a per-client trusted exception.
- Better Auth with argon2id, roles, optional TOTP, and rate limits.
- Admin overview, realtor and brokerage CRM, and catalog editing.
- Client portal sign-in, registration, and a dashboard limited to that client's rows.
- Staging isolation checks and a hard block on marketing email outside production.
- Seed data for Amalfi Media in Orlando, including the $120 introductory photography package.
