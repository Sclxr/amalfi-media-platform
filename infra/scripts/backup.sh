#!/bin/sh
# Encrypted local backup of one Postgres database and its media directory.
# Set RESTIC_REPOSITORY to also copy the archive off the server.
set -eu

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${MEDIA_ROOT:?MEDIA_ROOT is required}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE is required}"
: "${BACKUP_DIR:?BACKUP_DIR is required}"

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
dest="${BACKUP_DIR}/${stamp}"
mkdir -p "$dest"
chmod 700 "$BACKUP_DIR" "$dest"

pg_dump --format=custom --no-owner --dbname="$DATABASE_URL" \
  | openssl enc -aes-256-cbc -pbkdf2 -pass env:BACKUP_PASSPHRASE -out "${dest}/db.dump.enc"

if [ -d "$MEDIA_ROOT" ]; then
  tar -C "$MEDIA_ROOT" -czf - . \
    | openssl enc -aes-256-cbc -pbkdf2 -pass env:BACKUP_PASSPHRASE -out "${dest}/media.tar.gz.enc"
else
  echo "Media directory is missing; database dump only." >&2
fi

chmod 600 "${dest}"/*
echo "$dest"

if [ -n "${RESTIC_REPOSITORY:-}" ]; then
  restic backup "$dest"
fi
