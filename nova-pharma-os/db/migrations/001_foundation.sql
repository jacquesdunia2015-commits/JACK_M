-- =====================================================================
-- NOVA PHARMA OS — 001 : socle technique
-- Extensions, schéma utilitaire, contexte d'exécution multi-tenant.
--
-- Le contexte tenant est porté par des paramètres de session PostgreSQL
-- positionnés en début de transaction par l'API (SET LOCAL). Les
-- politiques Row-Level Security s'appuient exclusivement sur ces
-- fonctions : aucune requête ne peut voir les données d'une autre
-- organisation, même en cas d'oubli de filtre applicatif.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE SCHEMA IF NOT EXISTS nova;
COMMENT ON SCHEMA nova IS 'Fonctions utilitaires NOVA PHARMA OS (contexte tenant, RLS, numérotation).';

-- ---------------------------------------------------------------------
-- Contexte d'exécution
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION nova.current_organization_id() RETURNS uuid
LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT NULLIF(current_setting('nova.organization_id', true), '')::uuid;
$$;
COMMENT ON FUNCTION nova.current_organization_id() IS
  'Organisation (pharmacie cliente) du contexte courant, NULL hors contexte tenant.';

CREATE OR REPLACE FUNCTION nova.current_branch_id() RETURNS uuid
LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT NULLIF(current_setting('nova.branch_id', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION nova.current_actor_id() RETURNS uuid
LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT NULLIF(current_setting('nova.actor_id', true), '')::uuid;
$$;

-- Contexte « plateforme » : back-office SaaS NOVA PHARMA OS.
CREATE OR REPLACE FUNCTION nova.is_platform_context() RETURNS boolean
LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT COALESCE(NULLIF(current_setting('nova.platform', true), ''), 'off') = 'on';
$$;

-- Contexte en lecture seule : accès support temporaire, organisation
-- suspendue, ou consultation d'archives.
CREATE OR REPLACE FUNCTION nova.is_readonly_context() RETURNS boolean
LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT COALESCE(NULLIF(current_setting('nova.readonly', true), ''), 'off') = 'on';
$$;

-- Un contexte tenant est valide s'il désigne une organisation et n'est
-- pas simultanément un contexte plateforme.
CREATE OR REPLACE FUNCTION nova.tenant_read_allowed(target_organization uuid) RETURNS boolean
LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT target_organization IS NOT NULL
     AND target_organization = nova.current_organization_id();
$$;

CREATE OR REPLACE FUNCTION nova.tenant_write_allowed(target_organization uuid) RETURNS boolean
LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT nova.tenant_read_allowed(target_organization) AND NOT nova.is_readonly_context();
$$;

-- ---------------------------------------------------------------------
-- Horodatage automatique
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION nova.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Applique le trigger updated_at à une table donnée.
CREATE OR REPLACE FUNCTION nova.attach_touch(p_table regclass) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  v_name text := 'trg_touch_' || replace(p_table::text, '.', '_');
BEGIN
  EXECUTE format(
    'DROP TRIGGER IF EXISTS %I ON %s; '
    'CREATE TRIGGER %I BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION nova.touch_updated_at();',
    v_name, p_table, v_name, p_table);
END;
$$;

-- ---------------------------------------------------------------------
-- Types partagés
-- ---------------------------------------------------------------------

CREATE TYPE nova.organization_status AS ENUM (
  'prospect', 'trial', 'active', 'suspended', 'terminated', 'archived');

CREATE TYPE nova.subscription_status AS ENUM (
  'trialing',         -- essai gratuit
  'active',           -- actif
  'pending_payment',  -- paiement en attente
  'past_due',         -- en retard de paiement
  'suspended',        -- suspendu
  'cancelled',        -- résilié
  'expired',          -- expiré
  'archived');        -- archivé

CREATE TYPE nova.billing_cycle AS ENUM ('monthly', 'quarterly', 'annual');

CREATE TYPE nova.invoice_status AS ENUM (
  'draft', 'issued', 'partially_paid', 'paid', 'overdue', 'cancelled', 'credited');

CREATE TYPE nova.payment_method AS ENUM (
  'mobile_money', 'bank_transfer', 'bank_local', 'card', 'cash', 'manual', 'credit');

CREATE TYPE nova.payment_status AS ENUM ('pending', 'confirmed', 'failed', 'refunded');

CREATE TYPE nova.support_access_mode AS ENUM ('read_only', 'read_write');

CREATE TYPE nova.support_access_status AS ENUM (
  'requested', 'approved', 'active', 'expired', 'revoked', 'denied');

CREATE TYPE nova.stock_movement_kind AS ENUM (
  'reception',        -- entrée sur réception fournisseur
  'sale',             -- sortie sur vente
  'sale_return',      -- retour client
  'purchase_return',  -- retour fournisseur
  'adjustment_in',    -- régularisation positive
  'adjustment_out',   -- régularisation négative
  'transfer_in',      -- entrée sur transfert inter-branches
  'transfer_out',     -- sortie sur transfert inter-branches
  'inventory',        -- écart d'inventaire
  'expiry_write_off', -- destruction pour péremption
  'damage');          -- casse / avarie

CREATE TYPE nova.sale_status AS ENUM ('draft', 'completed', 'cancelled', 'refunded');

CREATE TYPE nova.b2b_order_status AS ENUM (
  'draft', 'submitted', 'confirmed', 'preparing', 'ready',
  'delivering', 'delivered', 'invoiced', 'cancelled');
