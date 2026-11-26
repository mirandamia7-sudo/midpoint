import { ApiProperty, ApiPropertyOptional, ApiSchema } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { NETWORK_IDS } from '@/chain/networks';
import { ACCOUNT_ADDRESS_RE } from '@/common/stellar';
import { P2P_TEXT_MAX } from '@/p2p/domain/constants';

export const ACCOUNT_ADDRESS_MESSAGE = 'must be a Stellar account address (G...)';
export const EXAMPLE_ACCOUNT = 'GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPV6LY4UV2GL6VJGIQRXFDNMADI';
export const EXAMPLE_ACCOUNT_2 = 'GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGSNFHEYVXM3XOJMDS674JZ';
export const EXAMPLE_CONTRACT = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';

@ApiSchema({ description: 'The account a registration challenge is for.' })
export class CreateChallengeDto {
  @ApiProperty({
    example: EXAMPLE_ACCOUNT,
    description: 'The Stellar account (G...) to register.',
  })
  @Matches(ACCOUNT_ADDRESS_RE, { message: `address ${ACCOUNT_ADDRESS_MESSAGE}` })
  address!: string;

  @ApiPropertyOptional({
    enum: NETWORK_IDS,
    example: 'testnet',
    description:
      'The network whose ledger has the account’s signers; default: the tier’s only network.',
  })
  @IsOptional()
  @IsIn(NETWORK_IDS)
  network?: string;
}

@ApiSchema({
  description:
    'A wallet’s registration: the registration challenge, signed by the account’s signers.',
})
export class RegisterAccountDto {
  @ApiProperty({
    description:
      'The challenge from `POST /v1/p2p/accounts/challenge`, signed (base64 XDR). It names the account, your organization and tier.',
  })
  @IsString()
  @MaxLength(8000)
  transaction!: string;

  @ApiPropertyOptional({ enum: NETWORK_IDS, example: 'testnet' })
  @IsOptional()
  @IsIn(NETWORK_IDS)
  network?: string;

  @ApiPropertyOptional({ example: 'Treasury wallet', maxLength: P2P_TEXT_MAX })
  @IsOptional()
  @IsString()
  @MaxLength(P2P_TEXT_MAX)
  label?: string;

  @ApiPropertyOptional({
    example: 'Oriente Cambio',
    description: 'The name people see on quotes when this account is a merchant.',
    minLength: 2,
    maxLength: 40,
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  displayName?: string;
}

@ApiSchema({ description: 'What an account owner may change.' })
export class UpdateAccountDto {
  @ApiPropertyOptional({ example: 'Treasury wallet', maxLength: P2P_TEXT_MAX })
  @IsOptional()
  @IsString()
  @MaxLength(P2P_TEXT_MAX)
  label?: string;

  @ApiPropertyOptional({ example: 'Oriente Cambio', minLength: 2, maxLength: 40 })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  displayName?: string;

  @ApiPropertyOptional({
    enum: ['ACTIVE', 'PAUSED'],
    example: 'PAUSED',
    description:
      'PAUSED stops new orders from matching this merchant; its live orders go on. A SUSPENDED account cannot change this.',
  })
  @IsOptional()
  @IsIn(['ACTIVE', 'PAUSED'])
  merchantStatus?: 'ACTIVE' | 'PAUSED';
}
