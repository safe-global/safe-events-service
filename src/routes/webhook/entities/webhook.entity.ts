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

  isEventRelevant(message: TxServiceEvent): boolean {
    const typeRelevant: boolean =
      (this.sendConfirmations &&
        (message.type === 'NEW_CONFIRMATION' ||
          message.type === 'CONFIRMATION_REQUEST')) ||
      (this.sendMultisigTxs &&
        (message.type === 'PENDING_MULTISIG_TRANSACTION' ||
          message.type === 'EXECUTED_MULTISIG_TRANSACTION')) ||
      (this.sendEtherTransfers &&
        (message.type === 'INCOMING_ETHER' ||
          message.type === 'OUTGOING_ETHER')) ||
      (this.sendTokenTransfers &&
        (message.type === 'INCOMING_TOKEN' ||
          message.type === 'OUTGOING_TOKEN')) ||
      (this.sendModuleTransactions && message.type === 'MODULE_TRANSACTION') ||
      (this.sendSafeCreations && message.type === 'SAFE_CREATED');
    return typeRelevant;
  }
}
