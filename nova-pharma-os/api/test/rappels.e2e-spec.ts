import { Harness, Session, uniqueSlug } from './harness';

/**
 * Rappels de lots et alertes produits falsifiés : alerte publiée par le
 * back-office et reprise par chaque pharmacie, lots trouvés malgré accents
 * et tirets, quarantaine qui sort le lot de la vente, clients à prévenir,
 * réception bloquée, destruction, fausse alerte levée.
 */
describe('Rappels de lots et produits falsifiés', () => {
  const harness = new Harness();
  const PASSWORD = 'Pharmacie2026!';
  let superAdmin: Session;
  let pharmacie: Session;
  let para: string;
  let amox: string;
  let client: string;
  let alerte: string;
  let rappel: string;

  const recevoir = (productId: string, lotNumber: string, quantity: number, expiryDate: string) =>
    harness.post('/inventory/receptions', { lines: [{ productId, quantity, unitCost: 0.4, lotNumber, expiryDate }] }, pharmacie.token);

  beforeAll(async () => {
    await harness.start();
    superAdmin = await harness.loginPlatform('admin@novapharmaos.com');
    const slug = uniqueSlug('rap');
    await harness
      .post('/platform/organizations', {
        slug, legalName: `PHARMACIE ${slug.toUpperCase()}`, countryCode: 'CD', city: 'Bukavu',
        planCode: 'business', startTrial: true,
        owner: { fullName: 'Gérant', email: `gerant@${slug}.cd`, password: PASSWORD },
      }, superAdmin.token)
      .expect(201);
    pharmacie = await harness.loginPharmacy(`gerant@${slug}.cd`, PASSWORD);
    para = (await harness.post('/catalog/products', { name: 'Paracétamol 500 mg', salePrice: 1 }, pharmacie.token).expect(201)).body.id;
    amox = (await harness.post('/catalog/products', { name: 'Amoxicilline 500 mg', salePrice: 2 }, pharmacie.token).expect(201)).body.id;
    await recevoir(para, 'P2304', 30, '2027-06-30').expect(201);
    await recevoir(para, 'P2400', 20, '2028-06-30').expect(201);
    await recevoir(amox, 'P2304', 10, '2027-12-31').expect(201);
    client = (await harness.post('/customers', { name: 'Papa Mapendo', phone: '0998887766' }, pharmacie.token).expect(201)).body.id;
    await harness.post('/cash/sessions', { openingFloat: 10 }, pharmacie.token).expect(201);
    // Le lot P2304, le plus proche de sa péremption, part en premier (FEFO).
    await harness.post('/sales', { customerId: client, lines: [{ productId: para, quantity: 2 }], payments: [{ method: 'cash', amount: 2 }] }, pharmacie.token).expect(201);
    await harness.post('/sales', { lines: [{ productId: para, quantity: 1 }], payments: [{ method: 'cash', amount: 1 }] }, pharmacie.token).expect(201);
  }, 90_000);

  afterAll(async () => {
    await harness.stop();
  });

  it('le back-office publie une alerte ; seuls les super-administrateurs et le support le peuvent', async () => {
    const vide = await harness.post('/platform/product-alerts', { kind: 'recall', title: 'Sans lot', productName: 'Produit X', lotNumbers: [] }, superAdmin.token).expect(409);
    expect(vide.body.message).toContain('numéros de lot');
    const a = await harness
      .post('/platform/product-alerts', {
        kind: 'recall', title: 'Rappel du lot P2304 de paracétamol 500 mg', productName: 'Paracetamol 500 mg comprimés',
        matchTerms: 'paracetamol 500', lotNumbers: ['p-2304'], source: 'acorep', reference: 'ACOREP/2026/117',
        description: 'Défaut de dissolution constaté.', actionRequired: 'return',
      }, superAdmin.token)
      .expect(201);
    alerte = a.body.id;
    await harness.post('/platform/product-alerts', { kind: 'recall', title: 'Essai', productName: 'Produit X', lotNumbers: ['1'] }, pharmacie.token).expect(403);
  });

  it('la pharmacie reçoit l’alerte et voit le lot concerné, accents et tirets ignorés', async () => {
    const liste = await harness.get('/recalls', pharmacie.token).expect(200);
    const r = liste.body.find((x: { alert_id: string }) => x.alert_id === alerte);
    expect(r).toMatchObject({ status: 'open', source: 'acorep', matchedLots: 1, stockUnits: 27, quarantinedLots: 0 });
    rappel = r.id;
    // Un second appel ne la duplique pas.
    const encore = await harness.get('/recalls', pharmacie.token).expect(200);
    expect(encore.body.filter((x: { alert_id: string }) => x.alert_id === alerte)).toHaveLength(1);

    const d = await harness.get(`/recalls/${rappel}`, pharmacie.token).expect(200);
    expect(d.body.lots).toHaveLength(1);
    expect(d.body.lots[0]).toMatchObject({ product_name: 'Paracétamol 500 mg', lot_number: 'P2304', is_quarantined: false });
    expect(Number(d.body.lots[0].stock)).toBe(27);
    expect(d.body.customers).toHaveLength(1);
    expect(d.body.customers[0]).toMatchObject({ name: 'Papa Mapendo', phone: '0998887766' });
    expect(Number(d.body.customers[0].quantity)).toBe(2);
    expect(d.body.anonymousSales).toEqual({ quantity: 1, sales: 1 });
    expect((await harness.get('/recalls/summary', pharmacie.token).expect(200)).body).toEqual({ open: 1, withStock: 1, notQuarantined: 1 });
  });

  it('la quarantaine sort le lot de la vente', async () => {
    const q = await harness.post(`/recalls/${rappel}/quarantine`, {}, pharmacie.token).expect(201);
    expect(q.body.quarantined).toBe(1);
    await harness.post('/sales', { lines: [{ productId: para, quantity: 25 }], payments: [{ method: 'cash', amount: 25 }] }, pharmacie.token).expect(409);
    const v = await harness.post('/sales', { lines: [{ productId: para, quantity: 5 }], payments: [{ method: 'cash', amount: 5 }] }, pharmacie.token).expect(201);
    const detail = await harness.get(`/sales/${v.body.sale.id}`, pharmacie.token).expect(200);
    expect(detail.body.lines.every((l: { lot_number: string }) => l.lot_number === 'P2400')).toBe(true);
  });

  it('bloque la réception du lot rappelé, pas celle d’un autre produit au même numéro', async () => {
    const refus = await recevoir(para, 'P 2304', 10, '2027-06-30').expect(409);
    expect(refus.body.message).toContain('visé par un rappel');
    await recevoir(amox, 'P2304', 5, '2027-12-31').expect(201);
  });

  it('prépare le message WhatsApp pour le client qui a acheté le lot', async () => {
    const m = await harness.post(`/recalls/${rappel}/notify`, { customerId: client }, pharmacie.token).expect(201);
    expect(m.body.send_link).toMatch(/^https:\/\/wa\.me\/243998887766\?text=/);
    expect(m.body.body).toContain('lot P2304');
    const autre = (await harness.post('/customers', { name: 'Inconnu', phone: '0990000000' }, pharmacie.token).expect(201)).body.id;
    await harness.post(`/recalls/${rappel}/notify`, { customerId: autre }, pharmacie.token).expect(409);
  });

  it('détruit le stock du lot et clôt le rappel', async () => {
    const r = await harness.post(`/recalls/${rappel}/withdraw`, { resolution: 'destroyed', note: 'PV de destruction n° 12' }, pharmacie.token).expect(201);
    expect(r.body.units).toBe(27);
    expect(r.body.recall).toMatchObject({ status: 'closed', resolution: 'destroyed', customers_notified: 1 });
    await harness.post(`/recalls/${rappel}/quarantine`, {}, pharmacie.token).expect(409);
    expect((await harness.get('/recalls/summary', pharmacie.token).expect(200)).body.open).toBe(0);
  });

  it('enregistre un rappel du grossiste, puis lève une fausse alerte', async () => {
    const c = await harness
      .post('/recalls', { kind: 'falsified', title: 'Boîtes suspectes signalées par le grossiste', productId: amox, lotNumbers: ['P2304'], source: 'grossiste' }, pharmacie.token)
      .expect(201);
    expect(c.body.lots).toHaveLength(1);
    expect(c.body.lots[0]).toMatchObject({ product_name: 'Amoxicilline 500 mg', is_quarantined: true });
    await harness.post('/sales', { lines: [{ productId: amox, quantity: 1 }], payments: [{ method: 'cash', amount: 2 }] }, pharmacie.token).expect(409);

    await harness.post(`/recalls/${c.body.recall.id}/release`, { note: 'Non' }, pharmacie.token).expect(400);
    const l = await harness.post(`/recalls/${c.body.recall.id}/release`, { note: 'Le grossiste confirme : boîtes authentiques' }, pharmacie.token).expect(201);
    expect(l.body).toMatchObject({ status: 'closed', resolution: 'released' });
    await harness.post('/sales', { lines: [{ productId: amox, quantity: 1 }], payments: [{ method: 'cash', amount: 2 }] }, pharmacie.token).expect(201);
  });

  it('une alerte retirée par le back-office n’arrive plus aux nouvelles pharmacies', async () => {
    await harness.patch(`/platform/product-alerts/${alerte}`, { isActive: false }, superAdmin.token).expect(200);
    const liste = await harness.get('/platform/product-alerts', superAdmin.token).expect(200);
    expect(liste.body.find((a: { id: string }) => a.id === alerte)).toMatchObject({ is_active: false, source: 'acorep' });
  });
});
