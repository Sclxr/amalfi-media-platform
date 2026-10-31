# Changelog

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
