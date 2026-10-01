import { Harness, Session, uniqueSlug } from './harness';

/**
 * Caisse hors connexion : catalogue gardé par le poste (prix, codes-barres,
 * lots vendables), ventes envoyées au retour du réseau avec leur heure
 * réelle, sans doublon même si l'envoi est répété.
 */
describe('Caisse hors connexion', () => {
  const harness = new Harness();
  const PASSWORD = 'Pharmacie2026!';
  let pharmacie: Session;
  let produit: string;

  beforeAll(async () => {
    await harness.start();
    const superAdmin = await harness.loginPlatform('admin@novapharmaos.com');
    const slug = uniqueSlug('horsligne');
    await harness
      .post('/platform/organizations', {
        slug, legalName: `PHARMACIE ${slug.toUpperCase()}`, countryCode: 'CD', city: 'Goma',
        planCode: 'starter', startTrial: true,
        owner: { fullName: 'Gérant', email: `gerant@${slug}.cd`, password: PASSWORD },
      }, superAdmin.token)
      .expect(201);
    pharmacie = await harness.loginPharmacy(`gerant@${slug}.cd`, PASSWORD);
    const p = await harness
      .post('/catalog/products', { name: 'Amoxicilline sirop', salePrice: 2.5, barcodes: ['6001234567899'] }, pharmacie.token)
      .expect(201);
    produit = p.body.id ?? p.body.product?.id;
    await harness
      .post('/inventory/receptions', {
        lines: [
          { productId: produit, quantity: 10, unitCost: 1, lotNumber: 'AMX-A', expiryDate: '2027-03-31' },
          { productId: produit, quantity: 5, unitCost: 1, lotNumber: 'AMX-B', expiryDate: '2028-06-30' },
        ],
      }, pharmacie.token)
      .expect(201);
    await harness.post('/cash/sessions', { openingFloat: 0 }, pharmacie.token).expect(201);
  }, 90_000);

  afterAll(async () => {
    await harness.stop();
  });

  it('donne au poste son catalogue : prix, codes-barres et lots vendables', async () => {
    const c = await harness.get('/sales/offline-catalog', pharmacie.token).expect(200);
    expect(c.body.currency).toBe('USD');
    expect(new Date(c.body.generatedAt).getTime()).toBeGreaterThan(Date.now() - 60_000);
    const p = c.body.products.find((x: { id: string }) => x.id === produit);
    expect(p).toMatchObject({ name: 'Amoxicilline sirop', sale_price: '2.5000', barcodes: ['6001234567899'] });
    expect(p.lots).toEqual([
      { e: '2027-03-31', q: 10 },
      { e: '2028-06-30', q: 5 },
    ]);
  });

  it('enregistre une vente faite pendant la coupure à son heure réelle, une seule fois', async () => {
    const heure = new Date(Date.now() - 2 * 3_600_000).toISOString();
    const corps = {
      lines: [{ productId: produit, quantity: 2, unitPrice: 2.5 }],
      payments: [{ method: 'cash', amount: 5 }],
      clientOperationId: `hl-test-${Date.now()}`,
      deviceId: 'poste-test',
      soldAt: heure,
    };
    const v = await harness.post('/sales', corps, pharmacie.token).expect(201);
    expect(new Date(v.body.sale.sold_at).toISOString()).toBe(heure);
    expect(v.body.duplicate).toBe(false);

    // Le poste renvoie la même vente (réponse perdue pendant la reconnexion).
    const rejeu = await harness.post('/sales', corps, pharmacie.token).expect(201);
    expect(rejeu.body.duplicate).toBe(true);
    expect(rejeu.body.sale.id).toBe(v.body.sale.id);

    const c = await harness.get('/sales/offline-catalog', pharmacie.token).expect(200);
    const p = c.body.products.find((x: { id: string }) => x.id === produit);
    expect(p.lots[0]).toEqual({ e: '2027-03-31', q: 8 });
  });

  it('refuse une heure de vente hors limites ou sans identifiant d’opération', async () => {
    const ligne = { lines: [{ productId: produit, quantity: 1 }], payments: [{ method: 'cash', amount: 2.5 }] };
    await harness.post('/sales', { ...ligne, soldAt: new Date().toISOString() }, pharmacie.token).expect(400);
    const vieille = await harness
      .post('/sales', { ...ligne, clientOperationId: `hl-v-${Date.now()}`, soldAt: new Date(Date.now() - 8 * 86_400_000).toISOString() }, pharmacie.token)
      .expect(409);
    expect(vieille.body.message).toContain('7 jours');
    await harness
      .post('/sales', { ...ligne, clientOperationId: `hl-f-${Date.now()}`, soldAt: new Date(Date.now() + 3_600_000).toISOString() }, pharmacie.token)
      .expect(409);
    await harness.post('/sales', { ...ligne, clientOperationId: 'x', soldAt: 'hier' }, pharmacie.token).expect(400);
  });
});
