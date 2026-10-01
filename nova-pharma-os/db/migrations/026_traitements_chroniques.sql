-- =====================================================================
-- NOVA PHARMA OS — 026 : traitements suivis (malades chroniques)
--
-- Un patient diabétique, hypertendu ou sous antirétroviraux revient
-- chaque mois. Prévenir quelques jours avant la fin de sa boîte le fait
-- revenir ici plutôt que chez le voisin — et l'aide à ne pas interrompre
-- son traitement. La pharmacie note, pour chaque patient et chaque
-- médicament, combien de jours dure une unité vendue ; chaque vente au
-- patient recalcule la date de fin, et la liste du jour dit qui prévenir.
-- =====================================================================

CREATE TABLE treatment_plans (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id         uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  product_id          uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  condition           text NOT NULL DEFAULT 'autre'
                        CHECK (condition IN ('diabete', 'hypertension', 'vih', 'asthme', 'epilepsie',
                                             'cardiaque', 'tuberculose', 'drepanocytose', 'autre')),
  -- Jours de traitement couverts par une unité vendue (une boîte de 30
  -- comprimés à un comprimé par jour : 30).
  days_per_unit       numeric(8,2) NOT NULL CHECK (days_per_unit > 0),
  remind_days_before  integer NOT NULL DEFAULT 3 CHECK (remind_days_before BETWEEN 0 AND 30),
  last_dispensed_at   date,
  last_quantity       numeric(12,3),
  next_refill_date    date,
  last_reminded_at    timestamptz,
  reminders_sent      integer NOT NULL DEFAULT 0,
  is_active           boolean NOT NULL DEFAULT true,
  notes               text,
  created_by          uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, product_id)
);
CREATE INDEX treatment_plans_due_idx ON treatment_plans (organization_id, next_refill_date) WHERE is_active;

SELECT nova.apply_tenant_rls('treatment_plans');
SELECT nova.attach_touch('treatment_plans'::regclass);
