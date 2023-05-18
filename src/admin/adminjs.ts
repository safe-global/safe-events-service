import { Webhook } from '../routes/webhook/entities/webhook.entity';

const DEFAULT_ADMIN = {
  email: 'admin@example.com',
  password: 'password',
};

const authenticate = async (email: string, password: string) => {
  if (email === DEFAULT_ADMIN.email && password === DEFAULT_ADMIN.password) {
    return Promise.resolve(DEFAULT_ADMIN);
  }
  return null;
};

async function buildAdminJsModule() {
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
    useFactory: () => ({
      adminJsOptions: {
        rootPath: '/admin',
        resources: [Webhook],
      },
      auth: {
        authenticate,
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
