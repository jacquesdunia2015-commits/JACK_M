import { Harness, Session, uniqueSlug } from './harness';

const PNG_1PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

/**
 * Catalogue de référence Goma–Bukavu et factures des clients : émission
 * depuis une vente, client nommé sur le moment, PDF au logo de la pharmacie.
 */
describe('Catalogue de référence et factures clients', () => {
  const harness = new Harness();
  const PASSWORD = 'Pharmacie2026!';
  let superAdmin: Session;
  let pharmacie: Session;
  let domaine: string;

  const creerPharmacie = async (currency?: string) => {
    const slug = uniqueSlug('facture');
    await harness
      .post(
        '/platform/organizations',
        {
          slug, legalName: `PHARMACIE ${slug.toUpperCase()}`, countryCode: 'CD', city: 'Goma',
          planCode: 'starter', startTrial: true, ...(currency ? { currency } : {}),
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

  const vendre = async (token: string, lignes: { productId: string; quantity: number }[], payments: unknown[]) =>
    (await harness.post('/sales', { lines: lignes, payments }, token).expect(201)).body;

  beforeAll(async () => {
    await harness.start();
    superAdmin = await harness.loginPlatform('admin@novapharmaos.com');
    ({ session: pharmacie, domaine } = await creerPharmacie());
  }, 90_000);

  afterAll(async () => {
    await harness.stop();
  });

  it('propose 100 produits de référence et les reprend au catalogue', async () => {
    const ref = await harness.get('/catalog/reference', pharmacie.token).expect(200);
    expect(ref.body.items).toHaveLength(100);
    expect(ref.body.currency).toBe('USD');
    expect(ref.body.items.every((p: { inCatalog: boolean }) => !p.inCatalog)).toBe(true);

    // Un produit déjà saisi sous le même nom n'est pas dupliqué.
    await harness.post('/catalog/products', { name: 'Paracétamol 500 mg', salePrice: 0.25 }, pharmacie.token).expect(201);

    const tous = ref.body.items.map((p: { code: string }) => ({ code: p.code }));
    const reprise = await harness
      .post('/catalog/reference/import', { items: [...tous, { code: 'KV-AMOX-500', salePrice: 0.6 }] }, pharmacie.token)
      .expect(201);
    expect(reprise.body.created).toBe(99);
    expect(reprise.body.skipped).toEqual(['KV-PARA-500']);

    const amox = await harness.get('/catalog/products?q=KV-AMOX-500', pharmacie.token).expect(200);
    expect(amox.body.data[0]).toMatchObject({
      name: 'Amoxicilline 500 mg', category_name: 'Antibiotiques', requires_prescription: true, inn: 'Amoxicilline',
    });
    // Un code demandé deux fois est repris une seule fois, au dernier prix donné.
    expect(Number(amox.body.data[0].sale_price)).toBe(0.6);
    const alu = await harness.get('/catalog/products?q=KV-ALU-24', pharmacie.token).expect(200);
    expect(Number(alu.body.data[0].sale_price)).toBe(2);
    expect(Number(alu.body.data[0].cost_price)).toBe(1.2);

    const coton = await harness.get('/catalog/products?q=KV-COTON', pharmacie.token).expect(200);
    expect(coton.body.data[0]).toMatchObject({ has_expiry: false, is_batch_tracked: false });

    const apres = await harness.get('/catalog/reference', pharmacie.token).expect(200);
    expect(apres.body.items.every((p: { inCatalog: boolean }) => p.inCatalog)).toBe(true);

    // Rejouer l'import ne crée rien de plus.
    const rejeu = await harness.post('/catalog/reference/import', { items: tous }, pharmacie.token).expect(201);
    expect(rejeu.body.created).toBe(0);

    await harness.post('/catalog/reference/import', { items: [{ code: 'INCONNU' }] }, pharmacie.token).expect(400);
    await harness.post('/catalog/reference/import', { items: [] }, pharmacie.token).expect(400);
  });

  it('hors dollar, les prix de la pharmacie sont exigés', async () => {
    const { session: francs } = await creerPharmacie('CDF');
    const ref = await harness.get('/catalog/reference', francs.token).expect(200);
    expect(ref.body.currency).toBe('CDF');
    await harness.post('/catalog/reference/import', { items: [{ code: 'KV-SRO' }] }, francs.token).expect(400);
    const ok = await harness
      .post('/catalog/reference/import', { items: [{ code: 'KV-SRO', salePrice: 500 }] }, francs.token)
      .expect(201);
    expect(ok.body.created).toBe(1);
    const sro = await harness.get('/catalog/products?q=KV-SRO', francs.token).expect(200);
    expect(Number(sro.body.data[0].sale_price)).toBe(500);
    expect(Number(sro.body.data[0].cost_price)).toBe(0);
  });

  it('établit la facture d’une vente au nom d’un client nommé sur le moment', async () => {
    const produits = await harness.get('/catalog/products?q=KV-A&pageSize=100', pharmacie.token).expect(200);
    const id = (code: string) => produits.body.data.find((p: { sku: string }) => p.sku === code).id;
    const alu = id('KV-ALU-24');
    const albe = id('KV-ALBE-400');
    await harness
      .post('/inventory/receptions', {
        lines: [
          { productId: alu, quantity: 50, unitCost: 1.2, lotNumber: 'L-ALU-1', expiryDate: '2028-03-31' },
          { productId: albe, quantity: 50, unitCost: 0.12, lotNumber: 'L-ALB-1', expiryDate: '2028-06-30' },
        ],
      }, pharmacie.token)
      .expect(201);

    const vente = await vendre(
      pharmacie.token,
      [{ productId: alu, quantity: 2 }, { productId: albe, quantity: 1 }],
      [{ method: 'cash', amount: 5 }],
    );
    expect(vente.sale.total).toBe('4.30');
    expect(vente.lines[0].description).toBe('Artéméther-Luméfantrine 20/120 mg adulte');

    const facture = await harness
      .post('/invoices', { saleId: vente.sale.id, customer: { name: 'Mme Furaha Bahati', phone: '0991 234 567' } }, pharmacie.token)
      .expect(201);
    expect(facture.body.created).toBe(true);
    expect(facture.body.invoice.number).toMatch(/^FA-\d{4}-\d{6}$/);
    expect(facture.body.invoice.status).toBe('paid');
    expect(facture.body.customer).toMatchObject({ name: 'Mme Furaha Bahati', phone: '+243991234567' });
    expect(facture.body.lines.map((l: { lot_number: string }) => l.lot_number)).toEqual(['L-ALU-1', 'L-ALB-1']);

    // Redemander la facture renvoie la même.
    const encore = await harness.post('/invoices', { saleId: vente.sale.id }, pharmacie.token).expect(201);
    expect(encore.body).toMatchObject({ created: false, invoice: { id: facture.body.invoice.id } });

    // Le même client, saisi autrement, est retrouvé par son téléphone.
    const vente2 = await vendre(pharmacie.token, [{ productId: albe, quantity: 2 }], [{ method: 'mobile_money', amount: 0.6, provider: 'M-Pesa', reference: 'MP123' }]);
    const facture2 = await harness
      .post('/invoices', { saleId: vente2.sale.id, customer: { name: 'Furaha', phone: '+243 991-234-567' } }, pharmacie.token)
      .expect(201);
    expect(facture2.body.customer.id).toBe(facture.body.customer.id);

    const duClient = await harness.get(`/invoices?customerId=${facture.body.customer.id}`, pharmacie.token).expect(200);
    expect(duClient.body).toHaveLength(2);
    const parNom = await harness.get('/invoices?search=furaha', pharmacie.token).expect(200);
    expect(parNom.body).toHaveLength(2);

    // La vente porte désormais sa facture et son client.
    const journal = await harness.get('/sales', pharmacie.token).expect(200);
    const ligne = journal.body.data.find((s: { id: string }) => s.id === vente.sale.id);
    expect(ligne).toMatchObject({ invoice_number: facture.body.invoice.number, customer_name: 'Mme Furaha Bahati' });

    // PDF au logo de la pharmacie.
    await harness.put('/admin/logo', { dataUrl: PNG_1PX }, pharmacie.token).expect(200);
    const doc = await pdf(`/invoices/${facture.body.invoice.id}/pdf`, pharmacie.token).expect(200);
    expect(doc.headers['content-type']).toBe('application/pdf');
    expect(doc.headers['content-disposition']).toContain(`${facture.body.invoice.number}-Mme-Furaha-Bahati.pdf`);
    const contenu = (doc.body as Buffer).toString('latin1');
    expect(contenu.startsWith('%PDF')).toBe(true);
    expect(contenu).toContain('/Subtype /Image');
    expect(contenu.match(/\/Type \/Page\b/g)).toHaveLength(1);
  });

  it('une vente à crédit reste due sur sa facture', async () => {
    const client = await harness
      .post('/customers', { name: 'Clinique Amani', phone: '0970000900', creditLimit: 100, creditDays: 30, kind: 'professional' }, pharmacie.token)
      .expect(201);
    const produits = await harness.get('/catalog/products?q=KV-ALBE-400', pharmacie.token).expect(200);
    const vente = (await harness
      .post('/sales', {
        customerId: client.body.id,
        lines: [{ productId: produits.body.data[0].id, quantity: 10 }],
        payments: [{ method: 'cash', amount: 1 }, { method: 'credit', amount: 2 }],
      }, pharmacie.token)
      .expect(201)).body;
    // Une vente à crédit est facturée d'office.
    expect(vente.invoice).not.toBeNull();
    const facture = await harness.get(`/invoices/${vente.invoice.id}`, pharmacie.token).expect(200);
    expect(facture.body.invoice).toMatchObject({ status: 'partially_paid', amount_paid: '1.00', balance: '2.00' });
    expect(facture.body.invoice.due_date).not.toBeNull();

    // Une vente déjà rattachée à un client ne change pas de client.
    await harness
      .post('/invoices', { saleId: vente.sale.id, customer: { name: 'Quelqu’un d’autre', phone: '0990000901' } }, pharmacie.token)
      .expect(409);
    await harness
      .post('/invoices', { saleId: vente.sale.id, customerId: client.body.id, customer: { name: 'X' } }, pharmacie.token)
      .expect(400);
  });

  it('une vente annulée ne se facture pas ; cloisonnement entre pharmacies', async () => {
    const produits = await harness.get('/catalog/products?q=KV-ALBE-400', pharmacie.token).expect(200);
    const vente = await vendre(pharmacie.token, [{ productId: produits.body.data[0].id, quantity: 1 }], [{ method: 'cash', amount: 0.3 }]);
    await harness.post(`/sales/${vente.sale.id}/cancel`, { reason: 'Erreur de saisie' }, pharmacie.token).expect(201);
    await harness.post('/invoices', { saleId: vente.sale.id }, pharmacie.token).expect(409);

    // Un vendeur établit et imprime les factures.
    await harness
      .post(
        '/admin/users',
        { fullName: 'Vendeur', phone: '0990000903', email: `vendeur@${domaine}`, password: 'Vendeur2026!', roleCodes: ['vendeur'] },
        pharmacie.token,
      )
      .expect(201);
    const vendeur = await harness.loginPharmacy(`vendeur@${domaine}`, 'Vendeur2026!');
    const factures = await harness.get('/invoices', vendeur.token).expect(200);
    expect(factures.body.length).toBeGreaterThanOrEqual(3);
    await pdf(`/invoices/${factures.body[0].id}/pdf`, vendeur.token).expect(200);

    const { session: autre } = await creerPharmacie();
    await harness.get(`/invoices/${factures.body[0].id}`, autre.token).expect(404);
    await pdf(`/invoices/${factures.body[0].id}/pdf`, autre.token).expect(404);
    await harness.post('/invoices', { saleId: vente.sale.id }, autre.token).expect(404);
    expect((await harness.get('/invoices', autre.token).expect(200)).body).toHaveLength(0);
  });
});
