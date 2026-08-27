import { Module } from '@nestjs/common';
import { PlatformModule } from '../platform/platform.module';
import { AccountController } from './account/account.controller';
import { TenantAdminController } from './admin/admin.controller';
import { TenantAdminService } from './admin/admin.service';
import { B2bController } from './b2b/b2b.controller';
import { B2bService } from './b2b/b2b.service';
import { CashController } from './cash/cash.controller';
import { CashService } from './cash/cash.service';
import { CatalogController } from './catalog/catalog.controller';
import { CatalogService } from './catalog/catalog.service';
import { CustomersController } from './customers/customers.controller';
import { CustomersService } from './customers/customers.service';
import { DeliveryController } from './delivery/delivery.controller';
import { DeliveryService } from './delivery/delivery.service';
import { InventoryController } from './inventory/inventory.controller';
import { InventoryService } from './inventory/inventory.service';
import { StockService } from './inventory/stock.service';
import { OnboardingController } from './onboarding/onboarding.controller';
import { OnboardingService } from './onboarding/onboarding.service';
import { PurchasingController } from './purchasing/purchasing.controller';
import { PurchasingService } from './purchasing/purchasing.service';
import { ReportingController } from './reporting/reporting.controller';
import { ReportingService } from './reporting/reporting.service';
import { SalesController } from './sales/sales.controller';
import { SalesService } from './sales/sales.service';

/**
 * Espace pharmacie : l'exploitation quotidienne d'une officine —
 * catalogue, stock et lots, achats, ventes, caisse, clients, commerce
 * professionnel, livraison, rapports et administration locale.
 */
@Module({
  imports: [PlatformModule],
  controllers: [
    CatalogController,
    InventoryController,
    PurchasingController,
    SalesController,
    CustomersController,
    CashController,
    B2bController,
    DeliveryController,
    ReportingController,
    TenantAdminController,
    AccountController,
    OnboardingController,
  ],
  providers: [
    CatalogService,
    StockService,
    InventoryService,
    PurchasingService,
    SalesService,
    CustomersService,
    CashService,
    B2bService,
    DeliveryService,
    ReportingService,
    TenantAdminService,
    OnboardingService,
  ],
  exports: [StockService, SalesService, InventoryService],
})
export class TenantModule {}
