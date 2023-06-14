import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

export const databaseProvider = TypeOrmModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: (configService: ConfigService) => ({
    type: 'postgres',
    url: configService.get('DATABASE_URL'),
    entities: [],
    autoLoadEntities: true,
    synchronize: configService.get('NODE_ENV') !== 'production', // TODO False in production
  }),
  inject: [ConfigService],
});
