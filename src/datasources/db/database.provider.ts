import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Environment, EnvironmentVariables } from '../../config/environment';
import {
  baseDataSourceOptions,
  sslOptionsFromConfig,
} from './database.options';

/**
 * Environments where TypeORM syncs the schema from the entities on startup.
 * Sync can drop columns and data, so it is an allow-list: any other
 * environment, production included, relies on migrations.
 */
const SCHEMA_SYNC_ENVIRONMENTS: ReadonlySet<Environment> = new Set([
  Environment.Dev,
  Environment.Development,
  Environment.Test,
]);

export function isSchemaSyncEnabled(nodeEnv: Environment): boolean {
  return SCHEMA_SYNC_ENVIRONMENTS.has(nodeEnv);
}

export const databaseProvider = TypeOrmModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (configService: ConfigService<EnvironmentVariables, true>) => ({
    ...baseDataSourceOptions,
    url: configService.get('DATABASE_URL', { infer: true }),
    ssl: sslOptionsFromConfig(configService),
    autoLoadEntities: true,
    synchronize: isSchemaSyncEnabled(
      configService.get('NODE_ENV', { infer: true }),
    ),
  }),
});
