-- =====================================================================
-- NOVA PHARMA OS — 023 : caisse en deux devises (dollar et franc congolais)
--
-- En RD Congo, une même vente se règle souvent en dollars et en francs :
-- le prix est affiché dans la devise de la pharmacie, le client paie avec
-- ce qu'il a, et la monnaie est rendue en francs. Il faut donc :
--   * un taux du jour, fixé par la pharmacie et historisé ;
--   * des encaissements qui gardent le montant réellement reçu, sa devise
--     et le taux appliqué, à côté de leur contre-valeur dans la devise de
--     la vente (seule utilisée pour les totaux, marges et factures) ;
--   * une caisse qui attend et compte chaque devise séparément.
-- =====================================================================

-- Taux de change, du plus récent au plus ancien. « 1 base = rate quote »,
-- la devise forte en base (1 USD = 2 850 CDF), quelle que soit la devise
-- de la pharmacie. L'arrondi s'applique à la monnaie rendue dans la devise
-- cotée : les petites coupures de francs ne circulent pas.
CREATE TABLE exchange_rates (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  base_currency       text NOT NULL CHECK (base_currency ~ '^[A-Z]{3}$'),
  quote_currency      text NOT NULL CHECK (quote_currency ~ '^[A-Z]{3}$'),
  rate                numeric(18,6) NOT NULL CHECK (rate > 0),
  change_rounding     numeric(16,2) NOT NULL DEFAULT 0 CHECK (change_rounding >= 0),
  set_by              uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CHECK (base_currency <> quote_currency)
);
CREATE INDEX exchange_rates_org_idx ON exchange_rates (organization_id, created_at DESC);

-- Encaissement : « amount » reste la contre-valeur dans la devise de la
-- vente ; le montant remis par le client, sa devise et le taux sont gardés.
ALTER TABLE sale_payments
  ADD COLUMN tendered_currency text,
  ADD COLUMN tendered_amount   numeric(16,2),
  ADD COLUMN exchange_rate     numeric(18,6);

-- Monnaie rendue, dans la devise où elle a été rendue (« change_given »
-- reste sa contre-valeur dans la devise de la vente).
ALTER TABLE sales
  ADD COLUMN change_currency text,
  ADD COLUMN change_amount   numeric(16,2);

-- Caisse : la devise de la pharmacie reste suivie dans cash_sessions ;
-- chaque autre devise a sa ligne ici, avec son fonds, son attendu et son
-- comptage à la clôture.
CREATE TABLE cash_session_currencies (
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_id          uuid NOT NULL REFERENCES cash_sessions(id) ON DELETE CASCADE,
  currency            text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  opening_float       numeric(16,2) NOT NULL DEFAULT 0,
  expected_cash       numeric(16,2) NOT NULL DEFAULT 0,
  counted_cash        numeric(16,2),
  variance            numeric(16,2) GENERATED ALWAYS AS (COALESCE(counted_cash, 0) - expected_cash) STORED,
  PRIMARY KEY (session_id, currency)
);

SELECT nova.apply_tenant_rls(t) FROM unnest(ARRAY['exchange_rates', 'cash_session_currencies']) AS t;
