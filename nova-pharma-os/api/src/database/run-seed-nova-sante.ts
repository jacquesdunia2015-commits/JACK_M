import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../app.module';
import { DatabaseService } from '../common/database/database.service';
import { SYSTEM_CONTEXT } from '../common/database/request-context';
import { OrganizationsService } from '../modules/platform/organizations/organizations.service';
import { TenantAdminService } from '../modules/tenant/admin/admin.service';
import { CatalogService } from '../modules/tenant/catalog/catalog.service';
import { loadEnv } from './load-env';

/**
 * Crée NOVA SANTÉ PHARMA — l'officine pilote de Bukavu — dans
 * l'application.
 *
 * Différence essentielle avec la pharmacie de démonstration : celle-ci
 * est une VRAIE pharmacie, destinée à recevoir de vraies données. On y
 * met donc ce qui fait gagner du temps sans mentir sur la réalité :
 *
 *   — la pharmacie, sa branche principale, ses huit rôles métier ;
 *   — les comptes du gérant, d'un vendeur et d'un livreur ;
 *   — un catalogue de départ, avec les produits les plus courants d'une
 *     officine de Bukavu.
 *
 * Et surtout ce qu'on n'y met PAS : aucun stock, aucune vente, aucun
 * client. Un stock inventé conduirait l'équipe à vendre des boîtes qui
 * ne sont pas sur l'étagère. Le stock démarre donc à zéro et se remplit
 * à la première réception réelle — celle du premier fournisseur, avec
 * ses vrais lots et ses vraies dates de péremption.
 *
 * Le catalogue, lui, n'est qu'une liste de référence : le poser à
 * l'avance ne crée aucune quantité et se corrige en deux clics.
 *
 * Relançable sans risque : si la pharmacie existe déjà, le script
 * s'arrête sans rien toucher.
 *
 * Lancement :  npm run seed:nova-sante   (ou « npm run pharmacie » à la
 * racine du projet)
 */

const SLUG = 'nova-sante-pharma';

/**
 * Mots de passe de départ. Ils sont volontairement écrits ici, en clair,
 * parce qu'ils ne protègent encore rien : la base est vide. Ils doivent
 * être changés par chaque personne à sa première connexion, avant que la
 * moindre donnée de patient ou d'argent n'entre dans le système.
 *
 * Pour en choisir d'autres dès maintenant, définissez les variables
 * d'environnement correspondantes avant de lancer le script.
 */
const COMPTES = [
  {
    role: 'gerant' as const,
    email: process.env.NOVA_SANTE_EMAIL_GERANT ?? 'gerant@nova-sante-pharma.cd',
    motDePasse: process.env.NOVA_SANTE_MOT_DE_PASSE_GERANT ?? 'NovaSante2026!',
    nom: 'Gérant NOVA SANTÉ PHARMA',
    roleCodes: [] as string[],
    description: 'Accès complet : stock, ventes, achats, comptes, réglages.',
  },
  {
    role: 'vendeur' as const,
    email: process.env.NOVA_SANTE_EMAIL_VENDEUR ?? 'vendeur@nova-sante-pharma.cd',
    motDePasse: process.env.NOVA_SANTE_MOT_DE_PASSE_VENDEUR ?? 'Vendeur2026!',
    nom: 'Vendeur au comptoir',
    roleCodes: ['vendeur'],
    description: "Comptoir et application mobile : vendre, encaisser, consulter le stock.",
  },
  {
    role: 'livreur' as const,
    email: process.env.NOVA_SANTE_EMAIL_LIVREUR ?? 'livreur@nova-sante-pharma.cd',
    motDePasse: process.env.NOVA_SANTE_MOT_DE_PASSE_LIVREUR ?? 'Livreur2026!',
    nom: 'Livreur',
    roleCodes: ['livreur'],
    description: 'Application mobile : tournée de livraison, preuve de remise.',
  },
];

/**
 * Catalogue de départ d'une officine de Bukavu.
 *
 * Les prix sont des ordres de grandeur en dollars, à ajuster : ils
 * servent à ce que l'écran de vente ne soit pas vide le premier jour,
 * pas à fixer la politique tarifaire de la pharmacie.
 */
const CATALOGUE = [
  // --- Antalgiques et antipyrétiques ---
  { sku: 'PARA500', name: 'Paracétamol 500 mg', inn: 'Paracétamol', dosage: '500 mg',
    dosageForm: 'comprimé', packaging: 'boîte de 20', categoryCode: 'ANTALGIQUES',
    unit: 'boîte', costPrice: 0.85, salePrice: 1.5, wholesalePrice: 1.1,
    reorderPoint: 40, reorderQuantity: 200 },
  { sku: 'PARA-SIROP', name: 'Paracétamol sirop enfant', inn: 'Paracétamol',
    dosageForm: 'sirop', packaging: 'flacon 60 ml', categoryCode: 'ANTALGIQUES',
    unit: 'flacon', costPrice: 1.3, salePrice: 2.5, reorderPoint: 20, reorderQuantity: 80 },
  { sku: 'IBUP400', name: 'Ibuprofène 400 mg', inn: 'Ibuprofène', dosage: '400 mg',
    dosageForm: 'comprimé', packaging: 'boîte de 30', categoryCode: 'ANTALGIQUES',
    unit: 'boîte', costPrice: 1.1, salePrice: 2, reorderPoint: 30, reorderQuantity: 120 },

  // --- Antipaludiques : première cause de consultation dans la région ---
  { sku: 'ACT-CP', name: 'Artéméther-Luméfantrine 20/120 mg', inn: 'Artéméther',
    dosage: '20/120 mg', dosageForm: 'comprimé', packaging: 'boîte de 24',
    categoryCode: 'ANTIPALUDIQUES', unit: 'boîte', costPrice: 2.8, salePrice: 4.5,
    wholesalePrice: 3.4, reorderPoint: 40, reorderQuantity: 200 },
  { sku: 'ACT-SIROP', name: 'Artéméther-Luméfantrine sirop', inn: 'Artéméther',
    dosageForm: 'sirop', packaging: 'flacon 60 ml', categoryCode: 'ANTIPALUDIQUES',
    unit: 'flacon', costPrice: 3.4, salePrice: 5.5, wholesalePrice: 4.2,
    reorderPoint: 30, reorderQuantity: 120 },
  { sku: 'TDR-PALU', name: 'Test rapide paludisme', dosageForm: 'dispositif',
    packaging: 'boîte de 25', categoryCode: 'DIAGNOSTIC', unit: 'boîte',
    costPrice: 7, salePrice: 12, reorderPoint: 10, reorderQuantity: 40 },

  // --- Antibiotiques : sur ordonnance ---
  { sku: 'AMOX250', name: 'Amoxicilline 250 mg', inn: 'Amoxicilline', dosage: '250 mg',
    dosageForm: 'gélule', packaging: 'boîte de 12', categoryCode: 'ANTIBIOTIQUES',
    unit: 'boîte', costPrice: 2.1, salePrice: 3.5, wholesalePrice: 2.7,
    requiresPrescription: true, reorderPoint: 25, reorderQuantity: 100 },
  { sku: 'AMOX500', name: 'Amoxicilline 500 mg', inn: 'Amoxicilline', dosage: '500 mg',
    dosageForm: 'gélule', packaging: 'boîte de 16', categoryCode: 'ANTIBIOTIQUES',
    unit: 'boîte', costPrice: 3.2, salePrice: 5.2, requiresPrescription: true,
    reorderPoint: 25, reorderQuantity: 100 },
  { sku: 'METRO500', name: 'Métronidazole 500 mg', inn: 'Métronidazole', dosage: '500 mg',
    dosageForm: 'comprimé', packaging: 'boîte de 20', categoryCode: 'ANTIBIOTIQUES',
    unit: 'boîte', costPrice: 1.4, salePrice: 2.6, requiresPrescription: true,
    reorderPoint: 20, reorderQuantity: 80 },

  // --- Réhydratation et digestif ---
  { sku: 'SRO', name: 'Sels de réhydratation orale', inn: 'SRO', dosageForm: 'poudre',
    packaging: 'sachet', categoryCode: 'REHYDRATATION', unit: 'sachet',
    costPrice: 0.15, salePrice: 0.35, wholesalePrice: 0.22,
    reorderPoint: 100, reorderQuantity: 500 },
  { sku: 'ZINC20', name: 'Zinc 20 mg', inn: 'Sulfate de zinc', dosage: '20 mg',
    dosageForm: 'comprimé dispersible', packaging: 'boîte de 10',
    categoryCode: 'REHYDRATATION', unit: 'boîte', costPrice: 0.3, salePrice: 0.7,
    reorderPoint: 50, reorderQuantity: 200 },

  // --- Chroniques : chaîne du froid et ordonnance ---
  { sku: 'INSU-NPH', name: 'Insuline NPH 100 UI/ml', inn: 'Insuline humaine',
    dosageForm: 'injectable', packaging: 'flacon 10 ml', categoryCode: 'ANTIDIABETIQUES',
    unit: 'flacon', costPrice: 6.8, salePrice: 11, requiresPrescription: true,
    isColdChain: true, storageConditions: '2 à 8 °C', reorderPoint: 10,
    reorderQuantity: 40, expiryAlertDays: 60 },
  { sku: 'AMLO5', name: 'Amlodipine 5 mg', inn: 'Amlodipine', dosage: '5 mg',
    dosageForm: 'comprimé', packaging: 'boîte de 30', categoryCode: 'CARDIOLOGIE',
    unit: 'boîte', costPrice: 1.6, salePrice: 3, requiresPrescription: true,
    reorderPoint: 20, reorderQuantity: 80 },

  // --- Vitamines et compléments ---
  { sku: 'VITC-500', name: 'Vitamine C 500 mg', inn: 'Acide ascorbique', dosage: '500 mg',
    dosageForm: 'comprimé effervescent', packaging: 'tube de 20',
    categoryCode: 'VITAMINES', unit: 'tube', costPrice: 1.2, salePrice: 2.2,
    reorderPoint: 20, reorderQuantity: 80 },
  { sku: 'FER-AF', name: 'Fer + acide folique', inn: 'Sulfate ferreux',
    dosageForm: 'comprimé', packaging: 'boîte de 30', categoryCode: 'VITAMINES',
    unit: 'boîte', costPrice: 0.9, salePrice: 1.8, reorderPoint: 30, reorderQuantity: 120 },

  // --- Consommables : ni lot ni péremption ---
  { sku: 'GANTS-M', name: "Gants d'examen taille M", dosageForm: 'dispositif',
    packaging: 'boîte de 100', categoryCode: 'CONSOMMABLES', unit: 'boîte',
    costPrice: 4.5, salePrice: 7, isBatchTracked: false, hasExpiry: false,
    reorderPoint: 15, reorderQuantity: 60 },
  { sku: 'SERINGUE-5', name: 'Seringue 5 ml à usage unique', dosageForm: 'dispositif',
    packaging: 'boîte de 100', categoryCode: 'CONSOMMABLES', unit: 'boîte',
    costPrice: 3.2, salePrice: 5.5, isBatchTracked: false, hasExpiry: false,
    reorderPoint: 10, reorderQuantity: 50 },
  { sku: 'COMPRESSE', name: 'Compresses stériles 10 x 10', dosageForm: 'dispositif',
    packaging: 'sachet de 10', categoryCode: 'CONSOMMABLES', unit: 'sachet',
    costPrice: 0.4, salePrice: 0.9, isBatchTracked: false, hasExpiry: false,
    reorderPoint: 40, reorderQuantity: 200 },
];

async function principal(): Promise<void> {
  loadEnv();
  Logger.overrideLogger(false);

  const application = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  try {
    const db = application.get(DatabaseService);
    const organizations = application.get(OrganizationsService);
    const admin = application.get(TenantAdminService);
    const catalog = application.get(CatalogService);

    const existante = await db.readTransaction(SYSTEM_CONTEXT, (tx) =>
      tx.one('SELECT id FROM organizations WHERE slug = $1', [SLUG]),
    );
    if (existante) {
      console.log('NOVA SANTÉ PHARMA existe déjà : rien à faire.');
      console.log(`  Connexion : ${COMPTES[0].email}`);
      return;
    }

    // --- Provisionnement, exactement comme le ferait le back-office ---
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

    const gerant = COMPTES[0];
    const creation = await organizations.provision(contextePlateforme, {
      slug: SLUG,
      legalName: 'NOVA SANTÉ PHARMA SARL',
      tradeName: 'NOVA SANTÉ PHARMA',
      kind: 'pharmacy',
      countryCode: 'CD',
      city: 'Bukavu',
      address: 'Bukavu, Sud-Kivu',
      planCode: 'professional',
      billingCycle: 'monthly',
      startTrial: true,
      mainBranchName: 'Officine principale',
      owner: {
        fullName: gerant.nom,
        email: gerant.email,
        password: gerant.motDePasse,
      },
    });

    const contexte = {
      organizationId: creation.organization.id as string,
      branchId: creation.mainBranch.id as string,
      actorId: creation.owner.id as string,
      actorKind: 'user' as const,
      actorLabel: gerant.email,
      platform: false,
      readonly: false,
      permissions: ['*'],
      modules: creation.subscription.modules as string[],
    };

    // --- Comptes de l'équipe ---
    for (const compte of COMPTES.slice(1)) {
      await admin.createUser(contexte, {
        email: compte.email,
        fullName: compte.nom,
        password: compte.motDePasse,
        roleCodes: compte.roleCodes,
      });
    }

    // --- Catalogue de départ, sans aucune quantité ---
    const importe = await catalog.import(contexte, { products: CATALOGUE });

    console.log('');
    console.log('  NOVA SANTÉ PHARMA est créée.');
    console.log('');
    console.log(`  Ville           Bukavu, Sud-Kivu (RD Congo)`);
    console.log(`  Forfait         Professionnel, en période d'essai`);
    console.log(`  Catalogue       ${CATALOGUE.length} produits de départ` +
                `${importe ? '' : ''}`);
    console.log(`  Stock           0 — il se remplira à votre première réception`);
    console.log('');
    console.log('  Comptes créés :');
    for (const compte of COMPTES) {
      console.log(`    ${compte.email.padEnd(34)} ${compte.motDePasse}`);
      console.log(`      ${compte.description}`);
    }
    console.log('');
    console.log('  Changez ces mots de passe avant de saisir de vraies données.');
    console.log('');
  } finally {
    await application.close();
  }
}

principal().catch((erreur: Error) => {
  console.error(erreur.message);
  process.exit(1);
});
