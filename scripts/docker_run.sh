#!/bin/bash 

export MIGRATIONS_DATABASE_URL=$DATABASE_URL
bash ./scripts/db_run_migrations_production.sh

exec node dist/main.js
