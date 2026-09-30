import { Harness, Session, uniqueSlug } from './harness';

/**
 * Répertoire des fournisseurs : fiche (dépôt, téléphone, e-mail, pays,
 * ville), catalogue et prix de chaque dépôt, comparaison des prix.
 */
describe('Fournisseurs', () => {
  const harness = new Harness();
  const PASSWORD = 'Pharmacie2026!';
  let superAdmin: Session;

  const creerPharmacie = async (planCode: string) => {
    const slug = uniqueSlug('fourn');
    const email = `gerant@${slug}.cd`;
    await harness
      .post(
        '/platform/organizations',
        {
          slug, legalName: `OFFICINE ${slug.toUpperCase()}`, countryCode: 'CD', city: 'Bukavu',
          planCode, startTrial: true, owner: { fullName: 'Gérant', email, password: PASSWORD },
        },
        superAdmin.token,
      )
      .expect(201);
    return { session: await harness.loginPharmacy(email, PASSWORD), domaine: `${slug}.cd` };
  };

  let pharmacie: Session;
  let domaine: string;
  let shalom: string;
  let kampala: string;

  beforeAll(async () => {
    await harness.start();
    superAdmin = await harness.loginPlatform('admin@novapharmaos.com');
    // Forfait Starter : le répertoire des fournisseurs doit y être.
    ({ session: pharmacie, domaine } = await creerPharmacie('starter'));
  }, 90_000);

  afterAll(async () => {
    await harness.stop();
  });

  it('enregistre un dépôt : nom, téléphone, e-mail, pays, ville', async () => {
    const res = await harness
      .post(
        '/purchasing/suppliers',
        {
          name: 'Dépôt pharmaceutique Shalom',
          phone: '0991 234 567',
          email: 'Commandes@Shalom.cd',
          countryCode: 'cd',
          city: 'Bukavu',
          address: 'Avenue Kasongo 12',
        },
        pharmacie.token,
      )
      .expect(201);
    expect(res.body).toMatchObject({
      name: 'Dépôt pharmaceutique Shalom',
      phone: '+243991234567',
      email: 'commandes@shalom.cd',
      country_code: 'CD',
      city: 'Bukavu',
      code: 'DEPOT-PHARMACEUTIQUE-SHA',
    });
    shalom = res.body.id;
  });

  it("un numéro national prend l'indicatif du pays du dépôt", async () => {
    const res = await harness
      .post(
        '/purchasing/suppliers',
        { name: 'Kampala Pharma Distributors', phone: '0772 123 456', countryCode: 'UG', city: 'Kampala' },
        pharmacie.token,
      )
      .expect(201);
    expect(res.body.phone).toBe('+256772123456');
    kampala = res.body.id;
  });

  it('refuse une fiche sans téléphone, un e-mail invalide, un numéro déjà pris', async () => {
    await harness.post('/purchasing/suppliers', { name: 'Sans numéro' }, pharmacie.token).expect(400);
    await harness
      .post('/purchasing/suppliers', { name: 'Mauvais e-mail', phone: '0991000001', email: 'pas-un-mail' }, pharmacie.token)
      .expect(400);
    const doublon = await harness
      .post('/purchasing/suppliers', { name: 'Shalom bis', phone: '+243 991 234 567' }, pharmacie.token)
      .expect(409);
    expect(doublon.body.message).toContain('Dépôt pharmaceutique Shalom');
  });

  it('tient le catalogue et les prix de chaque dépôt', async () => {
    await harness
      .post(
        `/purchasing/suppliers/${shalom}/products`,
        { productName: 'Amoxicilline 500 mg', presentation: 'Gélules, boîte de 100', price: 4.5 },
        pharmacie.token,
      )
      .expect(201);
    await harness
      .post(
        `/purchasing/suppliers/${shalom}/products`,
        { productName: 'amoxicilline 500 MG', presentation: 'gélules, boîte de 100', price: 4 },
        pharmacie.token,
      )
      .expect(409);
    await harness
      .post(`/purchasing/suppliers/${shalom}/products`, { price: 2 }, pharmacie.token)
      .expect(400);

    // Un produit déjà au catalogue de la pharmacie : un seul prix par dépôt.
    await harness
      .post(
        '/catalog/products/import',
        { products: [{ sku: 'PARA500', name: 'Paracétamol 500 mg', salePrice: 1.5, costPrice: 0.8, hasExpiry: false, isBatchTracked: false }] },
        pharmacie.token,
      )
      .expect(201);
    const catalogue = await harness.get('/catalog/products', pharmacie.token).expect(200);
    const para = catalogue.body.data.find((p: { sku: string }) => p.sku === 'PARA500').id;
    await harness
      .post(`/purchasing/suppliers/${shalom}/products`, { productId: para, price: 0.9 }, pharmacie.token)
      .expect(201);
    await harness
      .post(`/purchasing/suppliers/${shalom}/products`, { productId: para, price: 0.85 }, pharmacie.token)
      .expect(201);

    const fiche = await harness.get(`/purchasing/suppliers/${shalom}`, pharmacie.token).expect(200);
    expect(fiche.body.products).toHaveLength(2);
    const ligne = fiche.body.products.find((p: { sku: string }) => p.sku === 'PARA500');
    expect(Number(ligne.price)).toBe(0.85);
    expect(ligne.currency).toBe('USD');
  });

  it('compare les prix entre dépôts et signale le moins cher disponible', async () => {
    const offre = await harness
      .post(
        `/purchasing/suppliers/${kampala}/products`,
        { productName: 'Amoxicilline 500 mg', presentation: 'Gélules, boîte de 100', price: 3.9, currency: 'USD' },
        pharmacie.token,
      )
      .expect(201);

    let res = await harness
      .get('/purchasing/suppliers/price-comparison?search=amoxi', pharmacie.token)
      .expect(200);
    expect(res.body.map((o: { supplier_name: string }) => o.supplier_name)).toEqual([
      'Kampala Pharma Distributors',
      'Dépôt pharmaceutique Shalom',
    ]);
    expect(res.body.map((o: { is_cheapest: boolean }) => o.is_cheapest)).toEqual([true, false]);

    // En rupture chez Kampala : Shalom devient l'offre à retenir.
    const maj = await harness
      .patch(`/purchasing/suppliers/${kampala}/products/${offre.body.id}`, { isAvailable: false }, pharmacie.token)
      .expect(200);
    expect(maj.body.is_available).toBe(false);
    res = await harness.get('/purchasing/suppliers/price-comparison?search=amoxi', pharmacie.token).expect(200);
    const parDepot = Object.fromEntries(
      res.body.map((o: { supplier_name: string; is_cheapest: boolean }) => [o.supplier_name, o.is_cheapest]),
    );
    expect(parDepot).toEqual({ 'Dépôt pharmaceutique Shalom': true, 'Kampala Pharma Distributors': false });

    await harness.get('/purchasing/suppliers/price-comparison?search=a', pharmacie.token).expect(400);
  });

  it('un changement de prix est daté ; un dépôt désactivé sort de la comparaison', async () => {
    const fiche = await harness.get(`/purchasing/suppliers/${shalom}`, pharmacie.token).expect(200);
    const amoxi = fiche.body.products.find((p: { name: string }) => p.name === 'Amoxicilline 500 mg');
    const maj = await harness
      .patch(`/purchasing/suppliers/${shalom}/products/${amoxi.id}`, { price: 4.2 }, pharmacie.token)
      .expect(200);
    expect(new Date(maj.body.price_updated_at).getTime())
      .toBeGreaterThan(new Date(amoxi.price_updated_at).getTime());

    await harness.patch(`/purchasing/suppliers/${shalom}`, { isActive: false }, pharmacie.token).expect(200);
    const res = await harness.get('/purchasing/suppliers/price-comparison?search=amoxi', pharmacie.token).expect(200);
    expect(res.body.every((o: { supplier_name: string }) => o.supplier_name !== 'Dépôt pharmaceutique Shalom')).toBe(true);
    await harness.patch(`/purchasing/suppliers/${shalom}`, { isActive: true, city: 'Goma' }, pharmacie.token).expect(200);

    await harness
      .delete(`/purchasing/suppliers/${shalom}/products/${amoxi.id}`, pharmacie.token)
      .expect(200);
  });

  it('Starter : fournisseurs oui, commandes non ; un vendeur ne voit pas les fournisseurs', async () => {
    // Module hors forfait : 402, l'invitation à changer de forfait.
    await harness.get('/purchasing/orders', pharmacie.token).expect(402);

    await harness
      .post(
        '/admin/users',
        { fullName: 'Vendeur', phone: '0990000500', email: `vendeur@${domaine}`, password: 'Vendeur2026!', roleCodes: ['vendeur'] },
        pharmacie.token,
      )
      .expect(201);
    const vendeur = await harness.loginPharmacy(`vendeur@${domaine}`, 'Vendeur2026!');
    await harness.get('/purchasing/suppliers', vendeur.token).expect(403);
  });

  it("une autre pharmacie ne voit pas ces fournisseurs", async () => {
    const { session: autre } = await creerPharmacie('starter');
    const liste = await harness.get('/purchasing/suppliers', autre.token).expect(200);
    expect(liste.body).toHaveLength(0);
    await harness.get(`/purchasing/suppliers/${shalom}`, autre.token).expect(404);
  });

  it('une réception met à jour le prix du fournisseur', async () => {
    const { session: pro } = await creerPharmacie('professional');
    const fournisseur = await harness
      .post('/purchasing/suppliers', { name: 'Dépôt Espoir', phone: '0991000777' }, pro.token)
      .expect(201);
    await harness
      .post(
        '/catalog/products/import',
        { products: [{ sku: 'SRO', name: 'Sels de réhydratation', salePrice: 0.5, costPrice: 0.2, hasExpiry: false, isBatchTracked: false }] },
        pro.token,
      )
      .expect(201);
    const catalogue = await harness.get('/catalog/products', pro.token).expect(200);
    const sro = catalogue.body.data[0].id;
    await harness
      .post(
        '/purchasing/receipts',
        { supplierId: fournisseur.body.id, lines: [{ productId: sro, quantity: 50, unitCost: 0.27 }] },
        pro.token,
      )
      .expect(201);
    const fiche = await harness.get(`/purchasing/suppliers/${fournisseur.body.id}`, pro.token).expect(200);
    expect(fiche.body.products).toHaveLength(1);
    expect(Number(fiche.body.products[0].price)).toBe(0.27);
    expect(fiche.body.products[0].is_available).toBe(true);
  });
});
