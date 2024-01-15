import { Webhook } from '../../routes/webhook/entities/webhook.entity';
import { DataSourceOptions } from 'typeorm';
import { readFileSync } from 'fs';
/**
 * Use process.env for configuration instead of Nest.js ConfigService
 * as it cannot be used by TypeORM CLI to generate and run migrations
 */
export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  url: process.env.MIGRATIONS_DATABASE_URL,
  entities: [Webhook],
  migrations: [__dirname + '/../migrations/**/*{.ts,.js}'],
  ...(process.env.DATABASE_SSL_ENABLED == 'true'
    ? {
        ssl: process.env.DATABASE_CA_PATH
          ? {
              ca: readFileSync(process.env.DATABASE_CA_PATH),
              rejectUnauthorized: true,
            }
          : {
              rejectUnauthorized: false,
            },
      }
    : {}),
};
