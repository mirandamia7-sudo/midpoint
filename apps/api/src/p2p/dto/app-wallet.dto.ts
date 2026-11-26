import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { NETWORK_IDS } from '@/chain/networks';

@ApiSchema({ name: 'UpdateProfile', description: 'Claim or change your @handle.' })
export class UpdateProfileDto {
  @ApiProperty({
    example: 'maria_flores',
    description:
      '3 to 20 of a-z, 0-9 and underscore (a leading @ and upper case are accepted and normalised). Unique, case-insensitive; reserved words are refused.',
  })
  @IsString()
  @MaxLength(32)
  handle!: string;
}

export class NetworkQueryDto {
  @ApiPropertyOptional({
    enum: NETWORK_IDS,
    example: 'testnet',
    description: 'Default: the app’s only network.',
  })
  @IsOptional()
  @IsIn(NETWORK_IDS)
  network?: string;
}

@ApiSchema({
  name: 'Activate',
  description: 'Create your account and open a token’s trustline, sponsored.',
})
export class ActivateDto {
  @ApiPropertyOptional({ enum: NETWORK_IDS, example: 'testnet' })
  @IsOptional()
  @IsIn(NETWORK_IDS)
  network?: string;

  @ApiProperty({ example: 'USDC', description: 'By symbol, contract (C...) or CODE:ISSUER.' })
  @IsString()
  @MaxLength(70)
  token!: string;
}

@ApiSchema({ name: 'CreateTransfer', description: 'Send tokens to an address or an @handle.' })
export class CreateTransferDto {
  @ApiPropertyOptional({ enum: NETWORK_IDS, example: 'testnet' })
  @IsOptional()
  @IsIn(NETWORK_IDS)
  network?: string;

  @ApiProperty({
    example: '@maria_flores',
    description: 'A G (account), M (muxed account) or C (contract) address, or an @handle.',
  })
  @IsString()
  @MaxLength(80)
  to!: string;

  @ApiProperty({ example: 'USDC', description: 'By symbol, contract (C...) or CODE:ISSUER.' })
  @IsString()
  @MaxLength(70)
  token!: string;

  @ApiProperty({
    example: '25000000',
    description: 'Base units (7 decimals): 2.5 USDC is 25000000.',
  })
  @Matches(/^[1-9]\d{0,37}$/, { message: 'amount must be a positive integer in base units' })
  amount!: string;

  @ApiPropertyOptional({
    example: 'Empanadas',
    description: 'At most 28 bytes; it becomes the transaction’s text memo.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(28)
  note?: string;
}

export class ActivityQueryDto extends NetworkQueryDto {
  @ApiPropertyOptional({ description: 'The `nextCursor` of the previous page.' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  cursor?: string;

  @ApiPropertyOptional({ example: 20, default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

@ApiSchema({ name: 'PayCharge', description: 'Pay a charge with tokens from your balance.' })
export class PayChargeDto {
  @ApiPropertyOptional({
    enum: NETWORK_IDS,
    example: 'testnet',
    description: 'The charge’s network.',
  })
  @IsOptional()
  @IsIn(NETWORK_IDS)
  network?: string;

  @ApiProperty({ example: 'USDC', description: 'The charge’s token.' })
  @IsString()
  @MaxLength(70)
  token!: string;
}

@ApiSchema({ name: 'Submit', description: 'A transaction your wallet signed, to submit.' })
export class SubmitDto {
  @ApiProperty({
    description:
      'The signed inner `TransactionEnvelope` (base64 XDR), exactly as built by this API and signed. Never a fee-bump.',
  })
  @IsString()
  @MaxLength(20_000)
  xdr!: string;

  @ApiPropertyOptional({
    enum: NETWORK_IDS,
    example: 'testnet',
    description: 'Default: the tier’s only network.',
  })
  @IsOptional()
  @IsIn(NETWORK_IDS)
  network?: string;
}
