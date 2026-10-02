import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  Ctx, RequireModule, RequirePermissions, WriteOperation,
} from '../../../common/auth/decorators';
import { RequestContext } from '../../../common/database/request-context';
import { CustomerInput, CustomersService } from './customers.service';

@ApiTags('Espace pharmacie')
@Controller('customers')
@RequireModule('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @RequirePermissions('customers.read')
  @ApiOperation({ summary: 'Clients particuliers et professionnels (B2B)' })
  list(
    @Ctx() ctx: RequestContext,
    @Query('search') search?: string,
    @Query('kind') kind?: string,
  ) {
    return this.customers.list(ctx, search, kind);
  }

  @Post()
  @RequirePermissions('customers.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Créer un client' })
  create(@Ctx() ctx: RequestContext, @Body() dto: CustomerInput) {
    return this.customers.create(ctx, dto);
  }

  @Get('aged-receivables')
  @RequirePermissions('customers.credit')
  @ApiOperation({ summary: 'Balance âgée des créances clients' })
  aged(@Ctx() ctx: RequestContext) {
    return this.customers.agedReceivables(ctx);
  }

  @Get(':id')
  @RequirePermissions('customers.read')
  @ApiOperation({ summary: 'Fiche client : achats, factures et règlements' })
  get(@Ctx() ctx: RequestContext, @Param('id') id: string) {
    return this.customers.get(ctx, id);
  }

  @Patch(':id')
  @RequirePermissions('customers.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Modifier un client' })
  update(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body() dto: Partial<CustomerInput>,
  ) {
    return this.customers.update(ctx, id, dto);
  }

  @Post(':id/payments')
  @RequirePermissions('payments.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Encaisser un règlement client' })
  pay(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body()
    body: {
      amount: number; method: string; invoiceId?: string;
      provider?: string; reference?: string; clientOperationId?: string;
    },
  ) {
    return this.customers.recordPayment(ctx, id, body);
  }

  @Post(':id/credit-block')
  @RequirePermissions('customers.credit')
  @WriteOperation()
  @ApiOperation({ summary: 'Bloquer ou débloquer le crédit d’un client' })
  creditBlock(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: { blocked: boolean; reason?: string },
  ) {
    return this.customers.setCreditBlock(ctx, id, body.blocked, body.reason);
  }
}
