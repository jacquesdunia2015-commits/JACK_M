import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Charge un fichier .env sans dépendance externe. Les variables déjà
 * présentes dans l'environnement ne sont jamais écrasées, pour que la
 * configuration d'un conteneur prime sur le fichier local.
 */
export function loadEnv(file = '.env'): void {
  const path = resolve(process.cwd(), file);
  if (existsSync(path)) {
    for (const rawLine of readFileSync(path, 'utf8').split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const separator = line.indexOf('=');
      if (separator === -1) continue;

      const key = line.slice(0, separator).trim();
      let value = line.slice(separator + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }

  deriverAdresseApplicative();
}

/**
 * Déduit l'adresse de connexion de l'application de celle de
 * l'administrateur, quand seule cette dernière est fournie.
 *
 * Chez un hébergeur, la base arrive avec une seule adresse — celle de son
 * propriétaire. En demander une seconde, identique à l'identité près, oblige
 * la personne qui déploie à modifier une URL à la main : l'erreur la plus
 * probable de tout le déploiement, et la plus dangereuse, puisqu'une copie
 * de l'adresse administrateur ferait tourner l'application avec des droits
 * qu'elle ne doit pas avoir.
 *
 * On ne déduit rien si DATABASE_URL est déjà défini : une configuration
 * explicite l'emporte toujours. Et le rôle déduit reste soumis au contrôle
 * de démarrage de DatabaseService, qui refuse tout rôle capable de
 * contourner le cloisonnement.
 */
export function deriverAdresseApplicative(): void {
  if (process.env.DATABASE_URL) return;

  const administrateur = process.env.DATABASE_ADMIN_URL;
  const motDePasse = process.env.NOVA_APP_PASSWORD;
  if (!administrateur || !motDePasse) return;

  const url = new URL(administrateur);
  url.username = process.env.NOVA_APP_ROLE ?? 'nova_app';
  url.password = motDePasse;
  process.env.DATABASE_URL = url.toString();
}
