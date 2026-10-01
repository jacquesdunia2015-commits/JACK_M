-- =====================================================================
-- NOVA PHARMA OS — 031 : Mobile Money confirmé par le SMS de l'opérateur
--
-- Sans contrat avec les opérateurs (et leurs frais par transaction), la
-- preuve d'un versement est le SMS que l'opérateur envoie au téléphone
-- marchand de la pharmacie. Deux usages, gratuits :
--   * le caissier colle ce SMS : NOVA y lit montant, numéro et identifiant
--     de transaction, et refuse un SMS qui ne correspond pas ;
--   * une application Android gratuite de transfert de SMS, installée sur
--     le téléphone marchand, envoie chaque SMS à NOVA par un lien secret :
--     le versement attendu est confirmé tout seul.
-- Le raccordement direct à un opérateur réutilisera le même rapprochement.
-- =====================================================================

-- Lien secret de transfert des SMS : seule son empreinte est gardée. Lisible
-- par la plateforme (pour retrouver la pharmacie à partir du lien), écrit
-- par la pharmacie elle-même.
CREATE TABLE mobile_money_sms_links (
  organization_id     uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  token_hash          text NOT NULL UNIQUE,
  token_hint          text NOT NULL,
  is_active           boolean NOT NULL DEFAULT true,
  last_received_at    timestamptz,
  created_by          uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- SMS reçus : rapprochés d'un versement attendu, ou laissés à examiner.
CREATE TABLE mobile_money_sms (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source              text NOT NULL CHECK (source IN ('forward', 'paste')),
  sender              text,
  body                text NOT NULL CHECK (length(body) <= 2000),
  operator_code       text,
  amount              numeric(16,2),
  currency            text,
  payer_phone         text,
  transaction_id      text,
  status              text NOT NULL DEFAULT 'unmatched'
                        CHECK (status IN ('matched', 'unmatched', 'ignored', 'duplicate')),
  collection_id       uuid REFERENCES mobile_money_collections(id) ON DELETE SET NULL,
  note                text,
  received_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mobile_money_sms_status_idx ON mobile_money_sms (organization_id, status, received_at DESC);

SELECT nova.apply_platform_rls('mobile_money_sms_links', true);
SELECT nova.apply_tenant_rls('mobile_money_sms');
SELECT nova.attach_touch('mobile_money_sms_links'::regclass);
