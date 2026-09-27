-- Multi-devise : toute monnaie ISO 4217 (la liste autorisée est contrôlée par l'API),
-- et pays + monnaie par défaut de chaque utilisateur.
ALTER TABLE properties DROP CONSTRAINT properties_currency_check;
ALTER TABLE properties ADD CONSTRAINT properties_currency_check CHECK (currency ~ '^[A-Z]{3}$');
ALTER TABLE leases DROP CONSTRAINT leases_currency_check;
ALTER TABLE leases ADD CONSTRAINT leases_currency_check CHECK (currency ~ '^[A-Z]{3}$');

ALTER TABLE users ADD COLUMN country TEXT CHECK (country ~ '^[A-Z]{2}$');
ALTER TABLE users ADD COLUMN currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency ~ '^[A-Z]{3}$');
