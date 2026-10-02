import { DatabaseService } from '../src/common/database/database.service';
import { SYSTEM_CONTEXT, systemTenantContext } from '../src/common/database/request-context';
import { Harness, Session, uniqueSlug } from './harness';

/**
 * Prévisions saisonnières : deux produits vendus au même rythme récent,
 * l'un avec un pic l'an dernier au mois visé, l'autre régulier. Le premier
 * doit être prévu nettement plus haut ; la quantité à commander suit la
 * prévision, le stock et la couverture demandée. Les dates de l'historique
 * sont calculées à partir d'aujourd'hui : le test ne dépend pas du jour où
 * il tourne.
 */
describe('Prévisions saisonnières', () => {
  const harness = new Harness();
  const PASSWORD = 'Pharmacie2026!';
  const HORIZON = 30;
  let pharmacie: Session;
  let orgId: string;
  let saison: string;
  let regulier: string;
  let nouveau: string;

  /** Mois « AAAA-MM » décalé de n mois. */
  const decaler = (mois: string, n: number) => {
    const [a, m] = mois.split('-').map(Number);
    const d = new Date(Date.UTC(a, m - 1 + n, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  };

  const sql = (texte: string, params: unknown[] = []) =>
    harness.app.get(DatabaseService).transaction(systemTenantContext(orgId), (tx) => tx.query(texte, params));

  /** Vente faite aujourd'hui par l'API, puis datée dans le passé. */
  const venteDatee = async (produit: string, quantite: number, quand: string) => {
    const v = await harness.post('/sales', { lines: [{ productId: produit, quantity: quantite }], payments: [{ method: 'cash', amount: quantite * 2 }] }, pharmacie.token).expect(201);
    await sql('UPDATE sales SET sold_at = $2::timestamptz WHERE id = $1', [v.body.sale.id, quand]);
  };

  beforeAll(async () => {
    await harness.start();
    const superAdmin = await harness.loginPlatform('admin@novapharmaos.com');
    const slug = uniqueSlug('prev');
    await harness
      .post('/platform/organizations', {
        slug, legalName: `PHARMACIE ${slug.toUpperCase()}`, countryCode: 'CD', city: 'Goma',
        planCode: 'starter', startTrial: true,
        owner: { fullName: 'Gérant', email: `gerant@${slug}.cd`, password: PASSWORD },
      }, superAdmin.token)
      .expect(201);
    pharmacie = await harness.loginPharmacy(`gerant@${slug}.cd`, PASSWORD);
    orgId = (await harness.app.get(DatabaseService).readTransaction(SYSTEM_CONTEXT, (tx) =>
      tx.oneOrFail<{ id: string }>('SELECT id FROM organizations WHERE slug = $1', [slug]))).id;

    const creer = async (nom: string) => (await harness.post('/catalog/products', { name: nom, salePrice: 2 }, pharmacie.token).expect(201)).body.id as string;
    saison = await creer('Artéméther-Luméfantrine 20/120');
    regulier = await creer('Oméprazole 20 mg');
    nouveau = await creer('Zinc 20 mg');
    // Chaque produit dans sa catégorie : leur saison ne se mélange pas.
    for (const [produit, cat] of [[saison, 'ANTIPALU'], [regulier, 'DIGESTIF'], [nouveau, 'VITAMINES']]) {
      await sql(
        `WITH c AS (INSERT INTO product_categories (organization_id, code, name) VALUES ($1, $2, $2) RETURNING id)
         UPDATE products SET category_id = (SELECT id FROM c) WHERE id = $3`,
        [orgId, cat, produit],
      );
    }
    const recevoir = (produit: string, quantite: number) => harness
      .post('/inventory/receptions', { lines: [{ productId: produit, quantity: quantite, unitCost: 1, lotNumber: `L-${produit.slice(0, 6)}`, expiryDate: '2029-12-31' }] }, pharmacie.token)
      .expect(201);
    await recevoir(saison, 700);
    await recevoir(regulier, 1000);
    await recevoir(nouveau, 100);
    await harness.post('/cash/sessions', { openingFloat: 10 }, pharmacie.token).expect(201);

    // Mois visé par la prévision : celui du milieu de l'horizon (fuseau de Goma).
    const aujourdhui = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Lubumbashi' });
    const milieu = new Date(`${aujourdhui}T12:00:00Z`);
    milieu.setUTCDate(milieu.getUTCDate() + HORIZON / 2);
    const cible = milieu.toISOString().slice(0, 7);
    const courant = aujourdhui.slice(0, 7);

    // Historique : 30 boîtes par mois pendant 16 mois (le 15, il y a plus de 90 jours),
    // 90 boîtes l'an dernier au mois visé pour le produit saisonnier.
    for (let i = -16; i <= -4; i++) {
      const mois = decaler(courant, i);
      await venteDatee(saison, mois === decaler(cible, -12) ? 90 : 30, `${mois}-15T10:00:00Z`);
      await venteDatee(regulier, 30, `${mois}-15T10:00:00Z`);
    }
    // Rythme récent identique pour les deux : 30 boîtes il y a 10, 40 et 70 jours.
    for (const jours of [10, 40, 70]) {
      const quand = new Date(Date.now() - jours * 86_400_000).toISOString();
      await venteDatee(saison, 30, quand);
      await venteDatee(regulier, 30, quand);
    }
    // Produit récent : deux ventes seulement.
    await venteDatee(nouveau, 5, new Date(Date.now() - 20 * 86_400_000).toISOString());
    await venteDatee(nouveau, 5, new Date(Date.now() - 50 * 86_400_000).toISOString());
  }, 180_000);

  afterAll(async () => {
    await harness.stop();
  });

  it('prévoit plus pour le produit dont c’est la saison', async () => {
    const r = await harness.get(`/reports/forecast?horizon=${HORIZON}&coverDays=45&safetyPercent=20`, pharmacie.token).expect(200);
    expect(r.body).toMatchObject({ horizon: 30, coverDays: 45, safetyPercent: 20 });
    const s = r.body.products.find((x: { productId: string }) => x.productId === saison);
    const g = r.body.products.find((x: { productId: string }) => x.productId === regulier);
    // Même rythme récent : 30 dans les 30 derniers jours, 60 dans les 60 d'avant → 1 boîte par jour.
    expect(s.dailyRate).toBe(1);
    expect(g.dailyRate).toBe(1);
    expect(g.seasonalIndex).toBeCloseTo(1, 1);
    expect(g.forecast).toBeCloseTo(30, 0);
    expect(s.seasonalIndex).toBeGreaterThan(1.8);
    expect(s.forecast).toBeCloseTo(30 * s.seasonalIndex, 0);
    expect(s.confidence).toBe('bonne');
    expect(s.history).toHaveLength(12);
  });

  it('suggère la quantité à commander selon le stock et la couverture', async () => {
    const r = await harness.get(`/reports/forecast?horizon=${HORIZON}&coverDays=45&safetyPercent=20`, pharmacie.token).expect(200);
    for (const l of r.body.products) {
      const attendu = Math.max(0, Math.ceil((l.forecast / 30) * 45 * 1.2 - l.stock - l.onOrder));
      expect(Math.abs(l.suggestedOrder - attendu)).toBeLessThanOrEqual(1);
    }
    const g = r.body.products.find((x: { productId: string }) => x.productId === regulier);
    expect(g.stock).toBeGreaterThan(400);
    expect(g.suggestedOrder).toBe(0);
    const s = r.body.products.find((x: { productId: string }) => x.productId === saison);
    expect(s.suggestedOrder).toBeGreaterThan(0);
    // Le plus urgent (moins de jours couverts) vient en premier.
    expect(r.body.products[0].daysOfCover).toBeLessThanOrEqual(r.body.products[r.body.products.length - 1].daysOfCover ?? Infinity);
  });

  it('signale une prévision peu fiable pour un produit récent', async () => {
    const r = await harness.get('/reports/forecast', pharmacie.token).expect(200);
    const n = r.body.products.find((x: { productId: string }) => x.productId === nouveau);
    expect(n).toMatchObject({ confidence: 'faible', seasonalIndex: 1 });
    expect(r.body.seasons.map((x: { category: string }) => x.category)).toEqual(expect.arrayContaining(['ANTIPALU', 'DIGESTIF']));
  });

  it('exporte les prévisions en classeur Excel', async () => {
    const x = await harness.http().get('/api/reports/forecast/workbook')
      .set('Authorization', `Bearer ${pharmacie.token}`).buffer(true)
      .parse((res, fin) => { const m: Buffer[] = []; res.on('data', (c: Buffer) => m.push(c)); res.on('end', () => fin(null, Buffer.concat(m))); })
      .expect(200);
    expect(x.headers['content-type']).toContain('spreadsheetml');
    expect((x.body as Buffer).subarray(0, 2).toString()).toBe('PK');
  });
});
