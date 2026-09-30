-- =====================================================================
-- NOVA PHARMA OS — 022 : références de tickets propres à chaque pharmacie
--
-- La référence d'un ticket (TCK-2026-00001…) est numérotée pharmacie par
-- pharmacie, mais la colonne était unique pour toute la plateforme : la
-- seconde pharmacie à écrire au support se voyait refuser son premier
-- ticket (« Cet enregistrement existe déjà »). L'unicité porte désormais
-- sur le couple pharmacie + référence ; le back-office affiche toujours la
-- pharmacie à côté de la référence.
-- =====================================================================

ALTER TABLE support_tickets DROP CONSTRAINT IF EXISTS support_tickets_reference_key;
ALTER TABLE support_tickets
  ADD CONSTRAINT support_tickets_organization_reference_key UNIQUE (organization_id, reference);
