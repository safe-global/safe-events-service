import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Webhook } from './repositories/webhook.entity';
import { WebhookPublicDto, WebhookRequestDto } from './dtos/webhook.dto';
import { v4 as uuidv4 } from 'uuid';
import { plainToInstance } from 'class-transformer';
import {
  WebhookAlreadyExists,
  WebhookDoesNotExist,
} from './exceptions/webhook.exceptions';
import { DUPLICATED_KEY_ERROR } from '../../datasources/db/postgres.errors';

export class WebhookService {
  constructor(
    @InjectRepository(Webhook)
    private readonly WebHooksRepository: Repository<Webhook>,
  ) {}
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
    const publicId = uuidv4();
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
    const webhookDto = {
      ...requestData,
      id: webhookStored.id,
    };
    const publicWebhookDto = plainToInstance(WebhookPublicDto, webhookDto);
    const webhook = Webhook.fromPublicDto(publicWebhookDto);
    const saved = await this.WebHooksRepository.save(webhook);
    return saved.toPublicDto();
  }

  /**
   * Removes a Webhook
   * @param publicId
   */
  async deleteWebhook(publicId: string) {
    const result = await this.WebHooksRepository.delete({ id: publicId });

    if (result.affected === 0) {
      throw new WebhookDoesNotExist();
    }
  }
}
