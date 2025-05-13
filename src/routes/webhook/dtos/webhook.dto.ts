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

export class WebhookRequestDto {
  @ApiProperty({ description: 'Short description of the webhook' })
  @IsString()
  @MaxLength(300, { message: 'Description must not exceed 300 characters' })
  description: string;

  @ApiProperty({ description: 'Target URL where webhook events will be sent' })
  @IsUrl()
  @MaxLength(300, { message: 'Url must not exceed 300 characters' })
  url: string;

  @ApiProperty({ description: 'Field to enable or disable the webhook.' })
  @IsBoolean()
  is_active: boolean;

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

export class WebhookPublicDto extends WebhookRequestDto {
  @ApiProperty({ description: 'Public UUID used to identify the webhook' })
  @IsUUID()
  public_id: string;
}
