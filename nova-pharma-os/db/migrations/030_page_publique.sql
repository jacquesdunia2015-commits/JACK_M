-- =====================================================================
-- NOVA PHARMA OS — 030 : page publique, réservations, photo d'ordonnance
--
-- Chaque pharmacie peut publier une page à son nom (adresse, horaires,
-- WhatsApp, médicaments disponibles) que ses clients ouvrent sans compte.
-- Ils y réservent des médicaments ou envoient la photo de leur
-- ordonnance ; la pharmacie prépare, prévient sur WhatsApp que c'est prêt,
-- et le client passe récupérer. Rien n'est vendu ni payé en ligne.
-- =====================================================================

CREATE TABLE public_profiles (
  organization_id       uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  is_published          boolean NOT NULL DEFAULT false,
  headline              text,
  description           text,
  opening_hours         text,
  address_hint          text,
  whatsapp              text,
  on_duty_note          text,
  show_prices           boolean NOT NULL DEFAULT true,
  accept_reservations   boolean NOT NULL DEFAULT true,
  accept_prescriptions  boolean NOT NULL DEFAULT true,
  latitude              numeric(9,6) CHECK (latitude BETWEEN -90 AND 90),
  longitude             numeric(9,6) CHECK (longitude BETWEEN -180 AND 180),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE reservations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  number              text NOT NULL,
  customer_name       text NOT NULL CHECK (length(btrim(customer_name)) > 1),
  customer_phone      text NOT NULL,
  customer_id         uuid REFERENCES customers(id) ON DELETE SET NULL,
  -- [{ productId, name, quantity, unitPrice, available }] au moment de la demande.
  lines               jsonb NOT NULL DEFAULT '[]',
  message             text,
  pickup_preference   text,
  has_prescription    boolean NOT NULL DEFAULT false,
  status              text NOT NULL DEFAULT 'new'
                        CHECK (status IN ('new', 'confirmed', 'ready', 'collected', 'cancelled')),
  staff_note          text,
  handled_by          uuid REFERENCES users(id) ON DELETE SET NULL,
  status_changed_at   timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, number),
  CHECK (jsonb_typeof(lines) = 'array')
);
CREATE INDEX reservations_status_idx ON reservations (organization_id, status, created_at DESC);
CREATE INDEX reservations_phone_idx ON reservations (organization_id, customer_phone, created_at DESC);

-- Photo d'ordonnance : gardée dans la base (aucun stockage payant), effacée
-- 30 jours après que la réservation est retirée ou annulée.
CREATE TABLE reservation_files (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  reservation_id      uuid NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  content_type        text NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png')),
  data                bytea NOT NULL,
  size_bytes          integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 2500000),
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reservation_files_reservation_idx ON reservation_files (reservation_id);

SELECT nova.apply_tenant_rls(t) FROM unnest(ARRAY['public_profiles', 'reservations', 'reservation_files']) AS t;
SELECT nova.attach_touch('public_profiles'::regclass);
SELECT nova.attach_touch('reservations'::regclass);
