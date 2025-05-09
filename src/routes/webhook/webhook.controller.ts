import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiTags,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';
import { WebhookPublicDto } from './dtos/webhook.dto';
import { WebhookService } from './webhook.service';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Get(':uuid')
  @ApiOkResponse({ type: WebhookPublicDto })
  @ApiNotFoundResponse({ description: 'Webhook not found' })
  async getWebhookByUuid(
    @Param('uuid') uuid: string,
  ): Promise<WebhookPublicDto> {
    const webhook = await this.webhookService.getWebHook(uuid);
    if (!webhook) {
      throw new Error('Webhook not found');
    }
    return webhook;
  }

  @Post()
  @ApiBody({ type: WebhookPublicDto })
  @ApiResponse({
    status: 201,
    description: 'Webhook created',
    type: WebhookPublicDto,
  })
  async createWebhook(
    @Body() body: WebhookPublicDto,
  ): Promise<WebhookPublicDto> {
    return await this.webhookService.createWebhook(body);
  }
}
