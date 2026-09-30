-- =====================================================================
-- 019 — Répertoire des fournisseurs : catalogue et prix de chaque dépôt
--
-- Une pharmacie note ce que propose chaque dépôt pharmaceutique, et à
-- quel prix, avant même de référencer le produit dans son propre
-- catalogue : une ligne du catalogue fournisseur peut donc désigner un
-- produit de la pharmacie, ou seulement un nom libre (« Amoxicilline
-- 500 mg, boîte de 100 »). Les deux se comparent ensuite d'un dépôt à
-- l'autre.
-- =====================================================================

ALTER TABLE supplier_products
  ALTER COLUMN product_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS product_name     text,
  ADD COLUMN IF NOT EXISTS presentation     text,          -- forme, dosage, conditionnement
  ADD COLUMN IF NOT EXISTS is_available     boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS price_updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS notes            text,
  ADD COLUMN IF NOT EXISTS created_at       timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at       timestamptz NOT NULL DEFAULT now(),
  ADD CONSTRAINT supplier_products_designation_chk
    CHECK (product_id IS NOT NULL OR length(btrim(product_name)) > 0);

-- Un même article libre ne se saisit qu'une fois par dépôt.
CREATE UNIQUE INDEX supplier_products_libre_idx
  ON supplier_products (supplier_id, lower(product_name), lower(COALESCE(presentation, '')))
  WHERE product_id IS NULL;

-- Comparaison des prix d'un produit entre dépôts.
CREATE INDEX supplier_products_produit_idx
  ON supplier_products (organization_id, product_id) WHERE product_id IS NOT NULL;

SELECT nova.attach_touch('supplier_products'::regclass);

-- Le répertoire des fournisseurs sert à toute pharmacie, même sans le
-- module d'achats : il rejoint le forfait Starter. Les commandes et
-- réceptions restent réservées aux forfaits qui ont le module « purchasing ».
UPDATE subscription_plans
   SET modules = array_append(modules, 'suppliers')
 WHERE code = 'starter' AND NOT ('suppliers' = ANY (modules));

UPDATE organization_subscriptions os
   SET modules = array_append(os.modules, 'suppliers')
  FROM subscription_plans sp
 WHERE sp.id = os.plan_id AND sp.code = 'starter'
   AND NOT ('suppliers' = ANY (os.modules));
