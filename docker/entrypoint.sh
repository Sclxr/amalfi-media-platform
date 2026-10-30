#!/bin/sh
set -e
if [ -n "${MEDIA_ROOT}" ]; then
  mkdir -p "${MEDIA_ROOT}"
  chown amalfi:amalfi "${MEDIA_ROOT}"
fi
exec gosu amalfi "$@"
