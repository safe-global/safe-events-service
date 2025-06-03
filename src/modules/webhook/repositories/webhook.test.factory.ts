import { faker } from '@faker-js/faker';
import { Webhook, WebhookWithStats } from './webhook.entity';

export function webhookFactory(): Webhook {
  const webhook = new Webhook();
  webhook.id = faker.string.uuid();
  webhook.url = faker.internet.url();
  webhook.description = faker.lorem.sentence();
  webhook.isActive = true;
  webhook.authorization = `Bearer ${faker.string.alphanumeric(20)}`;
  webhook.chains = [faker.number.int({ min: 1, max: 10 }).toString()];
  webhook.sendConfirmations = faker.datatype.boolean();
  webhook.sendMultisigTxs = faker.datatype.boolean();
  webhook.sendEtherTransfers = faker.datatype.boolean();
  webhook.sendTokenTransfers = faker.datatype.boolean();
  webhook.sendModuleTransactions = faker.datatype.boolean();
  webhook.sendSafeCreations = faker.datatype.boolean();
  webhook.sendMessages = faker.datatype.boolean();
  webhook.sendReorgs = faker.datatype.boolean();
  webhook.sendDelegates = faker.datatype.boolean();
  return webhook;
}

export function webhookWithStatsFactory(): WebhookWithStats {
  const webhookWithStats = Object.assign(
    new WebhookWithStats(),
    webhookFactory(),
  );
  return webhookWithStats;
}
