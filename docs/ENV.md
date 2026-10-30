# Environment

Copy `.env.example` to `.env`. Never commit `.env`. Do not put `NODE_ENV` in the file.

| Name | Required | Notes |
| --- | --- | --- |
| `APP_ENV` | yes | `development`, `test`, `staging`, or `production` |
| `APP_URL` | yes | Public origin of this app, including scheme |
| `DATABASE_URL` | yes | Postgres. Staging and production must differ |
| `AUTH_SECRET` | yes | 32+ characters. Session signing |
| `ENCRYPTION_KEY` | yes | 32+ characters. Reserved for TOTP and token encryption |
| `EMAIL_MARKETING_ENABLED` | no | Default `false`. Boot fails if `true` outside production |
| `EMAIL_TRANSACTIONAL_ENABLED` | no | Default `false`. No sender is wired yet |
| `EMAIL_DEV_PREVIEW` | no | Local only. Stores the last password-reset URL in `AppSetting` |
| `STAGING_BASIC_AUTH` | staging | `username:password`. Required when `APP_ENV=staging` |
| `STRIPE_SECRET_KEY` | no | Staging must be `sk_test_`. Production must not be a test key |
| `STRIPE_WEBHOOK_SECRET` | no | Later milestone |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | no | Staging must be `pk_test_` |
| `S3_ENDPOINT` | no | R2 S3 API endpoint |
| `S3_REGION` | no | `auto` for R2 |
| `S3_BUCKET` | no | Staging name must include `staging` |
| `S3_ACCESS_KEY_ID` | no | R2 token |
| `S3_SECRET_ACCESS_KEY` | no | R2 secret |
| `SENTRY_DSN` | no | Reserved. Errors currently go to pino |
| `LOG_LEVEL` | no | Default `info` |
| `SEED_ADMIN_PASSWORD` | staging/prod seed | Required to seed outside development and test |

Generate secrets with `openssl rand -base64 32`.
