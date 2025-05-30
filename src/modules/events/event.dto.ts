export type TxServiceEventType =
  | 'NEW_CONFIRMATION'
  | 'PENDING_MULTISIG_TRANSACTION'
  | 'EXECUTED_MULTISIG_TRANSACTION'
  | 'INCOMING_ETHER'
  | 'INCOMING_TOKEN'
  | 'CONFIRMATION_REQUEST'
  | 'SAFE_CREATED'
  | 'MODULE_TRANSACTION'
  | 'OUTGOING_ETHER'
  | 'OUTGOING_TOKEN'
  | 'MESSAGE_CREATED'
  | 'MESSAGE_CONFIRMATION'
  | 'DELETED_MULTISIG_TRANSACTION'
  | 'REORG_DETECTED'
  | 'NEW_DELEGATE'
  | 'UPDATED_DELEGATE'
  | 'DELETED_DELEGATE';

export interface TxServiceEvent {
  chainId: string;
  address: string;
  type: TxServiceEventType;
  // It can have more properties
  [otherProperties: string]: unknown;
}
