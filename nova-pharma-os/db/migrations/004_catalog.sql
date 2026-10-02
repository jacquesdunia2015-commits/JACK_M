-- =====================================================================
-- NOVA PHARMA OS — 004 : catalogue produits
-- =====================================================================

CREATE TABLE product_categories (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  parent_id           uuid REFERENCES product_categories(id) ON DELETE SET NULL,
  code                text NOT NULL,
  name                text NOT NULL,
  sort_order          integer NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);

CREATE TABLE molecules (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  inn                 text NOT NULL,                       -- dénomination commune internationale
  atc_code            text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, inn)
);

CREATE TABLE tax_rates (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code                text NOT NULL,
  name                text NOT NULL,
  rate                numeric(6,3) NOT NULL DEFAULT 0,
  is_default          boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);

CREATE TABLE products (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sku                 text NOT NULL,
  name                text NOT NULL,
  commercial_name     text,
  category_id         uuid REFERENCES product_categories(id) ON DELETE SET NULL,
  molecule_id         uuid REFERENCES molecules(id) ON DELETE SET NULL,
  dosage              text,                                -- ex. 500 mg
  dosage_form         text,                                -- comprimé, sirop, injectable…
  packaging           text,                                -- boîte de 20, flacon 60 ml
  manufacturer        text,
  origin_country      text,
  unit                text NOT NULL DEFAULT 'unit',        -- unité de vente
  units_per_pack      numeric(12,3) NOT NULL DEFAULT 1 CHECK (units_per_pack > 0),
  -- Réglementaire
  requires_prescription boolean NOT NULL DEFAULT false,
  is_controlled       boolean NOT NULL DEFAULT false,      -- stupéfiant / psychotrope
  is_cold_chain       boolean NOT NULL DEFAULT false,
  storage_conditions  text,
  -- Suivi des lots : obligatoire pour les médicaments
  is_batch_tracked    boolean NOT NULL DEFAULT true,
  has_expiry          boolean NOT NULL DEFAULT true,
  -- Prix
  currency            text,
  cost_price          numeric(14,4) NOT NULL DEFAULT 0,
  sale_price          numeric(14,4) NOT NULL DEFAULT 0,
  wholesale_price     numeric(14,4) NOT NULL DEFAULT 0,
  min_margin_percent  numeric(6,2),
  tax_rate_id         uuid REFERENCES tax_rates(id) ON DELETE SET NULL,
  -- Réapprovisionnement
  reorder_point       numeric(14,3) NOT NULL DEFAULT 0,
  reorder_quantity    numeric(14,3) NOT NULL DEFAULT 0,
  max_stock           numeric(14,3),
  expiry_alert_days   integer NOT NULL DEFAULT 90,
  is_active           boolean NOT NULL DEFAULT true,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz,
  UNIQUE (organization_id, sku)
);
CREATE INDEX products_org_active_idx ON products(organization_id) WHERE deleted_at IS NULL AND is_active;
CREATE INDEX products_name_trgm_idx ON products(organization_id, lower(name));

CREATE TABLE product_barcodes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id          uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  barcode             text NOT NULL,
  kind                text NOT NULL DEFAULT 'ean13',
  is_primary          boolean NOT NULL DEFAULT false,
  UNIQUE (organization_id, barcode)
);

CREATE TABLE price_lists (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code                text NOT NULL,
  name                text NOT NULL,
  currency            text NOT NULL,
  kind                text NOT NULL DEFAULT 'retail',      -- retail | wholesale | b2b | promo
  valid_from          date,
  valid_until         date,
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);

CREATE TABLE price_list_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  price_list_id       uuid NOT NULL REFERENCES price_lists(id) ON DELETE CASCADE,
  product_id          uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  unit_price          numeric(14,4) NOT NULL,
  min_quantity        numeric(14,3) NOT NULL DEFAULT 1,
  UNIQUE (price_list_id, product_id, min_quantity)
);

SELECT nova.attach_touch(t) FROM (VALUES
  ('product_categories'::regclass), ('products')
) AS x(t);
