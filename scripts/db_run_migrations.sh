#!/bin/bash

source ./scripts/db_config.sh

set -ux

npx typeorm-ts-node-commonjs migration:show -d $ORMCONFIG
echo "Run previous migrations"
npx typeorm-ts-node-commonjs migration:run -d $ORMCONFIG
echo "Generate new migrations"
npx typeorm-ts-node-commonjs migration:show -d $ORMCONFIG
