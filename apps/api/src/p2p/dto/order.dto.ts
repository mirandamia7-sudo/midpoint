import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PageQueryDto } from '@/common/pagination';
import { ACCOUNT_ADDRESS_RE } from '@/common/stellar';
import {
  P2P_CURRENCY_CODES,
  P2P_MAX_INTEGRATOR_FEE_BPS,
  P2P_TEXT_MAX,
} from '@/p2p/domain/constants';
import { NETWORK_IDS } from '@/chain/networks';
import { P2P_ORDER_KINDS, P2P_ORDER_STATUSES } from '@/p2p/domain/order-status';
import { P2P_RAIL_IDS } from '@/p2p/domain/rails';

@ApiSchema({
  description:
    'What a person wants to trade. Give `fiatAmount` (local money) or `tokenAmount` (base units), not both.',
})
export class CreateQuoteDto {
  @ApiProperty({
    enum: ['BUY', 'SELL'],
    example: 'BUY',
    description:
      'BUY: the person receives tokens and pays local money. SELL: the person sends tokens and receives local money.',
  })
  @IsIn(['BUY', 'SELL'])
  side!: 'BUY' | 'SELL';

  @ApiProperty({ enum: NETWORK_IDS, example: 'testnet' })
  @IsIn(NETWORK_IDS)
  network!: string;

  @ApiProperty({
    example: 'USDC',
    description: 'By symbol, Stellar Asset Contract (C...) or CODE:ISSUER.',
  })
  @IsString()
  token!: string;

  @ApiProperty({ enum: P2P_CURRENCY_CODES, example: 'BOB' })
  @IsIn(P2P_CURRENCY_CODES)
  currency!: string;

  @ApiProperty({ enum: P2P_RAIL_IDS, example: 'bo_bank_transfer' })
  @IsIn(P2P_RAIL_IDS)
  rail!: string;

  @ApiPropertyOptional({
    example: '1210',
    description:
      'BUY: what the person pays. SELL: what the person receives. Up to the currency’s decimals.',
  })
  @IsOptional()
  @Matches(/^\d{1,15}(\.\d{1,2})?$/, {
    message: 'fiatAmount must be a positive decimal',
  })
  fiatAmount?: string;

  @ApiPropertyOptional({
    example: '100000000',
    description: 'The token amount the order locks, base units.',
  })
  @IsOptional()
  @Matches(/^[1-9]\d{0,37}$/, {
    message: 'tokenAmount must be a positive integer in base units',
  })
  tokenAmount?: string;

  @ApiPropertyOptional({
    example: 50,
    default: 0,
    minimum: 0,
    maximum: P2P_MAX_INTEGRATOR_FEE_BPS,
    description:
      'Your own fee on this order, basis points of what the buyer receives, paid to `integratorAccountId` on-chain.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(P2P_MAX_INTEGRATOR_FEE_BPS)
  integratorFeeBps?: number;

  @ApiPropertyOptional({
    example: 'cm3p2pacc0001l70g8v5q3z2w',
    description:
      'The account your fee is paid to; required with a fee when you have more than one account.',
  })
  @IsOptional()
  @IsString()
  integratorAccountId?: string;
}

@ApiSchema({
  description:
    'Who pays the local money on a purchase: the merchant checks the transfer comes from this person.',
})
export class PayerDto {
  @ApiProperty({ example: 'Juan Gómez', minLength: 2, maxLength: 100 })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    example: '20123456786',
    description: 'Their identity document number.',
  })
  @IsString()
  @MinLength(4)
  @MaxLength(20)
  document!: string;
}

@ApiSchema({
  description:
    'Where the merchant pays the local money on a sale or a payout (to yourself or to someone else): a holder, the rail’s account details and, where the rail’s transfer needs it, the holder’s ID. The ID (`document` and the rail’s ID fields, such as `cuit` or `documentType`/`documentNumber`) is optional on every rail whose `beneficiaryIdRequired` is false (`GET /v1/market`): the holder’s bank already identified them. Chile (`rut`) and Colombia need it. Given, it is checked as always.',
})
export class BeneficiaryDto {
  @ApiProperty({ example: 'Ana López', minLength: 2, maxLength: 100 })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  holderName!: string;

  @ApiPropertyOptional({
    example: '27234567891',
    minLength: 4,
    maxLength: 20,
    description:
      'The holder’s ID number. Required only on rails whose `beneficiaryIdRequired` is true (Chile, Colombia).',
  })
  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(20)
  document?: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    example: { bank: 'Banco Unión', accountType: 'savings', accountNumber: '1000023456781' },
    description: 'The rail’s fields, checked like a payment method’s.',
  })
  @IsObject()
  details!: Record<string, string>;
}

@ApiSchema({
  description:
    'An order from a quote. A purchase (BUY) needs `recipient` and `payer`; a sale (SELL) needs `seller` and `beneficiary`.',
})
export class CreateOrderDto {
  @ApiProperty({
    example: 'cm3p2pqte0001l70g8v5q3z2w',
    description: 'A quote of yours, not expired. One order per quote.',
  })
  @IsString()
  quoteId!: string;

  @ApiPropertyOptional({
    enum: ['BUY', 'SELL'],
    example: 'BUY',
    description: 'Optional; when given it must be the quote’s side.',
  })
  @IsOptional()
  @IsIn(['BUY', 'SELL'])
  kind?: 'BUY' | 'SELL';

  @ApiPropertyOptional({
    example: 'GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ',
    description: 'BUY: the wallet that receives the tokens.',
  })
  @IsOptional()
  @Matches(ACCOUNT_ADDRESS_RE, { message: 'recipient must be a Stellar account address (G...)' })
  recipient?: string;

  @ApiPropertyOptional({
    type: PayerDto,
    description: 'BUY: required.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => PayerDto)
  payer?: PayerDto;

  @ApiPropertyOptional({
    example: 'GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ',
    description:
      'SELL: the wallet that holds the tokens and signs the two transactions. Refunds go back to it.',
  })
  @IsOptional()
  @Matches(ACCOUNT_ADDRESS_RE, { message: 'seller must be a Stellar account address (G...)' })
  seller?: string;

  @ApiPropertyOptional({
    type: BeneficiaryDto,
    description: 'SELL: required.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => BeneficiaryDto)
  beneficiary?: BeneficiaryDto;

  @ApiPropertyOptional({ example: 'order-881', maxLength: P2P_TEXT_MAX })
  @IsOptional()
  @IsString()
  @MaxLength(P2P_TEXT_MAX)
  externalReference?: string;
}

@ApiSchema({
  description: 'The payment report: the transfer’s reference, when there is one.',
})
export class ReportPaidDto {
  @ApiPropertyOptional({ example: 'TRX-88213', maxLength: P2P_TEXT_MAX })
  @IsOptional()
  @IsString()
  @MaxLength(P2P_TEXT_MAX)
  reference?: string;
}

export class QueryOrdersDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: P2P_ORDER_STATUSES })
  @IsOptional()
  @IsIn(P2P_ORDER_STATUSES)
  status?: string;

  @ApiPropertyOptional({ enum: P2P_ORDER_KINDS })
  @IsOptional()
  @IsIn(P2P_ORDER_KINDS)
  kind?: string;

  @ApiPropertyOptional({
    example: 'GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ',
    description: 'Only orders where this account is the buyer or the seller.',
  })
  @IsOptional()
  @Matches(ACCOUNT_ADDRESS_RE, { message: 'address must be a Stellar account address (G...)' })
  address?: string;
}
