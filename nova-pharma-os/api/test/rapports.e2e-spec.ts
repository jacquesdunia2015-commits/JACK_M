import { inflateRawSync } from 'zlib';
import { Harness, Session, uniqueSlug } from './harness';

/** Lit les fichiers d'un .xlsx (zip) : nom → contenu texte. */
function lireXlsx(zip: Buffer): Map<string, string> {
  const fichiers = new Map<string, string>();
  let i = 0;
  while (zip.readUInt32LE(i) === 0x04034b50) {
    const methode = zip.readUInt16LE(i + 8);
    const taille = zip.readUInt32LE(i + 18);
    const longNom = zip.readUInt16LE(i + 26);
    const longExtra = zip.readUInt16LE(i + 28);
    const nom = zip.toString('utf8', i + 30, i + 30 + longNom);
    const debut = i + 30 + longNom + longExtra;
    const donnees = zip.subarray(debut, debut + taille);
    fichiers.set(nom, (methode === 8 ? inflateRawSync(donnees) : donnees).toString('utf8'));
    i = debut + taille;
  }
  return fichiers;
}

/**
 * Rapports : synthèse d'une période, ventes regroupées, encaissements par
 * moyen et par devise, pertes par péremption, classeur Excel.
 */
describe('Rapports et export Excel', () => {
  const harness = new Harness();
  const PASSWORD = 'Pharmacie2026!';
  let pharmacie: Session;
  let ibu: string;
  let sro: string;
  const aujourdhui = () => new Date(Date.now() + 2 * 3_600_000).toISOString().slice(0, 10); // Goma, UTC+2

  beforeAll(async () => {
    await harness.start();
    const superAdmin = await harness.loginPlatform('admin@novapharmaos.com');
    const slug = uniqueSlug('rapports');
    await harness
      .post('/platform/organizations', {
        slug, legalName: `PHARMACIE ${slug.toUpperCase()}`, countryCode: 'CD', city: 'Goma',
        planCode: 'starter', startTrial: true,
        owner: { fullName: 'Gérante', email: `gerant@${slug}.cd`, password: PASSWORD },
      }, superAdmin.token)
      .expect(201);
    pharmacie = await harness.loginPharmacy(`gerant@${slug}.cd`, PASSWORD);
    const creer = async (corps: Record<string, unknown>) => {
      const r = await harness.post('/catalog/products', corps, pharmacie.token).expect(201);
      return (r.body.id ?? r.body.product?.id) as string;
    };
    ibu = await creer({ name: 'Ibuprofène 400 mg', salePrice: 2, costPrice: 1 });
    sro = await creer({ name: 'SRO sachet', salePrice: 0.5, costPrice: 0.2 });
    const bientot = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10);
    await harness.post('/inventory/receptions', {
      lines: [
        { productId: ibu, quantity: 50, unitCost: 1, lotNumber: 'IBU-R', expiryDate: '2028-12-31' },
        { productId: sro, quantity: 30, unitCost: 0.2, lotNumber: 'SRO-R', expiryDate: bientot },
      ],
    }, pharmacie.token).expect(201);
    await harness.post('/cash/rates', { baseCurrency: 'USD', quoteCurrency: 'CDF', rate: 2800, changeRounding: 100 }, pharmacie.token).expect(201);
    await harness.post('/cash/sessions', { openingFloat: 0 }, pharmacie.token).expect(201);
    // Ventes : 3 ibuprofènes en dollars, 4 SRO payés en francs, une vente annulée.
    await harness.post('/sales', { lines: [{ productId: ibu, quantity: 3 }], payments: [{ method: 'cash', amount: 6 }] }, pharmacie.token).expect(201);
    await harness.post('/sales', { lines: [{ productId: sro, quantity: 4 }], payments: [{ method: 'cash', amount: 5600, currency: 'CDF' }] }, pharmacie.token).expect(201);
    const annulee = await harness.post('/sales', { lines: [{ productId: ibu, quantity: 1 }], payments: [{ method: 'mobile_money', amount: 2, reference: 'MP-RAP-1' }] }, pharmacie.token).expect(201);
    await harness.post(`/sales/${annulee.body.sale.id}/cancel`, { reason: 'Erreur de produit' }, pharmacie.token).expect(201);
    // Deux SRO abîmés retirés comme périmés.
    await harness.post('/inventory/adjustments', { productId: sro, quantity: 2, reason: 'Sachets gonflés', kind: 'expiry_write_off' }, pharmacie.token).expect(201);
  }, 90_000);

  afterAll(async () => {
    await harness.stop();
  });

  it('résume la période : chiffre d’affaires, marge, panier, annulations', async () => {
    const s = await harness.get(`/reports/summary?from=${aujourdhui()}&to=${aujourdhui()}`, pharmacie.token).expect(200);
    // TVA de 16 % comprise dans les prix : 8 $ TTC, 1,11 $ de taxes, marge hors taxes 3,09 $.
    expect(s.body).toMatchObject({ sales: 2, revenue: 8, tax: 1.11, cost: 3.8, margin: 3.09, averageBasket: 4, currency: 'USD' });
    expect(s.body.marginPercent).toBeCloseTo((100 * 3.09) / 6.89, 1);
    expect(s.body.cancelled).toEqual({ count: 1, total: 2 });
    const vide = await harness.get('/reports/summary?from=2020-01-01&to=2020-01-31', pharmacie.token).expect(200);
    expect(vide.body).toMatchObject({ sales: 0, revenue: 0, marginPercent: 0 });
    await harness.get('/reports/summary?from=hier', pharmacie.token).expect(409);
  });

  it('regroupe les ventes par jour et par produit', async () => {
    const j = await harness.get(`/reports/sales?groupBy=day&from=${aujourdhui()}&to=${aujourdhui()}`, pharmacie.token).expect(200);
    expect(j.body).toHaveLength(1);
    expect(j.body[0]).toMatchObject({ dimension: aujourdhui(), sales: '2' });
    const p = await harness.get(`/reports/sales?groupBy=product&from=${aujourdhui()}`, pharmacie.token).expect(200);
    expect(p.body.map((l: { dimension: string }) => l.dimension)).toEqual(['Ibuprofène 400 mg', 'SRO sachet']);
    // Ibuprofène : 6 $ TTC, 5,17 $ HT, coût 3 $ → 2,17 $ de marge, soit 42 % du hors taxes.
    expect(Number(p.body[0].margin)).toBeCloseTo(2.17, 2);
    expect(Number(p.body[0].margin_percent)).toBeCloseTo(41.97, 1);
  });

  it('détaille les encaissements par moyen et par devise remise', async () => {
    const r = await harness.get(`/reports/payments?from=${aujourdhui()}`, pharmacie.token).expect(200);
    const francs = r.body.find((l: { currency: string }) => l.currency === 'CDF');
    expect(francs).toMatchObject({ method: 'cash', payments: '1', tendered: '5600.00', amount: '2.00' });
    // La vente annulée n'apparaît pas.
    expect(r.body.find((l: { method: string }) => l.method === 'mobile_money')).toBeUndefined();
  });

  it('chiffre les pertes par péremption et le stock à risque', async () => {
    const r = await harness.get(`/reports/expiry?from=${aujourdhui()}`, pharmacie.token).expect(200);
    expect(r.body.writtenOffValue).toBe(0.4);
    expect(r.body.writtenOff[0]).toMatchObject({ name: 'SRO sachet', quantity: '2.000', reason: 'Sachets gonflés' });
    // 30 − 4 vendus − 2 retirés = 24 sachets à 0,20 qui périment dans 20 jours.
    expect(r.body.expiring30Value).toBe(4.8);
    expect(r.body.atRisk[0]).toMatchObject({ name: 'SRO sachet', lot_number: 'SRO-R' });
  });

  it('exporte tous les rapports dans un classeur Excel', async () => {
    const r = await harness.http().get(`/api/reports/workbook?from=${aujourdhui()}&to=${aujourdhui()}`)
      .set('Authorization', `Bearer ${pharmacie.token}`).buffer(true)
      .parse((res, fin) => { const m: Buffer[] = []; res.on('data', (c: Buffer) => m.push(c)); res.on('end', () => fin(null, Buffer.concat(m))); })
      .expect(200);
    expect(r.headers['content-type']).toContain('spreadsheetml.sheet');
    expect(r.headers['content-disposition']).toContain(`rapports-${aujourdhui()}_${aujourdhui()}.xlsx`);
    const fichiers = lireXlsx(r.body as Buffer);
    expect([...fichiers.keys()]).toEqual(expect.arrayContaining(['[Content_Types].xml', 'xl/workbook.xml', 'xl/styles.xml', 'xl/worksheets/sheet11.xml']));
    const classeur = fichiers.get('xl/workbook.xml') as string;
    for (const nom of ['Synthèse', 'Ventes par jour', 'Par produit', 'Paiements', 'Valeur du stock', 'Ne se vendent pas', 'Péremptions']) {
      expect(classeur).toContain(`name="${nom}"`);
    }
    const synthese = fichiers.get('xl/worksheets/sheet1.xml') as string;
    expect(synthese).toContain('Chiffre d’affaires');
    expect(synthese).toMatch(/<c r="B\d+" s="2"><v>8<\/v><\/c>/);
    const produits = fichiers.get('xl/worksheets/sheet3.xml') as string;
    expect(produits).toContain('Ibuprofène 400 mg');
    expect(produits).toContain('<autoFilter');
  });
});
