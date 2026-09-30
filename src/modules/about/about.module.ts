import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AboutController } from './about.controller';
import { AboutService } from './about.service';

@Module({
  imports: [ConfigModule],
  controllers: [AboutController],
  providers: [AboutService],
})
export class AboutModule {}
