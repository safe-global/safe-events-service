import { ApiProperty } from '@nestjs/swagger';
import {
  IsUUID,
  IsString,
  IsUrl,
  IsArray,
  IsInt,
  ArrayNotEmpty,
  MaxLength,
  IsBoolean,
  IsDefined,
  IsNotEmpty,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IsEthereumAddressArray } from '../../../common/validators/is-ethereum-address';

export enum SendEventTypes {
  SEND_CONFIRMATIONS = 'SEND_CONFIRMATIONS',
  SEND_MULTISIG_TXS = 'SEND_MULTISIG_TXS',
  SEND_ETHER_TRANSFERS = 'SEND_ETHER_TRANSFERS',
  SEND_TOKEN_TRANSFERS = 'SEND_TOKEN_TRANSFERS',
  SEND_MODULE_TXS = 'SEND_MODULE_TXS',
  SEND_SAFE_CREATIONS = 'SEND_SAFE_CREATIONS',
  SEND_MESSAGES = 'SEND_MESSAGES',
  SEND_REORGS = 'SEND_REORGS',
  SEND_DELEGATES = 'SEND_DELEGATES',
}

export class WebhookRequestDto {
  @ApiProperty({ description: 'Short description of the webhook' })
  @IsDefined({ message: 'Description is required' })
  @IsNotEmpty({ message: 'Description must not be empty' })
  @IsString()
  @MaxLength(300, { message: 'Description must not exceed 300 characters' })
  description: string;

  @ApiProperty({ description: 'Target URL where webhook events will be sent' })
  @IsDefined({ message: 'URL is required' })
  @IsNotEmpty({ message: 'URL must not be empty' })
  @IsUrl()
  @MaxLength(300, { message: 'Url must not exceed 300 characters' })
  url: string;

  @ApiProperty({ description: 'Field to enable or disable the webhook.' })
  @IsDefined({ message: 'isActive is required' })
  @IsBoolean()
  isActive: boolean;

  @ApiProperty({
    description: 'Authorization header value to send with requests',
  })
  @IsString()
  authorization: string;

  @ApiProperty({
    description: 'Array of chain IDs the webhook applies to',
    type: [Number],
  })
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  chains: number[];

  @ApiProperty({
    description:
      'List of Ethereum addresses the webhook should monitor. Each address must be a valid Ethereum address (e.g., 0x...). Maximum of 100 addresses allowed.',
    type: [String],
    example: [
      '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
      '0x53d284357ec70cE289D6D64134DfAc8E511c8a3D',
    ],
  })
  @IsArray({ message: 'Addresses must be provided as an array' })
  @ArrayMaxSize(100, {
    message: 'A maximum of 100 addresses is allowed',
  })
  @IsEthereumAddressArray({
    message: 'All addresses must be valid Ethereum addresses (e.g., 0x...)',
  })
  addresses: string[];

  @ApiProperty({
    description: 'List of event types this webhook subscribes to',
    type: [String],
    enum: SendEventTypes,
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  events: string[];
}

export class WebhookPublicDto extends WebhookRequestDto {
  @ApiProperty({ description: 'Public UUID used to identify the webhook' })
  @IsUUID()
  id: string;
}
