import { databaseProvider } from './database.provider';
import { Module } from '@nestjs/common';
@Module({
  imports: [databaseProvider],
  exports: [databaseProvider],
})
export class DatabaseModule {}
