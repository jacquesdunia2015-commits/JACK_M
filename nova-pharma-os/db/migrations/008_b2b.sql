-- =====================================================================
-- NOVA PHARMA OS — 008 : commerce B2B, devis, commandes, livraison
-- =====================================================================

CREATE TABLE b2b_quotes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id           uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  customer_id         uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  number              text NOT NULL,
  status              text NOT NULL DEFAULT 'draft',        -- draft | sent | accepted | rejected | expired | converted
  currency            text NOT NULL,
  valid_until         date,
  subtotal            numeric(16,2) NOT NULL DEFAULT 0,
  discount_total      numeric(16,2) NOT NULL DEFAULT 0,
  tax_total           numeric(16,2) NOT NULL DEFAULT 0,
  total               numeric(16,2) NOT NULL DEFAULT 0,
  converted_order_id  uuid,
  notes               text,
  created_by          uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, number)
);

CREATE TABLE b2b_quote_lines (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  quote_id            uuid NOT NULL REFERENCES b2b_quotes(id) ON DELETE CASCADE,
  product_id          uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  description         text NOT NULL,
  quantity            numeric(16,3) NOT NULL CHECK (quantity > 0),
  unit_price          numeric(14,4) NOT NULL DEFAULT 0,
  discount_percent    numeric(6,2) NOT NULL DEFAULT 0,
  tax_rate            numeric(6,3) NOT NULL DEFAULT 0,
  line_total          numeric(16,2) NOT NULL DEFAULT 0,
  sort_order          integer NOT NULL DEFAULT 0
);

CREATE TABLE b2b_orders (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id           uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  customer_id         uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  quote_id            uuid REFERENCES b2b_quotes(id) ON DELETE SET NULL,
  number              text NOT NULL,
  status              nova.b2b_order_status NOT NULL DEFAULT 'draft',
  currency            text NOT NULL,
  payment_terms       text NOT NULL DEFAULT 'cash',         -- cash | credit
  requested_date      date,
  subtotal            numeric(16,2) NOT NULL DEFAULT 0,
  discount_total      numeric(16,2) NOT NULL DEFAULT 0,
  tax_total           numeric(16,2) NOT NULL DEFAULT 0,
  total               numeric(16,2) NOT NULL DEFAULT 0,
  amount_paid         numeric(16,2) NOT NULL DEFAULT 0,
  balance_due         numeric(16,2) GENERATED ALWAYS AS (total - amount_paid) STORED,
  invoice_id          uuid REFERENCES invoices(id) ON DELETE SET NULL,
  sale_id             uuid REFERENCES sales(id) ON DELETE SET NULL,
  client_operation_id text,
  notes               text,
  submitted_at        timestamptz,
  confirmed_at        timestamptz,
  delivered_at        timestamptz,
  cancelled_at        timestamptz,
  created_by          uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, number)
);
CREATE UNIQUE INDEX b2b_orders_client_operation_idx
  ON b2b_orders(organization_id, client_operation_id) WHERE client_operation_id IS NOT NULL;
CREATE INDEX b2b_orders_org_status_idx ON b2b_orders(organization_id, status, created_at DESC);

ALTER TABLE b2b_quotes
  ADD CONSTRAINT b2b_quotes_converted_order_fk
  FOREIGN KEY (converted_order_id) REFERENCES b2b_orders(id) ON DELETE SET NULL;

ALTER TABLE invoices
  ADD CONSTRAINT invoices_b2b_order_fk
  FOREIGN KEY (b2b_order_id) REFERENCES b2b_orders(id) ON DELETE SET NULL;

CREATE TABLE b2b_order_lines (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  order_id            uuid NOT NULL REFERENCES b2b_orders(id) ON DELETE CASCADE,
  product_id          uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  description         text NOT NULL,
  quantity            numeric(16,3) NOT NULL CHECK (quantity > 0),
  prepared_quantity   numeric(16,3) NOT NULL DEFAULT 0,
  unit_price          numeric(14,4) NOT NULL DEFAULT 0,
  discount_percent    numeric(6,2) NOT NULL DEFAULT 0,
  tax_rate            numeric(6,3) NOT NULL DEFAULT 0,
  line_total          numeric(16,2) NOT NULL DEFAULT 0,
  sort_order          integer NOT NULL DEFAULT 0
);

CREATE TABLE deliveries (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id           uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  order_id            uuid REFERENCES b2b_orders(id) ON DELETE SET NULL,
  sale_id             uuid REFERENCES sales(id) ON DELETE SET NULL,
  customer_id         uuid REFERENCES customers(id) ON DELETE SET NULL,
  number              text NOT NULL,
  status              text NOT NULL DEFAULT 'pending',      -- pending | assigned | picked_up | in_transit | delivered | failed | returned
  driver_user_id      uuid REFERENCES users(id) ON DELETE SET NULL,
  vehicle             text,
  address             text,
  city                text,
  contact_name        text,
  contact_phone       text,
  latitude            numeric(10,7),
  longitude           numeric(10,7),
  scheduled_at        timestamptz,
  assigned_at         timestamptz,
  picked_up_at        timestamptz,
  delivered_at        timestamptz,
  failed_reason       text,
  -- Preuve de livraison : signature, photo, code de confirmation.
  proof_document_id   uuid REFERENCES documents(id) ON DELETE SET NULL,
  proof_code          text,
  recipient_name      text,
  amount_collected    numeric(16,2) NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, number)
);
CREATE INDEX deliveries_org_status_idx ON deliveries(organization_id, status, scheduled_at);

CREATE TABLE delivery_lines (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  delivery_id         uuid NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  product_id          uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  lot_id              uuid REFERENCES product_lots(id) ON DELETE SET NULL,
  quantity            numeric(16,3) NOT NULL CHECK (quantity > 0),
  delivered_quantity  numeric(16,3) NOT NULL DEFAULT 0
);

CREATE TABLE delivery_events (
  id                  bigserial PRIMARY KEY,
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  delivery_id         uuid NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  status              text NOT NULL,
  latitude            numeric(10,7),
  longitude           numeric(10,7),
  note                text,
  user_id             uuid REFERENCES users(id) ON DELETE SET NULL,
  occurred_at         timestamptz NOT NULL DEFAULT now()
);

SELECT nova.attach_touch(t) FROM (VALUES
  ('b2b_quotes'::regclass), ('b2b_orders'), ('deliveries')
) AS x(t);
