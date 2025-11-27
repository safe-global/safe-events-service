import { Module } from '@nestjs/common';
import { Webhook } from '../webhook/repositories/webhook.entity';
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
  const basePath = (process.env.URL_BASE_PATH || '') + '/admin';
  return AdminModule.createAdminAsync({
    imports: [AuthModule],
    inject: [AuthService],
    useFactory: (authService: AuthService) => ({
      adminJsOptions: {
        rootPath: basePath,
        loginPath: basePath + '/login',
        logoutPath: basePath + '/logout',
        resources: [Webhook],
      },
      auth: {
        authenticate: (email: string, password: string) =>
          authService.authenticate(email, password),
        cookieName: 'adminjs',
        cookiePassword: 'secret',
      },
      sessionOptions: {
        resave: true,
        saveUninitialized: true,
        secret: 'secret',
      },
    }),
  });
}

export const AdminJsModule = buildAdminJsModule();
