import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Webhook } from './repositories/webhook.entity';
import { WebhookPublicDto, WebhookRequestDto } from './dtos/webhook.dto';
import { plainToInstance } from 'class-transformer';
import {
  WebhookAlreadyExists,
  WebhookDoesNotExist,
  WebhookUrlNotPublic,
} from './exceptions/webhook.exceptions';
import { DUPLICATED_KEY_ERROR } from '../../datasources/db/postgres.errors';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../../config/environment';
import { hasPublicHost } from './public-address';

@Injectable()
export class WebhookService {
  private readonly allowNonPublicTargets: boolean;

  constructor(
    @InjectRepository(Webhook)
    private readonly webhooksRepository: Repository<Webhook>,
    configService: ConfigService<EnvironmentVariables, true>,
  ) {
    this.allowNonPublicTargets = configService.get(
      'WEBHOOK_ALLOW_NON_PUBLIC_TARGETS',
      { infer: true },
    );
  }

  private assertWebhookUrlIsAllowed(url: string): void {
    if (!this.allowNonPublicTargets && !hasPublicHost(url)) {
      throw new WebhookUrlNotPublic();
    }
  }

  /**
   * Get public webhook by its ID.
   * @param publicId
   * @returns PublicWebhook
   */
  async getWebhook(publicId: string): Promise<WebhookPublicDto | null> {
    const webhook = await Webhook.findOneBy({ id: publicId });
    return webhook ? webhook.toPublicDto() : null;
  }

  /**
   * Create a webhook from the provided data.
   * Generates a random uuid for publicId.
   * @param requestData
   * @returns stored webhook.
   */
  async createWebhook(
    requestData: WebhookRequestDto,
  ): Promise<WebhookPublicDto> {
    this.assertWebhookUrlIsAllowed(requestData.url);
    const publicId = randomUUID();
    const webhookDto = {
      ...requestData,
      id: publicId,
    };
    const publicWebhookDto = plainToInstance(WebhookPublicDto, webhookDto);
    const webhook = Webhook.fromPublicDto(publicWebhookDto);
    try {
      const saved = await webhook.save();
      return saved.toPublicDto();
    } catch (error) {
      if (error instanceof QueryFailedError) {
        if (error.driverError.code === DUPLICATED_KEY_ERROR) {
          throw new WebhookAlreadyExists(error.driverError.detail);
        }
      }
      // Unexpected error
      throw error;
    }
  }

  /**
   * Update a Webhook with the provided request data by publicId
   * @param publicId
   * @param requestData
   * @returns Public Webhook DTO
   */
  async updateWebhook(
    publicId: string,
    requestData: WebhookRequestDto,
  ): Promise<WebhookPublicDto> {
    const webhookStored = await Webhook.findOneBy({ id: publicId });
    if (webhookStored == null) {
      throw new WebhookDoesNotExist();
    }
    this.assertWebhookUrlIsAllowed(requestData.url);
    const webhookDto = {
      ...requestData,
      id: webhookStored.id,
    };
    const publicWebhookDto = plainToInstance(WebhookPublicDto, webhookDto);
    const webhook = Webhook.fromPublicDto(publicWebhookDto);
    const saved = await this.webhooksRepository.save(webhook);
    return saved.toPublicDto();
  }

  /**
   * Removes a Webhook
   * @param publicId
   */
  async deleteWebhook(publicId: string) {
    const result = await this.webhooksRepository.delete({ id: publicId });

    if (result.affected === 0) {
      throw new WebhookDoesNotExist();
    }
  }
}
