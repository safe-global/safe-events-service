import { ApiProperty } from '@nestjs/swagger';
import {
  IsUUID,
  IsString,
  IsUrl,
  IsArray,
  IsInt,
  ArrayNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

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

export class WebhookPublicDto {
  @ApiProperty({ description: 'Public UUID used to identify the webhook' })
  @IsUUID()
  public_id: string;

  @ApiProperty({ description: 'Short description of the webhook' })
  @IsString()
  description: string;

  @ApiProperty({ description: 'Target URL where webhook events will be sent' })
  @IsUrl()
  url: string;

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
    description: 'List of event types this webhook subscribes to',
    type: [String],
    enum: SendEventTypes,
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  events: string[];
}
