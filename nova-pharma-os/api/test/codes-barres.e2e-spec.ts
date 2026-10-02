import { Harness, Session, uniqueSlug } from './harness';

/**
 * Codes-barres : contrôle du chiffre de contrôle, un code pour un seul
 * produit, ajout d'un code scanné, codes internes pour les produits qui
 * n'en ont pas, étiquettes, vente au scan.
 */
describe('Codes-barres et étiquettes', () => {
  const harness = new Harness();
  const PASSWORD = 'Pharmacie2026!';
  let pharmacie: Session;
  let sirop: string;
  let gants: string;
  let compresses: string;

  const creer = async (corps: Record<string, unknown>) => {
    const r = await harness.post('/catalog/products', corps, pharmacie.token).expect(201);
    return (r.body.id ?? r.body.product?.id) as string;
  };

  beforeAll(async () => {
    await harness.start();
    const superAdmin = await harness.loginPlatform('admin@novapharmaos.com');
    const slug = uniqueSlug('codes');
    await harness
      .post('/platform/organizations', {
        slug, legalName: `PHARMACIE ${slug.toUpperCase()}`, countryCode: 'CD', city: 'Goma',
        planCode: 'starter', startTrial: true,
        owner: { fullName: 'Gérant', email: `gerant@${slug}.cd`, password: PASSWORD },
      }, superAdmin.token)
      .expect(201);
    pharmacie = await harness.loginPharmacy(`gerant@${slug}.cd`, PASSWORD);
  }, 90_000);

  afterAll(async () => {
    await harness.stop();
  });

  it('contrôle le chiffre de contrôle et refuse un code déjà pris', async () => {
    sirop = await creer({ name: 'Sirop toux adulte', salePrice: 2.2, barcodes: ['6001234567899'] });
    const faute = await harness
      .post('/catalog/products', { name: 'Sirop toux enfant', salePrice: 2, barcodes: ['6001234567890'] }, pharmacie.token)
      .expect(409);
    expect(faute.body.message).toContain('contrôle');
    const pris = await harness
      .post('/catalog/products', { name: 'Autre sirop', salePrice: 2, barcodes: ['6001234567899'] }, pharmacie.token)
      .expect(409);
    expect(pris.body.message).toContain('Sirop toux adulte');
  });

  it('ajoute un code scanné à un produit et le retrouve au comptoir', async () => {
    gants = await creer({ name: 'Gants d’examen', salePrice: 0.1, hasExpiry: false });
    const ajout = await harness.post(`/catalog/products/${gants}/barcodes`, { barcode: ' 4006381333931 ' }, pharmacie.token).expect(201);
    expect(ajout.body).toMatchObject({ barcode: '4006381333931', kind: 'ean13', deja: false });
    const encore = await harness.post(`/catalog/products/${gants}/barcodes`, { barcode: '4006381333931' }, pharmacie.token).expect(201);
    expect(encore.body.deja).toBe(true);
    await harness.post(`/catalog/products/${sirop}/barcodes`, { barcode: '4006381333931' }, pharmacie.token).expect(409);
    await harness.post(`/catalog/products/${gants}/barcodes`, { barcode: '12' }, pharmacie.token).expect(409);

    const trouve = await harness.get('/catalog/products?q=4006381333931', pharmacie.token).expect(200);
    expect(trouve.body.data.map((p: { id: string }) => p.id)).toEqual([gants]);
  });

  it('donne un code interne aux produits sans code-barres, une seule fois', async () => {
    compresses = await creer({ name: 'Compresses stériles', salePrice: 0.5, hasExpiry: false });
    const r = await harness.post('/catalog/barcodes/internal', {}, pharmacie.token).expect(201);
    expect(r.body.created).toBe(1);
    const code = r.body.items[0].barcode as string;
    expect(r.body.items[0].productId).toBe(compresses);
    expect(code).toMatch(/^29\d{11}$/);
    // Le code interne est un EAN-13 valide : on peut l'ajouter ailleurs ? non, il est pris.
    await harness.post(`/catalog/products/${sirop}/barcodes`, { barcode: code }, pharmacie.token).expect(409);

    const encore = await harness.post('/catalog/barcodes/internal', {}, pharmacie.token).expect(201);
    expect(encore.body.created).toBe(0);
  });

  it('prépare les étiquettes et vend au scan', async () => {
    const e = await harness.get(`/catalog/labels?ids=${[sirop, gants, compresses].join(',')}`, pharmacie.token).expect(200);
    expect(e.body).toHaveLength(3);
    const parNom = Object.fromEntries(e.body.map((x: { name: string; barcode: string; kind: string }) => [x.name, x]));
    expect(parNom['Sirop toux adulte']).toMatchObject({ barcode: '6001234567899', kind: 'ean13' });
    expect(parNom['Compresses stériles'].kind).toBe('internal');

    await harness
      .post('/inventory/receptions', { lines: [{ productId: gants, quantity: 100, unitCost: 0.04 }] }, pharmacie.token)
      .expect(201);
    const v = await harness
      .post('/sales', { lines: [{ barcode: '4006381333931', quantity: 10 }], payments: [{ method: 'cash', amount: 1 }] }, pharmacie.token)
      .expect(201);
    expect(v.body.sale.total).toBe('1.00');
  });

  it('retire un code, le suivant devient principal', async () => {
    await harness.post(`/catalog/products/${gants}/barcodes`, { barcode: '96385074' }, pharmacie.token).expect(201);
    await harness.delete(`/catalog/products/${gants}/barcodes/4006381333931`, pharmacie.token).expect(200);
    const e = await harness.get(`/catalog/labels?ids=${gants}`, pharmacie.token).expect(200);
    expect(e.body[0]).toMatchObject({ barcode: '96385074', kind: 'ean8' });
  });
});
