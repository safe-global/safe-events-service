import { Entity, Column, PrimaryGeneratedColumn, BaseEntity } from 'typeorm';
import { TxServiceEvent } from '../../events/event.dto';

@Entity()
export class Webhook extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  url: string;

  @Column()
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
        (this.sendSafeCreations && message.type === 'SAFE_CREATED'))
    );
  }
}
