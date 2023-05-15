import { Webhook } from 'src/routes/webhook/entities/webhook.entity';

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
  const AdminJSTypeorm = await import('@adminjs/typeorm');
  const { AdminJS } = await import('adminjs');
  AdminJS.registerAdapter({
    Resource: AdminJSTypeorm.Resource,
    Database: AdminJSTypeorm.Database,
  });
  const { AdminModule } = await import('@adminjs/nestjs');
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
  })
}

export const AdminJsModule = buildAdminJsModule()