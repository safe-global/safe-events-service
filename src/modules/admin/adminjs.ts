import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import connectPgSimple from 'connect-pg-simple';
import session from 'express-session';
import { dataSourceOptions } from '../../datasources/db/database.options';
import { Webhook } from '../webhook/repositories/webhook.entity';
import { ADMIN_BASE_PATH } from './admin.constants';
import { AuthModule } from './auth/auth.module';
import { AuthService } from './auth/auth.service';

// Empty module placeholder for test environment
@Module({})
class AdminJsTestModule {}

async function buildAdminJsModule() {
  // Skip loading AdminJS in test environment to avoid rollup's CustomGC handle
  // which keeps Jest from exiting cleanly
  if (process.env.JEST_WORKER_ID !== undefined) {
    console.log('Skipping AdminJS in test environment');
    return { module: AdminJsTestModule };
  }

  const { default: AdminJS } = await import('adminjs');
  const { Resource, Database } = await import('@adminjs/typeorm');
  AdminJS.registerAdapter({ Resource, Database });
  const { AdminModule } = await import('@adminjs/nestjs');
  return AdminModule.createAdminAsync({
    imports: [AuthModule, ConfigModule],
    inject: [AuthService, ConfigService],
    useFactory: (authService: AuthService, configService: ConfigService) => {
      const logger = new Logger('AdminJsSessionPool');
      const sessionPool = new Pool({
        connectionString: configService.get('DATABASE_URL'),
        max: 2,
        ...('ssl' in dataSourceOptions ? { ssl: dataSourceOptions.ssl } : {}),
      });
      // Without a listener, an idle client error crashes the process
      sessionPool.on('error', (error) => {
        logger.error(`Session pool error: ${error.message}`);
      });
      return {
        adminJsOptions: {
          rootPath: ADMIN_BASE_PATH,
          loginPath: ADMIN_BASE_PATH + '/login',
          logoutPath: ADMIN_BASE_PATH + '/logout',
          resources: [Webhook],
        },
        auth: {
          authenticate: (email: string, password: string) =>
            authService.authenticate(email, password),
          cookieName: 'adminjs',
          cookiePassword: configService.getOrThrow('ADMIN_COOKIE_SECRET'),
        },
        sessionOptions: {
          // Sessions must be shared across replicas: the default MemoryStore is
          // per-pod, so any request routed to another pod loses the session
          store: new (connectPgSimple(session))({
            pool: sessionPool,
            tableName: 'admin_sessions',
          }),
          resave: false,
          saveUninitialized: false,
          secret: configService.getOrThrow('ADMIN_SESSION_SECRET'),
        },
      };
    },
  });
}

export const AdminJsModule = buildAdminJsModule();
