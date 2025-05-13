import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiTags,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';
import { WebhookPublicDto, WebhookRequestDto } from './dtos/webhook.dto';
import { WebhookService } from './webhook.service';
import { WebhookDoesNotExist } from './exceptions/webhook.exceptions';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post()
  @ApiBody({ type: WebhookRequestDto })
  @ApiResponse({
    status: 201,
    description: 'Webhook created',
    type: WebhookPublicDto,
  })
  async createWebhook(
    @Body() body: WebhookRequestDto,
  ): Promise<WebhookPublicDto> {
    return await this.webhookService.createWebhook(body);
  }

  @Get(':id')
  @ApiOkResponse({ type: WebhookPublicDto })
  @ApiNotFoundResponse({ description: 'Webhook not found' })
  async getWebhookByUuid(
    @Param('id', ParseUUIDPipe) public_id: string,
  ): Promise<WebhookPublicDto> {
    const webhook = await this.webhookService.getWebhook(public_id);
    if (!webhook) {
      throw new WebhookDoesNotExist();
    }
    return webhook;
  }

  @Put(':id')
  @ApiBody({ type: WebhookRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Webhook updated',
    type: WebhookPublicDto,
  })
  async updateWebhook(
    @Param('id', ParseUUIDPipe) public_id: string,
    @Body() body: WebhookRequestDto,
  ): Promise<WebhookPublicDto> {
    return await this.webhookService.updateWebhook(public_id, body);
  }

  @Delete(':id')
  @ApiResponse({
    status: 204,
    description: 'Webhook deleted',
  })
  @HttpCode(204)
  async deleteWebhook(@Param('id', ParseUUIDPipe) public_id: string) {
    await this.webhookService.deleteWebhook(public_id);
  }
}
