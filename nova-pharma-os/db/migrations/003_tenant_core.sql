-- =====================================================================
-- NOVA PHARMA OS — 003 : socle tenant
-- Branches, utilisateurs pharmacie, rôles et permissions, sessions,
-- audit de niveau pharmacie, notifications, documents.
-- Toute table métier porte organization_id (isolation multi-tenant).
-- =====================================================================

CREATE TABLE branches (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code                text NOT NULL,
  name                text NOT NULL,
  kind                text NOT NULL DEFAULT 'pharmacy',   -- pharmacy | warehouse | depot
  address             text,
  city                text,
  phone               text,
  email               text,
  timezone            text,
  is_main             boolean NOT NULL DEFAULT false,
  is_active           boolean NOT NULL DEFAULT true,
  settings            jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);
CREATE UNIQUE INDEX branches_one_main_idx ON branches(organization_id) WHERE is_main;

CREATE TABLE roles (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code                text NOT NULL,
  name                text NOT NULL,
  description         text,
  is_system           boolean NOT NULL DEFAULT false,     -- rôle livré, non supprimable
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);

CREATE TABLE permissions (
  code                text PRIMARY KEY,                   -- ex. sales.create, stock.adjust
  module              text NOT NULL,
  label               text NOT NULL,
  description         text
);

CREATE TABLE role_permissions (
  role_id             uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  permission_code     text NOT NULL REFERENCES permissions(code) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_code)
);

CREATE TABLE users (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email               text NOT NULL,
  full_name           text NOT NULL,
  password_hash       text NOT NULL,
  phone               text,
  locale              text NOT NULL DEFAULT 'fr',
  default_branch_id   uuid REFERENCES branches(id) ON DELETE SET NULL,
  is_owner            boolean NOT NULL DEFAULT false,     -- administrateur pharmacie initial
  is_active           boolean NOT NULL DEFAULT true,
  must_change_password boolean NOT NULL DEFAULT false,
  last_login_at       timestamptz,
  failed_login_count  integer NOT NULL DEFAULT 0,
  locked_until        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz,
  UNIQUE (organization_id, email)
);
CREATE INDEX users_active_idx ON users(organization_id) WHERE deleted_at IS NULL AND is_active;

CREATE TABLE user_roles (
  user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id             uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE user_branches (
  user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  branch_id           uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, branch_id)
);

CREATE TABLE refresh_tokens (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid REFERENCES organizations(id) ON DELETE CASCADE,
  user_id             uuid REFERENCES users(id) ON DELETE CASCADE,
  platform_user_id    uuid REFERENCES platform_users(id) ON DELETE CASCADE,
  token_hash          text NOT NULL UNIQUE,
  issued_at           timestamptz NOT NULL DEFAULT now(),
  expires_at          timestamptz NOT NULL,
  revoked_at          timestamptz,
  replaced_by         uuid REFERENCES refresh_tokens(id),
  user_agent          text,
  ip_address          inet,
  CONSTRAINT refresh_tokens_subject CHECK (
    (user_id IS NOT NULL AND platform_user_id IS NULL) OR
    (user_id IS NULL AND platform_user_id IS NOT NULL))
);

-- ---------------------------------------------------------------------
-- Audit de niveau pharmacie
-- ---------------------------------------------------------------------
CREATE TABLE audit_logs (
  id                  bigserial PRIMARY KEY,
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id           uuid REFERENCES branches(id) ON DELETE SET NULL,
  user_id             uuid REFERENCES users(id) ON DELETE SET NULL,
  support_grant_id    uuid REFERENCES support_access_grants(id) ON DELETE SET NULL,
  actor_label         text,
  action              text NOT NULL,
  entity              text,
  entity_id           text,
  before_state        jsonb,
  after_state         jsonb,
  ip_address          inet,
  user_agent          text,
  occurred_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_org_idx ON audit_logs(organization_id, occurred_at DESC);
CREATE INDEX audit_logs_entity_idx ON audit_logs(organization_id, entity, entity_id);

-- ---------------------------------------------------------------------
-- Numérotation documentaire par organisation
-- ---------------------------------------------------------------------
CREATE TABLE document_sequences (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id           uuid REFERENCES branches(id) ON DELETE CASCADE,
  document_kind       text NOT NULL,                      -- sale | invoice | quote | purchase_order | delivery…
  period_key          text NOT NULL,                      -- ex. 2026 ou 2026-08
  format              text NOT NULL DEFAULT '{KIND}-{PERIOD}-{SEQ:5}',
  last_value          bigint NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX document_sequences_scope_idx ON document_sequences(
  organization_id,
  COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid),
  document_kind,
  period_key);

-- ---------------------------------------------------------------------
-- Notifications et documents
-- ---------------------------------------------------------------------
CREATE TABLE notifications (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id           uuid REFERENCES branches(id) ON DELETE CASCADE,
  user_id             uuid REFERENCES users(id) ON DELETE CASCADE,
  channel             text NOT NULL DEFAULT 'in_app',     -- in_app | email | sms | whatsapp | push
  category            text NOT NULL DEFAULT 'general',    -- stock_out | expiry | payment_due | order | system
  severity            text NOT NULL DEFAULT 'info',       -- info | warning | critical
  title               text NOT NULL,
  body                text,
  payload             jsonb NOT NULL DEFAULT '{}'::jsonb,
  status              text NOT NULL DEFAULT 'pending',    -- pending | sent | failed | read
  sent_at             timestamptz,
  read_at             timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_org_idx ON notifications(organization_id, status, created_at DESC);

CREATE TABLE documents (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id           uuid REFERENCES branches(id) ON DELETE SET NULL,
  kind                text NOT NULL,                      -- invoice_pdf | supplier_invoice | licence | proof_of_delivery | photo
  entity              text,
  entity_id           text,
  filename            text NOT NULL,
  mime_type           text NOT NULL,
  size_bytes          bigint NOT NULL DEFAULT 0,
  -- Les fichiers sont rangés par organisation : org/<organization_id>/…
  storage_key         text NOT NULL,
  checksum            text,
  uploaded_by         uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX documents_org_idx ON documents(organization_id, kind);

-- ---------------------------------------------------------------------
-- Intégrations et API partenaires
-- ---------------------------------------------------------------------
CREATE TABLE api_keys (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                text NOT NULL,
  key_prefix          text NOT NULL,
  key_hash            text NOT NULL UNIQUE,
  scopes              text[] NOT NULL DEFAULT '{}',
  rate_limit_per_min  integer NOT NULL DEFAULT 120,
  last_used_at        timestamptz,
  expires_at          timestamptz,
  revoked_at          timestamptz,
  created_by          uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX api_keys_org_idx ON api_keys(organization_id) WHERE revoked_at IS NULL;

CREATE TABLE api_call_logs (
  id                  bigserial PRIMARY KEY,
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  api_key_id          uuid REFERENCES api_keys(id) ON DELETE SET NULL,
  method              text NOT NULL,
  path                text NOT NULL,
  status_code         integer NOT NULL,
  duration_ms         integer NOT NULL DEFAULT 0,
  ip_address          inet,
  occurred_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX api_call_logs_org_idx ON api_call_logs(organization_id, occurred_at DESC);

CREATE TABLE webhook_endpoints (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  url                 text NOT NULL,
  secret              text NOT NULL,
  events              text[] NOT NULL DEFAULT '{}',
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE webhook_deliveries (
  id                  bigserial PRIMARY KEY,
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  endpoint_id         uuid NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  event               text NOT NULL,
  payload             jsonb NOT NULL,
  status              text NOT NULL DEFAULT 'pending',
  attempts            integer NOT NULL DEFAULT 0,
  last_error          text,
  delivered_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Synchronisation hors ligne
-- ---------------------------------------------------------------------
CREATE TABLE sync_operations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id           uuid REFERENCES branches(id) ON DELETE SET NULL,
  device_id           text NOT NULL,
  -- Clé d'idempotence produite par le poste hors ligne : rejoue sans
  -- créer de doublon (ventes, paiements, mouvements de stock).
  client_operation_id text NOT NULL,
  operation           text NOT NULL,
  payload             jsonb NOT NULL,
  status              text NOT NULL DEFAULT 'pending',    -- pending | applied | conflict | rejected
  result              jsonb,
  conflict_reason     text,
  received_at         timestamptz NOT NULL DEFAULT now(),
  applied_at          timestamptz,
  UNIQUE (organization_id, device_id, client_operation_id)
);

SELECT nova.attach_touch(t) FROM (VALUES
  ('branches'::regclass), ('roles'), ('users')
) AS x(t);
