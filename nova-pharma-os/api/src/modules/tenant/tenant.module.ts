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
import { CodesBarresController } from './catalog/codes-barres.controller';
import { CodesBarresService } from './catalog/codes-barres.service';
import { CustomersController } from './customers/customers.controller';
import { CustomersService } from './customers/customers.service';
import { DeliveryController } from './delivery/delivery.controller';
import { DeliveryService } from './delivery/delivery.service';
import { InventoryController } from './inventory/inventory.controller';
import { InventoryService } from './inventory/inventory.service';
import { StockService } from './inventory/stock.service';
import { MessagingController } from './messaging/messaging.controller';
import { MessagingService } from './messaging/messaging.service';
import { OnboardingController } from './onboarding/onboarding.controller';
import { OnboardingService } from './onboarding/onboarding.service';
import { PayersController } from './payers/payers.controller';
import { PayersService } from './payers/payers.service';
import { PaymentsController } from './payments/payments.controller';
import { MobileMoneyService } from './payments/mobile-money.service';
import { PurchasingController } from './purchasing/purchasing.controller';
import { PurchasingService } from './purchasing/purchasing.service';
import { RequisitionsController } from './purchasing/requisitions.controller';
import { RequisitionsService } from './purchasing/requisitions.service';
import { SuppliersController } from './purchasing/suppliers.controller';
import { SuppliersService } from './purchasing/suppliers.service';
import { ReportingController } from './reporting/reporting.controller';
import { ReportingService } from './reporting/reporting.service';
import { InvoicesController } from './sales/invoices.controller';
import { InvoicesService } from './sales/invoices.service';
import { SalesController } from './sales/sales.controller';
import { SalesService } from './sales/sales.service';
import { FideliteController } from './fidelite/fidelite.controller';
import { FideliteService } from './fidelite/fidelite.service';
import { TraitementsController } from './traitements/traitements.controller';
import { TraitementsService } from './traitements/traitements.service';

/**
 * Espace pharmacie : l'exploitation quotidienne d'une officine —
 * catalogue, stock et lots, achats, ventes, caisse, clients, commerce
 * professionnel, livraison, messagerie client, encaissement Mobile
 * Money, rapports et administration locale.
 */
@Module({
  imports: [PlatformModule],
  controllers: [
    CatalogController,
    CodesBarresController,
    InventoryController,
    PurchasingController,
    SuppliersController,
    RequisitionsController,
    SalesController,
    InvoicesController,
    CustomersController,
    PayersController,
    TraitementsController,
    FideliteController,
    CashController,
    B2bController,
    DeliveryController,
    MessagingController,
    PaymentsController,
    ReportingController,
    TenantAdminController,
    AccountController,
    OnboardingController,
  ],
  providers: [
    CatalogService,
    CodesBarresService,
    StockService,
    InventoryService,
    PurchasingService,
    SuppliersService,
    RequisitionsService,
    SalesService,
    InvoicesService,
    CustomersService,
    PayersService,
    TraitementsService,
    FideliteService,
    CashService,
    B2bService,
    DeliveryService,
    MessagingService,
    MobileMoneyService,
    ReportingService,
    TenantAdminService,
    OnboardingService,
  ],
  exports: [StockService, SalesService, InventoryService],
})
export class TenantModule {}
