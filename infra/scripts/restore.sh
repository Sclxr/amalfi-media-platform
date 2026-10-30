#!/bin/sh
# Restore one encrypted backup created by backup.sh.
# TARGET_DATABASE_URL receives the dump. MEDIA_RESTORE_DIR receives the files.
set -eu

: "${BACKUP_PATH:?BACKUP_PATH is required}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE is required}"
: "${TARGET_DATABASE_URL:?TARGET_DATABASE_URL is required}"
: "${MEDIA_RESTORE_DIR:?MEDIA_RESTORE_DIR is required}"

openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_PASSPHRASE -in "${BACKUP_PATH}/db.dump.enc" \
  | pg_restore --no-owner --clean --if-exists --dbname="$TARGET_DATABASE_URL"

mkdir -p "$MEDIA_RESTORE_DIR"
if [ -f "${BACKUP_PATH}/media.tar.gz.enc" ]; then
  openssl enc -d -aes-256-cbc -pbkdf2 -pass env:BACKUP_PASSPHRASE -in "${BACKUP_PATH}/media.tar.gz.enc" \
    | tar -xzf - -C "$MEDIA_RESTORE_DIR"
fi

echo "Restored database and media from ${BACKUP_PATH}"
