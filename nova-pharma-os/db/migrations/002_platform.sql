-- =====================================================================
-- NOVA PHARMA OS — 002 : plateforme SaaS
-- Organisations clientes, forfaits, abonnements, facturation SaaS,
-- utilisateurs internes NOVA PHARMA OS, support, audit plateforme.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Paramétrage local par pays
-- ---------------------------------------------------------------------
CREATE TABLE country_settings (
  code                text PRIMARY KEY,                 -- ISO 3166-1 alpha-2
  name                text NOT NULL,
  default_currency    text NOT NULL,
  default_locale      text NOT NULL DEFAULT 'fr',
  default_timezone    text NOT NULL DEFAULT 'UTC',
  vat_rate            numeric(6,3) NOT NULL DEFAULT 0,
  invoice_number_format text NOT NULL DEFAULT 'FA-{YYYY}-{SEQ:6}',
  phone_prefix        text,
  phone_pattern       text,
  payment_methods     text[] NOT NULL DEFAULT '{}',
  credit_rules        jsonb NOT NULL DEFAULT '{}'::jsonb,
  regulatory_rules    jsonb NOT NULL DEFAULT '{}'::jsonb,
  data_retention_days integer NOT NULL DEFAULT 3650,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE country_settings IS
  'Règles locales paramétrables : devise, TVA, format de facture, moyens de paiement, conservation des données.';

-- ---------------------------------------------------------------------
-- Forfaits et options commercialisables
-- ---------------------------------------------------------------------
CREATE TABLE subscription_plans (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                text NOT NULL UNIQUE,             -- starter | professional | business | enterprise
  name                text NOT NULL,
  target_audience     text,
  description         text,
  currency            text NOT NULL DEFAULT 'USD',
  price_monthly       numeric(14,2) NOT NULL DEFAULT 0,
  price_quarterly     numeric(14,2) NOT NULL DEFAULT 0,
  price_annual        numeric(14,2) NOT NULL DEFAULT 0,
  trial_days          integer NOT NULL DEFAULT 14,
  max_users           integer,                          -- NULL = sur mesure / illimité
  max_branches        integer,
  max_products        integer,
  storage_quota_mb    integer,
  sms_quota           integer NOT NULL DEFAULT 0,
  whatsapp_quota      integer NOT NULL DEFAULT 0,
  modules             text[] NOT NULL DEFAULT '{}',     -- modules activés par le forfait
  is_public           boolean NOT NULL DEFAULT true,
  is_custom           boolean NOT NULL DEFAULT false,   -- Enterprise : limites sur mesure
  sort_order          integer NOT NULL DEFAULT 0,
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE plan_addons (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                text NOT NULL UNIQUE,
  name                text NOT NULL,
  description         text,
  unit                text NOT NULL DEFAULT 'unit',     -- unit | user | branch | pack | month
  currency            text NOT NULL DEFAULT 'USD',
  unit_price          numeric(14,2) NOT NULL DEFAULT 0,
  billing_cycle       nova.billing_cycle NOT NULL DEFAULT 'monthly',
  grants_modules      text[] NOT NULL DEFAULT '{}',
  grants_users        integer NOT NULL DEFAULT 0,
  grants_branches     integer NOT NULL DEFAULT 0,
  grants_storage_mb   integer NOT NULL DEFAULT 0,
  grants_sms          integer NOT NULL DEFAULT 0,
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE plan_addons IS
  'Options vendables : utilisateur/branche supplémentaire, WhatsApp, pack SMS, OCR, IA, multi-entrepôts, API partenaires, support premium…';

CREATE TABLE promo_codes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                text NOT NULL UNIQUE,
  description         text,
  discount_percent    numeric(5,2) CHECK (discount_percent >= 0 AND discount_percent <= 100),
  discount_amount     numeric(14,2) CHECK (discount_amount >= 0),
  currency            text,
  valid_from          date,
  valid_until         date,
  max_redemptions     integer,
  redemptions         integer NOT NULL DEFAULT 0,
  applies_to_plans    text[] NOT NULL DEFAULT '{}',
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT promo_codes_discount_present
    CHECK (discount_percent IS NOT NULL OR discount_amount IS NOT NULL)
);

-- ---------------------------------------------------------------------
-- Organisations clientes (tenants)
-- ---------------------------------------------------------------------
CREATE TABLE organizations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                text NOT NULL UNIQUE,
  legal_name          text NOT NULL,
  trade_name          text,
  kind                text NOT NULL DEFAULT 'pharmacy',  -- pharmacy | clinic | wholesaler | network
  country_code        text NOT NULL REFERENCES country_settings(code),
  currency            text NOT NULL,
  locale              text NOT NULL DEFAULT 'fr',
  timezone            text NOT NULL DEFAULT 'Africa/Lubumbashi',
  email               text,
  phone               text,
  address             text,
  city                text,
  tax_id              text,
  license_number      text,                              -- agrément pharmaceutique
  status              nova.organization_status NOT NULL DEFAULT 'trial',
  onboarding_step     text NOT NULL DEFAULT 'organization_created',
  onboarding_completed_at timestamptz,
  activated_at        timestamptz,
  suspended_at        timestamptz,
  terminated_at       timestamptz,
  data_retention_until date,                             -- conservation contractuelle avant archivage
  deleted_at          timestamptz,                       -- suppression logique
  settings            jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX organizations_status_idx ON organizations(status) WHERE deleted_at IS NULL;
COMMENT ON COLUMN organizations.deleted_at IS
  'Suppression logique : les données restent restaurables pendant la durée contractuelle.';

-- ---------------------------------------------------------------------
-- Abonnements
-- ---------------------------------------------------------------------
CREATE TABLE organization_subscriptions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id             uuid NOT NULL REFERENCES subscription_plans(id),
  status              nova.subscription_status NOT NULL DEFAULT 'trialing',
  billing_cycle       nova.billing_cycle NOT NULL DEFAULT 'monthly',
  currency            text NOT NULL DEFAULT 'USD',
  unit_price          numeric(14,2) NOT NULL DEFAULT 0,
  discount_percent    numeric(5,2) NOT NULL DEFAULT 0,
  promo_code_id       uuid REFERENCES promo_codes(id),
  started_at          timestamptz NOT NULL DEFAULT now(),
  trial_ends_at       timestamptz,
  current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end  timestamptz NOT NULL,
  renewal_at          timestamptz,
  grace_days          integer NOT NULL DEFAULT 7,        -- délai de grâce paramétrable
  auto_renew          boolean NOT NULL DEFAULT true,
  suspended_at        timestamptz,
  cancelled_at        timestamptz,
  cancel_reason       text,
  -- Limites effectives (forfait + options souscrites) — recalculées à
  -- chaque changement de forfait ou d'option.
  max_users           integer,
  max_branches        integer,
  max_products        integer,
  storage_quota_mb    integer,
  sms_quota           integer NOT NULL DEFAULT 0,
  whatsapp_quota      integer NOT NULL DEFAULT 0,
  modules             text[] NOT NULL DEFAULT '{}',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
-- Une organisation n'a qu'un abonnement vivant à la fois.
CREATE UNIQUE INDEX organization_subscriptions_one_live_idx
  ON organization_subscriptions(organization_id)
  WHERE status NOT IN ('cancelled', 'expired', 'archived');
CREATE INDEX organization_subscriptions_status_idx ON organization_subscriptions(status);

CREATE TABLE organization_addons (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subscription_id     uuid NOT NULL REFERENCES organization_subscriptions(id) ON DELETE CASCADE,
  addon_id            uuid NOT NULL REFERENCES plan_addons(id),
  quantity            integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price          numeric(14,2) NOT NULL DEFAULT 0,
  currency            text NOT NULL DEFAULT 'USD',
  active_from         timestamptz NOT NULL DEFAULT now(),
  active_until        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX organization_addons_org_idx ON organization_addons(organization_id);

CREATE TABLE subscription_plan_changes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subscription_id     uuid NOT NULL REFERENCES organization_subscriptions(id) ON DELETE CASCADE,
  from_plan_id        uuid REFERENCES subscription_plans(id),
  to_plan_id          uuid NOT NULL REFERENCES subscription_plans(id),
  from_status         nova.subscription_status,
  to_status           nova.subscription_status NOT NULL,
  from_cycle          nova.billing_cycle,
  to_cycle            nova.billing_cycle,
  reason              text,
  changed_by          uuid,
  changed_at          timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE subscription_plan_changes IS
  'Historique obligatoire de toute modification de forfait ou de statut d''abonnement.';

-- ---------------------------------------------------------------------
-- Fonctionnalités activées (feature flags)
-- ---------------------------------------------------------------------
CREATE TABLE feature_flags (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid REFERENCES organizations(id) ON DELETE CASCADE, -- NULL = global
  feature_code        text NOT NULL,
  enabled             boolean NOT NULL DEFAULT true,
  source              text NOT NULL DEFAULT 'override',  -- plan | addon | override | global
  note                text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX feature_flags_scope_idx
  ON feature_flags(COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'::uuid), feature_code);

-- ---------------------------------------------------------------------
-- Facturation SaaS
-- ---------------------------------------------------------------------
CREATE TABLE subscription_invoices (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subscription_id     uuid REFERENCES organization_subscriptions(id) ON DELETE SET NULL,
  number              text NOT NULL UNIQUE,
  kind                text NOT NULL DEFAULT 'invoice',   -- quote | invoice | credit_note
  status              nova.invoice_status NOT NULL DEFAULT 'draft',
  currency            text NOT NULL DEFAULT 'USD',
  issue_date          date NOT NULL DEFAULT CURRENT_DATE,
  due_date            date NOT NULL DEFAULT CURRENT_DATE,
  period_start        date,
  period_end          date,
  subtotal            numeric(14,2) NOT NULL DEFAULT 0,
  discount_total      numeric(14,2) NOT NULL DEFAULT 0,
  tax_total           numeric(14,2) NOT NULL DEFAULT 0,
  total               numeric(14,2) NOT NULL DEFAULT 0,
  amount_paid         numeric(14,2) NOT NULL DEFAULT 0,
  balance             numeric(14,2) GENERATED ALWAYS AS (total - amount_paid) STORED,
  credited_invoice_id uuid REFERENCES subscription_invoices(id),
  idempotency_key     text UNIQUE,                       -- protection contre les doublons
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX subscription_invoices_org_idx ON subscription_invoices(organization_id, status);

CREATE TABLE subscription_invoice_lines (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id          uuid NOT NULL REFERENCES subscription_invoices(id) ON DELETE CASCADE,
  label               text NOT NULL,
  quantity            numeric(14,3) NOT NULL DEFAULT 1,
  unit_price          numeric(14,2) NOT NULL DEFAULT 0,
  discount_percent    numeric(5,2) NOT NULL DEFAULT 0,
  tax_rate            numeric(6,3) NOT NULL DEFAULT 0,
  line_total          numeric(14,2) NOT NULL DEFAULT 0,
  plan_id             uuid REFERENCES subscription_plans(id),
  addon_id            uuid REFERENCES plan_addons(id),
  sort_order          integer NOT NULL DEFAULT 0
);

CREATE TABLE subscription_payments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_id          uuid REFERENCES subscription_invoices(id) ON DELETE SET NULL,
  method              nova.payment_method NOT NULL,
  provider            text,                              -- M-Pesa, Airtel Money, Orange Money, banque…
  amount              numeric(14,2) NOT NULL CHECK (amount > 0),
  currency            text NOT NULL DEFAULT 'USD',
  status              nova.payment_status NOT NULL DEFAULT 'pending',
  reference           text,
  external_reference  text,
  idempotency_key     text UNIQUE,                       -- rapprochement sans doublon
  paid_at             timestamptz,
  confirmed_at        timestamptz,
  confirmed_by        uuid,
  failure_reason      text,
  metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX subscription_payments_org_idx ON subscription_payments(organization_id, status);
CREATE UNIQUE INDEX subscription_payments_external_ref_idx
  ON subscription_payments(provider, external_reference)
  WHERE external_reference IS NOT NULL;

CREATE TABLE dunning_notices (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_id          uuid NOT NULL REFERENCES subscription_invoices(id) ON DELETE CASCADE,
  level               integer NOT NULL DEFAULT 1,        -- 1 = rappel, 2 = relance, 3 = mise en demeure
  channel             text NOT NULL DEFAULT 'email',     -- email | sms | whatsapp | in_app
  subject             text,
  body                text,
  sent_at             timestamptz NOT NULL DEFAULT now(),
  days_overdue        integer NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX dunning_notices_unique_level_idx ON dunning_notices(invoice_id, level, channel);

-- ---------------------------------------------------------------------
-- Prospection commerciale
-- ---------------------------------------------------------------------
CREATE TABLE leads (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name        text NOT NULL,
  contact_name        text,
  email               text,
  phone               text,
  country_code        text REFERENCES country_settings(code),
  city                text,
  kind                text NOT NULL DEFAULT 'pharmacy',
  source              text,
  stage               text NOT NULL DEFAULT 'new',       -- new | contacted | demo | trial | won | lost
  interested_plan_id  uuid REFERENCES subscription_plans(id),
  converted_organization_id uuid REFERENCES organizations(id),
  owner_platform_user_id uuid,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Utilisateurs internes NOVA PHARMA OS
-- ---------------------------------------------------------------------
CREATE TABLE platform_users (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email               text NOT NULL UNIQUE,
  full_name           text NOT NULL,
  password_hash       text NOT NULL,
  role                text NOT NULL,                     -- super_admin | support_admin | commercial
  locale              text NOT NULL DEFAULT 'fr',
  is_active           boolean NOT NULL DEFAULT true,
  last_login_at       timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_users_role_check
    CHECK (role IN ('super_admin', 'support_admin', 'commercial'))
);

-- ---------------------------------------------------------------------
-- Accès support temporaire aux données clientes
-- ---------------------------------------------------------------------
CREATE TABLE support_access_grants (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  platform_user_id    uuid NOT NULL REFERENCES platform_users(id) ON DELETE CASCADE,
  ticket_id           uuid,
  reason              text NOT NULL,
  mode                nova.support_access_mode NOT NULL DEFAULT 'read_only',
  status              nova.support_access_status NOT NULL DEFAULT 'requested',
  requires_customer_approval boolean NOT NULL DEFAULT true,
  requested_at        timestamptz NOT NULL DEFAULT now(),
  approved_at         timestamptz,
  approved_by_user_id uuid,                              -- utilisateur de la pharmacie
  starts_at           timestamptz,
  expires_at          timestamptz NOT NULL,
  revoked_at          timestamptz,
  revoked_by          uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_access_grants_window CHECK (expires_at > requested_at)
);
CREATE INDEX support_access_grants_org_idx ON support_access_grants(organization_id, status);
COMMENT ON TABLE support_access_grants IS
  'Accès support temporaire : demande motivée, validation client, durée limitée, lecture seule par défaut, révocation automatique.';

CREATE TABLE support_access_events (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grant_id            uuid NOT NULL REFERENCES support_access_grants(id) ON DELETE CASCADE,
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  platform_user_id    uuid NOT NULL REFERENCES platform_users(id),
  action              text NOT NULL,
  method              text,
  path                text,
  entity              text,
  entity_id           text,
  payload_digest      text,
  occurred_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX support_access_events_grant_idx ON support_access_events(grant_id, occurred_at DESC);

-- ---------------------------------------------------------------------
-- Centre de support
-- ---------------------------------------------------------------------
CREATE TABLE support_tickets (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  reference           text NOT NULL UNIQUE,
  subject             text NOT NULL,
  description         text NOT NULL,
  category            text NOT NULL DEFAULT 'question',  -- question | incident | bug | feature_request | billing
  priority            text NOT NULL DEFAULT 'normal',    -- low | normal | high | critical
  status              text NOT NULL DEFAULT 'open',      -- open | pending_customer | in_progress | resolved | closed
  sla_due_at          timestamptz,
  first_response_at   timestamptz,
  resolved_at         timestamptz,
  closed_at           timestamptz,
  created_by_user_id  uuid,
  assigned_platform_user_id uuid REFERENCES platform_users(id),
  satisfaction_score  integer CHECK (satisfaction_score BETWEEN 1 AND 5),
  satisfaction_comment text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX support_tickets_org_idx ON support_tickets(organization_id, status);

CREATE TABLE support_ticket_messages (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id           uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  author_kind         text NOT NULL,                     -- customer | platform | system
  author_user_id      uuid,
  author_platform_user_id uuid REFERENCES platform_users(id),
  body                text NOT NULL,
  attachments         jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_internal_note    boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX support_ticket_messages_ticket_idx ON support_ticket_messages(ticket_id, created_at);

CREATE TABLE knowledge_base_articles (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                text NOT NULL UNIQUE,
  locale              text NOT NULL DEFAULT 'fr',
  category            text NOT NULL DEFAULT 'general',
  title               text NOT NULL,
  body                text NOT NULL,
  kind                text NOT NULL DEFAULT 'article',   -- article | faq | tutorial | tour
  video_url           text,
  tags                text[] NOT NULL DEFAULT '{}',
  is_published        boolean NOT NULL DEFAULT true,
  views               integer NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE platform_incidents (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title               text NOT NULL,
  status              text NOT NULL DEFAULT 'investigating', -- investigating | identified | monitoring | resolved
  severity            text NOT NULL DEFAULT 'minor',         -- minor | major | critical
  body                text,
  started_at          timestamptz NOT NULL DEFAULT now(),
  resolved_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Mesure d'usage et audit plateforme
-- ---------------------------------------------------------------------
CREATE TABLE usage_metrics (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  metric              text NOT NULL,                     -- users_active | sales_count | stock_value | sms_sent | storage_mb…
  period_start        date NOT NULL,
  period_end          date NOT NULL,
  value               numeric(18,4) NOT NULL DEFAULT 0,
  recorded_at         timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX usage_metrics_unique_idx ON usage_metrics(organization_id, metric, period_start, period_end);

CREATE TABLE platform_audit_logs (
  id                  bigserial PRIMARY KEY,
  organization_id     uuid REFERENCES organizations(id) ON DELETE SET NULL,
  platform_user_id    uuid REFERENCES platform_users(id) ON DELETE SET NULL,
  actor_email         text,
  action              text NOT NULL,
  entity              text,
  entity_id           text,
  before_state        jsonb,
  after_state         jsonb,
  reason              text,
  ip_address          inet,
  user_agent          text,
  occurred_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX platform_audit_logs_org_idx ON platform_audit_logs(organization_id, occurred_at DESC);
CREATE INDEX platform_audit_logs_actor_idx ON platform_audit_logs(platform_user_id, occurred_at DESC);

CREATE TABLE platform_settings (
  key                 text PRIMARY KEY,
  value               jsonb NOT NULL,
  description         text,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Sauvegardes par organisation
-- ---------------------------------------------------------------------
CREATE TABLE organization_backups (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  kind                text NOT NULL DEFAULT 'scheduled',  -- scheduled | manual | pre_termination
  status              text NOT NULL DEFAULT 'pending',    -- pending | running | completed | failed
  storage_key         text,
  checksum            text,
  size_bytes          bigint,
  table_counts        jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at          timestamptz NOT NULL DEFAULT now(),
  completed_at        timestamptz,
  error               text,
  restored_at         timestamptz,
  created_by          uuid
);
CREATE INDEX organization_backups_org_idx ON organization_backups(organization_id, started_at DESC);

SELECT nova.attach_touch(t) FROM (VALUES
  ('country_settings'::regclass), ('subscription_plans'), ('plan_addons'), ('promo_codes'),
  ('organizations'), ('organization_subscriptions'), ('organization_addons'),
  ('feature_flags'), ('subscription_invoices'), ('subscription_payments'), ('leads'),
  ('platform_users'), ('support_access_grants'), ('support_tickets'),
  ('knowledge_base_articles'), ('platform_incidents')
) AS x(t);
