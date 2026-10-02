-- =====================================================================
-- NOVA PHARMA OS — 006 : fournisseurs, achats, réceptions
-- =====================================================================

CREATE TABLE suppliers (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code                text NOT NULL,
  name                text NOT NULL,
  kind                text NOT NULL DEFAULT 'wholesaler',   -- manufacturer | wholesaler | semi_wholesaler | importer
  contact_name        text,
  email               text,
  phone               text,
  address             text,
  city                text,
  country_code        text,
  tax_id              text,
  currency            text,
  payment_terms_days  integer NOT NULL DEFAULT 0,
  credit_limit        numeric(16,2) NOT NULL DEFAULT 0,
  lead_time_days      integer NOT NULL DEFAULT 7,
  rating              integer CHECK (rating BETWEEN 1 AND 5),
  is_active           boolean NOT NULL DEFAULT true,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);

ALTER TABLE product_lots
  ADD CONSTRAINT product_lots_supplier_fk
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL;

CREATE TABLE supplier_products (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id         uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  product_id          uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  supplier_reference  text,
  last_cost           numeric(14,4) NOT NULL DEFAULT 0,
  currency            text,
  min_order_quantity  numeric(14,3) NOT NULL DEFAULT 1,
  is_preferred        boolean NOT NULL DEFAULT false,
  UNIQUE (supplier_id, product_id)
);

CREATE TABLE purchase_orders (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id           uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  supplier_id         uuid NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  number              text NOT NULL,
  status              text NOT NULL DEFAULT 'draft',
    -- draft | submitted | confirmed | partially_received | received | cancelled
  currency            text NOT NULL,
  exchange_rate       numeric(16,6) NOT NULL DEFAULT 1,
  order_date          date NOT NULL DEFAULT CURRENT_DATE,
  expected_date       date,
  subtotal            numeric(16,2) NOT NULL DEFAULT 0,
  discount_total      numeric(16,2) NOT NULL DEFAULT 0,
  tax_total           numeric(16,2) NOT NULL DEFAULT 0,
  shipping_cost       numeric(16,2) NOT NULL DEFAULT 0,
  total               numeric(16,2) NOT NULL DEFAULT 0,
  amount_paid         numeric(16,2) NOT NULL DEFAULT 0,
  notes               text,
  created_by          uuid REFERENCES users(id) ON DELETE SET NULL,
  submitted_at        timestamptz,
  received_at         timestamptz,
  cancelled_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, number)
);
CREATE INDEX purchase_orders_org_idx ON purchase_orders(organization_id, status, order_date DESC);

CREATE TABLE purchase_order_lines (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  purchase_order_id   uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id          uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity            numeric(16,3) NOT NULL CHECK (quantity > 0),
  received_quantity   numeric(16,3) NOT NULL DEFAULT 0,
  unit_cost           numeric(14,4) NOT NULL DEFAULT 0,
  discount_percent    numeric(6,2) NOT NULL DEFAULT 0,
  tax_rate            numeric(6,3) NOT NULL DEFAULT 0,
  line_total          numeric(16,2) NOT NULL DEFAULT 0,
  sort_order          integer NOT NULL DEFAULT 0
);
CREATE INDEX purchase_order_lines_po_idx ON purchase_order_lines(purchase_order_id);

CREATE TABLE goods_receipts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id           uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  purchase_order_id   uuid REFERENCES purchase_orders(id) ON DELETE SET NULL,
  supplier_id         uuid NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  number              text NOT NULL,
  status              text NOT NULL DEFAULT 'draft',        -- draft | validated | cancelled
  received_date       date NOT NULL DEFAULT CURRENT_DATE,
  supplier_invoice_number text,
  -- Empêche la double réception d'un même bon fournisseur.
  idempotency_key     text,
  notes               text,
  validated_at        timestamptz,
  validated_by        uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, number)
);
CREATE UNIQUE INDEX goods_receipts_idempotency_idx
  ON goods_receipts(organization_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE goods_receipt_lines (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  receipt_id          uuid NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
  purchase_order_line_id uuid REFERENCES purchase_order_lines(id) ON DELETE SET NULL,
  product_id          uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  lot_number          text,
  expiry_date         date,
  quantity            numeric(16,3) NOT NULL CHECK (quantity > 0),
  unit_cost           numeric(14,4) NOT NULL DEFAULT 0,
  lot_id              uuid REFERENCES product_lots(id) ON DELETE SET NULL
);

CREATE TABLE supplier_payments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id           uuid REFERENCES branches(id) ON DELETE SET NULL,
  supplier_id         uuid NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  purchase_order_id   uuid REFERENCES purchase_orders(id) ON DELETE SET NULL,
  method              nova.payment_method NOT NULL DEFAULT 'cash',
  amount              numeric(16,2) NOT NULL CHECK (amount > 0),
  currency            text NOT NULL,
  reference           text,
  paid_at             timestamptz NOT NULL DEFAULT now(),
  created_by          uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

SELECT nova.attach_touch(t) FROM (VALUES
  ('suppliers'::regclass), ('purchase_orders')
) AS x(t);
