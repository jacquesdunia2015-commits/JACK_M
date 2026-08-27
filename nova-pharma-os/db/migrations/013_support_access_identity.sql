-- =====================================================================
-- NOVA PHARMA OS — 013 : identité de l'agent visible par la pharmacie
--
-- La table platform_users est réservée au back-office SaaS : une
-- pharmacie ne peut pas la lire, et c'est voulu. Mais elle doit savoir
-- QUI demande l'accès à ses données — sans quoi la validation d'un accès
-- support serait un consentement à l'aveugle.
--
-- L'identité de l'agent est donc recopiée sur la subvention d'accès au
-- moment de la demande : la pharmacie la lit sans jointure, et la trace
-- reste exacte même si le compte de l'agent est renommé ou supprimé.
-- =====================================================================

ALTER TABLE support_access_grants
  ADD COLUMN IF NOT EXISTS agent_name  text,
  ADD COLUMN IF NOT EXISTS agent_email text;

UPDATE support_access_grants g
   SET agent_name  = pu.full_name,
       agent_email = pu.email
  FROM platform_users pu
 WHERE pu.id = g.platform_user_id
   AND g.agent_name IS NULL;

COMMENT ON COLUMN support_access_grants.agent_name IS
  'Nom de l''agent au moment de la demande, conservé pour la traçabilité.';

ALTER TABLE support_access_events
  ADD COLUMN IF NOT EXISTS agent_email text;
