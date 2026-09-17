-- =====================================================================
-- NOVA PHARMA OS — 005 : lots, stock, FEFO, inventaire
--
-- Le stock est tenu par (branche, produit, lot). La sortie de stock
-- applique la règle FEFO : First Expired, First Out — le lot dont la
-- date de péremption est la plus proche part en premier.
-- =====================================================================

CREATE TABLE product_lots (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  product_id          uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  lot_number          text NOT NULL,
  expiry_date         date,
  manufactured_date   date,
  supplier_id         uuid,
  cost_price          numeric(14,4) NOT NULL DEFAULT 0,
  is_quarantined      boolean NOT NULL DEFAULT false,      -- bloqué (rappel, contrôle qualité)
  quarantine_reason   text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, product_id, lot_number)
);
CREATE INDEX product_lots_expiry_idx ON product_lots(organization_id, expiry_date);

CREATE TABLE stock_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id           uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  product_id          uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  lot_id              uuid REFERENCES product_lots(id) ON DELETE CASCADE,
  quantity            numeric(16,3) NOT NULL DEFAULT 0,
  reserved_quantity   numeric(16,3) NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  available_quantity  numeric(16,3) GENERATED ALWAYS AS (quantity - reserved_quantity) STORED,
  average_cost        numeric(14,4) NOT NULL DEFAULT 0,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stock_items_no_negative CHECK (quantity >= 0)
);
CREATE UNIQUE INDEX stock_items_unique_idx
  ON stock_items(branch_id, product_id, COALESCE(lot_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX stock_items_org_product_idx ON stock_items(organization_id, product_id);

CREATE TABLE stock_movements (
  id                  bigserial PRIMARY KEY,
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id           uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  product_id          uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  lot_id              uuid REFERENCES product_lots(id) ON DELETE SET NULL,
  kind                nova.stock_movement_kind NOT NULL,
  -- Positif = entrée, négatif = sortie.
  quantity            numeric(16,3) NOT NULL CHECK (quantity <> 0),
  unit_cost           numeric(14,4) NOT NULL DEFAULT 0,
  balance_after       numeric(16,3) NOT NULL DEFAULT 0,
  reference_kind      text,                                 -- sale | purchase_order | inventory | transfer
  reference_id        uuid,
  reason              text,
  user_id             uuid REFERENCES users(id) ON DELETE SET NULL,
  occurred_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX stock_movements_org_idx ON stock_movements(organization_id, occurred_at DESC);
CREATE INDEX stock_movements_product_idx ON stock_movements(organization_id, product_id, occurred_at DESC);
CREATE INDEX stock_movements_reference_idx ON stock_movements(reference_kind, reference_id);

CREATE TABLE stock_transfers (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  reference           text NOT NULL,
  from_branch_id      uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  to_branch_id        uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  status              text NOT NULL DEFAULT 'draft',        -- draft | sent | received | cancelled
  sent_at             timestamptz,
  received_at         timestamptz,
  created_by          uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, reference),
  CONSTRAINT stock_transfers_distinct_branches CHECK (from_branch_id <> to_branch_id)
);

CREATE TABLE stock_transfer_lines (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  transfer_id         uuid NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
  product_id          uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  lot_id              uuid REFERENCES product_lots(id) ON DELETE SET NULL,
  quantity            numeric(16,3) NOT NULL CHECK (quantity > 0),
  received_quantity   numeric(16,3) NOT NULL DEFAULT 0
);

CREATE TABLE inventory_counts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id           uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  reference           text NOT NULL,
  kind                text NOT NULL DEFAULT 'full',         -- full | partial | cycle
  status              text NOT NULL DEFAULT 'draft',        -- draft | counting | validated | cancelled
  started_at          timestamptz NOT NULL DEFAULT now(),
  validated_at        timestamptz,
  validated_by        uuid REFERENCES users(id) ON DELETE SET NULL,
  notes               text,
  UNIQUE (organization_id, reference)
);

CREATE TABLE inventory_count_lines (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  count_id            uuid NOT NULL REFERENCES inventory_counts(id) ON DELETE CASCADE,
  product_id          uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  lot_id              uuid REFERENCES product_lots(id) ON DELETE SET NULL,
  expected_quantity   numeric(16,3) NOT NULL DEFAULT 0,
  counted_quantity    numeric(16,3),
  variance            numeric(16,3) GENERATED ALWAYS AS (COALESCE(counted_quantity, 0) - expected_quantity) STORED,
  reason              text
);

CREATE TABLE stock_alerts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id           uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  product_id          uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  lot_id              uuid REFERENCES product_lots(id) ON DELETE CASCADE,
  kind                text NOT NULL,                        -- out_of_stock | low_stock | expiring | expired | overstock
  severity            text NOT NULL DEFAULT 'warning',
  message             text NOT NULL,
  details             jsonb NOT NULL DEFAULT '{}'::jsonb,
  status              text NOT NULL DEFAULT 'open',         -- open | acknowledged | resolved
  acknowledged_by     uuid REFERENCES users(id) ON DELETE SET NULL,
  acknowledged_at     timestamptz,
  resolved_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX stock_alerts_open_unique_idx
  ON stock_alerts(branch_id, product_id, COALESCE(lot_id, '00000000-0000-0000-0000-000000000000'::uuid), kind)
  WHERE status = 'open';

-- ---------------------------------------------------------------------
-- Vue FEFO : lots consommables ordonnés par péremption la plus proche.
-- Les lots en quarantaine et les lots périmés sont exclus.
-- ---------------------------------------------------------------------
CREATE VIEW stock_fefo_queue AS
SELECT
  si.organization_id,
  si.branch_id,
  si.product_id,
  si.lot_id,
  pl.lot_number,
  pl.expiry_date,
  si.quantity,
  si.reserved_quantity,
  si.available_quantity,
  si.average_cost,
  row_number() OVER (
    PARTITION BY si.branch_id, si.product_id
    ORDER BY pl.expiry_date NULLS LAST, pl.created_at
  ) AS fefo_rank
FROM stock_items si
LEFT JOIN product_lots pl ON pl.id = si.lot_id
WHERE si.available_quantity > 0
  AND COALESCE(pl.is_quarantined, false) = false
  AND (pl.expiry_date IS NULL OR pl.expiry_date >= CURRENT_DATE);

COMMENT ON VIEW stock_fefo_queue IS
  'File FEFO (First Expired First Out) : ordre de consommation des lots par branche et produit.';

SELECT nova.attach_touch(t) FROM (VALUES
  ('product_lots'::regclass)
) AS x(t);
