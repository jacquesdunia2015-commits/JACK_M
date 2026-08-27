-- =====================================================================
-- NOVA PHARMA OS — 010 : données de référence
-- Pays, permissions, forfaits, options, base de connaissances.
-- Les tarifs ci-dessous sont des valeurs de départ paramétrables depuis
-- le back-office SaaS.
-- =====================================================================

INSERT INTO country_settings
  (code, name, default_currency, default_locale, default_timezone, vat_rate,
   invoice_number_format, phone_prefix, payment_methods, data_retention_days)
VALUES
  ('CD', 'République démocratique du Congo', 'USD', 'fr', 'Africa/Lubumbashi', 16.000,
   'FA-{YYYY}-{SEQ:6}', '+243', ARRAY['cash','mobile_money','bank_transfer','bank_local'], 3650),
  ('RW', 'Rwanda',   'RWF', 'fr', 'Africa/Kigali',     18.000, 'INV-{YYYY}-{SEQ:6}', '+250',
   ARRAY['cash','mobile_money','bank_transfer','card'], 3650),
  ('BI', 'Burundi',  'BIF', 'fr', 'Africa/Bujumbura',  18.000, 'FA-{YYYY}-{SEQ:6}',  '+257',
   ARRAY['cash','mobile_money','bank_transfer'], 3650),
  ('TZ', 'Tanzanie', 'TZS', 'sw', 'Africa/Dar_es_Salaam', 18.000, 'INV-{YYYY}-{SEQ:6}', '+255',
   ARRAY['cash','mobile_money','bank_transfer','card'], 3650),
  ('KE', 'Kenya',    'KES', 'sw', 'Africa/Nairobi',    16.000, 'INV-{YYYY}-{SEQ:6}', '+254',
   ARRAY['cash','mobile_money','bank_transfer','card'], 2555),
  ('CG', 'Congo-Brazzaville', 'XAF', 'fr', 'Africa/Brazzaville', 18.900, 'FA-{YYYY}-{SEQ:6}', '+242',
   ARRAY['cash','mobile_money','bank_transfer'], 3650)
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------
-- Permissions (référentiel global, attribuées via les rôles)
-- ---------------------------------------------------------------------
INSERT INTO permissions (code, module, label) VALUES
  ('catalog.read',        'catalog',    'Consulter le catalogue'),
  ('catalog.write',       'catalog',    'Créer et modifier les produits'),
  ('catalog.delete',      'catalog',    'Supprimer un produit'),
  ('inventory.read',      'inventory',  'Consulter le stock'),
  ('inventory.adjust',    'inventory',  'Régulariser le stock'),
  ('inventory.count',     'inventory',  'Réaliser un inventaire'),
  ('inventory.transfer',  'inventory',  'Transférer du stock entre branches'),
  ('purchasing.read',     'purchasing', 'Consulter les achats'),
  ('purchasing.write',    'purchasing', 'Créer des commandes fournisseur'),
  ('purchasing.receive',  'purchasing', 'Réceptionner une commande'),
  ('suppliers.read',      'suppliers',  'Consulter les fournisseurs'),
  ('suppliers.write',     'suppliers',  'Gérer les fournisseurs'),
  ('sales.read',          'sales',      'Consulter les ventes'),
  ('sales.create',        'sales',      'Enregistrer une vente'),
  ('sales.cancel',        'sales',      'Annuler ou rembourser une vente'),
  ('sales.discount',      'sales',      'Accorder une remise'),
  ('customers.read',      'customers',  'Consulter les clients'),
  ('customers.write',     'customers',  'Gérer les clients'),
  ('customers.credit',    'customers',  'Gérer le crédit client'),
  ('b2b.read',            'b2b',        'Consulter les commandes B2B'),
  ('b2b.write',           'b2b',        'Gérer devis et commandes B2B'),
  ('delivery.read',       'delivery',   'Consulter les livraisons'),
  ('delivery.write',      'delivery',   'Gérer les livraisons'),
  ('cash.read',           'cash',       'Consulter la caisse'),
  ('cash.manage',         'cash',       'Ouvrir et clôturer la caisse'),
  ('payments.read',       'payments',   'Consulter les paiements'),
  ('payments.write',      'payments',   'Enregistrer un paiement'),
  ('reporting.read',      'reporting',  'Consulter les rapports'),
  ('reporting.financial', 'reporting',  'Consulter marges et résultat opérationnel'),
  ('users.read',          'users',      'Consulter les utilisateurs'),
  ('users.write',         'users',      'Gérer les utilisateurs et les rôles'),
  ('settings.read',       'settings',   'Consulter les paramètres'),
  ('settings.write',      'settings',   'Modifier les paramètres'),
  ('billing.read',        'billing',    'Consulter l''abonnement et les factures SaaS'),
  ('support.read',        'support',    'Consulter les tickets de support'),
  ('support.write',       'support',    'Créer et suivre les tickets'),
  ('support.grant_access','support',    'Autoriser un accès support temporaire'),
  ('audit.read',          'audit',      'Consulter le journal d''audit'),
  ('integrations.manage', 'integrations','Gérer les clés API et intégrations')
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------
-- Forfaits
-- ---------------------------------------------------------------------
INSERT INTO subscription_plans
  (code, name, target_audience, description, currency,
   price_monthly, price_quarterly, price_annual, trial_days,
   max_users, max_branches, max_products, storage_quota_mb, sms_quota, whatsapp_quota,
   modules, is_public, is_custom, sort_order)
VALUES
  ('starter', 'Starter', 'Petite pharmacie',
   'Produits, stock, ventes, caisse et rapports de base.',
   'USD', 29, 78, 290, 14,
   3, 1, 2000, 1024, 0, 0,
   ARRAY['catalog','inventory','sales','pos','cash','reporting_basic','customers'],
   true, false, 1),

  ('professional', 'Professional', 'Pharmacie structurée',
   'Achats, lots et FEFO, clients professionnels (B2B), alertes et livraisons.',
   'USD', 79, 213, 790, 14,
   10, 2, 10000, 5120, 200, 200,
   ARRAY['catalog','inventory','sales','pos','cash','reporting_basic','customers',
         'purchasing','suppliers','lots_fefo','b2b','alerts','delivery','reporting_advanced'],
   true, false, 2),

  ('business', 'Business', 'Distributeur semi-grossiste',
   'Multi-sites, CRM, devis, crédit client, achats avancés et API partenaires.',
   'USD', 199, 537, 1990, 14,
   30, 5, 50000, 20480, 1000, 1000,
   ARRAY['catalog','inventory','sales','pos','cash','reporting_basic','customers',
         'purchasing','suppliers','lots_fefo','b2b','alerts','delivery','reporting_advanced',
         'multi_site','crm','quotes','credit','advanced_purchasing','api','multi_warehouse'],
   true, false, 3),

  ('enterprise', 'Enterprise', 'Réseau ou grossiste',
   'SSO, API avancée, SLA contractuel, intégrations et accompagnement dédié. Limites sur mesure.',
   'USD', 0, 0, 0, 30,
   NULL, NULL, NULL, NULL, 5000, 5000,
   ARRAY['catalog','inventory','sales','pos','cash','reporting_basic','customers',
         'purchasing','suppliers','lots_fefo','b2b','alerts','delivery','reporting_advanced',
         'multi_site','crm','quotes','credit','advanced_purchasing','api','multi_warehouse',
         'sso','advanced_api','sla','integrations','dedicated_support'],
   true, true, 4)
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------
-- Options commercialisables
-- ---------------------------------------------------------------------
INSERT INTO plan_addons
  (code, name, description, unit, currency, unit_price, billing_cycle,
   grants_modules, grants_users, grants_branches, grants_storage_mb, grants_sms)
VALUES
  ('extra_user',      'Utilisateur supplémentaire', 'Un compte utilisateur au-delà du forfait.',
   'user',   'USD',  6, 'monthly', '{}', 1, 0, 0, 0),
  ('extra_branch',    'Branche supplémentaire',     'Une branche ou point de vente au-delà du forfait.',
   'branch', 'USD', 25, 'monthly', '{}', 0, 1, 0, 0),
  ('driver_app',      'Application livreur',        'Application mobile de livraison avec preuve de livraison.',
   'unit',   'USD', 19, 'monthly', ARRAY['driver_app','delivery'], 0, 0, 0, 0),
  ('whatsapp',        'Module WhatsApp',            'Notifications transactionnelles via WhatsApp Business.',
   'unit',   'USD', 15, 'monthly', ARRAY['whatsapp'], 0, 0, 0, 0),
  ('sms_pack_1000',   'Pack SMS 1 000',             'Crédit de 1 000 SMS transactionnels.',
   'pack',   'USD', 12, 'monthly', '{}', 0, 0, 0, 1000),
  ('ocr',             'Module OCR',                 'Extraction automatique des factures fournisseur.',
   'unit',   'USD', 29, 'monthly', ARRAY['ocr'], 0, 0, 0, 0),
  ('ai_insights',     'Module IA et prévisions',    'Prévisions de ventes, détection d''anomalies, assistant de gestion.',
   'unit',   'USD', 39, 'monthly', ARRAY['ai_insights'], 0, 0, 0, 0),
  ('multi_warehouse', 'Module multi-entrepôts',     'Gestion de plusieurs entrepôts et emplacements.',
   'unit',   'USD', 25, 'monthly', ARRAY['multi_warehouse'], 0, 0, 0, 0),
  ('import',          'Module importation',         'Suivi des importations, coûts rendus et dédouanement.',
   'unit',   'USD', 29, 'monthly', ARRAY['import'], 0, 0, 0, 0),
  ('mobile_money',    'Intégration Mobile Money',   'Encaissement Mobile Money intégré.',
   'unit',   'USD', 19, 'monthly', ARRAY['mobile_money'], 0, 0, 0, 0),
  ('accounting',      'Intégration comptable',      'Export et synchronisation vers un logiciel comptable.',
   'unit',   'USD', 25, 'monthly', ARRAY['accounting'], 0, 0, 0, 0),
  ('partner_api',     'API partenaires',            'Clés API, scopes et webhooks pour intégrateurs.',
   'unit',   'USD', 49, 'monthly', ARRAY['api','advanced_api'], 0, 0, 0, 0),
  ('training',        'Formation initiale',         'Formation guidée de l''équipe à la mise en production.',
   'unit',   'USD', 250, 'monthly', '{}', 0, 0, 0, 0),
  ('premium_support', 'Support premium',            'SLA renforcé, canal prioritaire et interlocuteur dédié.',
   'unit',   'USD', 79, 'monthly', ARRAY['premium_support'], 0, 0, 0, 0),
  ('backup_plus',     'Sauvegardes renforcées',     'Sauvegardes plus fréquentes et rétention allongée.',
   'unit',   'USD', 19, 'monthly', ARRAY['backup_plus'], 0, 0, 0, 0),
  ('storage_10gb',    'Stockage documentaire +10 Go','10 Go de stockage documentaire supplémentaire.',
   'pack',   'USD', 10, 'monthly', '{}', 0, 0, 10240, 0)
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------
-- Paramètres globaux de la plateforme
-- ---------------------------------------------------------------------
INSERT INTO platform_settings (key, value, description) VALUES
  ('billing.default_currency', '"USD"'::jsonb, 'Devise de facturation SaaS par défaut.'),
  ('billing.grace_days', '7'::jsonb, 'Délai de grâce avant suspension pour impayé.'),
  ('billing.dunning_schedule', '[1, 7, 14]'::jsonb,
   'Jours de retard déclenchant les relances de niveau 1, 2 et 3.'),
  ('billing.invoice_number_format', '"NPO-{YYYY}-{SEQ:6}"'::jsonb, 'Format des numéros de facture SaaS.'),
  ('trial.default_days', '14'::jsonb, 'Durée par défaut de l''essai gratuit.'),
  ('support.default_sla_hours', '{"low": 72, "normal": 24, "high": 8, "critical": 2}'::jsonb,
   'Délais de réponse contractuels par priorité.'),
  ('support.access_max_hours', '72'::jsonb, 'Durée maximale d''un accès support temporaire.'),
  ('retention.after_termination_days', '365'::jsonb,
   'Conservation des données après résiliation, avant archivage ou suppression.'),
  ('locales.supported',
   '["fr","en","sw","sw-CD","ln","rn","ar","pt","es","zh","hi","no"]'::jsonb,
   'Langues d''interface prises en charge.')
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------
-- Base de connaissances (support)
-- ---------------------------------------------------------------------
INSERT INTO knowledge_base_articles (slug, locale, category, title, kind, body, tags) VALUES
  ('demarrer-avec-nova-pharma-os', 'fr', 'onboarding',
   'Démarrer avec NOVA PHARMA OS', 'tutorial',
   E'Ce guide accompagne la mise en route d''une pharmacie :\n'
   '1. création de l''organisation ;\n2. choix du forfait ;\n3. ajout de la branche principale ;\n'
   '4. configuration de la devise et de la localisation ;\n5. création de l''administrateur pharmacie ;\n'
   '6. import du catalogue et du stock initial ;\n7. création des utilisateurs ;\n'
   '8. configuration de la caisse et des moyens de paiement ;\n9. validation de mise en production.',
   ARRAY['onboarding','demarrage']),
  ('comprendre-le-fefo', 'fr', 'inventory',
   'Comprendre la règle FEFO', 'article',
   E'FEFO signifie « First Expired, First Out » : le lot dont la date de péremption est la plus '
   'proche est vendu en premier. NOVA PHARMA OS applique cette règle automatiquement à chaque '
   'vente et signale les lots proches de la péremption selon le seuil défini sur chaque produit.',
   ARRAY['stock','lots','peremption']),
  ('paiement-de-l-abonnement', 'fr', 'billing',
   'Payer son abonnement', 'faq',
   E'Les factures d''abonnement sont émises au début de chaque période. Les règlements sont '
   'acceptés par Mobile Money, virement bancaire, paiement bancaire local, carte lorsque '
   'disponible, ou validation manuelle par l''équipe NOVA PHARMA OS. En cas de retard, des '
   'relances automatiques sont envoyées ; passé le délai de grâce, le compte peut être suspendu '
   'sans perte de données.',
   ARRAY['abonnement','facturation','paiement']),
  ('acces-support-temporaire', 'fr', 'security',
   'Accès du support à vos données', 'article',
   E'Aucun agent NOVA PHARMA OS ne consulte les données d''une pharmacie sans autorisation. '
   'Toute intervention passe par une demande motivée, à durée limitée, en lecture seule par '
   'défaut, validée par la pharmacie et intégralement journalisée. La pharmacie peut révoquer '
   'l''accès à tout moment et consulter le détail des actions réalisées.',
   ARRAY['securite','support','confidentialite'])
ON CONFLICT (slug) DO NOTHING;
