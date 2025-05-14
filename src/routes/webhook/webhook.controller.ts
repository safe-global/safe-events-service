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
  UseGuards,
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
import { AdminWebhookGuard } from '../../auth/basic-auth.guard';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhookService: WebhookService) {}

  @UseGuards(AdminWebhookGuard)
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

  @UseGuards(AdminWebhookGuard)
  @Get(':id')
  @ApiOkResponse({ type: WebhookPublicDto })
  @ApiNotFoundResponse({ description: 'Webhook not found' })
  async getWebhookByUuid(
    @Param('id', ParseUUIDPipe) publicId: string,
  ): Promise<WebhookPublicDto> {
    const webhook = await this.webhookService.getWebhook(publicId);
    if (!webhook) {
      throw new WebhookDoesNotExist();
    }
    return webhook;
  }

  @UseGuards(AdminWebhookGuard)
  @Put(':id')
  @ApiBody({ type: WebhookRequestDto })
  @ApiResponse({
    status: 200,
    description: 'Webhook updated',
    type: WebhookPublicDto,
  })
  async updateWebhook(
    @Param('id', ParseUUIDPipe) publicId: string,
    @Body() body: WebhookRequestDto,
  ): Promise<WebhookPublicDto> {
    return await this.webhookService.updateWebhook(publicId, body);
  }

  @UseGuards(AdminWebhookGuard)
  @Delete(':id')
  @ApiResponse({
    status: 204,
    description: 'Webhook deleted',
  })
  @HttpCode(204)
  async deleteWebhook(@Param('id', ParseUUIDPipe) publicId: string) {
    await this.webhookService.deleteWebhook(publicId);
  }
}
