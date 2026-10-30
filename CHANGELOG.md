# Changelog

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
