import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Ctx, RequirePermissions, WriteOperation } from '../../../common/auth/decorators';
import { RequestContext } from '../../../common/database/request-context';
import { OnboardingService } from './onboarding.service';

@ApiTags('Espace pharmacie')
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get()
  @ApiOperation({
    summary: "Parcours d'activation",
    description:
      "Chaque étape est vérifiée sur les données réelles : la progression " +
      "reflète l'état effectif de la mise en route.",
  })
  status(@Ctx() ctx: RequestContext) {
    return this.onboarding.status(ctx);
  }

  @Post('stock-import')
  @RequirePermissions('inventory.adjust')
  @WriteOperation()
  @ApiOperation({ summary: 'Importer le stock initial' })
  importStock(
    @Ctx() ctx: RequestContext,
    @Body()
    body: {
      branchId: string;
      lines: {
        sku: string; quantity: number; unitCost?: number;
        lotNumber?: string; expiryDate?: string;
      }[];
    },
  ) {
    return this.onboarding.importInitialStock(ctx, body.branchId, body.lines);
  }

  @Post('payment-methods')
  @RequirePermissions('settings.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Déclarer les moyens de paiement acceptés' })
  paymentMethods(@Ctx() ctx: RequestContext, @Body() body: { methods: string[] }) {
    return this.onboarding.setPaymentMethods(ctx, body.methods);
  }

  @Post('training')
  @WriteOperation()
  @ApiOperation({ summary: 'Marquer la formation guidée comme suivie' })
  training(@Ctx() ctx: RequestContext) {
    return this.onboarding.completeTraining(ctx);
  }

  @Post('validate-production')
  @RequirePermissions('settings.write')
  @WriteOperation()
  @ApiOperation({ summary: 'Valider la mise en production' })
  validate(@Ctx() ctx: RequestContext) {
    return this.onboarding.validateProduction(ctx);
  }
}
