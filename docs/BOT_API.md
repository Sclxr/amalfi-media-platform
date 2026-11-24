# Lead bot API

The bot can look up and file realtors, add notes, and save a campaign draft. It cannot send email. There is no send scope, and `POST /api/bot/send` answers 403.

Set the key in the shell. Do not commit it.

```bash
export AMALFI_BOT_TOKEN='amalfi_…'
```

Issue the key at `/admin/settings/api-keys`. Look up realtors (`leads:read`) is checked by default, with create, notes, and draft campaigns. Sending is not on the form.

On staging, `/api/bot` is outside the basic-auth gate. The API key is still required. Marketing email stays off.

Limits are per key, stored in the database: 60 requests a minute and 1000 a UTC day. A 429 includes `Retry-After` in seconds.

## Create or merge

`POST /api/bot/leads` (or `POST /api/bot`)

Required: `firstName`, `lastName`, and an email or a recognizable phone. Optional: `phone`, `city`, `brokerage` (matched or created by name), `source` (matched or created; default `Lead bot`), `tags`, `note`, `website`, `profileUrl`, `externalRef`.

There is no website column on a realtor. `website` and `profileUrl` are written into the note.

Matching order is normalized email, then E.164 phone, then `externalRef`. A soft-deleted realtor is not restored and is not edited. The response is `{ "id", "merged": true, "hidden": true }`.

A merge fills an empty phone, city, brokerage, or source, stores `externalRef` only when the realtor does not already have one, and unions tags. Name, email, and status stay as they are.

If the email is suppressed, or the matched realtor is do-not-contact, nothing is written:

```json
{ "skipped": true, "reason": "suppressed" }
```

`reason` is `suppressed` or `do-not-contact`.

```bash
curl -sS -X POST "$APP_URL/api/bot/leads" \
  -H "Authorization: Bearer $AMALFI_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Ada","lastName":"Lovelace","email":"ada@example.com","phone":"407-555-0100","city":"Orlando","brokerage":"Lakeside Realty","tags":["waterfront"],"externalRef":"src-100","note":"Met at a showing."}'
```

## Notes

`POST /api/bot/notes` with `leadId` and `summary`. Scope `notes:write`.

A note on a do-not-contact realtor is stored, and the response includes `"flagged": true` and `"reason": "do-not-contact"`. The status is not changed.

## Lookup

`GET /api/bot/leads` with one of `email`, `phone`, `externalRef`, or `q`. Scope `leads:read`.

`q` matches a first name, last name, or brokerage and returns at most 25. A request with no query is 400. Soft-deleted realtors are omitted.

Each row is `id`, `name`, `status`, `brokerage`, `tags`, `lastContactedAt`.

```bash
curl -sS "$APP_URL/api/bot/leads?email=ada@example.com" \
  -H "Authorization: Bearer $AMALFI_BOT_TOKEN"
```

## Draft campaign

`POST /api/bot/campaigns` with `name`, `subject`, and `body`. Scope `campaigns:draft`. The campaign stays a draft.

## Send

`POST /api/bot/send` is 403. A key cannot be given a send scope.
