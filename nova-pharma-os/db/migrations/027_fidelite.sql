-- =====================================================================
-- NOVA PHARMA OS — 027 : fidélité (points et remises)
--
-- Deux façons de récompenser un client qui revient :
--   * des points gagnés à chaque achat, qu'il utilise ensuite pour payer
--     une partie d'un achat (100 points = 5 $ par exemple) ;
--   * une remise permanente par catégorie de clients (personnel, clients
--     fidèles, personnes âgées…), appliquée d'office à la caisse.
-- Tout est réglé par la pharmacie ; rien n'est activé sans elle.
-- =====================================================================

-- Les points utilisés sont un règlement de la vente : ils n'entrent ni en
-- caisse ni à l'encours du client.
ALTER TYPE nova.payment_method ADD VALUE IF NOT EXISTS 'loyalty';

CREATE TABLE loyalty_programs (
  organization_id     uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  is_enabled          boolean NOT NULL DEFAULT false,
  -- Points gagnés pour une unité de la devise de la pharmacie payée.
  points_per_unit     numeric(10,3) NOT NULL DEFAULT 1 CHECK (points_per_unit >= 0),
  -- Valeur d'un point utilisé, dans la devise de la pharmacie.
  point_value         numeric(12,4) NOT NULL DEFAULT 0.05 CHECK (point_value > 0),
  -- Solde minimum pour commencer à utiliser ses points.
  min_redeem_points   integer NOT NULL DEFAULT 100 CHECK (min_redeem_points >= 0),
  -- Part au plus d'une vente payable en points.
  max_redeem_percent  numeric(5,2) NOT NULL DEFAULT 50 CHECK (max_redeem_percent > 0 AND max_redeem_percent <= 100),
  -- Points offerts à la première inscription au programme (facultatif).
  welcome_points      integer NOT NULL DEFAULT 0 CHECK (welcome_points >= 0),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE loyalty_entries (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id         uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  sale_id             uuid REFERENCES sales(id) ON DELETE SET NULL,
  kind                text NOT NULL CHECK (kind IN ('earn', 'redeem', 'reverse', 'adjust', 'welcome')),
  points              integer NOT NULL CHECK (points <> 0),
  balance_after       integer NOT NULL CHECK (balance_after >= 0),
  -- Valeur des points utilisés (règlement de la vente).
  amount              numeric(16,2),
  reason              text,
  created_by          uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX loyalty_entries_customer_idx ON loyalty_entries (customer_id, created_at DESC);
CREATE INDEX loyalty_entries_sale_idx ON loyalty_entries (sale_id) WHERE sale_id IS NOT NULL;

ALTER TABLE sales
  ADD COLUMN loyalty_points_earned   integer NOT NULL DEFAULT 0,
  ADD COLUMN loyalty_points_redeemed integer NOT NULL DEFAULT 0,
  -- Remise de la catégorie du client appliquée d'office à la vente.
  ADD COLUMN group_discount_percent  numeric(6,2);

ALTER TABLE customer_groups
  ADD COLUMN is_active  boolean NOT NULL DEFAULT true,
  ADD COLUMN notes      text,
  ADD COLUMN created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(),
  ADD CONSTRAINT customer_groups_discount_check CHECK (discount_percent >= 0 AND discount_percent <= 100);

SELECT nova.apply_tenant_rls(t) FROM unnest(ARRAY['loyalty_programs', 'loyalty_entries']) AS t;
SELECT nova.attach_touch('loyalty_programs'::regclass);
SELECT nova.attach_touch('customer_groups'::regclass);
