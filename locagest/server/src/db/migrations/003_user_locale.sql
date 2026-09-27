-- Langue de l'interface choisie par l'utilisateur (suit le compte d'un appareil à l'autre)
ALTER TABLE users ADD COLUMN locale TEXT NOT NULL DEFAULT 'fr';
