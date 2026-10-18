import { Harness, Session, uniqueSlug } from './harness';

/**
 * Ajouter un produit, enregistrer ce qu'on achète et ce qu'on vend, et
 * retrouver ces quantités — dans tous les forfaits, Starter compris.
 */
describe('Saisie du stock', () => {
  const harness = new Harness();
  const PASSWORD = 'Pharmacie2026!';
  let pharmacie: Session;
  let domaine: string;
  let para: string;

  beforeAll(async () => {
    await harness.start();
    const superAdmin = await harness.loginPlatform('admin@novapharmaos.com');
    const slug = uniqueSlug('saisie');
    domaine = `${slug}.cd`;
    await harness
      .post(
        '/platform/organizations',
        {
          slug, legalName: `OFFICINE ${slug.toUpperCase()}`, countryCode: 'CD', city: 'Bukavu',
          planCode: 'starter', startTrial: true,
          owner: { fullName: 'Gérant', email: `gerant@${domaine}`, password: PASSWORD },
        },
        superAdmin.token,
      )
      .expect(201);
    pharmacie = await harness.loginPharmacy(`gerant@${domaine}`, PASSWORD);
  }, 90_000);

  afterAll(async () => {
    await harness.stop();
  });

  it('ajoute un produit sans référence : elle est tirée du nom', async () => {
    const res = await harness
      .post('/catalog/products', { name: 'Paracétamol 500 mg', salePrice: 0.1, costPrice: 0.05 }, pharmacie.token)
      .expect(201);
    expect(res.body.sku).toBe('PARACETAMOL-500-MG');
    para = res.body.id;

    const second = await harness
      .post('/catalog/products', { name: 'Paracétamol 500 mg', salePrice: 0.12 }, pharmacie.token)
      .expect(201);
    expect(second.body.sku).toBe('PARACETAMOL-500-MG-2');
  });

  it('enregistre un achat, même sans fournisseur ni module d’achats', async () => {
    // Produit périssable : la date de péremption est exigée.
    await harness
      .post('/inventory/receptions', { lines: [{ productId: para, quantity: 100, unitCost: 0.05 }] }, pharmacie.token)
      .expect(409);

    const achat = await harness
      .post(
        '/inventory/receptions',
        {
          idempotencyKey: 'achat-1',
          lines: [{ productId: para, lotNumber: 'L-2026-01', expiryDate: '2028-06-30', quantity: 100, unitCost: 0.05 }],
        },
        pharmacie.token,
      )
      .expect(201);
    expect(achat.body.receipt.status).toBe('validated');
    expect(achat.body.receipt.supplier_name).toContain('Achats divers');

    // Un double clic ne compte pas l'achat deux fois.
    const doublon = await harness
      .post(
        '/inventory/receptions',
        {
          idempotencyKey: 'achat-1',
          lines: [{ productId: para, lotNumber: 'L-2026-01', expiryDate: '2028-06-30', quantity: 100, unitCost: 0.05 }],
        },
        pharmacie.token,
      )
      .expect(201);
    expect(doublon.body.duplicate).toBe(true);

    const fournisseurs = await harness.get('/purchasing/suppliers', pharmacie.token).expect(200);
    expect(fournisseurs.body.map((f: { code: string }) => f.code)).toContain('DIVERS');

    // Les commandes, elles, restent réservées au module d'achats.
    await harness.get('/purchasing/orders', pharmacie.token).expect(402);
  });

  it('les quantités achetées et vendues apparaissent dans le stock', async () => {
    await harness
      .post(
        '/sales',
        { lines: [{ productId: para, quantity: 30 }], payments: [{ method: 'cash', amount: 3 }] },
        pharmacie.token,
      )
      .expect(201);

    const stock = await harness.get('/inventory/stock?search=PARACETAMOL-500-MG', pharmacie.token).expect(200);
    const ligne = stock.body.find((l: { product_id: string }) => l.product_id === para);
    expect(Number(ligne.on_hand)).toBe(70);
    expect(Number(ligne.purchases_last_30_days)).toBe(100);
    expect(Number(ligne.sales_last_30_days)).toBe(30);

    const fiche = await harness.get(`/inventory/products/${para}/history`, pharmacie.token).expect(200);
    expect(fiche.body.name).toBe('Paracétamol 500 mg');
    expect(fiche.body.totals).toMatchObject({ purchased: '100.000', sold: '30.000', on_hand: '70.000' });
    expect(fiche.body.movements.map((m: { kind: string }) => m.kind)).toEqual(['sale', 'reception']);
  });

  it('un vendeur ne peut pas enregistrer d’achat', async () => {
    await harness
      .post(
        '/admin/users',
        { fullName: 'Vendeur', phone: '0990000700', email: `vendeur@${domaine}`, password: 'Vendeur2026!', roleCodes: ['vendeur'] },
        pharmacie.token,
      )
      .expect(201);
    const vendeur = await harness.loginPharmacy(`vendeur@${domaine}`, 'Vendeur2026!');
    await harness
      .post(
        '/inventory/receptions',
        { lines: [{ productId: para, lotNumber: 'X', expiryDate: '2028-01-01', quantity: 5, unitCost: 0.05 }] },
        vendeur.token,
      )
      .expect(403);
  });
});
