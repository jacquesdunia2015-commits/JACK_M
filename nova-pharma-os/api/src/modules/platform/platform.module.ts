import { Module } from '@nestjs/common';
import { PlatformAuditController } from './audit/platform-audit.controller';
import { BackupsController } from './backups/backups.controller';
import { BackupsService } from './backups/backups.service';
import { BillingController } from './billing/billing.controller';
import { BillingService } from './billing/billing.service';
import { LeadsController } from './leads/leads.controller';
import { LeadsService } from './leads/leads.service';
import { MetricsController } from './metrics/metrics.controller';
import { MetricsService } from './metrics/metrics.service';
import { OrganizationsController } from './organizations/organizations.controller';
import { OrganizationsService } from './organizations/organizations.service';
import { PlansController, PublicPlansController } from './plans/plans.controller';
import { PlansService } from './plans/plans.service';
import { PlatformSupportController } from './support/support.controller';
import { SupportService } from './support/support.service';
import { SubscriptionsService } from './subscriptions/subscriptions.service';
import { PlatformUsersController } from './users/platform-users.controller';
import { PlatformUsersService } from './users/platform-users.service';

/**
 * Back-office SaaS NOVA PHARMA OS : administration de la plateforme,
 * des pharmacies clientes, des abonnements et du support.
 */
@Module({
  controllers: [
    OrganizationsController,
    BillingController,
    MetricsController,
    PlatformSupportController,
    PlansController,
    PublicPlansController,
    LeadsController,
    PlatformUsersController,
    PlatformAuditController,
    BackupsController,
  ],
  providers: [
    OrganizationsService,
    SubscriptionsService,
    BillingService,
    MetricsService,
    SupportService,
    PlansService,
    LeadsService,
    PlatformUsersService,
    BackupsService,
  ],
  exports: [
    OrganizationsService,
    SubscriptionsService,
    BillingService,
    SupportService,
    BackupsService,
  ],
})
export class PlatformModule {}
