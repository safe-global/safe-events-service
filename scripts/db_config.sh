#!/bin/bash

export MIGRATIONS_DATABASE_URL=${MIGRATIONS_DATABASE_URL:-psql://postgres:postgres@localhost:5433/migrations}
ORMCONFIG="./src/datasources/db/ormconfig.ts"
MIGRATIONS_FOLDER="./src/datasources/migrations"
MIGRATIONS_NAME=${1:-MIGRATION_NAME_NOT_DEFINED}
