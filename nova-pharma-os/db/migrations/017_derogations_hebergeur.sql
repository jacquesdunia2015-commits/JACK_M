-- =====================================================================
-- NOVA PHARMA OS — 017 : dérogations indépendantes du superutilisateur
--
-- Trois fonctions SECURITY DEFINER franchissent le cloisonnement pour des
-- besoins étroits : retrouver un compte à la connexion (012), et compter
-- la consommation des quotas pour le back-office (014). Elles reposaient
-- sur un fait jamais écrit : leur propriétaire — l'administrateur qui
-- joue les migrations — était superutilisateur, et un superutilisateur
-- ignore toute politique de sécurité par ligne.
--
-- Chez un hébergeur (Render, Neon, Supabase…), l'administrateur n'est
-- qu'un compte ordinaire, propriétaire de la base. Le cloisonnement étant
-- FORCÉ pour le propriétaire, ces fonctions n'y voyaient plus aucune
-- ligne : aucune connexion n'aboutissait, même avec le bon mot de passe.
--
-- On ne relâche pas le cloisonnement forcé. C'est précisément chez un
-- hébergeur qu'il protège vraiment, puisque le propriétaire y est soumis.
-- On confie plutôt ces trois fonctions à un rôle dédié, sans droit de
-- connexion, auquel une politique n'ouvre QUE la lecture des tables dont
-- elles ont besoin. Personne ne peut se connecter sous ce rôle : on ne
-- l'exerce qu'à travers ces fonctions, dont le contenu reste inchangé.
-- =====================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nova_derogation') THEN
    CREATE ROLE nova_derogation NOLOGIN;
  END IF;
END
$$;

-- Céder la propriété d'une fonction exige d'être membre du rôle qui la
-- reçoit. Le créateur d'un rôle en détient l'administration : il peut se
-- l'accorder. L'administrateur ne sert qu'aux migrations, jamais à
-- l'application — le contrôle de démarrage de l'API y veille.
GRANT nova_derogation TO CURRENT_USER;

GRANT USAGE ON SCHEMA public TO nova_derogation;
GRANT USAGE ON SCHEMA nova TO nova_derogation;
-- Les politiques existantes s'évaluent aussi pour ce rôle : il doit
-- pouvoir appeler les fonctions qu'elles invoquent.
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA nova TO nova_derogation;

-- Exactement les tables lues par les trois fonctions, rien de plus.
GRANT SELECT ON users, organizations, branches, products, documents TO nova_derogation;

DROP POLICY IF EXISTS users_derogation ON users;
DROP POLICY IF EXISTS organizations_derogation ON organizations;
DROP POLICY IF EXISTS branches_derogation ON branches;
DROP POLICY IF EXISTS products_derogation ON products;
DROP POLICY IF EXISTS documents_derogation ON documents;

CREATE POLICY users_derogation ON users
  FOR SELECT TO nova_derogation USING (true);
CREATE POLICY organizations_derogation ON organizations
  FOR SELECT TO nova_derogation USING (true);
CREATE POLICY branches_derogation ON branches
  FOR SELECT TO nova_derogation USING (true);
CREATE POLICY products_derogation ON products
  FOR SELECT TO nova_derogation USING (true);
CREATE POLICY documents_derogation ON documents
  FOR SELECT TO nova_derogation USING (true);

-- PostgreSQL exige que le nouveau propriétaire d'une fonction puisse
-- créer dans son schéma. Ce droit n'est utile qu'au moment du transfert :
-- il est retiré aussitôt après, et la propriété, elle, demeure.
GRANT CREATE ON SCHEMA nova TO nova_derogation;

ALTER FUNCTION nova.authentication_lookup(text, text) OWNER TO nova_derogation;
ALTER FUNCTION nova.authentication_lookup_by_id(uuid) OWNER TO nova_derogation;
ALTER FUNCTION nova.organization_quota_usage(uuid) OWNER TO nova_derogation;

REVOKE CREATE ON SCHEMA nova FROM nova_derogation;
