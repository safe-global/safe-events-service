import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiNotFoundResponse, ApiTags } from '@nestjs/swagger';
import { Webhook } from './entities/webhook.entity';
import { WebhookService } from './webhook.service';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Get(':uuid')
  @ApiOkResponse({ type: Webhook })
  @ApiNotFoundResponse({ description: 'Webhook not found' })
  async getWebhookByUuid(@Param('uuid') uuid: string): Promise<Webhook> {
    const webhook = await this.webhookService.getWebHook(uuid);

    if (!webhook) {
      throw new Error('Webhook not found');
    }

    return webhook;
  }
}
