import { resolve } from 'node:path';
import { copierBase } from './copier-base';
import { alignerRoleApplicatif } from './ensure-app-role';
import { runMigrations } from './migrator';
import { loadEnv } from './load-env';

async function main(): Promise<void> {
  loadEnv();
  const connectionString =
    process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_ADMIN_URL ou DATABASE_URL est requis.');
  }
  // Le rôle applicatif est créé (ou réaligné) AVANT les migrations, avec
  // le mot de passe fourni. Sur une base neuve, la migration 009 le
  // trouve alors déjà et ne le crée pas avec son mot de passe par défaut —
  // que certains hébergeurs (Neon) refusent, faute d'être assez long.
  // Sans effet sur une base déjà en ordre.
  if (process.env.NOVA_APP_PASSWORD) {
    await alignerRoleApplicatif(connectionString).catch((erreur: Error) =>
      console.warn(`Rôle applicatif non réaligné : ${erreur.message}`),
    );
  }

  const dir = resolve(__dirname, '../../../db/migrations');
  const { applied, skipped } = await runMigrations(connectionString, dir);

  if (applied.length === 0) {
    console.log(`Base à jour — ${skipped.length} migration(s) déjà appliquée(s).`);
  } else {
    console.log(`${applied.length} migration(s) appliquée(s) :`);
    applied.forEach((f) => console.log(`  • ${f}`));
  }

  // Changement de base (base gratuite qui expire…) : COPIER_DEPUIS_URL
  // désigne l'ancienne base ; tout y est recopié dans la nouvelle, une
  // seule fois. Une cible qui a déjà des pharmacies n'est jamais écrasée,
  // sauf COPIER_FORCER=oui.
  const source = process.env.COPIER_DEPUIS_URL;
  if (source) {
    console.log('Copie de l’ancienne base vers la nouvelle…');
    const resultat = await copierBase(source, connectionString, {
      forcer: process.env.COPIER_FORCER === 'oui',
    });
    if (resultat.copie) {
      console.log(
        `Copie réussie : ${resultat.tables} tables, ${resultat.lignes} lignes. ` +
          'Retirez maintenant COPIER_DEPUIS_URL des réglages du service.',
      );
    } else {
      console.log(`${resultat.raison} Retirez COPIER_DEPUIS_URL des réglages du service.`);
    }
  }
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exit(1);
});
