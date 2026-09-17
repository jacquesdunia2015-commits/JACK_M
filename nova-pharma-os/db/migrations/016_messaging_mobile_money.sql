-- =====================================================================
-- NOVA PHARMA OS — 016 : messagerie SMS/WhatsApp et encaissement
--                        Mobile Money
--
-- Deux besoins de terrain, traités de façon à fonctionner **sans compte
-- payant** dès le premier jour, puis à basculer sur une passerelle
-- facturée le jour où la pharmacie en ouvre une.
--
-- Messagerie
--   Le message est toujours composé, daté et conservé par la plateforme.
--   Seule la remise change :
--     • mode « manuel » (gratuit)  : la plateforme produit un lien que le
--       vendeur ouvre depuis SON téléphone — WhatsApp ou l'application
--       SMS s'ouvre avec le texte déjà rempli. Aucun contrat, aucun
--       coût, et le message part réellement.
--     • mode « passerelle » (payant) : la plateforme appelle l'API du
--       fournisseur. Les identifiants vivent dans messaging_settings,
--       table de la pharmacie, jamais dans une table plateforme.
--   Dans les deux cas la trace est la même, si bien que passer de l'un à
--   l'autre ne fait perdre aucun historique.
--
-- Mobile Money
--   Encaisser par téléphone ne demande pas d'API : le client compose un
--   code, le vendeur relève l'identifiant de transaction. Ce que le
--   logiciel doit garantir, c'est qu'aucun encaissement ne soit compté
--   deux fois et qu'on retrouve à qui il se rapporte. C'est le rôle des
--   deux tables ci-dessous ; l'intégration automatique d'un opérateur
--   viendra plus tard s'y brancher sans changer le modèle.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Réglages de messagerie, propres à chaque pharmacie
-- ---------------------------------------------------------------------
CREATE TABLE messaging_settings (
  organization_id     uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  -- manual : liens à ouvrir depuis le téléphone du vendeur (gratuit)
  -- gateway: appel d'une passerelle HTTP (payant)
  sms_mode            text NOT NULL DEFAULT 'manual'
                        CHECK (sms_mode IN ('manual', 'gateway', 'disabled')),
  whatsapp_mode       text NOT NULL DEFAULT 'manual'
                        CHECK (whatsapp_mode IN ('manual', 'gateway', 'disabled')),
  sender_name         text,
  -- Passerelle : une URL appelée en POST avec { to, body }. Le jeton est
  -- gardé ici, dans les données de la pharmacie, protégé par RLS comme
  -- le reste. Le back-office SaaS ne peut pas le lire.
  gateway_url         text,
  gateway_token       text,
  default_country_code text NOT NULL DEFAULT '+243',
  updated_by          uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at          timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE messaging_settings IS
  'Mode d''envoi SMS/WhatsApp par pharmacie. « manual » n''engage aucun frais.';

-- ---------------------------------------------------------------------
-- Modèles de message
-- ---------------------------------------------------------------------
CREATE TABLE message_templates (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code                text NOT NULL,             -- receipt | payment_reminder | delivery_on_way | refill_reminder
  channel             text NOT NULL DEFAULT 'whatsapp'
                        CHECK (channel IN ('sms', 'whatsapp')),
  locale              text NOT NULL DEFAULT 'fr',
  label               text NOT NULL,
  -- Le corps accepte des marqueurs {{client}}, {{montant}}, {{numero}}…
  body                text NOT NULL,
  active              boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code, channel, locale)
);

-- ---------------------------------------------------------------------
-- Journal des messages sortants
-- ---------------------------------------------------------------------
CREATE TABLE outbound_messages (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id           uuid REFERENCES branches(id) ON DELETE SET NULL,
  channel             text NOT NULL CHECK (channel IN ('sms', 'whatsapp')),
  mode                text NOT NULL CHECK (mode IN ('manual', 'gateway')),
  recipient_phone     text NOT NULL,
  recipient_name      text,
  customer_id         uuid REFERENCES customers(id) ON DELETE SET NULL,
  category            text NOT NULL DEFAULT 'general',
  entity              text,
  entity_id           text,
  body                text NOT NULL,
  -- ready  : le lien est prêt, le vendeur doit l'ouvrir (mode manuel)
  -- sent   : parti, confirmé par la passerelle ou par le vendeur
  status              text NOT NULL DEFAULT 'ready'
                        CHECK (status IN ('ready', 'sent', 'failed', 'cancelled')),
  -- Lien wa.me:// ou sms: à ouvrir depuis le téléphone (mode manuel).
  send_link           text,
  provider_message_id text,
  error               text,
  -- Idempotence : réémettre le même reçu ne crée pas un doublon.
  client_operation_id text,
  created_by          uuid REFERENCES users(id) ON DELETE SET NULL,
  sent_by             uuid REFERENCES users(id) ON DELETE SET NULL,
  sent_at             timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX outbound_messages_org_idx
  ON outbound_messages(organization_id, status, created_at DESC);
CREATE INDEX outbound_messages_entity_idx
  ON outbound_messages(organization_id, entity, entity_id);
CREATE UNIQUE INDEX outbound_messages_operation_idx
  ON outbound_messages(organization_id, client_operation_id)
  WHERE client_operation_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- Encaissements Mobile Money
-- ---------------------------------------------------------------------
CREATE TABLE mobile_money_operators (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code                text NOT NULL,            -- mpesa | airtel | orange | afrimoney | autre
  label               text NOT NULL,
  -- Numéro marchand de la pharmacie, celui que le client crédite.
  merchant_number     text,
  -- Modèle du code à composer, ex. *1122*1*{{numero}}*{{montant}}#
  ussd_pattern        text,
  active              boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, code)
);

CREATE TABLE mobile_money_collections (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id           uuid NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  operator_code       text NOT NULL,
  payer_phone         text NOT NULL,
  payer_name          text,
  amount              numeric(16,2) NOT NULL CHECK (amount > 0),
  currency            text NOT NULL,
  -- Notre référence, remise au client ; sert à retrouver l'encaissement.
  reference           text NOT NULL,
  -- Identifiant de transaction rendu par l'opérateur, saisi par le
  -- vendeur. Unique : c'est lui qui empêche de compter deux fois le
  -- même versement.
  operator_reference  text,
  instructions        text,
  status              text NOT NULL DEFAULT 'requested'
                        CHECK (status IN ('requested', 'confirmed', 'failed', 'cancelled')),
  sale_id             uuid REFERENCES sales(id) ON DELETE SET NULL,
  invoice_id          uuid REFERENCES invoices(id) ON DELETE SET NULL,
  customer_id         uuid REFERENCES customers(id) ON DELETE SET NULL,
  failure_reason      text,
  client_operation_id text,
  requested_by        uuid REFERENCES users(id) ON DELETE SET NULL,
  confirmed_by        uuid REFERENCES users(id) ON DELETE SET NULL,
  requested_at        timestamptz NOT NULL DEFAULT now(),
  confirmed_at        timestamptz,
  UNIQUE (organization_id, reference)
);
CREATE UNIQUE INDEX mobile_money_operator_reference_idx
  ON mobile_money_collections(organization_id, operator_code, operator_reference)
  WHERE operator_reference IS NOT NULL;
CREATE UNIQUE INDEX mobile_money_operation_idx
  ON mobile_money_collections(organization_id, client_operation_id)
  WHERE client_operation_id IS NOT NULL;
CREATE INDEX mobile_money_org_status_idx
  ON mobile_money_collections(organization_id, status, requested_at DESC);
COMMENT ON COLUMN mobile_money_collections.operator_reference IS
  'Identifiant de transaction de l''opérateur. Unique par opérateur : un '
  'même versement ne peut pas être encaissé deux fois.';

-- ---------------------------------------------------------------------
-- Cloisonnement
-- ---------------------------------------------------------------------
SELECT nova.apply_tenant_rls('messaging_settings');
SELECT nova.apply_tenant_rls('message_templates');
SELECT nova.apply_tenant_rls('outbound_messages');
SELECT nova.apply_tenant_rls('mobile_money_operators');
SELECT nova.apply_tenant_rls('mobile_money_collections');

-- ---------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------
-- Les permissions « payments.* » existent depuis l'origine : le Mobile
-- Money s'y range sans en créer de nouvelles. Seule la messagerie en
-- demande.
INSERT INTO permissions (code, label, module) VALUES
  ('messaging.read',  'Consulter les messages envoyés',   'messaging'),
  ('messaging.write', 'Envoyer des messages aux clients', 'messaging')
ON CONFLICT (code) DO NOTHING;

-- Attribution aux rôles déjà en place dans les pharmacies existantes.
-- Ceux qui servent la clientèle écrivent ; le comptable lit seulement.
-- Les rôles créés plus tard reçoivent ces permissions par DEFAULT_ROLES.
INSERT INTO role_permissions (role_id, organization_id, permission_code)
SELECT r.id, r.organization_id, p.code
  FROM roles r
 CROSS JOIN (VALUES ('messaging.read'), ('messaging.write')) AS p(code)
 WHERE r.code IN ('pharmacien_responsable', 'vendeur', 'caissier', 'gestionnaire_b2b')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, organization_id, permission_code)
SELECT r.id, r.organization_id, 'messaging.read'
  FROM roles r
 WHERE r.code IN ('comptable', 'livreur')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------
-- Ouverture des modules
--
-- Le mode manuel ne coûte rien à l'éditeur : c'est le téléphone du
-- vendeur qui envoie, et c'est lui qui relève la référence Mobile Money.
-- Le réserver aux gros forfaits n'aurait donc pas de justification —
-- les deux modules sont ouverts à tous les forfaits.
--
-- Ce qui reste payant, et le reste : l'envoi automatique par passerelle
-- et l'intégration directe d'un opérateur, déjà présents comme options
-- (« whatsapp », « sms_pack_1000 », « mobile_money »).
-- ---------------------------------------------------------------------
UPDATE subscription_plans
   SET modules = (
         SELECT array_agg(DISTINCT m ORDER BY m)
           FROM unnest(modules || ARRAY['messaging', 'payments']) AS m
       );

UPDATE organization_subscriptions
   SET modules = (
         SELECT array_agg(DISTINCT m ORDER BY m)
           FROM unnest(modules || ARRAY['messaging', 'payments']) AS m
       );

-- ---------------------------------------------------------------------
-- Modèles de message livrés d'origine
--
-- Ils sont copiés dans chaque pharmacie existante afin qu'un vendeur
-- puisse envoyer un reçu dès la première ouverture, sans rien rédiger.
-- ---------------------------------------------------------------------
INSERT INTO message_templates (organization_id, code, channel, locale, label, body)
SELECT o.id, v.code, v.channel, 'fr', v.label, v.body
  FROM organizations o
 CROSS JOIN (VALUES
   ('receipt', 'whatsapp', 'Reçu de vente',
    'Bonjour {{client}}, merci de votre achat chez {{pharmacie}}. ' ||
    'Reçu {{numero}} — montant {{montant}}. Bonne santé à vous.'),
   ('payment_reminder', 'whatsapp', 'Rappel de paiement',
    'Bonjour {{client}}, votre solde chez {{pharmacie}} est de {{montant}}. ' ||
    'Merci de passer régler quand vous le pourrez.'),
   ('delivery_on_way', 'whatsapp', 'Livraison en route',
    'Bonjour {{client}}, votre commande {{numero}} de {{pharmacie}} est en route. ' ||
    'Montant à régler : {{montant}}.'),
   ('receipt_sms', 'sms', 'Reçu de vente (SMS)',
    '{{pharmacie}} : recu {{numero}}, montant {{montant}}. Merci.')
 ) AS v(code, channel, label, body)
ON CONFLICT (organization_id, code, channel, locale) DO NOTHING;

-- Opérateurs Mobile Money courants en RD Congo, prêts à l'emploi. Le
-- numéro marchand reste à saisir par la pharmacie : il lui est propre.
INSERT INTO mobile_money_operators (organization_id, code, label, ussd_pattern)
SELECT o.id, v.code, v.label, v.ussd
  FROM organizations o
 CROSS JOIN (VALUES
   ('mpesa',     'M-Pesa (Vodacom)', '*1122#'),
   ('airtel',    'Airtel Money',     '*501#'),
   ('orange',    'Orange Money',     '*144#'),
   ('afrimoney', 'Afrimoney',        '*555#')
 ) AS v(code, label, ussd)
ON CONFLICT (organization_id, code) DO NOTHING;

-- Réglages par défaut : mode manuel, donc gratuit.
INSERT INTO messaging_settings (organization_id)
SELECT id FROM organizations
ON CONFLICT (organization_id) DO NOTHING;
