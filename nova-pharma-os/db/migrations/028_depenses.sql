-- =====================================================================
-- NOVA PHARMA OS — 028 : dépenses, bénéfice réel et facture normalisée
--
-- La marge des ventes ne dit pas ce que la pharmacie gagne : il faut en
-- retirer le loyer, les salaires, le courant (SNEL), l'eau (REGIDESO), le
-- carburant du groupe électrogène, les frais Mobile Money… et les pertes
-- de stock. Cette migration enregistre les dépenses et prépare le bénéfice
-- réel du mois.
--
-- Facture normalisée (décret n° 23/10 du 3 mars 2023) : un assujetti à la
-- TVA émet ses factures par un système de facturation homologué par la
-- DGI, relié à un dispositif électronique fiscal (MCF ou e-MCF), qui leur
-- donne une signature, le numéro du dispositif et un QR code. NOVA n'est
-- pas un système homologué : il garde la référence de la facture
-- normalisée émise par le dispositif de la pharmacie, et ne compte en TVA
-- déductible que les dépenses justifiées par une facture normalisée.
-- =====================================================================

CREATE TABLE finance_settings (
  organization_id     uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  -- Assujettie à la TVA (chiffre d'affaires annuel ≥ 80 000 000 FC, ou option).
  vat_registered      boolean NOT NULL DEFAULT false,
  -- Numéro du dispositif électronique fiscal (MCF ou e-MCF) de la pharmacie.
  def_number          text,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE expenses (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id             uuid REFERENCES branches(id) ON DELETE SET NULL,
  number                text NOT NULL,
  expense_date          date NOT NULL,
  category              text NOT NULL CHECK (category IN (
                          'loyer', 'salaires', 'electricite', 'eau', 'carburant', 'transport',
                          'telephone_internet', 'impots_taxes', 'entretien', 'fournitures',
                          'publicite', 'frais_bancaires', 'frais_mobile_money', 'honoraires',
                          'assurance', 'autre')),
  label                 text NOT NULL CHECK (length(btrim(label)) > 1),
  supplier_name         text,
  -- Montant payé, dans la devise du paiement, toutes taxes comprises.
  amount                numeric(16,2) NOT NULL CHECK (amount > 0),
  currency              text NOT NULL,
  exchange_rate         numeric(18,6),
  -- Contre-valeur dans la devise de la pharmacie.
  amount_base           numeric(16,2) NOT NULL CHECK (amount_base > 0),
  -- TVA portée par la facture du fournisseur (devise de la pharmacie).
  vat_amount            numeric(16,2) NOT NULL DEFAULT 0 CHECK (vat_amount >= 0),
  normalized_invoice    boolean NOT NULL DEFAULT false,
  normalized_reference  text,
  payment_method        text NOT NULL DEFAULT 'cash'
                          CHECK (payment_method IN ('cash', 'mobile_money', 'bank', 'card', 'other')),
  -- Sortie de la caisse ouverte, quand la dépense est payée en espèces au comptoir.
  cash_session_id       uuid REFERENCES cash_sessions(id) ON DELETE SET NULL,
  notes                 text,
  created_by            uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  cancelled_at          timestamptz,
  cancel_reason         text,
  UNIQUE (organization_id, number),
  CHECK (vat_amount < amount_base)
);
CREATE INDEX expenses_date_idx ON expenses (organization_id, expense_date) WHERE cancelled_at IS NULL;

-- Référence de la facture normalisée émise par le dispositif fiscal de la
-- pharmacie pour cette vente (numéro, code de signature…).
ALTER TABLE sales ADD COLUMN normalized_reference text;

SELECT nova.apply_tenant_rls(t) FROM unnest(ARRAY['finance_settings', 'expenses']) AS t;
SELECT nova.attach_touch('finance_settings'::regclass);
SELECT nova.attach_touch('expenses'::regclass);
