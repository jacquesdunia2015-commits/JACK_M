/**
 * Rôles livrés à la création d'une pharmacie. Ils couvrent l'organisation
 * courante d'une officine ; chaque pharmacie reste libre de les modifier
 * ou d'en créer d'autres depuis son espace.
 */
export interface DefaultRole {
  code: string;
  name: string;
  description: string;
  permissions: string[];
}

export const DEFAULT_ROLES: DefaultRole[] = [
  {
    code: 'pharmacien_responsable',
    name: 'Pharmacien responsable',
    description: "Responsable de l'officine : accès complet à l'exploitation.",
    permissions: [
      'catalog.read', 'catalog.write', 'catalog.delete',
      'inventory.read', 'inventory.adjust', 'inventory.count', 'inventory.transfer',
      'purchasing.read', 'purchasing.write', 'purchasing.receive',
      'suppliers.read', 'suppliers.write',
      'sales.read', 'sales.create', 'sales.cancel', 'sales.discount',
      'customers.read', 'customers.write', 'customers.credit',
      'b2b.read', 'b2b.write', 'delivery.read', 'delivery.write',
      'cash.read', 'cash.manage', 'payments.read', 'payments.write',
      'reporting.read', 'reporting.financial',
      'users.read', 'users.write', 'settings.read', 'settings.write',
      'billing.read', 'support.read', 'support.write', 'audit.read',
    ],
  },
  {
    code: 'vendeur',
    name: 'Vendeur',
    description: 'Enregistre les ventes au comptoir et sert la clientèle.',
    permissions: [
      'catalog.read', 'inventory.read',
      'sales.read', 'sales.create',
      'customers.read', 'customers.write',
      'cash.read', 'payments.write',
    ],
  },
  {
    code: 'caissier',
    name: 'Caissier',
    description: 'Tient la caisse : ouverture, encaissements, clôture.',
    permissions: [
      'catalog.read', 'sales.read', 'sales.create',
      'cash.read', 'cash.manage',
      'payments.read', 'payments.write', 'customers.read',
    ],
  },
  {
    code: 'magasinier',
    name: 'Magasinier',
    description: 'Réceptionne les commandes et tient le stock.',
    permissions: [
      'catalog.read', 'catalog.write',
      'inventory.read', 'inventory.adjust', 'inventory.count', 'inventory.transfer',
      'purchasing.read', 'purchasing.receive', 'suppliers.read',
    ],
  },
  {
    code: 'acheteur',
    name: 'Acheteur',
    description: 'Prépare et suit les commandes fournisseurs.',
    permissions: [
      'catalog.read', 'inventory.read',
      'purchasing.read', 'purchasing.write', 'purchasing.receive',
      'suppliers.read', 'suppliers.write', 'reporting.read',
    ],
  },
  {
    code: 'gestionnaire_b2b',
    name: 'Gestionnaire B2B',
    description: 'Suit les clients professionnels, les devis et le crédit.',
    permissions: [
      'catalog.read', 'inventory.read',
      'customers.read', 'customers.write', 'customers.credit',
      'b2b.read', 'b2b.write', 'delivery.read',
      'payments.read', 'payments.write', 'reporting.read',
    ],
  },
  {
    code: 'livreur',
    name: 'Livreur',
    description: 'Prend en charge et confirme les livraisons.',
    permissions: ['delivery.read', 'delivery.write', 'customers.read'],
  },
  {
    code: 'comptable',
    name: 'Comptable',
    description: 'Consulte les résultats, les paiements et les journaux.',
    permissions: [
      'reporting.read', 'reporting.financial',
      'payments.read', 'sales.read', 'purchasing.read',
      'customers.read', 'billing.read', 'audit.read',
    ],
  },
];
