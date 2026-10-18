-- =====================================================================
-- NOVA PHARMA OS — 012 : recherche des comptes à l'authentification
--
-- Les tables métier, `users` comprise, sont cloisonnées par
-- organisation : une requête sans contexte tenant ne voit rien. Or, à la
-- connexion, l'organisation n'est pas encore connue — c'est justement ce
-- que l'authentification doit établir.
--
-- Ces deux fonctions SECURITY DEFINER constituent la seule dérogation.
-- Elles sont volontairement étroites :
--   • elles ne renvoient que les colonnes nécessaires à la vérification
--     d'identité — jamais de données métier ;
--   • elles filtrent sur une adresse ou un identifiant précis, ce qui
--     interdit l'énumération des comptes ;
--   • elles ne comparent aucun mot de passe : la vérification reste
--     applicative.
-- =====================================================================

CREATE OR REPLACE FUNCTION nova.authentication_lookup(
  p_email text,
  p_organization_slug text DEFAULT NULL
)
RETURNS TABLE (
  id                  uuid,
  organization_id     uuid,
  email               text,
  full_name           text,
  password_hash       text,
  default_branch_id   uuid,
  is_active           boolean,
  must_change_password boolean,
  locked_until        timestamptz,
  failed_login_count  integer,
  org_slug            text,
  org_status          text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT u.id, u.organization_id, u.email, u.full_name, u.password_hash,
         u.default_branch_id, u.is_active, u.must_change_password,
         u.locked_until, u.failed_login_count,
         o.slug, o.status::text
    FROM users u
    JOIN organizations o ON o.id = u.organization_id
   WHERE lower(u.email) = lower(p_email)
     AND u.deleted_at IS NULL
     AND o.deleted_at IS NULL
     AND (p_organization_slug IS NULL OR o.slug = p_organization_slug);
$$;

COMMENT ON FUNCTION nova.authentication_lookup(text, text) IS
  'Recherche un compte pharmacie par adresse e-mail, à la connexion uniquement. '
  'Ne renvoie aucune donnée métier et ne vérifie aucun mot de passe.';

CREATE OR REPLACE FUNCTION nova.authentication_lookup_by_id(p_user_id uuid)
RETURNS TABLE (
  id                uuid,
  organization_id   uuid,
  email             text,
  full_name         text,
  default_branch_id uuid,
  is_active         boolean,
  org_status        text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT u.id, u.organization_id, u.email, u.full_name, u.default_branch_id,
         u.is_active, o.status::text
    FROM users u
    JOIN organizations o ON o.id = u.organization_id
   WHERE u.id = p_user_id
     AND u.deleted_at IS NULL
     AND o.deleted_at IS NULL;
$$;

COMMENT ON FUNCTION nova.authentication_lookup_by_id(uuid) IS
  'Reconstitue l''identité d''un compte pharmacie lors du renouvellement de jeton.';

-- L'exécution est réservée au rôle applicatif ; le public n'y a pas accès.
REVOKE ALL ON FUNCTION nova.authentication_lookup(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION nova.authentication_lookup_by_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION nova.authentication_lookup(text, text) TO nova_app;
GRANT EXECUTE ON FUNCTION nova.authentication_lookup_by_id(uuid) TO nova_app;
