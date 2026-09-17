-- =====================================================================
-- NOVA PHARMA OS — 011 : numérotation de la facturation SaaS
-- Séquence dédiée aux documents émis par l'éditeur (devis, factures,
-- avoirs). Une séquence PostgreSQL garantit l'unicité même sous forte
-- concurrence, sans verrou applicatif.
-- =====================================================================

CREATE SEQUENCE IF NOT EXISTS subscription_document_seq;
GRANT USAGE, SELECT ON SEQUENCE subscription_document_seq TO nova_app;

CREATE OR REPLACE FUNCTION nova.next_subscription_document_number(p_kind text)
RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  v_prefix text := CASE p_kind
                     WHEN 'quote'       THEN 'DVN'
                     WHEN 'credit_note' THEN 'AVN'
                     ELSE 'NPO'
                   END;
  v_value bigint := nextval('subscription_document_seq');
BEGIN
  RETURN format('%s-%s-%s', v_prefix,
                to_char(now(), 'YYYY'),
                lpad(v_value::text, 6, '0'));
END;
$$;

GRANT EXECUTE ON FUNCTION nova.next_subscription_document_number(text) TO nova_app;
