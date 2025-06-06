import { Test } from '@nestjs/testing';
import { WebhookService } from './webhook.service';
import { Webhook } from './repositories/webhook.entity';
import { WebhookModule } from './webhook.module';
import { DatabaseModule } from '../../datasources/db/database.module';
import { ConfigModule } from '@nestjs/config';
import { WebhookRequestDto } from './dtos/webhook.dto';
import { DataSource, Repository } from 'typeorm';
import {
  WebhookAlreadyExists,
  WebhookDoesNotExist,
} from './exceptions/webhook.exceptions';

describe('Webhook service', () => {
  let webhookService: WebhookService;
  let dataSource: DataSource;
  let webhookRepository: Repository<Webhook>;
  const requestWebhook: WebhookRequestDto = {
    description: 'Awesome webhook',
    url: 'https://example.com/webhook',
    isActive: true,
    authorization: 'Bearer abc123secret',
    chains: [1, 137],
    events: [
      'SEND_CONFIRMATIONS',
      'SEND_TOKEN_TRANSFERS',
      'SEND_ETHER_TRANSFERS',
    ],
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot(), WebhookModule, DatabaseModule],
    }).compile();

    webhookService = moduleRef.get<WebhookService>(WebhookService);
    dataSource = moduleRef.get<DataSource>(DataSource);
    webhookRepository = dataSource.getRepository(Webhook);
    await webhookRepository.clear();
  });
  describe('Create Get Update Delete webhook', () => {
    it('Should create a webhook correclty', async () => {
      const webhook = await webhookService.createWebhook(requestWebhook);
      expect(webhook).not.toBeNull();
      expect(webhook?.id).not.toBeNull();
      expect(webhook?.url).toBe(requestWebhook.url);
      expect(webhook?.chains).toEqual(requestWebhook.chains);
      expect(webhook?.events.sort()).toEqual(requestWebhook.events.sort());
      const createdWebhook = await Webhook.findOneBy({
        id: webhook?.id,
      });
      expect(createdWebhook).not.toBeNull();
      expect(createdWebhook?.id).toBe(webhook?.id);
      expect(createdWebhook?.url).toBe(requestWebhook.url);
      expect(createdWebhook?.sendTokenTransfers).toBe(true);
      expect(createdWebhook?.sendEtherTransfers).toBe(true);
      expect(createdWebhook?.sendConfirmations).toBe(true);
      expect(createdWebhook?.sendMultisigTxs).toBe(false);
      expect(createdWebhook?.sendDelegates).toBe(false);
      expect(createdWebhook?.sendModuleTransactions).toBe(false);
      expect(createdWebhook?.sendSafeCreations).toBe(false);
      expect(createdWebhook?.sendMessages).toBe(false);
      expect(createdWebhook?.sendReorgs).toBe(false);
    });
    it('Should raise a exception webhook already exists', async () => {
      const webhook = await webhookService.createWebhook(requestWebhook);
      expect(webhook).not.toBeNull();
      await expect(
        webhookService.createWebhook(requestWebhook),
      ).rejects.toThrow(
        new WebhookAlreadyExists(
          'Key (url)=(https://example.com/webhook) already exists.',
        ),
      );
    });
    it('Should return null if webhook does not exist', async () => {
      const webhook = await webhookService.getWebhook(
        '88888888-e757-4b74-a40f-8dca14553576',
      );
      expect(webhook).toBeNull();
    });
    it('Should return the public webhook', async () => {
      const createdWebhook = await webhookService.createWebhook(requestWebhook);
      const webhook = await webhookService.getWebhook(createdWebhook.id);
      expect(webhook).not.toBeNull();
      expect(webhook).not.toBeNull();
      expect(webhook?.id).toBe(createdWebhook.id);
      expect(webhook?.url).toBe(requestWebhook.url);
      expect(webhook?.chains).toEqual(requestWebhook.chains);
      expect(webhook?.events.sort()).toEqual(requestWebhook.events.sort());
    });
    it('Should raise exception during upodate if webhook does not exist', async () => {
      await expect(
        webhookService.updateWebhook(
          '88888888-e757-4b74-a40f-8dca14553576',
          requestWebhook,
        ),
      ).rejects.toThrow(new WebhookDoesNotExist());
    });
    it('Should update the existing webhook', async () => {
      const createdWebhook = await webhookService.createWebhook(requestWebhook);
      requestWebhook.description = 'Modified description';
      requestWebhook.chains = [5];
      const updatedWebhook = await webhookService.updateWebhook(
        createdWebhook.id,
        requestWebhook,
      );
      expect(updatedWebhook.id).toBe(createdWebhook.id);
      expect(updatedWebhook.chains).toEqual([5]);
      expect(updatedWebhook.description).toBe('Modified description');
      // Check if was stored in database
      const storedWebhook = await webhookRepository.findOne({
        where: { id: createdWebhook.id },
      });
      expect(storedWebhook).not.toBeNull();
      expect(storedWebhook?.id).toBe(createdWebhook.id);
      expect(storedWebhook?.chains).toEqual(['5']);
      expect(storedWebhook?.description).toBe('Modified description');
    });
    it('Should raise webhook does not exist during delete', async () => {
      await expect(
        webhookService.deleteWebhook('88888888-e757-4b74-a40f-8dca14553576'),
      ).rejects.toThrow(new WebhookDoesNotExist());
    });
    it('Should delete a webhook', async () => {
      const createdWebhook = await webhookService.createWebhook(requestWebhook);
      await webhookService.deleteWebhook(createdWebhook.id);

      const storedWebhook = await webhookRepository.findOne({
        where: { id: createdWebhook.id },
      });
      expect(storedWebhook).toBeNull();
    });
  });
});
