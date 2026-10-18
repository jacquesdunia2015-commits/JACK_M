-- =====================================================================
-- NOVA PHARMA OS — 024 : tiers payant (assurances, mutuelles, conventions)
--
-- Beaucoup de clients réguliers ne paient qu'une partie de leurs
-- médicaments : le reste est à la charge d'une assurance, d'une mutuelle
-- de santé, de leur employeur ou d'une ONG. La pharmacie doit :
--   * connaître chaque organisme payeur et son taux de prise en charge ;
--   * reconnaître ses bénéficiaires (numéro de carte ou matricule), avec
--     un plafond éventuel et une date de validité ;
--   * partager chaque vente entre la part du patient et celle du payeur,
--     sans jamais dépasser le plafond ;
--   * présenter chaque mois à chaque payeur le relevé de ce qu'il doit, puis
--     en suivre le règlement.
-- =====================================================================

-- La part du payeur est un règlement de la vente comme un autre, mais elle
-- n'entre ni en caisse ni à l'encours du client : elle est due par le payeur.
ALTER TYPE nova.payment_method ADD VALUE IF NOT EXISTS 'insurance';

CREATE TABLE payers (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code                text NOT NULL,
  name                text NOT NULL CHECK (length(btrim(name)) > 1),
  kind                text NOT NULL DEFAULT 'assurance'
                        CHECK (kind IN ('assurance', 'mutuelle', 'entreprise', 'ong', 'autre')),
  coverage_percent    numeric(5,2) NOT NULL DEFAULT 80 CHECK (coverage_percent > 0 AND coverage_percent <= 100),
  -- Plafond de la part du payeur sur une seule vente (bon de prise en charge).
  per_sale_ceiling    numeric(16,2) CHECK (per_sale_ceiling IS NULL OR per_sale_ceiling > 0),
  contact_name        text,
  phone               text,
  email               text,
  address             text,
  -- Délai de règlement des relevés, en jours.
  payment_days        integer NOT NULL DEFAULT 30 CHECK (payment_days >= 0),
  is_active           boolean NOT NULL DEFAULT true,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);

CREATE TABLE payer_members (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  payer_id            uuid NOT NULL REFERENCES payers(id) ON DELETE CASCADE,
  customer_id         uuid REFERENCES customers(id) ON DELETE SET NULL,
  member_number       text NOT NULL CHECK (length(btrim(member_number)) > 0),
  full_name           text NOT NULL CHECK (length(btrim(full_name)) > 1),
  -- Ayant droit d'un adhérent (conjoint, enfant) : nom de l'adhérent principal.
  principal_name      text,
  phone               text,
  -- Taux propre à ce bénéficiaire ; à défaut, celui du payeur.
  coverage_percent    numeric(5,2) CHECK (coverage_percent IS NULL OR (coverage_percent > 0 AND coverage_percent <= 100)),
  -- Plafond annuel de la part du payeur pour ce bénéficiaire (année civile).
  annual_ceiling      numeric(16,2) CHECK (annual_ceiling IS NULL OR annual_ceiling > 0),
  valid_until         date,
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (payer_id, member_number)
);
CREATE INDEX payer_members_search_idx ON payer_members (organization_id, payer_id, full_name);

-- Relevé mensuel présenté à un payeur : les ventes qu'il prend en charge.
CREATE TABLE payer_claims (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  payer_id            uuid NOT NULL REFERENCES payers(id) ON DELETE RESTRICT,
  number              text NOT NULL,
  period_start        date NOT NULL,
  period_end          date NOT NULL CHECK (period_end >= period_start),
  status              text NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'sent', 'partially_paid', 'paid', 'cancelled')),
  currency            text NOT NULL,
  total               numeric(16,2) NOT NULL DEFAULT 0,
  amount_paid         numeric(16,2) NOT NULL DEFAULT 0,
  balance             numeric(16,2) GENERATED ALWAYS AS (total - amount_paid) STORED,
  due_date            date,
  sent_at             timestamptz,
  notes               text,
  created_by          uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, number)
);
CREATE INDEX payer_claims_payer_idx ON payer_claims (organization_id, payer_id, period_start DESC);

CREATE TABLE payer_claim_payments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  claim_id            uuid NOT NULL REFERENCES payer_claims(id) ON DELETE CASCADE,
  method              nova.payment_method NOT NULL DEFAULT 'bank_transfer',
  amount              numeric(16,2) NOT NULL CHECK (amount > 0),
  reference           text,
  received_at         timestamptz NOT NULL DEFAULT now(),
  created_by          uuid REFERENCES users(id) ON DELETE SET NULL
);

-- La vente garde qui la prend en charge, à quel taux, et le partage.
ALTER TABLE sales
  ADD COLUMN payer_id              uuid REFERENCES payers(id) ON DELETE SET NULL,
  ADD COLUMN payer_member_id       uuid REFERENCES payer_members(id) ON DELETE SET NULL,
  ADD COLUMN coverage_percent      numeric(5,2),
  ADD COLUMN payer_share           numeric(16,2) NOT NULL DEFAULT 0,
  ADD COLUMN patient_share         numeric(16,2),
  ADD COLUMN authorization_number  text,
  ADD COLUMN payer_claim_id        uuid REFERENCES payer_claims(id) ON DELETE SET NULL;
CREATE INDEX sales_payer_idx ON sales (organization_id, payer_id, sold_at) WHERE payer_id IS NOT NULL;

SELECT nova.apply_tenant_rls(t)
  FROM unnest(ARRAY['payers', 'payer_members', 'payer_claims', 'payer_claim_payments']) AS t;
SELECT nova.attach_touch(t) FROM (VALUES
  ('payers'::regclass), ('payer_members'), ('payer_claims')
) AS x(t);
