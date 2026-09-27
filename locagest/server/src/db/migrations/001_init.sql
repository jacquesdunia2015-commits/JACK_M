-- Schéma initial de LocaGest (MVP)

CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name     TEXT NOT NULL,
  phone         TEXT,
  role          TEXT NOT NULL CHECK (role IN ('bailleur', 'locataire', 'admin')),
  plan          TEXT NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'pro', 'enterprise')),
  -- Pour un locataire : le bailleur qui lui a ouvert l'accès
  landlord_id   INTEGER REFERENCES users(id) ON DELETE CASCADE,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE properties (
  id                SERIAL PRIMARY KEY,
  owner_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  province          TEXT NOT NULL,
  commune           TEXT NOT NULL,
  quartier          TEXT,
  avenue            TEXT,
  numero            TEXT,
  type              TEXT NOT NULL CHECK (type IN ('maison', 'appartement', 'studio', 'villa', 'chambre', 'bureau', 'autre')),
  description       TEXT,
  bedrooms          INTEGER NOT NULL DEFAULT 0,
  living_rooms      INTEGER NOT NULL DEFAULT 0,
  toilets_internal  INTEGER NOT NULL DEFAULT 0,
  toilets_external  INTEGER NOT NULL DEFAULT 0,
  kitchens          INTEGER NOT NULL DEFAULT 0,
  condition         TEXT NOT NULL DEFAULT 'bon' CHECK (condition IN ('bon', 'moyen', 'a_renover')),
  monthly_rent      NUMERIC(14, 2) NOT NULL CHECK (monthly_rent >= 0),
  currency          TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'CDF')),
  available_from    DATE,
  status            TEXT NOT NULL DEFAULT 'vacante' CHECK (status IN ('vacante', 'occupee', 'maintenance')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX properties_owner_idx ON properties(owner_id);

CREATE TABLE property_photos (
  id            SERIAL PRIMARY KEY,
  property_id   INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  filename      TEXT NOT NULL,
  original_name TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tenants (
  id                SERIAL PRIMARY KEY,
  owner_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  first_name        TEXT NOT NULL,
  last_name         TEXT NOT NULL,
  email             TEXT,
  phone             TEXT,
  id_number         TEXT,
  nationality       TEXT,
  profession        TEXT,
  employer          TEXT,
  previous_housing  TEXT,
  rating            INTEGER CHECK (rating BETWEEN 1 AND 5),
  rating_note       TEXT,
  blacklisted       BOOLEAN NOT NULL DEFAULT FALSE,
  blacklist_reason  TEXT,
  user_id           INTEGER UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX tenants_owner_idx ON tenants(owner_id);

CREATE TABLE leases (
  id                    SERIAL PRIMARY KEY,
  owner_id              INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_id           INTEGER NOT NULL REFERENCES properties(id),
  tenant_id             INTEGER NOT NULL REFERENCES tenants(id),
  start_date            DATE NOT NULL,
  end_date              DATE NOT NULL,
  -- Date à laquelle la garantie cesse de couvrir le locataire : c'est elle
  -- qui pilote le code couleur des alertes. Par défaut, la fin du bail.
  guarantee_expires_on  DATE NOT NULL,
  monthly_rent          NUMERIC(14, 2) NOT NULL CHECK (monthly_rent >= 0),
  currency              TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'CDF')),
  guarantee_amount      NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (guarantee_amount >= 0),
  terms                 TEXT,
  auto_renew            BOOLEAN NOT NULL DEFAULT FALSE,
  status                TEXT NOT NULL DEFAULT 'actif' CHECK (status IN ('actif', 'termine', 'renouvele')),
  previous_lease_id     INTEGER REFERENCES leases(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date > start_date)
);
CREATE INDEX leases_owner_idx ON leases(owner_id);
-- Un seul bail actif par propriété
CREATE UNIQUE INDEX leases_one_active_per_property ON leases(property_id) WHERE status = 'actif';

CREATE TABLE payments (
  id          SERIAL PRIMARY KEY,
  owner_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lease_id    INTEGER NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  -- Mois couvert (toujours le 1er du mois)
  period      DATE NOT NULL CHECK (EXTRACT(DAY FROM period) = 1),
  amount      NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  paid_on     DATE NOT NULL,
  method      TEXT NOT NULL DEFAULT 'especes' CHECK (method IN ('especes', 'mobile_money', 'virement', 'autre')),
  reference   TEXT,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX payments_lease_idx ON payments(lease_id, period);

-- Historique des alertes (audit) : une ligne par envoi
CREATE TABLE alerts (
  id              SERIAL PRIMARY KEY,
  owner_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lease_id        INTEGER NOT NULL REFERENCES leases(id) ON DELETE CASCADE,
  kind            TEXT NOT NULL CHECK (kind IN ('garantie', 'paiement')),
  level           TEXT NOT NULL CHECK (level IN ('vert', 'jaune', 'orange', 'rouge')),
  -- Palier déclencheur : jours avant expiration (garantie) ou jours de retard (paiement)
  threshold       INTEGER NOT NULL,
  -- Référence de l'échéance concernée : date d'expiration ou mois du loyer
  due_ref         DATE NOT NULL,
  recipient_type  TEXT NOT NULL CHECK (recipient_type IN ('bailleur', 'locataire')),
  recipient       TEXT NOT NULL,
  channel         TEXT NOT NULL DEFAULT 'email',
  status          TEXT NOT NULL CHECK (status IN ('envoye', 'simule', 'echec')),
  message         TEXT NOT NULL,
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lease_id, kind, threshold, due_ref, recipient_type)
);
CREATE INDEX alerts_owner_idx ON alerts(owner_id, created_at DESC);

-- Journal des actions critiques
CREATE TABLE audit_logs (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  entity      TEXT NOT NULL,
  entity_id   INTEGER,
  details     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
