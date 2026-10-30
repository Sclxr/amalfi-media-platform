# Changelog

## 0.4.0 — 2026-10-30

### Added

- Stripe Checkout for invoices when keys are set. The app still boots when they are absent and shows billing as not configured. Live keys stay refused outside production.
- Webhook verification, idempotent event storage, invoice pages, and receipt links. Card numbers are not stored.
- Galleries with signed uploads, watermark-free previews, pay-before-download, a trusted-client override, zip download, and an audit row on download.

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
