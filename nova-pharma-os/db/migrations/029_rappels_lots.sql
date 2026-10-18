-- =====================================================================
-- NOVA PHARMA OS — 029 : rappels de lots et alertes produits falsifiés
--
-- Quand l'autorité de réglementation (ACOREP), l'OMS (alertes produits
-- médicaux), un fabricant ou un grossiste rappelle un lot ou signale un
-- produit falsifié, chaque pharmacie doit savoir en quelques secondes :
--   * si elle a ce lot en rayon (et le bloquer aussitôt) ;
--   * à qui elle l'a déjà vendu (pour prévenir ces patients) ;
--   * ce qu'elle en a fait (détruit, retourné, ou fausse alerte).
--
-- Deux sources :
--   * product_alerts : alertes publiées par le back-office NOVA PHARMA OS
--     pour toutes les pharmacies d'un pays (table de référence) ;
--   * lot_recalls : le suivi de chaque alerte par chaque pharmacie, et les
--     rappels qu'elle reçoit elle-même (lettre d'un grossiste…).
-- =====================================================================

CREATE TABLE product_alerts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind                text NOT NULL CHECK (kind IN ('recall', 'falsified', 'quality')),
  title               text NOT NULL CHECK (length(btrim(title)) > 3),
  product_name        text NOT NULL,
  -- Mots qui doivent figurer dans le nom ou la molécule du produit de la
  -- pharmacie (« paracétamol 500 ») : un numéro de lot seul est trop ambigu.
  match_terms         text,
  manufacturer        text,
  lot_numbers         text[] NOT NULL DEFAULT '{}',
  source              text NOT NULL DEFAULT 'autre'
                        CHECK (source IN ('acorep', 'oms', 'fabricant', 'grossiste', 'autre')),
  reference           text,
  description         text,
  action_required     text NOT NULL DEFAULT 'quarantine'
                        CHECK (action_required IN ('quarantine', 'return', 'destroy', 'inform')),
  -- Pays concerné ; NULL : toutes les pharmacies.
  country_code        char(2) DEFAULT 'CD',
  published_at        timestamptz NOT NULL DEFAULT now(),
  is_active           boolean NOT NULL DEFAULT true,
  created_by          uuid REFERENCES platform_users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE lot_recalls (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  alert_id            uuid REFERENCES product_alerts(id) ON DELETE SET NULL,
  kind                text NOT NULL CHECK (kind IN ('recall', 'falsified', 'quality')),
  title               text NOT NULL,
  product_id          uuid REFERENCES products(id) ON DELETE SET NULL,
  product_name        text NOT NULL,
  match_terms         text,
  lot_numbers         text[] NOT NULL DEFAULT '{}',
  source              text NOT NULL DEFAULT 'autre'
                        CHECK (source IN ('acorep', 'oms', 'fabricant', 'grossiste', 'autre')),
  reference           text,
  description         text,
  action_required     text NOT NULL DEFAULT 'quarantine'
                        CHECK (action_required IN ('quarantine', 'return', 'destroy', 'inform')),
  status              text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  resolution          text CHECK (resolution IN ('destroyed', 'returned', 'released', 'no_stock')),
  resolution_note     text,
  customers_notified  integer NOT NULL DEFAULT 0,
  created_by          uuid REFERENCES users(id) ON DELETE SET NULL,
  closed_by           uuid REFERENCES users(id) ON DELETE SET NULL,
  closed_at           timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, alert_id)
);
CREATE INDEX lot_recalls_open_idx ON lot_recalls (organization_id) WHERE status = 'open';

-- Numéro de lot comparable : majuscules, sans espaces ni tirets.
CREATE OR REPLACE FUNCTION nova.lot_normalise(t text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT upper(regexp_replace(coalesce(t, ''), '[\s\-_./]', '', 'g'));
$$;

-- Texte comparable sans accents ni majuscules (« Paracétamol » = « paracetamol »).
CREATE OR REPLACE FUNCTION nova.sans_accent(t text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT translate(lower(coalesce(t, '')), 'àáâãäåçèéêëìíîïñòóôõöùúûüýÿœæ', 'aaaaaaceeeeiiiinooooouuuuyyoa');
$$;

SELECT nova.apply_reference_rls('product_alerts');
SELECT nova.apply_tenant_rls('lot_recalls');
SELECT nova.attach_touch('product_alerts'::regclass);
SELECT nova.attach_touch('lot_recalls'::regclass);
