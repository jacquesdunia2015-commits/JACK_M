-- =====================================================================
-- NOVA PHARMA OS — 014 : consommation des quotas, vue back-office
--
-- Le back-office SaaS ne voit aucune donnée métier : c'est la garantie
-- offerte aux pharmacies. Il doit pourtant savoir combien d'utilisateurs,
-- de branches et de références chaque cliente consomme — sans quoi il ne
-- peut ni facturer les options, ni conseiller un changement de forfait.
--
-- Cette fonction est la dérogation minimale à ce cloisonnement : elle ne
-- renvoie que des NOMBRES. Jamais un nom de produit, un client, une
-- vente. Et elle refuse de s'exécuter hors du contexte back-office.
-- =====================================================================

CREATE OR REPLACE FUNCTION nova.organization_quota_usage(p_organization_id uuid DEFAULT NULL)
RETURNS TABLE (
  organization_id uuid,
  users_count     bigint,
  branches_count  bigint,
  products_count  bigint,
  storage_mb      numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT nova.is_platform_context() THEN
    RAISE EXCEPTION 'Compteurs de quota réservés au back-office NOVA PHARMA OS.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT o.id,
         (SELECT count(*) FROM users u
           WHERE u.organization_id = o.id AND u.deleted_at IS NULL AND u.is_active),
         (SELECT count(*) FROM branches b
           WHERE b.organization_id = o.id AND b.is_active),
         (SELECT count(*) FROM products p
           WHERE p.organization_id = o.id AND p.deleted_at IS NULL),
         (SELECT COALESCE(sum(d.size_bytes), 0) / 1048576.0 FROM documents d
           WHERE d.organization_id = o.id)
    FROM organizations o
   WHERE o.deleted_at IS NULL
     AND (p_organization_id IS NULL OR o.id = p_organization_id);
END;
$$;

COMMENT ON FUNCTION nova.organization_quota_usage(uuid) IS
  'Compteurs de consommation des quotas par organisation. Ne renvoie que '
  'des nombres, jamais de données métier, et refuse tout appel hors '
  'contexte back-office SaaS.';

REVOKE ALL ON FUNCTION nova.organization_quota_usage(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION nova.organization_quota_usage(uuid) TO nova_app;
