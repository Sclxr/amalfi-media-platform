# Gmail API

Marketing mail is designed to leave through the Gmail API later. This milestone does not call Google.

## What is stubbed

`sendViaGmail` in `src/lib/gmail.ts` returns `{ sent: false, liveCall: false }` whether `GMAIL_API_ENABLED` is `true` or `false`. It does not use `fetch`. Campaign send still runs the production kill switch first: outside production, or when `EMAIL_MARKETING_ENABLED` is false, nothing is queued.

## OAuth plan for a later change

1. Create a Google Cloud project owned by Amalfi Media. Enable the Gmail API.
2. OAuth consent screen, external or internal. Scope `https://www.googleapis.com/auth/gmail.send` only.
3. OAuth client type Web. Authorized redirect `https://app.amalfimedia.xyz/api/gmail/callback`. Staging, if ever connected, uses `https://staging.amalfimedia.xyz/api/gmail/callback` and a separate Google client.
4. An admin signs in once. Store the refresh token encrypted with `ENCRYPTION_KEY`. Do not put the token in git or in the campaign row.
5. Send with the Gmail users.messages.send method as the mailbox `eathen@amalfimedia.xyz`. Add `List-Unsubscribe` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click`.
6. Turn `GMAIL_API_ENABLED=true` only in production, and only together with `EMAIL_MARKETING_ENABLED=true`.
7. Keep the stub as the default until that mailbox is connected. Staging never sends.
