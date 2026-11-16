#!/bin/bash

set -e

export MIGRATIONS_DATABASE_URL=$DATABASE_URL
bash ./scripts/db_run_migrations_production.sh

# AdminJS writes its frontend bundle here at startup. The app directory of the
# image is not writable by the runtime user.
export ADMIN_JS_TMP_DIR="${ADMIN_JS_TMP_DIR:-${TMPDIR:-/tmp}/adminjs}"
exec node dist/main.js
