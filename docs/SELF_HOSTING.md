# Self-hosting on the OVH VPS

The platform runs on the existing Ubuntu VPS. The public site at `amalfimedia.xyz` stays as it is. Nothing in this document should be applied until Eathen approves each gate. Nobody else has been given VPS access.

Production is `https://app.amalfimedia.xyz`. Staging is `https://staging.amalfimedia.xyz`. Each has its own database, database user, media directory, env file, and Docker Compose project.

## Recommendation

Use **Docker Compose**, not a pile of systemd units, for the app, worker, and Postgres. The host already runs Nginx and should keep doing that. Compose gives two named projects (`amalfi-staging` and `amalfi-production`) so a staging deploy cannot restart production. Postgres, the app, and the worker only join an internal Docker network. Published ports are `127.0.0.1` only. Host Nginx is the only process on 80 and 443.

Use **files on disk plus short-lived signed URLs**, and let Nginx send the bytes with `X-Accel-Redirect`. Do not add MinIO or Garage.

MinIO would store the same photos a second time, with its own passwords and its own backup. The disk is the limit either way. A signed URL here is an HMAC that expires in ten minutes. The browser uploads or downloads through the app. The app checks the signature, then tells Nginx to read the file from a private directory. That directory is not a public web root. Backups are a database dump plus that folder, encrypted, copied off the server with restic. If the disk later fills up, the same `storageKey` can be moved to S3-compatible storage without a new data model. That is a later decision, not the first one.

Render, Neon, and R2 are not the hosting plan. `render.yaml` is leftover and should not be applied.

## Size

Run staging and production on the one VPS.

| Piece | Memory, roughly | Notes |
| --- | --- | --- |
| Ubuntu and Nginx | 1 GB | Already there |
| Postgres, both databases | 1 GB | One container is enough if the two databases have different users |
| Production app | 0.5 GB | Next.js standalone |
| Staging app | 0.5 GB | Same image, other env |
| Two workers | 0.3 GB | Idle until jobs exist |
| Page cache for photos | 2 GB | Linux will use free RAM as cache |

**Start with 4 CPU cores, 8 GB RAM, and 250 GB of disk.** That is enough for the apps and the first year of delivered files if the business is still growing. Two cores and 4 GB will boot, and it will feel tight the first time a video upload, a backup, and both apps overlap.

### Photo and video disk

A typical Central Florida listing, delivered files only:

- 30 edited photos, about 10 MB each: 300 MB
- One 1080p walkthrough, about 400 MB
- One short social clip, about 80 MB

Call that **about 1 GB per shoot** if originals are deleted after delivery. If camera originals are kept, plan **4 to 8 GB per shoot**.

At 15 shoots a month, delivered files are about **15 GB a month**, or **180 GB a year**. At 40 shoots a month, about **40 GB a month**. Two years of delivered files at that pace is about **1 TB**. Originals on top of that can double it.

Keep delivered files for **24 months**, then archive or delete. Keep originals for **90 days** unless a client has asked for them. Alert when the disk passes **70 percent**. The first disk should be **250 GB**. Add space before it is full. A 1 TB disk is the comfortable size if originals stay for a year.

## What gets installed

Two Compose projects. Run them from the repo's `deploy/` directory. Every command needs the project name and the env file. The first staging install failed when `up` was run without `--env-file`: Compose left `POSTGRES_PASSWORD` empty and Postgres exited. `env_file:` inside the YAML only fills the container. It does not substitute `${POSTGRES_PASSWORD}` or `${STAGING_MEDIA_DIR}` in the file itself.

`STAGING_MEDIA_DIR` and `PRODUCTION_MEDIA_DIR` are already in the env examples. Keep them in the real env file so `--env-file` supplies them. Exporting the same variables in the shell also works, but the env file is the one that has to be passed either way.

```bash
cd deploy
docker compose -p amalfi-staging --env-file staging.env -f docker-compose.staging.yml up -d --build
docker compose -p amalfi-production --env-file production.env -f docker-compose.production.yml up -d --build
```

`--build` is required until GitHub Actions pushes an image to GHCR. The VPS compiles the Dockerfile. After a registry push exists, `pull` can replace `--build`.

- `deploy/docker-compose.staging.yml` publishes `127.0.0.1:3101` (app) and `127.0.0.1:5433` (Postgres).
- `deploy/docker-compose.production.yml` publishes `127.0.0.1:3100` and `127.0.0.1:5434`.

Neither publishes `0.0.0.0`. Host Nginx proxies the two hostnames to those local ports. Media directories:

- `/var/lib/amalfi/staging/media`
- `/var/lib/amalfi/production/media`

The app refuses to boot staging if `MEDIA_ROOT` does not contain a `staging` path segment, or if the database name does not contain `staging`. Production refuses a media path or database name that contains `staging`. Marketing email stays off unless `APP_ENV=production` and the flag is true. Staging still requires basic auth and Stripe test keys.

Startup runs `prisma migrate deploy`, then seeds only when `seed.completed` is missing, then starts the server. A second boot does not overwrite prices or passwords.

## Host Nginx and certificates

Copy these new files. Do not open the existing `amalfimedia.xyz` site file. Ubuntu 24.04 ships Nginx 1.24, which rejects the `http2 on;` directive. The configs use `listen 443 ssl http2;` instead.

- `infra/nginx/app.amalfimedia.xyz.conf`
- `infra/nginx/staging.amalfimedia.xyz.conf`
- `infra/nginx/amalfi-proxy.conf` as `/etc/nginx/snippets/amalfi-proxy.conf`

Existing photos that were stored before watermarked previews need a one-time backfill. The production image includes `pnpm` and `tsx`. Run it inside the staging app container so it uses that container's `MEDIA_ROOT` and database. `--force` rewrites previews that already exist, which is required when the watermark itself changes.

From `deploy/`:

```bash
docker compose -p amalfi-staging --env-file staging.env -f docker-compose.staging.yml exec app pnpm previews:backfill -- --force
```

That writes a smaller watermarked JPEG next to each original and points the preview at it. It does not replace the original. The letters are drawn as shapes, so the container does not need a system font for the mark to appear. A portal thumbnail never falls back to the original: if a preview is missing, the next view creates one, and a failure is a 404. After this release, run the command with `--force` once so photos that already have a blank bar are rewritten.

Photo uploads are a signed PUT to the app. The file is not posted as a Server Action. The app accepts up to 50 MB per file unless `MEDIA_MAX_UPLOAD_BYTES` is set (ceiling 512 MB). Next.js clones that PUT for the proxy and would otherwise keep only the first 10 MB, so the app sets the clone limit to 512 MB and then enforces the per-file cap itself. Host Nginx must allow at least that. The staging and app server blocks, the proxy snippet, and the Compose Nginx file set `client_max_body_size 512m`. Nginx's own default is 1 MB, so a copied snippet that omits the line will reject photos before they reach the app.

Check the live staging block. Do not open the public site file.

```bash
sudo nginx -T | grep -n client_max_body_size
```

If `staging.amalfimedia.xyz` already shows `512m` (or anything at least `100m`), leave the host config alone. If the directive is missing, add it to the snippet the staging site includes:

```bash
printf '\nclient_max_body_size 512m;\n' | sudo tee -a /etc/nginx/snippets/amalfi-proxy.conf
sudo nginx -t && sudo systemctl reload nginx
```

The same line belongs in the app host snippet when production is cut over. Do not change `amalfimedia.xyz`.

The media locations are `internal`. A request from the internet to `/internal-media/` is not served. Only `X-Accel-Redirect` from the app can use them. The host Nginx aliases the same directories the containers write.

Port 80 answers `/.well-known/acme-challenge/` from its own webroot, then redirects every other path to HTTPS. Staging uses `/var/www/letsencrypt-staging`. The app host uses `/var/www/letsencrypt-app`. Neither is the public site's webroot. Renewals keep working after the redirect is in place because the challenge location is matched first.

The full file cannot be enabled first: it names certificate files that do not exist yet, and `nginx -t` fails. Bootstrap with a temporary port-80-only block.

```bash
sudo mkdir -p /var/www/letsencrypt-staging
sudo tee /etc/nginx/sites-available/staging.amalfimedia.xyz >/dev/null <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name staging.amalfimedia.xyz;
    location ^~ /.well-known/acme-challenge/ {
        root /var/www/letsencrypt-staging;
        default_type text/plain;
    }
    location / {
        return 404;
    }
}
EOF
sudo ln -s /etc/nginx/sites-available/staging.amalfimedia.xyz /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot certonly --webroot -w /var/www/letsencrypt-staging -d staging.amalfimedia.xyz
```

Then replace that temporary file with `infra/nginx/staging.amalfimedia.xyz.conf`, run `sudo nginx -t`, and reload. Repeat for `app.amalfimedia.xyz` with webroot `/var/www/letsencrypt-app`. Do not replace the certificate that covers `amalfimedia.xyz`. Confirm `systemctl list-timers | grep certbot` so renewals are scheduled. A renewal writes into the same webroot the port-80 block already serves.

## Firewall, SSH, and updates

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

Do not allow 5432, 5433, 5434, 3100, or 3101 from the internet.

SSH: key login only, `PasswordAuthentication no`, `PermitRootLogin no`. A deploy user in the `docker` group, not root. `fail2ban` jail for sshd. `unattended-upgrades` for security updates. Reboot when the kernel needs it, during a window Eathen picks.

Secrets live next to the Compose files, at `deploy/staging.env` and `deploy/production.env`, mode `600`. Those paths are gitignored. The examples are `deploy/staging.env.example` and `deploy/production.env.example`. Copy the example, fill it in, and pass that same file as `--env-file`. Do not put a second copy under `/etc/amalfi`.

## Postgres

One Postgres 16 container can hold both databases, but the Compose files use **two containers** so a staging experiment cannot fill the production disk or restart the production database. Each user owns only its database.

```sql
-- inside the staging container, already created by the image
-- user amalfi_staging, database amalfi_staging
```

Do not use the `postgres` superuser from the app. The Compose `POSTGRES_USER` is the app user. Keep a backup of the password in the env file and in the password manager.

Defaults are enough at this size. If memory pressure shows up, set `shared_buffers` to 1 GB on the production container only.

## Backups

Nightly, from cron as the deploy user:

```bash
DATABASE_URL=postgresql://amalfi_prod:PASSWORD@127.0.0.1:5434/amalfi_prod \
MEDIA_ROOT=/var/lib/amalfi/production/media \
BACKUP_PASSPHRASE=from-the-env-file \
BACKUP_DIR=/var/backups/amalfi/production \
infra/scripts/backup.sh
```

Repeat with the staging URL on port 5433 and the staging media directory. The script writes an encrypted `db.dump.enc` and `media.tar.gz.enc` (OpenSSL AES-256). If `RESTIC_REPOSITORY` and `RESTIC_PASSWORD` are set, it also runs `restic backup`.

Send restic to **Backblaze B2** or **OVH Object Storage**. The repository password is not the same as the database password. Retention: 7 daily, 4 weekly, 6 monthly (`restic forget --keep-daily 7 --keep-weekly 4 --keep-monthly 6`).

**RPO:** 24 hours with the nightly dump. About 15 minutes if WAL archiving is added later. Start with nightly. **RTO:** about 1 to 2 hours for someone who has done the drill: new empty database, `infra/scripts/restore.sh`, media directory extracted, Compose restarted.

Drill once after the first real backup, and again every quarter. Restore into a throwaway database name, not over production. Check that a known order id is present and one photo opens.

## Moving the current Neon staging database and any R2 objects

There is no production data. Staging on Neon, if it was ever loaded, moves like this:

```bash
pg_dump --format=custom --no-owner --dbname="$NEON_DIRECT_URL" --file=neon.dump
pg_restore --no-owner --dbname="postgresql://amalfi_staging:PASSWORD@127.0.0.1:5433/amalfi_staging" neon.dump
```

Use the Neon **direct** URL, not the pooler. Then set `seed.completed` if the dump already contains the data you want to keep, so startup does not seed over it.

R2, if any objects exist:

```bash
rclone copy remote:amalfi-staging /var/lib/amalfi/staging/media --progress
```

The app now stores keys like `uploads/<id>/<file>`. Old R2 keys can sit in that tree under the same relative path. Nothing is copied until Eathen says the Neon dump looks right.

## Logs, monitoring, deploy, rollback

Containers log JSON to disk, 10 MB times 5 files, set in the Compose files. Host Nginx logs stay in `/var/log/nginx`, rotated by logrotate.

Uptime: an outside check on `https://app.amalfimedia.xyz/portal/api/health` and the same path on staging. Health only runs `SELECT 1`. It does not require the basic-auth gate.

**Deploy.** There is no GHCR push yet. Build on the VPS with `--build`. From `deploy/`:

```bash
docker compose -p amalfi-staging --env-file staging.env -f docker-compose.staging.yml up -d --build
```

Production, after a written yes:

```bash
docker compose -p amalfi-production --env-file production.env -f docker-compose.production.yml up -d --build
```

Do staging first. Watch logs with the same flags:

```bash
docker compose -p amalfi-staging --env-file staging.env -f docker-compose.staging.yml logs app
```

Look for the migration line and for `Seed marker present` on every boot after the first. When a workflow pushes `ghcr.io/sclxr/amalfi-media-platform:<sha>`, set `APP_IMAGE` to that tag and drop `--build`.

**Rollback.** From `deploy/`, run the production compose command above with the previous image tag and without `--build`. Migrations in this project must stay backward compatible: add columns, do not rename or drop in the same release the old image still runs. If a migration was wrong, restore the database from the backup taken before the deploy. Take that backup as part of the deploy, before compose starts the new container.

This is close to zero downtime: build or pull the image, backup, start the app container with the same `-p` and `--env-file` flags, wait until health returns 200, reload Nginx only if the port changed. There is a short window of errors if the new process is not up yet. Two app containers and a socket switch can come later. It is not worth the extra moving parts on day one.

## Pre-flight audit

Eathen can run these on the VPS. They do not change configuration.

```bash
set +e
uname -a
. /etc/os-release && echo "$PRETTY_NAME"
nproc
free -h
df -h
id
who
sudo -n true && echo "sudo works without a password prompt" || echo "sudo needs a password"
systemctl is-active nginx
sudo nginx -t
sudo ls /etc/nginx/sites-enabled
sudo ufw status verbose
sudo ss -lntup
systemctl is-active fail2ban || true
systemctl is-enabled unattended-upgrades || true
docker --version || true
docker compose version || true
certbot --version || true
systemctl list-timers | grep -E 'certbot|apt' || true
sudo grep -E 'PasswordAuthentication|PermitRootLogin' /etc/ssh/sshd_config /etc/ssh/sshd_config.d/*.conf
```

Send the output. Do not paste passwords. Stop if the public site's Nginx test fails. We do not continue on a broken public site.

## Cutover gates

1. **Approve the audit.** Disk, RAM, Nginx test, and SSH settings look acceptable.
2. **Approve DNS.** Add `A` or `CNAME` records for `app` and `staging` only. Do not change `@` or `www`.
3. **Approve certificates** after `certbot certonly` for those two names. Confirm `amalfimedia.xyz` still loads.
4. **Approve `deploy/staging.env`**, mode 600, and start staging with `-p amalfi-staging --env-file staging.env -f docker-compose.staging.yml up -d --build` from `deploy/`. Sign in. Upload one photo. Download it with the signed URL.
5. **Approve the first backup and a restore drill** into a throwaway database.
6. **Approve production.** Separate env file, separate database, separate media directory. Seed once. Sign in. Do not point the public site at it.
7. **Approve the old Neon project can be deleted**, only after the dump has been restored and checked, or after confirming it was never used.

Until gate 6, production Compose stays down.
