#!/bin/bash

source ./scripts/db_config.sh

set -eux

# Typescript is not installed on dockerfile, use js
ORMCONFIG="./dist/datasources/db/ormconfig.js"

npx typeorm migration:show -d $ORMCONFIG
echo "Run migrations"
npx typeorm migration:run -d $ORMCONFIG
npx typeorm migration:show -d $ORMCONFIG
