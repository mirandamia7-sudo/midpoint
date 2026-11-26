import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { OrgPrincipal } from '@/auth/auth.types';
import { CurrentOrg, OrgAuth } from '@/auth/decorators';
import { ApiErrors } from '@/common/openapi';
import { PageQueryDto } from '@/common/pagination';
import { RateLimit } from '@/common/rate-limit';
import { AccountsService } from '@/p2p/accounts.service';
import { CreateChallengeDto, RegisterAccountDto, UpdateAccountDto } from '@/p2p/dto/account.dto';
import {
  CreatePaymentMethodDto,
  QueryPaymentMethodsDto,
  UpdatePaymentMethodDto,
} from '@/p2p/dto/payment-method.dto';
import {
  AccountDetailView,
  AccountListView,
  AccountView,
  ChallengeView,
  PaymentMethodListView,
  PaymentMethodView,
} from '@/p2p/entities/account.entity';
import { PaymentMethodsService } from '@/p2p/payment-methods.service';

@ApiTags('Accounts')
@Controller('v1/p2p/accounts')
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Post('challenge')
  @OrgAuth('p2p:write')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get a wallet registration challenge',
    description:
      'The message the wallet signs (EIP-191 `personal_sign`) to register: it names the address, your organization, the tier, a single-use nonce and an expiry.',
  })
  @ApiOkResponse({ type: ChallengeView })
  @ApiErrors(400)
  challenge(@CurrentOrg() org: OrgPrincipal, @Body() dto: CreateChallengeDto) {
    return this.accounts.challenge(org, dto);
  }

  @Post()
  @OrgAuth('p2p:write')
  @ApiOperation({
    summary: 'Register a wallet',
    description:
      'Proves the wallet with its signature over an open challenge, which is then spent. A wallet belongs to one organization per tier.',
  })
  @ApiCreatedResponse({ type: AccountView })
  @ApiErrors(400, 409)
  register(@CurrentOrg() org: OrgPrincipal, @Body() dto: RegisterAccountDto) {
    return this.accounts.register(org, dto);
  }

  @Get()
  @OrgAuth('p2p:read')
  @ApiOperation({ summary: 'Your wallets on this tier' })
  @ApiOkResponse({ type: AccountListView })
  @ApiErrors(400)
  list(@CurrentOrg() org: OrgPrincipal, @Query() query: PageQueryDto) {
    return this.accounts.list(org, query);
  }

  @Get(':id')
  @OrgAuth('p2p:read')
  @RateLimit({ name: 'p2p:account-read', limit: 60, windowMs: 60_000 })
  @ApiOperation({
    summary: 'One wallet, with its on-chain state',
    description:
      'Its free balances in the contract per network and token, what live orders lock, the terms it gave the matcher and the operators it granted.',
  })
  @ApiOkResponse({ type: AccountDetailView })
  @ApiErrors(400, 404, 429)
  get(@CurrentOrg() org: OrgPrincipal, @Param('id') id: string) {
    return this.accounts.get(org, id);
  }

  @Patch(':id')
  @OrgAuth('p2p:write')
  @ApiOperation({
    summary: 'Change a wallet’s label or merchant profile',
    description:
      'PAUSED stops new orders from matching it; a SUSPENDED account cannot change its status.',
  })
  @ApiOkResponse({ type: AccountView })
  @ApiErrors(400, 404)
  update(@CurrentOrg() org: OrgPrincipal, @Param('id') id: string, @Body() dto: UpdateAccountDto) {
    return this.accounts.update(org, id, dto);
  }

  @Delete(':id')
  @OrgAuth('p2p:write')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Forget a wallet',
    description:
      'With its payment methods and offers. Refused while it has live orders; its tokens stay in the contract, withdrawable by the wallet.',
  })
  @ApiNoContentResponse()
  @ApiErrors(400, 404, 409)
  remove(@CurrentOrg() org: OrgPrincipal, @Param('id') id: string): Promise<void> {
    return this.accounts.remove(org, id);
  }
}

@ApiTags('Payment methods')
@Controller('v1/p2p/payment-methods')
export class PaymentMethodsController {
  constructor(private readonly methods: PaymentMethodsService) {}

  @Post()
  @OrgAuth('p2p:write')
  @ApiOperation({
    summary: 'Add a payment method',
    description:
      'Where one of your wallets receives local money, checked per rail (Bolivian accounts with their CI or NIT, CCI, PIX keys, CBU/CVU check digits, CLABE...) and encrypted at rest. A purchase shows its payer the one method the order names.',
  })
  @ApiCreatedResponse({ type: PaymentMethodView })
  @ApiErrors(400, 404)
  create(@CurrentOrg() org: OrgPrincipal, @Body() dto: CreatePaymentMethodDto) {
    return this.methods.create(org, dto);
  }

  @Get()
  @OrgAuth('p2p:read')
  @ApiOperation({ summary: 'Your payment methods on this tier' })
  @ApiOkResponse({ type: PaymentMethodListView })
  @ApiErrors(400)
  list(@CurrentOrg() org: OrgPrincipal, @Query() query: QueryPaymentMethodsDto) {
    return this.methods.list(org, query);
  }

  @Patch(':id')
  @OrgAuth('p2p:write')
  @ApiOperation({ summary: 'Change or deactivate a payment method' })
  @ApiOkResponse({ type: PaymentMethodView })
  @ApiErrors(400, 404)
  update(
    @CurrentOrg() org: OrgPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdatePaymentMethodDto,
  ) {
    return this.methods.update(org, id, dto);
  }

  @Delete(':id')
  @OrgAuth('p2p:write')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a payment method' })
  @ApiNoContentResponse()
  @ApiErrors(400, 404)
  remove(@CurrentOrg() org: OrgPrincipal, @Param('id') id: string): Promise<void> {
    return this.methods.remove(org, id);
  }
}
