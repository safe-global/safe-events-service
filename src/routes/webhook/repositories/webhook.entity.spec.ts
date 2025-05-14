import { TxServiceEvent, TxServiceEventType } from '../../events/event.dto';
import { Webhook } from './webhook.entity';
import { WebhookPublicDto } from '../dtos/webhook.dto';

describe('Webhook entity', () => {
  let txServiceEvent: TxServiceEvent;
  let webhook: Webhook;

  beforeEach(async () => {
    txServiceEvent = {
      chainId: '1',
      type: 'NEW_CONFIRMATION' as TxServiceEventType,
      hero: 'Saitama',
      address: '0x0275FC2adfF11270F3EcC4D2F7Aa0a9784601Ca6',
    };
    webhook = new Webhook();
    webhook.chains = [];
    webhook.sendConfirmations = true;
    webhook.sendMultisigTxs = true;
    webhook.sendEtherTransfers = true;
    webhook.sendTokenTransfers = true;
    webhook.sendModuleTransactions = true;
    webhook.sendSafeCreations = true;
    webhook.sendMessages = true;
    webhook.sendReorgs = true;
    webhook.sendDelegates = true;
  });

  it('If chain is set, only those chain messages will be sent', async () => {
    expect(webhook.isEventRelevant(txServiceEvent)).toBe(true);
    webhook.chains = ['4', '100'];
    expect(webhook.isEventRelevant(txServiceEvent)).toBe(false);
    webhook.chains = ['1', '4', '100'];
    expect(webhook.isEventRelevant(txServiceEvent)).toBe(true);
    txServiceEvent.chainId = '5';
    expect(webhook.isEventRelevant(txServiceEvent)).toBe(false);
    webhook.chains = ['5'];
    expect(webhook.isEventRelevant(txServiceEvent)).toBe(true);
    webhook.chains = [];
    expect(webhook.isEventRelevant(txServiceEvent)).toBe(true);
  });

  it('NEW_CONFIRMATION should not be relevant if sendConfirmations is disabled', async () => {
    txServiceEvent.type = 'NEW_CONFIRMATION' as TxServiceEventType;
    expect(webhook.isEventRelevant(txServiceEvent)).toBe(true);
    webhook.sendConfirmations = false;
    expect(webhook.isEventRelevant(txServiceEvent)).toBe(false);
  });

  it('CONFIRMATION_REQUEST should not be relevant if sendConfirmations is disabled', async () => {
    txServiceEvent.type = 'CONFIRMATION_REQUEST' as TxServiceEventType;
    expect(webhook.isEventRelevant(txServiceEvent)).toBe(true);
    webhook.sendConfirmations = false;
    expect(webhook.isEventRelevant(txServiceEvent)).toBe(false);
  });

  it('PENDING_MULTISIG_TRANSACTION should not be relevant if sendMultisigTxs is disabled', async () => {
    txServiceEvent.type = 'PENDING_MULTISIG_TRANSACTION' as TxServiceEventType;
    expect(webhook.isEventRelevant(txServiceEvent)).toBe(true);
    webhook.sendMultisigTxs = false;
    expect(webhook.isEventRelevant(txServiceEvent)).toBe(false);
  });

  it('EXECUTED_MULTISIG_TRANSACTION should not be relevant if sendMultisigTxs is disabled', async () => {
    txServiceEvent.type = 'EXECUTED_MULTISIG_TRANSACTION' as TxServiceEventType;
    expect(webhook.isEventRelevant(txServiceEvent)).toBe(true);
    webhook.sendMultisigTxs = false;
    expect(webhook.isEventRelevant(txServiceEvent)).toBe(false);
  });

  it('DELETED_MULTISIG_TRANSACTION should not be relevant if sendMultisigTxs is disabled', async () => {
    txServiceEvent.type = 'DELETED_MULTISIG_TRANSACTION' as TxServiceEventType;
    expect(webhook.isEventRelevant(txServiceEvent)).toBe(true);
    webhook.sendMultisigTxs = false;
    expect(webhook.isEventRelevant(txServiceEvent)).toBe(false);
  });

  it('INCOMING_ETHER should not be relevant if sendEtherTransfers is disabled', async () => {
    txServiceEvent.type = 'INCOMING_ETHER' as TxServiceEventType;
    expect(webhook.isEventRelevant(txServiceEvent)).toBe(true);
    webhook.sendEtherTransfers = false;
    expect(webhook.isEventRelevant(txServiceEvent)).toBe(false);
  });

  it('OUTGOING_ETHER should not be relevant if sendEtherTransfers is disabled', async () => {
    txServiceEvent.type = 'OUTGOING_ETHER' as TxServiceEventType;
    expect(webhook.isEventRelevant(txServiceEvent)).toBe(true);
    webhook.sendEtherTransfers = false;
    expect(webhook.isEventRelevant(txServiceEvent)).toBe(false);
  });

  it('INCOMING_TOKEN should not be relevant if sendTokenTransfers is disabled', async () => {
    txServiceEvent.type = 'INCOMING_TOKEN' as TxServiceEventType;
    expect(webhook.isEventRelevant(txServiceEvent)).toBe(true);
    webhook.sendTokenTransfers = false;
    expect(webhook.isEventRelevant(txServiceEvent)).toBe(false);
  });

  it('OUTGOING_TOKEN should not be relevant if sendTokenTransfers is disabled', async () => {
    txServiceEvent.type = 'OUTGOING_TOKEN' as TxServiceEventType;
    expect(webhook.isEventRelevant(txServiceEvent)).toBe(true);
    webhook.sendTokenTransfers = false;
    expect(webhook.isEventRelevant(txServiceEvent)).toBe(false);
  });

  it('MODULE_TRANSACTION should not be relevant if sendModuleTransactions is disabled', async () => {
    txServiceEvent.type = 'MODULE_TRANSACTION' as TxServiceEventType;
    expect(webhook.isEventRelevant(txServiceEvent)).toBe(true);
    webhook.sendModuleTransactions = false;
    expect(webhook.isEventRelevant(txServiceEvent)).toBe(false);
  });

  it('SAFE_CREATED should not be relevant if sendTokenTransfers is disabled', async () => {
    txServiceEvent.type = 'SAFE_CREATED' as TxServiceEventType;
    expect(webhook.isEventRelevant(txServiceEvent)).toBe(true);
    webhook.sendSafeCreations = false;
    expect(webhook.isEventRelevant(txServiceEvent)).toBe(false);
  });

  it('MESSAGE_CREATED should not be relevant if sendMessages is disabled', async () => {
    txServiceEvent.type = 'MESSAGE_CREATED' as TxServiceEventType;
    expect(webhook.isEventRelevant(txServiceEvent)).toBe(true);
    webhook.sendMessages = false;
    expect(webhook.isEventRelevant(txServiceEvent)).toBe(false);
  });

  it('MESSAGE_CONFIRMATION should not be relevant if sendMessages is disabled', async () => {
    txServiceEvent.type = 'MESSAGE_CONFIRMATION' as TxServiceEventType;
    expect(webhook.isEventRelevant(txServiceEvent)).toBe(true);
    webhook.sendMessages = false;
    expect(webhook.isEventRelevant(txServiceEvent)).toBe(false);
  });

  it('REORG_DETECTED should not be relevant if sendReorgs is disabled', async () => {
    txServiceEvent.type = 'REORG_DETECTED' as TxServiceEventType;
    expect(webhook.isEventRelevant(txServiceEvent)).toBe(true);
    webhook.sendReorgs = false;
    expect(webhook.isEventRelevant(txServiceEvent)).toBe(false);
  });

  it('NEW_DELEGATE should not be relevant if sendDelegates is disabled', async () => {
    txServiceEvent.type = 'NEW_DELEGATE' as TxServiceEventType;
    expect(webhook.isEventRelevant(txServiceEvent)).toBe(true);
    webhook.sendDelegates = false;
    expect(webhook.isEventRelevant(txServiceEvent)).toBe(false);
  });

  it('UPDATED_DELEGATE should not be relevant if sendDelegates is disabled', async () => {
    txServiceEvent.type = 'UPDATED_DELEGATE' as TxServiceEventType;
    expect(webhook.isEventRelevant(txServiceEvent)).toBe(true);
    webhook.sendDelegates = false;
    expect(webhook.isEventRelevant(txServiceEvent)).toBe(false);
  });

  it('DELETED_DELEGATE should not be relevant if sendDelegates is disabled', async () => {
    txServiceEvent.type = 'DELETED_DELEGATE' as TxServiceEventType;
    expect(webhook.isEventRelevant(txServiceEvent)).toBe(true);
    webhook.sendDelegates = false;
    expect(webhook.isEventRelevant(txServiceEvent)).toBe(false);
  });

  it('Webhook should be converted right to public webhook', async () => {
    let public_webhook = webhook.toPublicDto();
    expect(public_webhook.id).toBe(webhook.publicId);
    expect(public_webhook.description).toBe(webhook.description);
    expect(public_webhook.url).toBe(webhook.url);
    expect(public_webhook.authorization).toBe(webhook.authorization);
    expect(public_webhook.chains).toHaveLength(0);
    expect(public_webhook.events).toHaveLength(9);
    expect(public_webhook.events).toContain('SEND_CONFIRMATIONS');
    expect(public_webhook.events).toContain('SEND_MULTISIG_TXS');
    expect(public_webhook.events).toContain('SEND_ETHER_TRANSFERS');
    expect(public_webhook.events).toContain('SEND_TOKEN_TRANSFERS');
    expect(public_webhook.events).toContain('SEND_MODULE_TXS');
    expect(public_webhook.events).toContain('SEND_SAFE_CREATIONS');
    expect(public_webhook.events).toContain('SEND_MESSAGES');
    expect(public_webhook.events).toContain('SEND_REORGS');
    expect(public_webhook.events).toContain('SEND_DELEGATES');
    webhook.chains = ['4', '100'];
    webhook.sendConfirmations = false;
    public_webhook = webhook.toPublicDto();
    expect(public_webhook.chains).toHaveLength(2);
    expect(public_webhook.events).toHaveLength(8);
    expect(public_webhook.events).not.toContain('confirmations');
  });

  it('Public Webhook should be converted right to Webhook', async () => {
    const public_webhook: WebhookPublicDto = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      description: 'Awesome webhook',
      url: 'https://example.com/webhook',
      authorization: 'Bearer abc123secret',
      chains: [1, 137],
      isActive: true,
      events: [
        'SEND_CONFIRMATIONS',
        'SEND_TOKEN_TRANSFERS',
        'SEND_ETHER_TRANSFERS',
      ],
    };
    const generated_webhook = Webhook.fromPublicDto(public_webhook);
    expect(generated_webhook.publicId).toBe(public_webhook.id);
    expect(generated_webhook.description).toBe(public_webhook.description);
    expect(generated_webhook.url).toBe(public_webhook.url);
    expect(generated_webhook.isActive).toBe(true);
    expect(generated_webhook.authorization).toBe(public_webhook.authorization);
    expect(generated_webhook.chains).toHaveLength(2);
    expect(generated_webhook.sendConfirmations).toBe(true);
    expect(generated_webhook.sendTokenTransfers).toBe(true);
    expect(generated_webhook.sendEtherTransfers).toBe(true);
    expect(generated_webhook.sendMultisigTxs).toBe(false);
    expect(generated_webhook.sendDelegates).toBe(false);
    expect(generated_webhook.sendModuleTransactions).toBe(false);
    expect(generated_webhook.sendSafeCreations).toBe(false);
    expect(generated_webhook.sendMessages).toBe(false);
    expect(generated_webhook.sendReorgs).toBe(false);
  });
});
