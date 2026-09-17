import { Client } from 'pg';
import { loadEnv } from './load-env';

/**
 * Garantit que le rôle applicatif existe, qu'il peut se connecter, et
 * qu'il n'échappe pas aux politiques de cloisonnement.
 *
 * Pourquoi ce script existe : l'API se connecte avec un rôle ordinaire,
 * jamais avec l'administrateur de la base. C'est ce qui fait qu'une
 * pharmacie ne voit pas les données d'une autre — un superutilisateur
 * PostgreSQL, lui, ignore les politiques et verrait tout, sans qu'aucune
 * erreur n'apparaisse.
 *
 * La migration 009 crée bien ce rôle, mais seulement s'il n'existe pas
 * déjà. Sur une base réutilisée, le mot de passe peut donc être inconnu
 * de l'installation courante. Ce script réaligne les deux, et remet les
 * attributs en place si quelqu'un les a élargis entre-temps.
 *
 * Il se connecte avec DATABASE_ADMIN_URL — le seul endroit où
 * l'administrateur de la base a encore sa place.
 *
 * Lancement :  npm run role:app
 */
async function principal(): Promise<void> {
  loadEnv();

  const adminUrl = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
  if (!adminUrl) throw new Error('DATABASE_ADMIN_URL est requis.');

  const role = process.env.NOVA_APP_ROLE ?? 'nova_app';
  const motDePasse = process.env.NOVA_APP_PASSWORD ?? 'nova_app';

  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  try {
    const { rows } = await client.query<{ existe: boolean }>(
      'SELECT true AS existe FROM pg_roles WHERE rolname = $1',
      [role],
    );

    // Le nom du rôle ne peut pas être passé en paramètre : il fait partie
    // de la commande, pas des données. Il est donc échappé comme
    // identifiant, et le mot de passe comme littéral.
    const nom = await identifiant(client, role);
    const secret = await litteral(client, motDePasse);
    const attributs = `LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD ${secret}`;

    if (rows.length === 0) {
      await client.query(`CREATE ROLE ${nom} WITH ${attributs}`);
    } else {
      await client.query(`ALTER ROLE ${nom} WITH ${attributs}`);
    }

    // Les droits sur les tables sont posés par la migration 009 ; ils ne
    // sont pas repris ici pour que ce script reste sans effet de bord sur
    // une base déjà en service.
  } finally {
    await client.end();
  }
}

/** Échappe un identifiant SQL en confiant le travail à PostgreSQL. */
async function identifiant(client: Client, valeur: string): Promise<string> {
  const { rows } = await client.query<{ q: string }>('SELECT quote_ident($1) AS q', [
    valeur,
  ]);
  return rows[0].q;
}

/** Échappe un littéral SQL de la même façon. */
async function litteral(client: Client, valeur: string): Promise<string> {
  const { rows } = await client.query<{ q: string }>('SELECT quote_literal($1) AS q', [
    valeur,
  ]);
  return rows[0].q;
}

principal().catch((erreur: Error) => {
  console.error(erreur.message);
  process.exit(1);
});
