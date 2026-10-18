-- =====================================================================
-- 020 — Dates de fabrication et d'expiration dans le catalogue fournisseur
--
-- Deux offres au même prix ne se valent pas : l'une périme dans deux ans,
-- l'autre dans trois mois. La pharmacie note donc, pour chaque produit
-- proposé, les dates du lot que le dépôt lui annonce.
-- =====================================================================

ALTER TABLE supplier_products
  ADD COLUMN IF NOT EXISTS manufacture_date date,
  ADD COLUMN IF NOT EXISTS expiry_date      date,
  ADD CONSTRAINT supplier_products_dates_chk
    CHECK (manufacture_date IS NULL OR expiry_date IS NULL OR expiry_date > manufacture_date);
