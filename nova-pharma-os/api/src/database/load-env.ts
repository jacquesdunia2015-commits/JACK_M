import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Charge un fichier .env sans dépendance externe. Les variables déjà
 * présentes dans l'environnement ne sont jamais écrasées, pour que la
 * configuration d'un conteneur prime sur le fichier local.
 */
export function loadEnv(file = '.env'): void {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) return;

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
