import { Controller, Get } from '@nestjs/common';
import { Webhook } from './entities/webhook.entity';
import { WebhookService } from './webhook.service';

@Controller('webhooks')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Get()
  getWebhookList(): Promise<Webhook[]> {
    return this.webhookService.findAll();
  }
}
