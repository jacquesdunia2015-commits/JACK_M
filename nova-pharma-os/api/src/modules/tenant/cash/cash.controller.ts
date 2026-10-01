import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  Ctx, RequireModule, RequirePermissions, WriteOperation,
} from '../../../common/auth/decorators';
import { RequestContext } from '../../../common/database/request-context';
import { CashService, MontantDevise } from './cash.service';

@ApiTags('Espace pharmacie')
@Controller('cash')
@RequireModule('cash')
export class CashController {
  constructor(private readonly cash: CashService) {}

  @Get('current')
  @RequirePermissions('cash.read')
  @ApiOperation({ summary: 'Session de caisse en cours' })
  current(@Ctx() ctx: RequestContext, @Query('branchId') branchId?: string) {
    return this.cash.current(ctx, branchId);
  }

  @Get('rates')
  @RequirePermissions('cash.read')
  @ApiOperation({ summary: 'Taux du jour et historique des taux' })
  taux(@Ctx() ctx: RequestContext) {
    return this.cash.taux(ctx);
  }

  @Post('rates')
  @RequirePermissions('cash.manage')
  @WriteOperation()
  @ApiOperation({ summary: 'Fixer le taux du jour (1 base = rate quote)' })
  fixerTaux(
    @Ctx() ctx: RequestContext,
    @Body() body: { baseCurrency: string; quoteCurrency: string; rate: number; changeRounding?: number },
  ) {
    return this.cash.fixerTaux(ctx, body ?? ({} as never));
  }

  @Get('sessions')
  @RequirePermissions('cash.read')
  @ApiOperation({ summary: 'Historique des sessions de caisse' })
  history(@Ctx() ctx: RequestContext, @Query('branchId') branchId?: string) {
    return this.cash.history(ctx, branchId);
  }

  @Post('sessions')
  @RequirePermissions('cash.manage')
  @WriteOperation()
  @ApiOperation({ summary: 'Ouvrir la caisse' })
  open(
    @Ctx() ctx: RequestContext,
    @Body() body: {
      branchId?: string; registerCode?: string; openingFloat?: number;
      openingFloats?: MontantDevise[];
    },
  ) {
    return this.cash.open(ctx, body ?? {});
  }

  @Post('sessions/:id/close')
  @RequirePermissions('cash.manage')
  @WriteOperation()
  @ApiOperation({ summary: 'Clôturer la caisse par comptage' })
  close(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: { countedCash: number; countedOther?: MontantDevise[]; notes?: string },
  ) {
    return this.cash.close(ctx, id, body);
  }

  @Post('sessions/:id/movements')
  @RequirePermissions('cash.manage')
  @WriteOperation()
  @ApiOperation({ summary: 'Entrée ou sortie de caisse' })
  movement(
    @Ctx() ctx: RequestContext,
    @Param('id') id: string,
    @Body() body: { kind: string; amount: number; reason: string; currency?: string },
  ) {
    return this.cash.movement(ctx, id, body);
  }
}
