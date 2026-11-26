import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { P2P_CURRENCY_CODES, P2P_TEXT_MAX } from '@/p2p/domain/constants';
import { P2P_RAIL_IDS } from '@/p2p/domain/rails';
import { PageQueryDto } from '@/common/pagination';

@ApiSchema({
  description:
    'Where an account receives local money on one rail. `details` takes the rail’s fields (`GET /v1/p2p/market` lists them) and is checked per rail, checksums included.',
})
export class CreatePaymentMethodDto {
  @ApiProperty({
    example: 'cm3p2pacc0001l70g8v5q3z2w',
    description: 'One of your accounts.',
  })
  @IsString()
  accountId!: string;

  @ApiProperty({ enum: P2P_CURRENCY_CODES, example: 'BOB' })
  @IsIn(P2P_CURRENCY_CODES)
  currency!: string;

  @ApiProperty({ enum: P2P_RAIL_IDS, example: 'bo_bank_transfer' })
  @IsIn(P2P_RAIL_IDS)
  rail!: string;

  @ApiProperty({ example: 'María Pérez', minLength: 2, maxLength: 100 })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  holderName!: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    example: {
      bank: 'Banco Unión',
      accountType: 'savings',
      accountNumber: '1000012345678',
      documentType: 'NIT',
      documentNumber: '1023456789',
    },
  })
  @IsObject()
  details!: Record<string, string>;

  @ApiPropertyOptional({ example: 'Main account', maxLength: P2P_TEXT_MAX })
  @IsOptional()
  @IsString()
  @MaxLength(P2P_TEXT_MAX)
  label?: string;
}

@ApiSchema({
  description: 'What may change on a payment method; its rail and currency never do.',
})
export class UpdatePaymentMethodDto {
  @ApiPropertyOptional({ example: 'María Pérez', minLength: 2, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  holderName?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { type: 'string' },
    example: {
      bank: 'Banco Unión',
      accountType: 'savings',
      accountNumber: '1000012345679',
      documentType: 'NIT',
      documentNumber: '1023456789',
    },
    description: 'Replaces the details whole, checked like a new method’s.',
  })
  @IsOptional()
  @IsObject()
  details?: Record<string, string>;

  @ApiPropertyOptional({ example: 'Main account', maxLength: P2P_TEXT_MAX })
  @IsOptional()
  @IsString()
  @MaxLength(P2P_TEXT_MAX)
  label?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class QueryPaymentMethodsDto extends PageQueryDto {
  @ApiPropertyOptional({
    example: 'cm3p2pacc0001l70g8v5q3z2w',
    description: 'Only this account’s.',
  })
  @IsOptional()
  @IsString()
  accountId?: string;
}
