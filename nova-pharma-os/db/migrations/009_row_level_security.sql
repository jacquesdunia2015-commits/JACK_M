-- =====================================================================
-- NOVA PHARMA OS — 009 : Row-Level Security
--
-- L'isolation des pharmacies clientes est garantie à deux niveaux :
--   1. niveau applicatif  : chaque requête est filtrée par organization_id ;
--   2. niveau base        : les politiques ci-dessous rendent invisibles
--      les lignes des autres organisations, même si le filtre applicatif
--      venait à manquer.
--
-- Le rôle applicatif nova_app n'est ni propriétaire des tables ni
-- superutilisateur, et ne dispose pas de BYPASSRLS.
-- =====================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nova_app') THEN
    CREATE ROLE nova_app LOGIN PASSWORD 'nova_app' NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO nova_app;
GRANT USAGE ON SCHEMA nova TO nova_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO nova_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO nova_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA nova TO nova_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO nova_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO nova_app;

-- Le back-office SaaS ne doit pas pouvoir écrire dans les données
-- métier d'une pharmacie sans passer par un accès support validé : le
-- contexte plateforme n'ouvre aucune politique sur les tables tenant.
CREATE OR REPLACE FUNCTION nova.platform_or_own(target_organization uuid) RETURNS boolean
LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT nova.is_platform_context()
      OR (target_organization IS NOT NULL
          AND target_organization = nova.current_organization_id());
$$;

CREATE OR REPLACE FUNCTION nova.platform_write_allowed() RETURNS boolean
LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT nova.is_platform_context() AND NOT nova.is_readonly_context();
$$;

-- ---------------------------------------------------------------------
-- Application des politiques
-- ---------------------------------------------------------------------

-- Tables métier de pharmacie : strictement cloisonnées par organisation.
CREATE OR REPLACE FUNCTION nova.apply_tenant_rls(p_table text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', p_table);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', p_table);
  EXECUTE format('DROP POLICY IF EXISTS %I ON %I', p_table || '_tenant_select', p_table);
  EXECUTE format('DROP POLICY IF EXISTS %I ON %I', p_table || '_tenant_insert', p_table);
  EXECUTE format('DROP POLICY IF EXISTS %I ON %I', p_table || '_tenant_update', p_table);
  EXECUTE format('DROP POLICY IF EXISTS %I ON %I', p_table || '_tenant_delete', p_table);

  EXECUTE format(
    'CREATE POLICY %I ON %I FOR SELECT USING (nova.tenant_read_allowed(organization_id))',
    p_table || '_tenant_select', p_table);
  EXECUTE format(
    'CREATE POLICY %I ON %I FOR INSERT WITH CHECK (nova.tenant_write_allowed(organization_id))',
    p_table || '_tenant_insert', p_table);
  EXECUTE format(
    'CREATE POLICY %I ON %I FOR UPDATE USING (nova.tenant_write_allowed(organization_id)) '
    'WITH CHECK (nova.tenant_write_allowed(organization_id))',
    p_table || '_tenant_update', p_table);
  EXECUTE format(
    'CREATE POLICY %I ON %I FOR DELETE USING (nova.tenant_write_allowed(organization_id))',
    p_table || '_tenant_delete', p_table);
END;
$$;

-- Tables plateforme visibles par leur organisation (lecture) mais
-- pilotées par le back-office SaaS (écriture).
CREATE OR REPLACE FUNCTION nova.apply_platform_rls(
  p_table text,
  p_tenant_may_write boolean DEFAULT false
) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  v_write_expr text;
BEGIN
  v_write_expr := CASE
    WHEN p_tenant_may_write
      THEN '(nova.platform_write_allowed() OR nova.tenant_write_allowed(organization_id))'
    ELSE 'nova.platform_write_allowed()'
  END;

  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', p_table);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', p_table);
  EXECUTE format('DROP POLICY IF EXISTS %I ON %I', p_table || '_pf_select', p_table);
  EXECUTE format('DROP POLICY IF EXISTS %I ON %I', p_table || '_pf_insert', p_table);
  EXECUTE format('DROP POLICY IF EXISTS %I ON %I', p_table || '_pf_update', p_table);
  EXECUTE format('DROP POLICY IF EXISTS %I ON %I', p_table || '_pf_delete', p_table);

  EXECUTE format(
    'CREATE POLICY %I ON %I FOR SELECT USING (nova.platform_or_own(organization_id))',
    p_table || '_pf_select', p_table);
  EXECUTE format('CREATE POLICY %I ON %I FOR INSERT WITH CHECK (%s)',
    p_table || '_pf_insert', p_table, v_write_expr);
  EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE USING (%s) WITH CHECK (%s)',
    p_table || '_pf_update', p_table, v_write_expr, v_write_expr);
  EXECUTE format('CREATE POLICY %I ON %I FOR DELETE USING (nova.platform_write_allowed())',
    p_table || '_pf_delete', p_table);
END;
$$;

-- Tables réservées au back-office SaaS (aucune visibilité tenant).
CREATE OR REPLACE FUNCTION nova.apply_platform_only_rls(p_table text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', p_table);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', p_table);
  EXECUTE format('DROP POLICY IF EXISTS %I ON %I', p_table || '_pfonly_all', p_table);
  EXECUTE format(
    'CREATE POLICY %I ON %I FOR ALL USING (nova.is_platform_context()) '
    'WITH CHECK (nova.platform_write_allowed())',
    p_table || '_pfonly_all', p_table);
END;
$$;

-- Référentiels publics : lecture pour tous, écriture plateforme.
CREATE OR REPLACE FUNCTION nova.apply_reference_rls(p_table text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', p_table);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', p_table);
  EXECUTE format('DROP POLICY IF EXISTS %I ON %I', p_table || '_ref_select', p_table);
  EXECUTE format('DROP POLICY IF EXISTS %I ON %I', p_table || '_ref_write', p_table);
  EXECUTE format('CREATE POLICY %I ON %I FOR SELECT USING (true)', p_table || '_ref_select', p_table);
  EXECUTE format(
    'CREATE POLICY %I ON %I FOR ALL USING (nova.platform_write_allowed()) '
    'WITH CHECK (nova.platform_write_allowed())',
    p_table || '_ref_write', p_table);
END;
$$;

-- ---------------------------------------------------------------------
-- Tables métier pharmacie
-- ---------------------------------------------------------------------
SELECT nova.apply_tenant_rls(t) FROM unnest(ARRAY[
  'branches', 'roles', 'role_permissions', 'users', 'user_roles', 'user_branches',
  'audit_logs', 'document_sequences', 'notifications', 'documents',
  'api_keys', 'api_call_logs', 'webhook_endpoints', 'webhook_deliveries', 'sync_operations',
  'product_categories', 'molecules', 'tax_rates', 'products', 'product_barcodes',
  'price_lists', 'price_list_items',
  'product_lots', 'stock_items', 'stock_movements', 'stock_transfers', 'stock_transfer_lines',
  'inventory_counts', 'inventory_count_lines', 'stock_alerts',
  'suppliers', 'supplier_products', 'purchase_orders', 'purchase_order_lines',
  'goods_receipts', 'goods_receipt_lines', 'supplier_payments',
  'customer_groups', 'customers', 'cash_sessions', 'cash_movements', 'prescriptions',
  'sales', 'sale_lines', 'sale_payments', 'invoices', 'invoice_lines', 'customer_payments',
  'b2b_quotes', 'b2b_quote_lines', 'b2b_orders', 'b2b_order_lines',
  'deliveries', 'delivery_lines', 'delivery_events'
]) AS t;

-- ---------------------------------------------------------------------
-- Tables plateforme lisibles par la pharmacie concernée
-- ---------------------------------------------------------------------
SELECT nova.apply_platform_rls(t) FROM unnest(ARRAY[
  'organization_subscriptions', 'organization_addons', 'subscription_plan_changes',
  'subscription_invoices', 'subscription_payments', 'dunning_notices',
  'feature_flags', 'usage_metrics', 'support_access_events'
]) AS t;

-- Tickets de support : la pharmacie crée et alimente ses propres tickets.
SELECT nova.apply_platform_rls(t, true) FROM unnest(ARRAY[
  'support_tickets', 'support_ticket_messages', 'support_access_grants'
]) AS t;

-- ---------------------------------------------------------------------
-- Tables strictement réservées au back-office SaaS
-- ---------------------------------------------------------------------
SELECT nova.apply_platform_only_rls(t) FROM unnest(ARRAY[
  'promo_codes', 'leads', 'platform_users', 'platform_audit_logs',
  'platform_settings', 'organization_backups'
]) AS t;

-- ---------------------------------------------------------------------
-- Référentiels partagés
-- ---------------------------------------------------------------------
SELECT nova.apply_reference_rls(t) FROM unnest(ARRAY[
  'country_settings', 'subscription_plans', 'plan_addons', 'permissions',
  'knowledge_base_articles', 'platform_incidents'
]) AS t;

-- ---------------------------------------------------------------------
-- organizations : la pharmacie voit sa fiche, la plateforme voit tout.
-- ---------------------------------------------------------------------
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS organizations_select ON organizations;
DROP POLICY IF EXISTS organizations_insert ON organizations;
DROP POLICY IF EXISTS organizations_update ON organizations;
DROP POLICY IF EXISTS organizations_delete ON organizations;
CREATE POLICY organizations_select ON organizations FOR SELECT
  USING (nova.is_platform_context() OR id = nova.current_organization_id());
CREATE POLICY organizations_insert ON organizations FOR INSERT
  WITH CHECK (nova.platform_write_allowed());
-- La pharmacie peut mettre à jour sa fiche (coordonnées, préférences) ;
-- les changements de statut d'abonnement restent au back-office SaaS.
CREATE POLICY organizations_update ON organizations FOR UPDATE
  USING (nova.platform_write_allowed()
         OR (id = nova.current_organization_id() AND NOT nova.is_readonly_context()))
  WITH CHECK (nova.platform_write_allowed()
         OR (id = nova.current_organization_id() AND NOT nova.is_readonly_context()));
CREATE POLICY organizations_delete ON organizations FOR DELETE
  USING (nova.platform_write_allowed());

-- ---------------------------------------------------------------------
-- Lignes de facture d'abonnement : rattachées via leur facture.
-- ---------------------------------------------------------------------
ALTER TABLE subscription_invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_invoice_lines FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS subscription_invoice_lines_select ON subscription_invoice_lines;
DROP POLICY IF EXISTS subscription_invoice_lines_write ON subscription_invoice_lines;
CREATE POLICY subscription_invoice_lines_select ON subscription_invoice_lines FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM subscription_invoices si
    WHERE si.id = subscription_invoice_lines.invoice_id
      AND nova.platform_or_own(si.organization_id)));
CREATE POLICY subscription_invoice_lines_write ON subscription_invoice_lines FOR ALL
  USING (nova.platform_write_allowed())
  WITH CHECK (nova.platform_write_allowed());

-- ---------------------------------------------------------------------
-- refresh_tokens : lisible par son propriétaire uniquement.
-- ---------------------------------------------------------------------
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS refresh_tokens_all ON refresh_tokens;
CREATE POLICY refresh_tokens_all ON refresh_tokens FOR ALL
  USING (nova.is_platform_context() OR organization_id = nova.current_organization_id())
  WITH CHECK (nova.is_platform_context() OR organization_id = nova.current_organization_id());

-- ---------------------------------------------------------------------
-- Garde-fou : toute table publique portant organization_id doit avoir RLS.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION nova.assert_rls_coverage() RETURNS TABLE(table_name text, issue text)
LANGUAGE sql STABLE AS $$
  SELECT c.relname::text,
         CASE WHEN NOT c.relrowsecurity THEN 'RLS désactivée'
              WHEN NOT c.relforcerowsecurity THEN 'RLS non forcée pour le propriétaire'
              ELSE 'aucune politique' END
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND (NOT c.relrowsecurity
         OR NOT c.relforcerowsecurity
         OR NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid));
$$;
COMMENT ON FUNCTION nova.assert_rls_coverage() IS
  'Retourne les tables sans protection RLS complète. Doit renvoyer zéro ligne.';
