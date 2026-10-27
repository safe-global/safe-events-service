import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import * as connectPgSimple from 'connect-pg-simple';
import * as session from 'express-session';
import { EnvironmentVariables } from '../../config/environment';
import { sslOptionsFromConfig } from '../../datasources/db/database.options';
import { Webhook } from '../webhook/repositories/webhook.entity';
import { getAdminBasePath } from './admin.constants';
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
    return AdminJsTestModule;
  }

  // Nest.js does not support ESM modules
  // This workaround is better than modifying tsconfig.json module resolution as
  // it brings issues with another libraries
  // https://stackoverflow.com/a/75287028/724991

  const { AdminJS } = await (eval(`import('adminjs')`) as Promise<any>);
  const AdminJSTypeorm = await (eval(
    `import('@adminjs/typeorm')`,
  ) as Promise<any>);
  AdminJS.registerAdapter({
    Resource: AdminJSTypeorm.Resource,
    Database: AdminJSTypeorm.Database,
  });
  const { AdminModule } = await (eval(
    `import('@adminjs/nestjs')`,
  ) as Promise<any>);
  return AdminModule.createAdminAsync({
    imports: [AuthModule],
    inject: [AuthService, ConfigService],
    useFactory: (
      authService: AuthService,
      configService: ConfigService<EnvironmentVariables, true>,
    ) => {
      const logger = new Logger('AdminJsSessionPool');
      const adminBasePath = getAdminBasePath(
        configService.get('URL_BASE_PATH', { infer: true }),
      );
      const sessionPool = new Pool({
        connectionString: configService.get('DATABASE_URL', { infer: true }),
        max: 2,
        ssl: sslOptionsFromConfig(configService),
      });
      // Without a listener, an idle client error crashes the process
      sessionPool.on('error', (error) => {
        logger.error(`Session pool error: ${error.message}`);
      });
      return {
        adminJsOptions: {
          rootPath: adminBasePath,
          loginPath: adminBasePath + '/login',
          logoutPath: adminBasePath + '/logout',
          resources: [Webhook],
        },
        auth: {
          authenticate: (email: string, password: string) =>
            authService.authenticate(email, password),
          cookieName: 'adminjs',
          cookiePassword: configService.get('ADMIN_COOKIE_SECRET', {
            infer: true,
          }),
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
          secret: configService.get('ADMIN_SESSION_SECRET', { infer: true }),
        },
      };
    },
  });
}

export const AdminJsModule = buildAdminJsModule();
