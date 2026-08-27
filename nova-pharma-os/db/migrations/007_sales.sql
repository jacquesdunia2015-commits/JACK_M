-- =====================================================================
-- NOVA PHARMA OS — 007 : clients, ventes POS, caisse, factures
-- =====================================================================

CREATE TABLE customer_groups (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code                text NOT NULL,
  name                text NOT NULL,
  discount_percent    numeric(6,2) NOT NULL DEFAULT 0,
  price_list_id       uuid REFERENCES price_lists(id) ON DELETE SET NULL,
  UNIQUE (organization_id, code)
);

CREATE TABLE customers (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code                text NOT NULL,
  kind                text NOT NULL DEFAULT 'individual',   -- individual | professional
  -- « professional » = client professionnel (B2B) : pharmacie, clinique,
  -- dispensaire, ONG, structure de santé.
  name                text NOT NULL,
  contact_name        text,
  email               text,
  phone               text,
  address             text,
  city                text,
  country_code        text,
  tax_id              text,
  license_number      text,
  group_id            uuid REFERENCES customer_groups(id) ON DELETE SET NULL,
  price_list_id       uuid REFERENCES price_lists(id) ON DELETE SET NULL,
  -- Encours et crédit
  credit_limit        numeric(16,2) NOT NULL DEFAULT 0,
  credit_days         integer NOT NULL DEFAULT 0,
  outstanding_balance numeric(16,2) NOT NULL DEFAULT 0,
  is_credit_blocked   boolean NOT NULL DEFAULT false,
  loyalty_points      integer NOT NULL DEFAULT 0,
  is_active           boolean NOT NULL DEFAULT true,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz,
  UNIQUE (organization_id, code)
);
CREATE INDEX customers_org_kind_idx ON customers(organization_id, kind) WHERE deleted_at IS NULL;

CREATE TABLE cash_sessions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id           uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  register_code       text NOT NULL DEFAULT 'CAISSE-1',
  opened_by           uuid REFERENCES users(id) ON DELETE SET NULL,
  closed_by           uuid REFERENCES users(id) ON DELETE SET NULL,
  currency            text NOT NULL,
  opening_float       numeric(16,2) NOT NULL DEFAULT 0,
  expected_cash       numeric(16,2) NOT NULL DEFAULT 0,
  counted_cash        numeric(16,2),
  variance            numeric(16,2) GENERATED ALWAYS AS (COALESCE(counted_cash, 0) - expected_cash) STORED,
  status              text NOT NULL DEFAULT 'open',         -- open | closed
  opened_at           timestamptz NOT NULL DEFAULT now(),
  closed_at           timestamptz,
  notes               text
);
CREATE UNIQUE INDEX cash_sessions_one_open_idx
  ON cash_sessions(branch_id, register_code) WHERE status = 'open';

CREATE TABLE cash_movements (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_id          uuid NOT NULL REFERENCES cash_sessions(id) ON DELETE CASCADE,
  kind                text NOT NULL,                        -- sale | refund | cash_in | cash_out | expense | deposit
  amount              numeric(16,2) NOT NULL,
  currency            text NOT NULL,
  reference_kind      text,
  reference_id        uuid,
  reason              text,
  user_id             uuid REFERENCES users(id) ON DELETE SET NULL,
  occurred_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cash_movements_session_idx ON cash_movements(session_id, occurred_at);

CREATE TABLE prescriptions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id         uuid REFERENCES customers(id) ON DELETE SET NULL,
  patient_name        text,
  prescriber_name     text,
  prescriber_number   text,
  issued_date         date,
  document_id         uuid REFERENCES documents(id) ON DELETE SET NULL,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sales (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id           uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  session_id          uuid REFERENCES cash_sessions(id) ON DELETE SET NULL,
  number              text NOT NULL,
  status              nova.sale_status NOT NULL DEFAULT 'completed',
  channel             text NOT NULL DEFAULT 'pos',          -- pos | b2b | online | delivery
  customer_id         uuid REFERENCES customers(id) ON DELETE SET NULL,
  prescription_id     uuid REFERENCES prescriptions(id) ON DELETE SET NULL,
  currency            text NOT NULL,
  subtotal            numeric(16,2) NOT NULL DEFAULT 0,
  discount_total      numeric(16,2) NOT NULL DEFAULT 0,
  tax_total           numeric(16,2) NOT NULL DEFAULT 0,
  total               numeric(16,2) NOT NULL DEFAULT 0,
  amount_paid         numeric(16,2) NOT NULL DEFAULT 0,
  change_given        numeric(16,2) NOT NULL DEFAULT 0,
  balance_due         numeric(16,2) GENERATED ALWAYS AS (total - amount_paid) STORED,
  cost_total          numeric(16,2) NOT NULL DEFAULT 0,
  margin_total        numeric(16,2) GENERATED ALWAYS AS (total - tax_total - cost_total) STORED,
  -- Idempotence : rejeu d'une vente encaissée hors ligne.
  client_operation_id text,
  device_id           text,
  sold_by             uuid REFERENCES users(id) ON DELETE SET NULL,
  sold_at             timestamptz NOT NULL DEFAULT now(),
  cancelled_at        timestamptz,
  cancel_reason       text,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, number)
);
CREATE UNIQUE INDEX sales_client_operation_idx
  ON sales(organization_id, client_operation_id) WHERE client_operation_id IS NOT NULL;
CREATE INDEX sales_org_date_idx ON sales(organization_id, sold_at DESC);
CREATE INDEX sales_branch_date_idx ON sales(branch_id, sold_at DESC);
CREATE INDEX sales_customer_idx ON sales(organization_id, customer_id);

CREATE TABLE sale_lines (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sale_id             uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id          uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  lot_id              uuid REFERENCES product_lots(id) ON DELETE SET NULL,
  description         text NOT NULL,
  quantity            numeric(16,3) NOT NULL CHECK (quantity > 0),
  unit_price          numeric(14,4) NOT NULL DEFAULT 0,
  unit_cost           numeric(14,4) NOT NULL DEFAULT 0,
  discount_percent    numeric(6,2) NOT NULL DEFAULT 0,
  tax_rate            numeric(6,3) NOT NULL DEFAULT 0,
  tax_amount          numeric(16,2) NOT NULL DEFAULT 0,
  line_total          numeric(16,2) NOT NULL DEFAULT 0,
  sort_order          integer NOT NULL DEFAULT 0
);
CREATE INDEX sale_lines_sale_idx ON sale_lines(sale_id);
CREATE INDEX sale_lines_product_idx ON sale_lines(organization_id, product_id);

CREATE TABLE sale_payments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sale_id             uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  method              nova.payment_method NOT NULL,
  provider            text,
  amount              numeric(16,2) NOT NULL CHECK (amount > 0),
  currency            text NOT NULL,
  reference           text,
  received_at         timestamptz NOT NULL DEFAULT now()
);

-- Factures et reçus émis par la pharmacie (à ne pas confondre avec les
-- factures d'abonnement SaaS de la table subscription_invoices).
CREATE TABLE invoices (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id           uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  number              text NOT NULL,
  kind                text NOT NULL DEFAULT 'invoice',      -- invoice | receipt | credit_note | proforma
  status              nova.invoice_status NOT NULL DEFAULT 'issued',
  customer_id         uuid REFERENCES customers(id) ON DELETE SET NULL,
  sale_id             uuid REFERENCES sales(id) ON DELETE SET NULL,
  b2b_order_id        uuid,
  currency            text NOT NULL,
  issue_date          date NOT NULL DEFAULT CURRENT_DATE,
  due_date            date,
  subtotal            numeric(16,2) NOT NULL DEFAULT 0,
  discount_total      numeric(16,2) NOT NULL DEFAULT 0,
  tax_total           numeric(16,2) NOT NULL DEFAULT 0,
  total               numeric(16,2) NOT NULL DEFAULT 0,
  amount_paid         numeric(16,2) NOT NULL DEFAULT 0,
  balance             numeric(16,2) GENERATED ALWAYS AS (total - amount_paid) STORED,
  credited_invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  document_id         uuid REFERENCES documents(id) ON DELETE SET NULL,
  created_by          uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, number)
);
CREATE INDEX invoices_org_customer_idx ON invoices(organization_id, customer_id, status);

CREATE TABLE invoice_lines (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_id          uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id          uuid REFERENCES products(id) ON DELETE SET NULL,
  description         text NOT NULL,
  quantity            numeric(16,3) NOT NULL DEFAULT 1,
  unit_price          numeric(14,4) NOT NULL DEFAULT 0,
  discount_percent    numeric(6,2) NOT NULL DEFAULT 0,
  tax_rate            numeric(6,3) NOT NULL DEFAULT 0,
  line_total          numeric(16,2) NOT NULL DEFAULT 0,
  sort_order          integer NOT NULL DEFAULT 0
);

CREATE TABLE customer_payments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id           uuid REFERENCES branches(id) ON DELETE SET NULL,
  customer_id         uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  invoice_id          uuid REFERENCES invoices(id) ON DELETE SET NULL,
  method              nova.payment_method NOT NULL DEFAULT 'cash',
  provider            text,
  amount              numeric(16,2) NOT NULL CHECK (amount > 0),
  currency            text NOT NULL,
  reference           text,
  client_operation_id text,
  received_at         timestamptz NOT NULL DEFAULT now(),
  created_by          uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX customer_payments_client_operation_idx
  ON customer_payments(organization_id, client_operation_id) WHERE client_operation_id IS NOT NULL;

SELECT nova.attach_touch(t) FROM (VALUES
  ('customers'::regclass), ('invoices')
) AS x(t);
