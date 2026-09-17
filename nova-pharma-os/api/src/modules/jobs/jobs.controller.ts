import { Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PlatformRoles } from '../../common/auth/decorators';
import { JobsService } from './jobs.service';

const RUNNERS = {
  'billing-cycle': 'runBillingCycle',
  dunning: 'runDunning',
  'trial-expiry': 'runTrialExpiry',
  'support-access-expiry': 'runSupportAccessExpiry',
  'stock-alerts': 'runStockAlerts',
  'usage-metrics': 'runUsageCollection',
  retention: 'runRetention',
} as const;

type JobName = keyof typeof RUNNERS;

@ApiTags('Back-office SaaS')
@Controller('platform/jobs')
@PlatformRoles('super_admin')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get()
  @ApiOperation({ summary: 'Traitements périodiques disponibles' })
  list() {
    return {
      jobs: [
        { name: 'billing-cycle', schedule: 'Chaque jour à 02h00',
          description: "Facture les abonnements dont la période est échue." },
        { name: 'dunning', schedule: 'Chaque jour à 08h00',
          description: 'Relance les impayés et suspend après le délai de grâce.' },
        { name: 'trial-expiry', schedule: 'Chaque jour à 06h00',
          description: 'Bascule les essais échus en attente de paiement.' },
        { name: 'support-access-expiry', schedule: 'Chaque heure',
          description: 'Ferme les accès support arrivés à échéance.' },
        { name: 'stock-alerts', schedule: 'Chaque jour à 05h00',
          description: 'Recalcule ruptures, seuils et péremptions.' },
        { name: 'usage-metrics', schedule: 'Chaque jour à 03h00',
          description: "Agrège l'activité de chaque pharmacie." },
        { name: 'retention', schedule: 'Chaque jour à 04h00',
          description: 'Archive les pharmacies résiliées hors durée de conservation.' },
      ],
    };
  }

  @Post(':name/run')
  @ApiOperation({
    summary: 'Exécuter un traitement immédiatement',
    description:
      'Les traitements sont idempotents : un rejeu ne produit ni double ' +
      'facture, ni double relance.',
  })
  async run(@Param('name') name: string) {
    const method = RUNNERS[name as JobName];
    if (!method) {
      return {
        error: 'Traitement inconnu.',
        available: Object.keys(RUNNERS),
      };
    }
    return (this.jobs[method] as () => Promise<unknown>).call(this.jobs);
  }
}
