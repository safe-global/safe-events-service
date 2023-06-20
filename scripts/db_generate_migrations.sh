#!/bin/bash

source ./scripts/db_config.sh

set -eux

echo "Cleaning migrations database"
npx typeorm-ts-node-commonjs schema:drop -d $ORMCONFIG
npx typeorm-ts-node-commonjs migration:show -d $ORMCONFIG
echo "Run previous migrations"
npx typeorm-ts-node-commonjs migration:run -d $ORMCONFIG
echo "Generate new migrations"
npx typeorm-ts-node-commonjs migration:generate "$MIGRATIONS_FOLDER/$MIGRATIONS_NAME" -d $ORMCONFIG
echo "Check that new migrations are valid"
npx typeorm-ts-node-commonjs migration:run -d $ORMCONFIG
npx typeorm-ts-node-commonjs migration:show -d $ORMCONFIG
