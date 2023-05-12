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

export const AdminJsModule = import('@adminjs/typeorm').then((AdminJSTypeorm) =>
  import('adminjs').then(({ AdminJS }) => {
    AdminJS.registerAdapter({
      Resource: AdminJSTypeorm.Resource,
      Database: AdminJSTypeorm.Database,
    });
    return import('@adminjs/nestjs').then(({ AdminModule }) =>
      AdminModule.createAdminAsync({
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
      }),
    );
  }),
);
