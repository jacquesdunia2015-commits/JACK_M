import { Harness, Session, uniqueSlug } from './harness';

const PNG_1PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

/**
 * Fournisseurs de chaque produit, fournisseur de chaque achat, comparaison
 * des prix, réquisitions et leur PDF au logo de la pharmacie.
 */
describe('Réquisitions et fournisseurs des produits', () => {
  const harness = new Harness();
  const PASSWORD = 'Pharmacie2026!';
  let superAdmin: Session;
  let pharmacie: Session;
  let domaine: string;
  let amox: string;
  let shalom: string;
  let kampala: string;
  let requisition: string;

  const creerPharmacie = async () => {
    const slug = uniqueSlug('requi');
    await harness
      .post(
        '/platform/organizations',
        {
          slug, legalName: `PHARMACIE ${slug.toUpperCase()}`, countryCode: 'CD', city: 'Bukavu',
          planCode: 'starter', startTrial: true,
          owner: { fullName: 'Gérante', email: `gerant@${slug}.cd`, password: PASSWORD },
        },
        superAdmin.token,
      )
      .expect(201);
    return { session: await harness.loginPharmacy(`gerant@${slug}.cd`, PASSWORD), domaine: `${slug}.cd` };
  };

  const pdf = (chemin: string, token: string) =>
    harness
      .http()
      .get(`/api${chemin}`)
      .set('Authorization', `Bearer ${token}`)
      .buffer(true)
      .parse((res, fin) => {
        const morceaux: Buffer[] = [];
        res.on('data', (m: Buffer) => morceaux.push(m));
        res.on('end', () => fin(null, Buffer.concat(morceaux)));
      });

  beforeAll(async () => {
    await harness.start();
    superAdmin = await harness.loginPlatform('admin@novapharmaos.com');
    ({ session: pharmacie, domaine } = await creerPharmacie());

    amox = (await harness
      .post('/catalog/products', { name: 'Amoxicilline 500 mg', packaging: 'boîte de 100', salePrice: 0.5 }, pharmacie.token)
      .expect(201)).body.id;
    shalom = (await harness
      .post('/purchasing/suppliers', { name: 'Dépôt Shalom', phone: '0991000801', city: 'Bukavu' }, pharmacie.token)
      .expect(201)).body.id;
    kampala = (await harness
      .post('/purchasing/suppliers', { name: 'Kampala Pharma', phone: '0772000802', countryCode: 'UG' }, pharmacie.token)
      .expect(201)).body.id;
  }, 90_000);

  afterAll(async () => {
    await harness.stop();
  });

  it('enregistre les fournisseurs d’un médicament et compare leurs prix', async () => {
    await harness
      .post(`/purchasing/suppliers/${shalom}/products`, { productId: amox, price: 4.5, expiryDate: '2029-01-31' }, pharmacie.token)
      .expect(201);
    await harness
      .post(`/purchasing/suppliers/${kampala}/products`, { productId: amox, price: 3.9, minOrderQuantity: 20, expiryDate: '2028-06-30' }, pharmacie.token)
      .expect(201);

    const offres = await harness
      .get(`/purchasing/suppliers/price-comparison?productId=${amox}`, pharmacie.token)
      .expect(200);
    expect(offres.body.map((o: { supplier_name: string; is_cheapest: boolean }) => [o.supplier_name, o.is_cheapest]))
      .toEqual([['Kampala Pharma', true], ['Dépôt Shalom', false]]);
    expect(Number(offres.body[0].min_order_quantity)).toBe(20);

    await harness.get('/purchasing/suppliers/price-comparison', pharmacie.token).expect(400);
  });

  it('chaque achat mis en stock garde son fournisseur', async () => {
    await harness
      .post(
        '/inventory/receptions',
        { supplierId: shalom, lines: [{ productId: amox, lotNumber: 'A1', expiryDate: '2029-01-31', quantity: 40, unitCost: 4.5 }] },
        pharmacie.token,
      )
      .expect(201);
    const stock = await harness.get('/inventory/stock?search=AMOXICILLINE', pharmacie.token).expect(200);
    expect(stock.body[0].last_supplier_name).toBe('Dépôt Shalom');
    const fiche = await harness.get(`/inventory/products/${amox}/history`, pharmacie.token).expect(200);
    expect(fiche.body.movements[0]).toMatchObject({ kind: 'reception', supplier_name: 'Dépôt Shalom' });
  });

  it('crée une réquisition en choisissant le fournisseur de chaque produit', async () => {
    const res = await harness
      .post(
        '/purchasing/requisitions',
        {
          neededBy: '2026-12-15',
          notes: 'Livraison le matin.',
          lines: [
            { productId: amox, quantity: 50, supplierId: kampala },
            { productName: 'Gants d’examen', presentation: 'boîte de 100', quantity: 10, supplierId: shalom, unitPrice: 7 },
            { productName: 'Coton hydrophile', quantity: 5 },
          ],
        },
        pharmacie.token,
      )
      .expect(201);
    requisition = res.body.id;
    expect(res.body.number).toMatch(/^RQ-\d{4}-00001$/);
    expect(res.body.status).toBe('brouillon');
    const ligneAmox = res.body.lines.find((l: { product_name: string }) => l.product_name === 'Amoxicilline 500 mg');
    // Le prix vient du catalogue du fournisseur choisi.
    expect(Number(ligneAmox.unit_price)).toBe(3.9);
    expect(ligneAmox.presentation).toBe('boîte de 100');

    const liste = await harness.get('/purchasing/requisitions', pharmacie.token).expect(200);
    expect(liste.body[0]).toMatchObject({ lines: '3', suppliers: '2' });
    expect(Number(liste.body[0].estimated_total)).toBeCloseTo(50 * 3.9 + 70);

    await harness
      .post('/purchasing/requisitions', { lines: [{ productName: 'X', quantity: 0 }] }, pharmacie.token)
      .expect(400);
  });

  it('produit le PDF : un fournisseur par page, au logo de la pharmacie', async () => {
    // Un faux PNG est refusé, un vrai accepté.
    await harness.http().put('/api/admin/logo').set('Authorization', `Bearer ${pharmacie.token}`)
      .send({ dataUrl: 'data:image/png;base64,' + Buffer.from('pas une image').toString('base64') })
      .expect(400);
    await harness.http().put('/api/admin/logo').set('Authorization', `Bearer ${pharmacie.token}`)
      .send({ dataUrl: PNG_1PX })
      .expect(200);

    const complet = await pdf(`/purchasing/requisitions/${requisition}/pdf`, pharmacie.token).expect(200);
    expect(complet.headers['content-type']).toContain('application/pdf');
    const contenu = (complet.body as Buffer).toString('latin1');
    expect(contenu.startsWith('%PDF')).toBe(true);
    expect((contenu.match(/\/Type \/Page\b/g) ?? []).length).toBe(3);
    expect(contenu).toContain('/Subtype /Image');

    const kampalaSeul = await pdf(`/purchasing/requisitions/${requisition}/pdf?supplierId=${kampala}`, pharmacie.token)
      .expect(200);
    expect(((kampalaSeul.body as Buffer).toString('latin1').match(/\/Type \/Page\b/g) ?? []).length).toBe(1);
    expect(kampalaSeul.headers['content-disposition']).toContain('Kampala-Pharma');

    const inconnu = '00000000-0000-4000-8000-000000000000';
    await pdf(`/purchasing/requisitions/${requisition}/pdf?supplierId=${inconnu}`, pharmacie.token).expect(400);
  });

  it('suit le statut : brouillon, envoyée, reçue', async () => {
    await harness.patch(`/purchasing/requisitions/${requisition}`, { status: 'recue' }, pharmacie.token).expect(409);
    const envoyee = await harness
      .patch(`/purchasing/requisitions/${requisition}`, { status: 'envoyee' }, pharmacie.token)
      .expect(200);
    expect(envoyee.body.sent_at).toBeTruthy();
    await harness
      .patch(`/purchasing/requisitions/${requisition}`, { lines: [{ productName: 'Autre', quantity: 1 }] }, pharmacie.token)
      .expect(409);
    await harness.patch(`/purchasing/requisitions/${requisition}`, { status: 'recue' }, pharmacie.token).expect(200);
    await harness.patch(`/purchasing/requisitions/${requisition}`, { status: 'brouillon' }, pharmacie.token).expect(409);
  });

  it('cloisonnement : un vendeur ne voit rien, une autre pharmacie non plus', async () => {
    await harness
      .post(
        '/admin/users',
        { fullName: 'Vendeur', phone: '0990000803', email: `vendeur@${domaine}`, password: 'Vendeur2026!', roleCodes: ['vendeur'] },
        pharmacie.token,
      )
      .expect(201);
    const vendeur = await harness.loginPharmacy(`vendeur@${domaine}`, 'Vendeur2026!');
    await harness.get('/purchasing/requisitions', vendeur.token).expect(403);

    const { session: autre } = await creerPharmacie();
    await harness.get(`/purchasing/requisitions/${requisition}`, autre.token).expect(404);
    await pdf(`/purchasing/requisitions/${requisition}/pdf`, autre.token).expect(404);
  });
});
