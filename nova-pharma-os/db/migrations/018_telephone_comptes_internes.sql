-- =====================================================================
-- NOVA PHARMA OS — 018 : téléphone des comptes internes
--
-- Les comptes de pharmacie portent un numéro de téléphone depuis la
-- migration 003 ; les comptes internes NOVA PHARMA OS (super-
-- administrateur, support, commercial) n'en avaient pas. En RD Congo,
-- le téléphone est souvent le moyen le plus sûr de joindre quelqu'un :
-- chaque compte, quel que soit son espace, en porte désormais un.
--
-- La colonne reste facultative au niveau de la base : les comptes créés
-- avant cette migration n'en ont pas, et l'obligation est portée par
-- l'API, au moment de la création.
-- =====================================================================

ALTER TABLE platform_users ADD COLUMN IF NOT EXISTS phone text;
