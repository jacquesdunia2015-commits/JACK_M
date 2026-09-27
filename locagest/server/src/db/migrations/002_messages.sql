-- Messagerie interne bailleur ↔ locataire (Phase 2)
CREATE TABLE messages (
  id              SERIAL PRIMARY KEY,
  owner_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id       INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sender_role     TEXT NOT NULL CHECK (sender_role IN ('bailleur', 'locataire')),
  body            TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 5000),
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX messages_conversation_idx ON messages(tenant_id, created_at);
CREATE INDEX messages_owner_idx ON messages(owner_id, created_at DESC);
