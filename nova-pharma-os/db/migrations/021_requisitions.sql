-- =====================================================================
-- 021 — Réquisitions et logo de la pharmacie
--
-- Une réquisition liste ce qu'il faut acheter et chez qui : chaque ligne
-- porte un produit, une quantité et le fournisseur choisi, avec le prix
-- de son catalogue au moment de la demande. Elle s'imprime ou se partage
-- en PDF, un document par fournisseur, au logo de la pharmacie.
--
-- Elle relève du répertoire des fournisseurs (tous les forfaits) : la
-- commande formelle, avec réception rapprochée, reste au module d'achats.
-- =====================================================================

CREATE TABLE requisitions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id           uuid REFERENCES branches(id) ON DELETE SET NULL,
  number              text NOT NULL,
  status              text NOT NULL DEFAULT 'brouillon'
                        CHECK (status IN ('brouillon', 'envoyee', 'recue', 'annulee')),
  needed_by           date,
  notes               text,
  created_by          uuid REFERENCES users(id) ON DELETE SET NULL,
  sent_at             timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, number)
);
CREATE INDEX requisitions_org_idx ON requisitions (organization_id, created_at DESC);

CREATE TABLE requisition_lines (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  requisition_id      uuid NOT NULL REFERENCES requisitions(id) ON DELETE CASCADE,
  position            integer NOT NULL DEFAULT 0,
  product_id          uuid REFERENCES products(id) ON DELETE SET NULL,
  -- Désignation figée au moment de la demande : le document reste lisible
  -- même si le produit est renommé ou retiré du catalogue.
  product_name        text NOT NULL CHECK (length(btrim(product_name)) > 0),
  presentation        text,
  quantity            numeric(14,3) NOT NULL CHECK (quantity > 0),
  supplier_id         uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  supplier_product_id uuid REFERENCES supplier_products(id) ON DELETE SET NULL,
  unit_price          numeric(14,4) CHECK (unit_price IS NULL OR unit_price >= 0),
  currency            text,
  notes               text
);
CREATE INDEX requisition_lines_req_idx ON requisition_lines (requisition_id, position);

SELECT nova.apply_tenant_rls(t) FROM unnest(ARRAY['requisitions', 'requisition_lines']) AS t;
SELECT nova.attach_touch('requisitions'::regclass);

-- Logo imprimé sur les documents de la pharmacie (PNG ou JPEG, en data URL).
-- Plafonné à environ 500 Ko : un logo net n'en demande pas davantage.
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS logo_data text
    CHECK (logo_data IS NULL OR (logo_data ~ '^data:image/(png|jpeg);base64,' AND length(logo_data) <= 700000));
