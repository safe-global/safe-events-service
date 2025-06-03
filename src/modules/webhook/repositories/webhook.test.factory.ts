import { faker } from '@faker-js/faker';
import { Webhook, WebhookWithStats } from './webhook.entity';

interface WebhookOptions {
  id?: string;
  url?: string;
  description?: string;
  isActive?: boolean;
  authorization?: string;
  chains?: string[];
  sendConfirmations?: boolean;
  sendMultisigTxs?: boolean;
  sendEtherTransfers?: boolean;
  sendTokenTransfers?: boolean;
  sendModuleTransactions?: boolean;
  sendSafeCreations?: boolean;
  sendMessages?: boolean;
  sendReorgs?: boolean;
  sendDelegates?: boolean;
}

export function webhookFactory(options: WebhookOptions = {}): Webhook {
  const webhook = new Webhook();
  webhook.id = options.id ?? faker.string.uuid();
  webhook.url = options.url ?? faker.internet.url();
  webhook.description = options.description ?? faker.lorem.sentence();
  webhook.isActive = options.isActive ?? true;
  webhook.authorization =
    options.authorization ?? `Bearer ${faker.string.alphanumeric(20)}`;
  webhook.chains = options.chains ?? [
    faker.number.int({ min: 1, max: 10 }).toString(),
  ];
  webhook.sendConfirmations =
    options.sendConfirmations ?? faker.datatype.boolean();
  webhook.sendMultisigTxs = options.sendMultisigTxs ?? faker.datatype.boolean();
  webhook.sendEtherTransfers =
    options.sendEtherTransfers ?? faker.datatype.boolean();
  webhook.sendTokenTransfers =
    options.sendTokenTransfers ?? faker.datatype.boolean();
  webhook.sendModuleTransactions =
    options.sendModuleTransactions ?? faker.datatype.boolean();
  webhook.sendSafeCreations =
    options.sendSafeCreations ?? faker.datatype.boolean();
  webhook.sendMessages = options.sendMessages ?? faker.datatype.boolean();
  webhook.sendReorgs = options.sendReorgs ?? faker.datatype.boolean();
  webhook.sendDelegates = options.sendDelegates ?? faker.datatype.boolean();
  return webhook;
}

export function webhookWithStatsFactory(
  options: WebhookOptions = {},
): WebhookWithStats {
  const webhookWithStats = Object.assign(
    new WebhookWithStats(),
    webhookFactory(options),
  );
  return webhookWithStats;
}
