import { Harness, Session, uniqueSlug } from './harness';

/**
 * Caisse en dollars et en francs congolais : taux du jour, paiements mêlant
 * les deux devises, monnaie rendue en francs arrondie à la coupure, caisse
 * attendue et comptée devise par devise, annulation qui rend les bonnes
 * espèces.
 */
describe('Caisse en deux devises', () => {
  const harness = new Harness();
  const PASSWORD = 'Pharmacie2026!';
  let superAdmin: Session;
  let pharmacie: Session;
  let produit: string;
  let sessionId: string;
  let premiereVente: string;

  const creerPharmacie = async () => {
    const slug = uniqueSlug('devises');
    await harness
      .post(
        '/platform/organizations',
        {
          slug, legalName: `PHARMACIE ${slug.toUpperCase()}`, countryCode: 'CD', city: 'Bukavu',
          planCode: 'starter', startTrial: true,
          owner: { fullName: 'Gérant', email: `gerant@${slug}.cd`, password: PASSWORD },
        },
        superAdmin.token,
      )
      .expect(201);
    return harness.loginPharmacy(`gerant@${slug}.cd`, PASSWORD);
  };

  const vendre = (corps: Record<string, unknown>, token = pharmacie.token) =>
    harness.post('/sales', { lines: [{ productId: produit, quantity: 3 }], ...corps }, token);

  const caisse = async () => (await harness.get('/cash/current', pharmacie.token).expect(200)).body;
  const francs = (etat: { currencies: { currency: string; expected_cash: string }[] }) =>
    Number(etat.currencies.find((c) => c.currency === 'CDF')?.expected_cash);

  beforeAll(async () => {
    await harness.start();
    superAdmin = await harness.loginPlatform('admin@novapharmaos.com');
    pharmacie = await creerPharmacie();
    const p = await harness
      .post('/catalog/products', { name: 'Ibuprofène 400 mg', salePrice: 1.75 }, pharmacie.token)
      .expect(201);
    produit = p.body.id ?? p.body.product?.id;
    await harness
      .post('/inventory/receptions', {
        lines: [{ productId: produit, quantity: 100, unitCost: 0.8, lotNumber: 'IBU-1', expiryDate: '2028-12-31' }],
      }, pharmacie.token)
      .expect(201);
  }, 90_000);

  afterAll(async () => {
    await harness.stop();
  });

  it('refuse un paiement en francs tant qu’aucun taux n’est fixé', async () => {
    await harness.post('/cash/sessions', { openingFloat: 0 }, pharmacie.token).expect(201);
    const refus = await vendre({ payments: [{ method: 'cash', amount: 20000, currency: 'CDF' }] }).expect(409);
    expect(refus.body.message).toContain('fixez le taux du jour');
    const etat = await caisse();
    expect(etat.currencies).toEqual([]);
    await harness.post(`/cash/sessions/${etat.session.id}/close`, { countedCash: 0 }, pharmacie.token).expect(201);
  });

  it('fixe le taux du jour et en garde l’historique', async () => {
    const vide = await harness.get('/cash/rates', pharmacie.token).expect(200);
    expect(vide.body).toMatchObject({ devise: 'USD', courant: null });

    await harness.post('/cash/rates', { baseCurrency: 'USD', quoteCurrency: 'USD', rate: 1 }, pharmacie.token).expect(409);
    await harness.post('/cash/rates', { baseCurrency: 'EUR', quoteCurrency: 'CDF', rate: 3100 }, pharmacie.token).expect(409);
    await harness.post('/cash/rates', { baseCurrency: 'USD', quoteCurrency: 'CDF', rate: 0 }, pharmacie.token).expect(409);
    await harness
      .post('/cash/rates', { baseCurrency: 'USD', quoteCurrency: 'CDF', rate: 2850, changeRounding: 50 }, pharmacie.token)
      .expect(201);

    const taux = await harness.get('/cash/rates', pharmacie.token).expect(200);
    expect(Number(taux.body.courant.rate)).toBe(2850);
    expect(Number(taux.body.courant.change_rounding)).toBe(50);
    expect(taux.body.courant.set_by_name).toBe('Gérant');
  });

  it('ouvre la caisse avec un fonds dans chaque devise', async () => {
    await harness
      .post('/cash/sessions', { openingFloat: 20, openingFloats: [{ currency: 'CDF', amount: 50000 }] }, pharmacie.token)
      .expect(201);
    const etat = await caisse();
    sessionId = etat.session.id;
    expect(Number(etat.session.expected_cash)).toBe(20);
    expect(francs(etat)).toBe(50000);
    expect(Number(etat.currencies[0].opening_float)).toBe(50000);
  });

  it('encaisse en francs une vente en dollars et rend la monnaie en francs, arrondie', async () => {
    // 3 × 1,75 $ = 5,25 $ ; 20 000 FC remis = 7,02 $ ; monnaie : 5 037,5 FC → 5 050 FC.
    const vente = await vendre({
      payments: [{ method: 'cash', amount: 20000, currency: 'CDF' }],
      changeCurrency: 'CDF',
    }).expect(201);
    premiereVente = vente.body.sale.id;
    expect(vente.body.sale).toMatchObject({ total: '5.25', change_currency: 'CDF', change_amount: '5050.00' });
    expect(vente.body.payments[0]).toMatchObject({
      method: 'cash', amount: '7.02', currency: 'USD', tendered_currency: 'CDF', tendered_amount: '20000.00',
    });
    expect(Number(vente.body.payments[0].exchange_rate)).toBe(2850);

    const etat = await caisse();
    expect(Number(etat.session.expected_cash)).toBe(20);
    expect(francs(etat)).toBe(50000 + 20000 - 5050);
  });

  it('accepte un paiement mêlant dollars et francs', async () => {
    // 5 $ + 700 FC (0,25 $) = 5,25 $ : rien à rendre.
    const vente = await vendre({
      payments: [
        { method: 'cash', amount: 5 },
        { method: 'cash', amount: 700, currency: 'CDF' },
      ],
    }).expect(201);
    expect(vente.body.sale.change_given).toBe('0.00');
    expect(vente.body.sale.balance_due).toBe('0.00');
    const etat = await caisse();
    expect(Number(etat.session.expected_cash)).toBe(25);
    expect(francs(etat)).toBe(64950 + 700);
  });

  it('solde l’écart d’arrondi mais refuse un règlement réellement incomplet', async () => {
    // 14 950 FC = 5,2456 $ : à moins d'un demi-pas (25 FC) du total, la vente est soldée.
    const juste = await vendre({ payments: [{ method: 'mobile_money', amount: 14950, currency: 'CDF', reference: 'MP-DEV-1' }] })
      .expect(201);
    expect(juste.body.sale.balance_due).toBe('0.00');

    const court = await vendre({ payments: [{ method: 'cash', amount: 14000, currency: 'CDF' }] }).expect(409);
    expect(court.body.message).toContain('Règlement incomplet');
    await vendre({ payments: [{ method: 'credit', amount: 15000, currency: 'CDF' }] }).expect(409);
  });

  it('garde le taux affiché au client s’il a été fixé, refuse un taux inventé', async () => {
    await harness.post('/cash/rates', { baseCurrency: 'USD', quoteCurrency: 'CDF', rate: 2900 }, pharmacie.token).expect(201);
    const ancien = await vendre({
      payments: [{ method: 'cash', amount: 15000, currency: 'CDF', exchangeRate: 2850 }],
      changeCurrency: 'CDF',
    }).expect(201);
    expect(Number(ancien.body.payments[0].exchange_rate)).toBe(2850);
    // Le pas d'arrondi suit le taux précédent quand il n'est pas redonné.
    expect(ancien.body.sale.change_amount).toBe('50.00');

    const invente = await vendre({ payments: [{ method: 'cash', amount: 15000, currency: 'CDF', exchangeRate: 2500 }] })
      .expect(409);
    expect(invente.body.message).toContain('n\'a pas été fixé');
  });

  it('rend à l’annulation les espèces de chaque devise, monnaie déduite', async () => {
    const avant = await caisse();
    await harness.post(`/sales/${premiereVente}/cancel`, { reason: 'Erreur de produit' }, pharmacie.token).expect(201);
    const apres = await caisse();
    expect(francs(apres)).toBe(francs(avant) - (20000 - 5050));
    expect(Number(apres.session.expected_cash)).toBe(Number(avant.session.expected_cash));
  });

  it('exige le comptage de chaque devise à la clôture', async () => {
    const etat = await caisse();
    const refus = await harness.post(`/cash/sessions/${sessionId}/close`, { countedCash: 25 }, pharmacie.token).expect(409);
    expect(refus.body.message).toContain('CDF');

    const clos = await harness
      .post(`/cash/sessions/${sessionId}/close`, {
        countedCash: Number(etat.session.expected_cash),
        countedOther: [{ currency: 'CDF', amount: francs(etat) - 500 }],
      }, pharmacie.token)
      .expect(201);
    expect(clos.body.ecarts).toEqual([
      expect.objectContaining({ currency: 'USD', variance: 0 }),
      expect.objectContaining({ currency: 'CDF', variance: -500 }),
    ]);
    expect(clos.body.message).toContain('manquant de 500.00 CDF');

    const historique = await harness.get('/cash/sessions', pharmacie.token).expect(200);
    const session = historique.body.find((s: { id: string }) => s.id === sessionId);
    expect(Number(session.currencies[0].variance)).toBe(-500);
  });
});
