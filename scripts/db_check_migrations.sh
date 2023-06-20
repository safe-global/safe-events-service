#/bin/bash

source ./scripts/db_config.sh


# Fails if there are pending migrations to generate
npx typeorm-ts-node-commonjs schema:drop -d $ORMCONFIG
npx typeorm-ts-node-commonjs migration:run -d $ORMCONFIG
npx typeorm-ts-node-commonjs migration:generate "$MIGRATIONS_FOLDER/$MIGRATIONS_NAME" -d $ORMCONFIG

retVal=$?
if [ $retVal -ne 0 ]; then
    exit 0
fi
exit 1
