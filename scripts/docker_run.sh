#!/bin/bash

set -e

export MIGRATIONS_DATABASE_URL=$DATABASE_URL
bash ./scripts/db_run_migrations_production.sh

case "${DD_APM_ENABLED,,}" in
  y | yes | t | true | on | 1)
    export NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--import dd-trace/initialize.mjs"
    ;;
esac

exec node dist/main.js
