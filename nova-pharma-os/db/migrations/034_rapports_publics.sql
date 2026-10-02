-- =====================================================================
-- NOVA PHARMA OS — 034 : rapport mensuel pour les programmes publics
--
-- Le ministère de la Santé suit les produits de santé par deux systèmes :
--   • LOGIMEV, système national de gestion logistique (bâti sur OpenLMIS),
--     en phase pilote (Kinshasa, Maniema) pour les programmes nationaux ;
--   • le SNIS, sur DHIS2, où remontent les rapports mensuels des structures.
-- Tous deux reposent sur le même rapport mensuel de gestion des stocks :
-- stock initial, quantités reçues, consommées, pertes et ajustements,
-- stock final, jours de rupture, quantité à commander.
--
-- NOVA calcule ce rapport depuis le registre des mouvements de stock et le
-- livre en Excel (colonnes OpenLMIS) et en fichier DHIS2 (dataValueSets),
-- à importer gratuitement dans l'application Import/Export de DHIS2. Les
-- codes nationaux des produits, de la structure et les identifiants DHIS2
-- sont attribués par le programme : la pharmacie les saisit ici. L'accès
-- direct à LOGIMEV s'obtient auprès du ministère ; aucun format ni
-- identifiant n'est supposé ici.
-- =====================================================================

CREATE TABLE public_report_settings (
  organization_id     uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  -- Code de la structure attribué par le programme ou la zone de santé.
  facility_code       text,
  -- Identifiants DHIS2 (11 caractères) de l'unité d'organisation et du formulaire.
  dhis2_org_unit      text CHECK (dhis2_org_unit ~ '^[A-Za-z][A-Za-z0-9]{10}$'),
  dhis2_data_set      text CHECK (dhis2_data_set ~ '^[A-Za-z][A-Za-z0-9]{10}$'),
  -- Stock maximum, en mois de consommation moyenne (OpenLMIS : 3 par défaut).
  max_months          numeric(4,1) NOT NULL DEFAULT 3 CHECK (max_months > 0 AND max_months <= 24),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public_report_mappings (
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id          uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  -- Code du produit dans la liste nationale (ou du programme).
  national_code       text,
  -- Rubrique du rapport → élément de données DHIS2 :
  -- {"consumed": {"de": "fbfJHSPpUQD", "coc": "pq2XI5kz2BY"}, …}
  dhis2               jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, product_id)
);

SELECT nova.apply_tenant_rls(t) FROM unnest(ARRAY['public_report_settings', 'public_report_mappings']) AS t;
SELECT nova.attach_touch('public_report_settings'::regclass);
SELECT nova.attach_touch('public_report_mappings'::regclass);
