import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../app.module';
import { DatabaseService } from '../common/database/database.service';
import { SYSTEM_CONTEXT } from '../common/database/request-context';
import { AuthService } from '../modules/auth/auth.service';
import { OrganizationsService } from '../modules/platform/organizations/organizations.service';
import { CatalogService } from '../modules/tenant/catalog/catalog.service';
import { PurchasingService } from '../modules/tenant/purchasing/purchasing.service';
import { SalesService } from '../modules/tenant/sales/sales.service';
import { CashService } from '../modules/tenant/cash/cash.service';
import { CustomersService } from '../modules/tenant/customers/customers.service';
import { loadEnv } from './load-env';

/**
 * Crée une pharmacie de démonstration exploitable immédiatement.
 *
 * Le but est qu'à l'ouverture de l'application, l'équipe voie une
 * officine qui vit — un catalogue rempli, du stock réparti sur des lots
 * aux péremptions différentes, des ventes déjà passées — plutôt qu'un
 * écran vide qui n'apprend rien.
 *
 * Le script passe par les mêmes services que l'application : les ventes
 * suivent réellement la règle FEFO, le stock est réellement décrémenté.
 * Rien n'est écrit « en dur » dans la base.
 *
 * Relançable sans risque : si la pharmacie existe déjà, il s'arrête.
 */

const SLUG = 'pharmacie-demo';
const EMAIL_GERANT = 'gerant@pharmacie-demo.cd';
const MOT_DE_PASSE = 'Pharmacie2026!';

const CATALOGUE = [
  { sku: 'PARA500', name: 'Paracétamol 500 mg', inn: 'Paracétamol', dosage: '500 mg',
    dosageForm: 'comprimé', packaging: 'boîte de 20', categoryCode: 'ANTALGIQUES',
    unit: 'boîte', costPrice: 0.85, salePrice: 1.5, wholesalePrice: 1.1,
    reorderPoint: 40, reorderQuantity: 200, barcodes: ['3400930000011'] },
  { sku: 'AMOX250', name: 'Amoxicilline 250 mg', inn: 'Amoxicilline', dosage: '250 mg',
    dosageForm: 'gélule', packaging: 'boîte de 12', categoryCode: 'ANTIBIOTIQUES',
    unit: 'boîte', costPrice: 2.1, salePrice: 3.5, wholesalePrice: 2.7,
    requiresPrescription: true, reorderPoint: 25, reorderQuantity: 100 },
  { sku: 'ACT-SIROP', name: 'Artéméther-Luméfantrine sirop', inn: 'Artéméther',
    dosageForm: 'sirop', packaging: 'flacon 60 ml', categoryCode: 'ANTIPALUDIQUES',
    unit: 'flacon', costPrice: 3.4, salePrice: 5.5, wholesalePrice: 4.2,
    reorderPoint: 30, reorderQuantity: 120 },
  { sku: 'INSU-NPH', name: 'Insuline NPH 100 UI/ml', inn: 'Insuline humaine',
    dosageForm: 'injectable', packaging: 'flacon 10 ml', categoryCode: 'ANTIDIABETIQUES',
    unit: 'flacon', costPrice: 6.8, salePrice: 11, requiresPrescription: true,
    isColdChain: true, storageConditions: '2 à 8 °C', reorderPoint: 10,
    reorderQuantity: 40, expiryAlertDays: 60 },
  { sku: 'SRO', name: 'Sels de réhydratation orale', inn: 'SRO', dosageForm: 'poudre',
    packaging: 'sachet', categoryCode: 'REHYDRATATION', unit: 'sachet',
    costPrice: 0.15, salePrice: 0.35, wholesalePrice: 0.22,
    reorderPoint: 100, reorderQuantity: 500 },
  { sku: 'GANTS-M', name: "Gants d'examen taille M", dosageForm: 'dispositif',
    packaging: 'boîte de 100', categoryCode: 'CONSOMMABLES', unit: 'boîte',
    costPrice: 4.5, salePrice: 7, isBatchTracked: false, hasExpiry: false,
    reorderPoint: 15, reorderQuantity: 60 },
  { sku: 'VITC-500', name: 'Vitamine C 500 mg', inn: 'Acide ascorbique', dosage: '500 mg',
    dosageForm: 'comprimé effervescent', packaging: 'tube de 20',
    categoryCode: 'VITAMINES', unit: 'tube', costPrice: 1.2, salePrice: 2.2,
    reorderPoint: 20, reorderQuantity: 80 },
  { sku: 'IBUP400', name: 'Ibuprofène 400 mg', inn: 'Ibuprofène', dosage: '400 mg',
    dosageForm: 'comprimé', packaging: 'boîte de 30', categoryCode: 'ANTALGIQUES',
    unit: 'boîte', costPrice: 1.1, salePrice: 2, reorderPoint: 30, reorderQuantity: 120 },
];

function dansNMois(mois: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() + mois);
  return date.toISOString().slice(0, 10);
}

async function principal(): Promise<void> {
  loadEnv();
  Logger.overrideLogger(false);

  const application = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  try {
    const db = application.get(DatabaseService);
    const organizations = application.get(OrganizationsService);
    const catalog = application.get(CatalogService);
    const purchasing = application.get(PurchasingService);
    const sales = application.get(SalesService);
    const cash = application.get(CashService);
    const customers = application.get(CustomersService);

    const existante = await db.readTransaction(SYSTEM_CONTEXT, (tx) =>
      tx.one('SELECT id FROM organizations WHERE slug = $1', [SLUG]),
    );
    if (existante) {
      console.log('La pharmacie de démonstration existe déjà.');
      return;
    }

    // --- Provisionnement, par le back-office SaaS ---
    const superAdmin = await db.readTransaction(SYSTEM_CONTEXT, (tx) =>
      tx.oneOrFail<{ id: string; email: string }>(
        `SELECT id, email FROM platform_users WHERE role = 'super_admin' LIMIT 1`,
        [],
        "Aucun compte interne : lancez d'abord « npm run seed ».",
      ),
    );

    const contextePlateforme = {
      actorId: superAdmin.id,
      actorKind: 'platform_user' as const,
      actorLabel: superAdmin.email,
      platform: true,
      readonly: false,
      platformRole: 'super_admin',
    };

    const creation = await organizations.provision(contextePlateforme, {
      slug: SLUG,
      legalName: 'PHARMACIE DE DÉMONSTRATION SARL',
      tradeName: 'Pharmacie de démonstration',
      countryCode: 'CD',
      city: 'Bukavu',
      address: 'Avenue Patrice Lumumba, Ibanda',
      phone: '+243990000001',
      planCode: 'professional',
      billingCycle: 'monthly',
      startTrial: true,
      mainBranchName: 'Officine principale',
      owner: {
        fullName: 'Gérant de démonstration',
        email: EMAIL_GERANT,
        password: MOT_DE_PASSE,
      },
    });

    const organizationId = creation.organization.id as string;
    const branchId = creation.mainBranch.id as string;
    const ownerId = creation.owner.id as string;

    const contexte = {
      organizationId,
      branchId,
      actorId: ownerId,
      actorKind: 'user' as const,
      actorLabel: EMAIL_GERANT,
      platform: false,
      readonly: false,
      permissions: ['*'],
      modules: creation.subscription.modules as string[],
    };

    // --- Catalogue ---
    await catalog.import(contexte, { products: CATALOGUE });

    const produits = await catalog.search(contexte, { pageSize: 100 });
    const parReference = Object.fromEntries(
      produits.data.map((p) => [p.sku as string, p.id as string]),
    );

    // --- Fournisseur et réception, avec des lots aux péremptions variées ---
    const fournisseur = await purchasing.createSupplier(contexte, {
      code: 'UBIPHARM',
      name: 'Ubipharm RDC',
      kind: 'wholesaler',
      city: 'Goma',
      paymentTermsDays: 30,
      leadTimeDays: 10,
    });

    await purchasing.receive(contexte, {
      supplierId: fournisseur.id as string,
      supplierInvoiceNumber: 'UBI-2026-0001',
      idempotencyKey: 'demo-reception-1',
      lines: [
        // Deux lots du même produit : le plus proche de la péremption
        // partira en premier, ce qui rend la règle FEFO visible.
        { productId: parReference.PARA500, lotNumber: 'PAR-A', expiryDate: dansNMois(3),
          quantity: 60, unitCost: 0.85 },
        { productId: parReference.PARA500, lotNumber: 'PAR-B', expiryDate: dansNMois(20),
          quantity: 240, unitCost: 0.82 },
        { productId: parReference.AMOX250, lotNumber: 'AMX-01', expiryDate: dansNMois(11),
          quantity: 120, unitCost: 2.1 },
        { productId: parReference['ACT-SIROP'], lotNumber: 'ACT-01', expiryDate: dansNMois(6),
          quantity: 90, unitCost: 3.4 },
        // Péremption volontairement proche : l'alerte correspondante
        // s'affiche dès l'ouverture du tableau de bord, ce qui montre à
        // l'équipe à quoi ressemble un avertissement réel.
        { productId: parReference['INSU-NPH'], lotNumber: 'INS-01', expiryDate: dansNMois(1),
          quantity: 25, unitCost: 6.8 },
        { productId: parReference.SRO, lotNumber: 'SRO-01', expiryDate: dansNMois(28),
          quantity: 800, unitCost: 0.15 },
        { productId: parReference['VITC-500'], lotNumber: 'VIT-01', expiryDate: dansNMois(14),
          quantity: 60, unitCost: 1.2 },
        { productId: parReference.IBUP400, lotNumber: 'IBU-01', expiryDate: dansNMois(18),
          quantity: 90, unitCost: 1.1 },
        { productId: parReference['GANTS-M'], quantity: 40, unitCost: 4.5 },
      ],
    });

    // --- Clients ---
    const clinique = await customers.create(contexte, {
      kind: 'professional',
      name: 'Clinique du Lac',
      contactName: 'Dr Mwamini',
      phone: '+243990001111',
      city: 'Bukavu',
      creditLimit: 500,
      creditDays: 30,
    });
    await customers.create(contexte, {
      kind: 'individual',
      name: 'Espérance Nsimire',
      phone: '+243990002222',
    });

    // --- Caisse et ventes ---
    await cash.open(contexte, { registerCode: 'CAISSE-1', openingFloat: 50 });

    await sales.create(contexte, {
      lines: [
        { productId: parReference.PARA500, quantity: 3 },
        { productId: parReference.SRO, quantity: 10 },
      ],
      payments: [{ method: 'cash', amount: 10 }],
    });

    await sales.create(contexte, {
      lines: [{ productId: parReference.AMOX250, quantity: 2 }],
      payments: [{ method: 'mobile_money', amount: 7, provider: 'M-Pesa' }],
      prescription: {
        patientName: 'Jean-Claude Byamungu',
        prescriberName: 'Dr Kabila',
        prescriberNumber: 'CNOM-4471',
      },
    });

    await sales.create(contexte, {
      customerId: clinique.id as string,
      channel: 'b2b',
      lines: [
        { productId: parReference.PARA500, quantity: 40 },
        { productId: parReference['VITC-500'], quantity: 12 },
      ],
      payments: [{ method: 'credit', amount: 70.4 }],
    });

    await sales.create(contexte, {
      lines: [
        { productId: parReference['GANTS-M'], quantity: 2 },
        { productId: parReference.IBUP400, quantity: 4 },
      ],
      payments: [{ method: 'cash', amount: 25 }],
    });

    console.log(`Pharmacie de démonstration créée : ${SLUG}`);
    console.log(`  Connexion : ${EMAIL_GERANT} / ${MOT_DE_PASSE}`);
  } finally {
    await application.close();
  }
}

principal().catch((erreur: Error) => {
  console.error(erreur.message);
  process.exit(1);
});
