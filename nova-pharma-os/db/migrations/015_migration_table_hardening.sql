-- =====================================================================
-- NOVA PHARMA OS — 015 : protection de la table de suivi des migrations
--
-- `schema_migrations` est créée par l'outil de migration, avant que les
-- politiques RLS n'existent. Elle ne contient aucune donnée de
-- pharmacie — seulement l'historique du schéma — mais elle ne doit pas
-- pour autant rester accessible au rôle applicatif.
--
-- La protection retenue est plus radicale que RLS : le rôle applicatif
-- n'a aucun privilège dessus. Seul le rôle propriétaire, utilisé
-- exclusivement par les migrations, peut la lire et l'écrire.
--
-- Le contrôle de couverture est étendu en conséquence : une table est
-- considérée protégée soit par une politique RLS complète, soit par
-- l'absence totale de privilège pour le rôle applicatif.
-- =====================================================================

REVOKE ALL ON TABLE schema_migrations FROM nova_app;

CREATE OR REPLACE FUNCTION nova.assert_rls_coverage()
RETURNS TABLE(table_name text, issue text)
LANGUAGE sql STABLE AS $$
  SELECT c.relname::text,
         CASE WHEN NOT c.relrowsecurity THEN 'RLS désactivée'
              WHEN NOT c.relforcerowsecurity THEN 'RLS non forcée pour le propriétaire'
              ELSE 'aucune politique' END
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    -- Une table sans aucun privilège accordé au rôle applicatif est
    -- hors de portée de l'application : elle n'a pas besoin de RLS.
    AND (has_table_privilege('nova_app', c.oid, 'SELECT')
      OR has_table_privilege('nova_app', c.oid, 'INSERT')
      OR has_table_privilege('nova_app', c.oid, 'UPDATE')
      OR has_table_privilege('nova_app', c.oid, 'DELETE'))
    AND (NOT c.relrowsecurity
         OR NOT c.relforcerowsecurity
         OR NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid));
$$;

COMMENT ON FUNCTION nova.assert_rls_coverage() IS
  'Retourne les tables atteignables par le rôle applicatif sans protection '
  'RLS complète. Doit renvoyer zéro ligne.';
