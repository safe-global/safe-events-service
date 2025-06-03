import { Entity, Column, PrimaryGeneratedColumn, BaseEntity } from 'typeorm';
import { TxServiceEvent } from '../../events/event.dto';
import { SendEventTypes, WebhookPublicDto } from '../dtos/webhook.dto';

@Entity()
export class Webhook extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, type: 'varchar', length: 300 })
  url: string;

  @Column({ type: 'varchar', length: 300 })
  description: string;

  @Column({ default: true })
  isActive: boolean;

  @Column()
  authorization: string;

  @Column('bigint', { array: true, default: [] })
  chains: string[];

  @Column({ default: true })
  sendConfirmations: boolean;

  @Column({ default: true })
  sendMultisigTxs: boolean;

  @Column({ default: true })
  sendEtherTransfers: boolean;

  @Column({ default: true })
  sendTokenTransfers: boolean;

  @Column({ default: true })
  sendModuleTransactions: boolean;

  @Column({ default: true })
  sendSafeCreations: boolean;

  @Column({ default: true })
  sendMessages: boolean;

  @Column({ default: true })
  sendReorgs: boolean;

  @Column({ default: true })
  sendDelegates: boolean;

  /**
   * Check if event chainId matches the one of the webhook (everything will match if webhook chains are empty). Check if event
   * type matches the flags enabled for the webhook
   * @param message
   * @returns true if event is relevant.
   */
  isEventRelevant(message: TxServiceEvent): boolean {
    const chainMatches: boolean =
      this.chains.length === 0 || this.chains.includes(message.chainId);
    return (
      chainMatches &&
      ((this.sendConfirmations &&
        (message.type === 'NEW_CONFIRMATION' ||
          message.type === 'CONFIRMATION_REQUEST')) ||
        (this.sendMultisigTxs &&
          (message.type === 'PENDING_MULTISIG_TRANSACTION' ||
            message.type === 'EXECUTED_MULTISIG_TRANSACTION' ||
            message.type === 'DELETED_MULTISIG_TRANSACTION')) ||
        (this.sendEtherTransfers &&
          (message.type === 'INCOMING_ETHER' ||
            message.type === 'OUTGOING_ETHER')) ||
        (this.sendTokenTransfers &&
          (message.type === 'INCOMING_TOKEN' ||
            message.type === 'OUTGOING_TOKEN')) ||
        (this.sendModuleTransactions &&
          message.type === 'MODULE_TRANSACTION') ||
        (this.sendMessages &&
          (message.type === 'MESSAGE_CREATED' ||
            message.type === 'MESSAGE_CONFIRMATION')) ||
        (this.sendSafeCreations && message.type === 'SAFE_CREATED') ||
        (this.sendReorgs && message.type === 'REORG_DETECTED') ||
        (this.sendDelegates &&
          (message.type === 'NEW_DELEGATE' ||
            message.type === 'UPDATED_DELEGATE' ||
            message.type === 'DELETED_DELEGATE')))
    );
  }

  /**
   * @returns WebhookPublicDto from the current Webhook instance
   */
  toPublicDto(): WebhookPublicDto {
    const events: SendEventTypes[] = [];

    if (this.sendConfirmations) events.push(SendEventTypes.SEND_CONFIRMATIONS);
    if (this.sendMultisigTxs) events.push(SendEventTypes.SEND_MULTISIG_TXS);
    if (this.sendEtherTransfers)
      events.push(SendEventTypes.SEND_ETHER_TRANSFERS);
    if (this.sendTokenTransfers)
      events.push(SendEventTypes.SEND_TOKEN_TRANSFERS);
    if (this.sendModuleTransactions)
      events.push(SendEventTypes.SEND_MODULE_TXS);
    if (this.sendSafeCreations) events.push(SendEventTypes.SEND_SAFE_CREATIONS);
    if (this.sendMessages) events.push(SendEventTypes.SEND_MESSAGES);
    if (this.sendReorgs) events.push(SendEventTypes.SEND_REORGS);
    if (this.sendDelegates) events.push(SendEventTypes.SEND_DELEGATES);

    return {
      id: this.id,
      description: this.description,
      url: this.url,
      isActive: this.isActive,
      authorization: this.authorization,
      chains: this.chains.map(Number),
      events,
    };
  }

  /**
   * Converts to Webhook a provided WebhookPublicDto
   * @param public_webhook
   * @returns Webhook
   */
  static fromPublicDto(public_webhook: WebhookPublicDto): Webhook {
    const webhook = new Webhook();
    webhook.id = public_webhook.id;
    webhook.url = public_webhook.url;
    webhook.description = public_webhook.description;
    webhook.authorization = public_webhook.authorization;
    webhook.chains = public_webhook.chains.map(String);
    webhook.isActive = public_webhook.isActive;

    webhook.sendConfirmations = public_webhook.events.includes(
      SendEventTypes.SEND_CONFIRMATIONS,
    );
    webhook.sendMultisigTxs = public_webhook.events.includes(
      SendEventTypes.SEND_MULTISIG_TXS,
    );
    webhook.sendEtherTransfers = public_webhook.events.includes(
      SendEventTypes.SEND_ETHER_TRANSFERS,
    );
    webhook.sendTokenTransfers = public_webhook.events.includes(
      SendEventTypes.SEND_TOKEN_TRANSFERS,
    );
    webhook.sendModuleTransactions = public_webhook.events.includes(
      SendEventTypes.SEND_MODULE_TXS,
    );
    webhook.sendSafeCreations = public_webhook.events.includes(
      SendEventTypes.SEND_SAFE_CREATIONS,
    );
    webhook.sendMessages = public_webhook.events.includes(
      SendEventTypes.SEND_MESSAGES,
    );
    webhook.sendReorgs = public_webhook.events.includes(
      SendEventTypes.SEND_REORGS,
    );
    webhook.sendDelegates = public_webhook.events.includes(
      SendEventTypes.SEND_DELEGATES,
    );

    return webhook;
  }
}

export class WebhookWithStats extends Webhook {
  private successCount = 0;
  private failureCount = 0;
  private startTime: number;

  constructor() {
    super();
    this.startTime = Date.now();
  }

  /**
   * Increment the webhook success count
   */
  incrementSuccess(): void {
    this.successCount++;
  }

  /**
   * Increment the webhook failure count
   */
  incrementFailure(): void {
    this.failureCount++;
  }

  /**
   *
   * @returns the percentage of fails for the current webhook
   */
  getFailureRate(): number {
    const total = this.successCount + this.failureCount;
    return total > 0 ? (this.failureCount / total) * 100 : 0; // Return 0 if no attempts
  }

  /**
   *
   * @returns the minutes passed from StartTime
   */
  getTimeDelayedFromStartTime(): number {
    const now = Date.now();
    return Math.floor((now - this.startTime) / 1000 / 60);
  }

  /**
   * Reset to 0 and current epoch time the Stats
   */
  resetStats(): void {
    this.successCount = 0;
    this.failureCount = 0;
    this.startTime = Date.now();
  }
}
