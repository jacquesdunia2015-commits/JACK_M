import { resolve } from 'node:path';
import { Client } from 'pg';
import { copierBase } from '../src/database/copier-base';
import { runMigrations } from '../src/database/migrator';
import { Harness, uniqueSlug } from './harness';

/**
 * Changement de base : tout ce que contient la base de test est recopié
 * dans une base neuve, la source reste intacte, et une base déjà en
 * service n'est jamais écrasée.
 */
describe('Copie complète vers une nouvelle base', () => {
  const harness = new Harness();
  const sourceUrl = () => process.env.DATABASE_ADMIN_URL as string;
  const nomCible = () => `${new URL(sourceUrl()).pathname.slice(1)}_copie`;
  const cibleUrl = () => sourceUrl().replace(/\/[^/?]+(\?|$)/, `/${nomCible()}$1`);
  const maintenance = () => sourceUrl().replace(/\/[^/?]+(\?|$)/, '/postgres$1');

  const sql = async (url: string, requete: string) => {
    const c = new Client({ connectionString: url });
    await c.connect();
    try {
      return (await c.query(requete)).rows;
    } finally {
      await c.end();
    }
  };

  /** Comptes de lignes, cloisonnement levé dans une transaction annulée. */
  const comptes = async (url: string, tables: string[]) => {
    const c = new Client({ connectionString: url });
    await c.connect();
    try {
      await c.query('BEGIN');
      const resultat: Record<string, number> = {};
      for (const t of tables) {
        await c.query(`ALTER TABLE ${t} NO FORCE ROW LEVEL SECURITY`);
        resultat[t] = Number((await c.query(`SELECT count(*) AS n FROM ${t}`)).rows[0].n);
      }
      await c.query('ROLLBACK');
      return resultat;
    } finally {
      await c.end();
    }
  };

  beforeAll(async () => {
    await harness.start();
    // Une pharmacie avec un produit et une vente, pour que la copie porte
    // sur de vraies données de pharmacie.
    const superAdmin = await harness.loginPlatform('admin@novapharmaos.com');
    const slug = uniqueSlug('copie');
    await harness
      .post('/platform/organizations', {
        slug, legalName: `PHARMACIE ${slug.toUpperCase()}`, countryCode: 'CD', planCode: 'starter', startTrial: true,
        owner: { fullName: 'Gérante', email: `gerant@${slug}.cd`, password: 'Pharmacie2026!' },
      }, superAdmin.token)
      .expect(201);
    const pharmacie = await harness.loginPharmacy(`gerant@${slug}.cd`, 'Pharmacie2026!');
    const produit = (await harness.post('/catalog/products', { name: 'Paracétamol 500 mg', salePrice: 0.2 }, pharmacie.token).expect(201)).body.id;
    await harness.post('/inventory/receptions', { lines: [{ productId: produit, quantity: 10, unitCost: 0.1, lotNumber: 'L-COPIE', expiryDate: '2029-01-31' }] }, pharmacie.token).expect(201);
    await harness.post('/sales', { lines: [{ productId: produit, quantity: 2 }], payments: [{ method: 'cash', amount: 1 }] }, pharmacie.token).expect(201);

    await sql(maintenance(), `DROP DATABASE IF EXISTS ${nomCible()}`);
    await sql(maintenance(), `CREATE DATABASE ${nomCible()} ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0`);
    await runMigrations(cibleUrl(), resolve(__dirname, '../../db/migrations'));
  }, 120_000);

  afterAll(async () => {
    await harness.stop();
    await sql(maintenance(), `DROP DATABASE IF EXISTS ${nomCible()}`).catch(() => undefined);
  });

  const TABLES = ['organizations', 'users', 'products', 'stock_movements', 'sales', 'sale_lines', 'platform_users', 'subscription_plans'];

  it('recopie tout, laisse la source intacte et rétablit les protections', async () => {
    const avant = await comptes(sourceUrl(), TABLES);
    const resultat = await copierBase(sourceUrl(), cibleUrl(), { journal: () => undefined });
    expect(resultat.copie).toBe(true);
    expect(resultat.lignes).toBeGreaterThan(0);

    expect(await comptes(cibleUrl(), TABLES)).toEqual(avant);
    expect(await comptes(sourceUrl(), TABLES)).toEqual(avant);

    // Cloisonnement forcé et clés étrangères à l'identique.
    const protections = (url: string) => sql(url,
      `SELECT (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public' AND c.relforcerowsecurity) AS forcees,
              (SELECT count(*) FROM pg_constraint WHERE contype = 'f') AS cles`);
    expect(await protections(cibleUrl())).toEqual(await protections(sourceUrl()));
  });

  it('n’écrase pas une base qui a déjà des pharmacies, et refuse une copie sur elle-même', async () => {
    const resultat = await copierBase(sourceUrl(), cibleUrl(), { journal: () => undefined });
    expect(resultat.copie).toBe(false);
    expect(resultat.raison).toMatch(/déjà/);
    await expect(copierBase(sourceUrl(), sourceUrl())).rejects.toThrow(/même/);
  });
});
