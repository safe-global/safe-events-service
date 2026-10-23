import { Webhook } from '../../modules/webhook/repositories/webhook.entity';
import type { ConfigService } from '@nestjs/config';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { readFileSync } from 'fs';
import type { EnvironmentVariables } from '../../config/environment';

export interface SslOptions {
  ca?: Buffer;
  rejectUnauthorized: boolean;
}

/**
 * TLS options for the Postgres connection, or `undefined` when SSL is off.
 * With a CA file the server certificate is verified; without one any
 * certificate is accepted.
 */
export function buildSslOptions(
  enabled: boolean,
  caPath: string | undefined,
): SslOptions | undefined {
  if (!enabled) {
    return undefined;
  }
  return caPath
    ? { ca: readFileSync(caPath), rejectUnauthorized: true }
    : { rejectUnauthorized: false };
}

export function sslOptionsFromConfig(
  configService: ConfigService<EnvironmentVariables, true>,
): SslOptions | undefined {
  return buildSslOptions(
    configService.get('DATABASE_SSL_ENABLED', { infer: true }),
    configService.get('DATABASE_CA_PATH', { infer: true }),
  );
}

/**
 * Options shared by the app and the TypeORM CLI. Connection settings are added
 * by each one: the app reads them through ConfigService, the CLI from
 * `process.env` in `ormconfig.ts`.
 */
export const baseDataSourceOptions: PostgresConnectionOptions = {
  type: 'postgres',
  entities: [Webhook],
  migrations: [__dirname + '/migrations/**/*{.ts,.js}'],
};
