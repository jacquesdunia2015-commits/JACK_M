-- =====================================================================
-- NOVA PHARMA OS — 032 : place de marché entre pharmacies et dépôts
--
-- Un dépôt (grossiste) — ou une pharmacie qui écoule un surplus ou des
-- produits à péremption proche — publie ses offres. Toute pharmacie
-- abonnée les voit, compare les prix et passe commande. Le vendeur
-- accepte (la commande devient une commande professionnelle dans son
-- NOVA), expédie ; l'acheteur réceptionne en stock. Aucun paiement ne
-- transite par la plateforme : chacun règle comme d'habitude.
--
-- Cloisonnement : ces tables sont les seules où une pharmacie lit des
-- lignes d'une autre — et seulement ce qui est publié (offres, fiche du
-- vendeur) ou ce qui la concerne (commandes dont elle est l'acheteur ou
-- le vendeur). Les politiques sont écrites ici, explicitement.
-- =====================================================================

CREATE TABLE market_sellers (
  organization_id     uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  is_listed           boolean NOT NULL DEFAULT false,
  display_name        text NOT NULL,
  city                text,
  province            text,
  phone               text,
  whatsapp            text,
  delivery_zones      text,
  min_order_amount    numeric(16,2) NOT NULL DEFAULT 0 CHECK (min_order_amount >= 0),
  payment_terms       text,
  description         text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE market_offers (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  -- Produit du vendeur, pour mettre à jour la disponibilité depuis son stock.
  product_id          uuid REFERENCES products(id) ON DELETE SET NULL,
  name                text NOT NULL CHECK (length(btrim(name)) > 1),
  dosage              text,
  form                text,
  presentation        text,
  manufacturer        text,
  unit_price          numeric(14,4) NOT NULL CHECK (unit_price > 0),
  currency            text NOT NULL,
  min_quantity        numeric(12,3) NOT NULL DEFAULT 1 CHECK (min_quantity > 0),
  availability        text NOT NULL DEFAULT 'in_stock' CHECK (availability IN ('in_stock', 'limited', 'on_order', 'out')),
  -- Péremption la plus proche annoncée (produits à écouler vite).
  expiry_date         date,
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX market_offers_search_idx ON market_offers (is_active, lower(name));
CREATE INDEX market_offers_seller_idx ON market_offers (organization_id);

CREATE TABLE market_orders (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- L'acheteur : la commande lui appartient.
  organization_id         uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  seller_organization_id  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  number                  text NOT NULL,
  status                  text NOT NULL DEFAULT 'sent'
                            CHECK (status IN ('sent', 'accepted', 'rejected', 'shipped', 'received', 'cancelled')),
  -- [{ offerId, productId, name, presentation, quantity, unitPrice }] au moment de la commande.
  lines                   jsonb NOT NULL CHECK (jsonb_typeof(lines) = 'array'),
  total                   numeric(16,2) NOT NULL CHECK (total >= 0),
  currency                text NOT NULL,
  -- Coordonnées figées : chaque partie ne lit pas la fiche de l'autre.
  buyer_name              text NOT NULL,
  buyer_city              text,
  buyer_phone             text,
  seller_name             text NOT NULL,
  buyer_note              text,
  seller_note             text,
  delivery_preference     text,
  -- Commande professionnelle créée chez le vendeur à l'acceptation.
  seller_b2b_order_id     uuid,
  -- Réception créée chez l'acheteur.
  buyer_receipt_id        uuid,
  created_by              uuid REFERENCES users(id) ON DELETE SET NULL,
  status_changed_at       timestamptz NOT NULL DEFAULT now(),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, number),
  CHECK (organization_id <> seller_organization_id)
);
CREATE INDEX market_orders_seller_idx ON market_orders (seller_organization_id, status, created_at DESC);

ALTER TABLE market_sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_sellers FORCE ROW LEVEL SECURITY;
ALTER TABLE market_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_offers FORCE ROW LEVEL SECURITY;
ALTER TABLE market_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_orders FORCE ROW LEVEL SECURITY;

-- Fiche vendeur : publiée → visible de toute pharmacie ; écrite par son titulaire.
CREATE POLICY market_sellers_tenant_select ON market_sellers FOR SELECT
  USING (nova.current_organization_id() IS NOT NULL AND (is_listed OR nova.tenant_read_allowed(organization_id)));
CREATE POLICY market_sellers_tenant_insert ON market_sellers FOR INSERT WITH CHECK (nova.tenant_write_allowed(organization_id));
CREATE POLICY market_sellers_tenant_update ON market_sellers FOR UPDATE
  USING (nova.tenant_write_allowed(organization_id)) WITH CHECK (nova.tenant_write_allowed(organization_id));
CREATE POLICY market_sellers_tenant_delete ON market_sellers FOR DELETE USING (nova.tenant_write_allowed(organization_id));

-- Offres : actives et d'un vendeur publié → visibles de toute pharmacie.
CREATE POLICY market_offers_tenant_select ON market_offers FOR SELECT
  USING (nova.current_organization_id() IS NOT NULL AND (
    nova.tenant_read_allowed(organization_id)
    OR (is_active AND EXISTS (SELECT 1 FROM market_sellers s WHERE s.organization_id = market_offers.organization_id AND s.is_listed))));
CREATE POLICY market_offers_tenant_insert ON market_offers FOR INSERT WITH CHECK (nova.tenant_write_allowed(organization_id));
CREATE POLICY market_offers_tenant_update ON market_offers FOR UPDATE
  USING (nova.tenant_write_allowed(organization_id)) WITH CHECK (nova.tenant_write_allowed(organization_id));
CREATE POLICY market_offers_tenant_delete ON market_offers FOR DELETE USING (nova.tenant_write_allowed(organization_id));

-- Commandes : vues par l'acheteur et par le vendeur, et par eux seuls.
-- L'acheteur crée ; chacun met à jour (les passages permis sont contrôlés
-- par l'application) ; seul l'acheteur supprime (restauration de sauvegarde).
CREATE POLICY market_orders_tenant_select ON market_orders FOR SELECT
  USING (nova.tenant_read_allowed(organization_id) OR nova.tenant_read_allowed(seller_organization_id));
CREATE POLICY market_orders_tenant_insert ON market_orders FOR INSERT WITH CHECK (nova.tenant_write_allowed(organization_id));
CREATE POLICY market_orders_tenant_update ON market_orders FOR UPDATE
  USING (nova.tenant_write_allowed(organization_id) OR nova.tenant_write_allowed(seller_organization_id))
  WITH CHECK (nova.tenant_write_allowed(organization_id) OR nova.tenant_write_allowed(seller_organization_id));
CREATE POLICY market_orders_tenant_delete ON market_orders FOR DELETE USING (nova.tenant_write_allowed(organization_id));

SELECT nova.attach_touch('market_sellers'::regclass);
SELECT nova.attach_touch('market_offers'::regclass);
SELECT nova.attach_touch('market_orders'::regclass);
