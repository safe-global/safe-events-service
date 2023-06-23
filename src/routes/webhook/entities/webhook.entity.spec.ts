import { TxServiceEvent, TxServiceEventType } from '../../events/event.dto';
import { Webhook } from './webhook.entity';

const txServiceEvent: TxServiceEvent = {
  chainId: '1',
  type: 'NEW_CONFIRMATION' as TxServiceEventType,
  hero: 'Saitama',
  address: '0x0275FC2adfF11270F3EcC4D2F7Aa0a9784601Ca6',
};

describe('Webhook entity', () => {
  let webhook: Webhook;

  beforeEach(async () => {
    webhook = new Webhook();
    webhook.sendConfirmations = true;
    webhook.sendMultisigTxs = true;
    webhook.sendEtherTransfers = true;
    webhook.sendTokenTransfers = true;
    webhook.sendModuleTransactions = true;
    webhook.sendSafeCreations = true;
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
});
