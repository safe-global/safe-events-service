import { DataSource } from 'typeorm';
import { parseBoolean } from '../../config/environment';
import { baseDataSourceOptions, buildSslOptions } from './database.options';

/**
 * Data source for the TypeORM CLI, which generates and runs migrations outside
 * Nest. It cannot use ConfigService, so it reads `process.env` directly.
 */
export const datasource = new DataSource({
  ...baseDataSourceOptions,
  url: process.env.MIGRATIONS_DATABASE_URL,
  ssl: buildSslOptions(
    parseBoolean(process.env.DATABASE_SSL_ENABLED) === true,
    process.env.DATABASE_CA_PATH || undefined,
  ),
});
