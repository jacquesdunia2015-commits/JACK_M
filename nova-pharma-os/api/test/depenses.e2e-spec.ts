import { Harness, Session, uniqueSlug } from './harness';

/**
 * Dépenses et bénéfice réel du mois : dépenses en dollars ou en francs,
 * sortie de la caisse ouverte, annulation, pertes de stock et points de
 * fidélité déduits ; TVA déductible seulement sur facture normalisée ;
 * référence de la facture normalisée d'une vente.
 */
describe('Dépenses et bénéfice réel', () => {
  const harness = new Harness();
  const PASSWORD = 'Pharmacie2026!';
  let pharmacie: Session;
  let produit: string;
  let vente: string;
  let carburant: string;
  const mois = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Lubumbashi' }).slice(0, 7);

  beforeAll(async () => {
    await harness.start();
    const superAdmin = await harness.loginPlatform('admin@novapharmaos.com');
    const slug = uniqueSlug('dep');
    await harness
      .post('/platform/organizations', {
        slug, legalName: `PHARMACIE ${slug.toUpperCase()}`, countryCode: 'CD', city: 'Goma',
        planCode: 'starter', startTrial: true,
        owner: { fullName: 'Gérante', email: `gerant@${slug}.cd`, password: PASSWORD },
      }, superAdmin.token)
      .expect(201);
    pharmacie = await harness.loginPharmacy(`gerant@${slug}.cd`, PASSWORD);
    const p = await harness.post('/catalog/products', { name: 'Ibuprofène 400 mg', salePrice: 10 }, pharmacie.token).expect(201);
    produit = p.body.id ?? p.body.product?.id;
    await harness
      .post('/inventory/receptions', {
        lines: [{ productId: produit, quantity: 100, unitCost: 4, lotNumber: 'IBU-1', expiryDate: '2028-12-31' }],
      }, pharmacie.token)
      .expect(201);
    await harness.post('/cash/rates', { baseCurrency: 'USD', quoteCurrency: 'CDF', rate: 2800, changeRounding: 100 }, pharmacie.token).expect(201);
    await harness.post('/cash/sessions', { openingFloat: 100 }, pharmacie.token).expect(201);
    // 30 × 10 $ = 300 $ TTC (TVA 16 % : 258,62 $ HT), 120 $ de coût : 138,62 $ de marge HT.
    vente = (await harness.post('/sales', { lines: [{ productId: produit, quantity: 30 }], payments: [{ method: 'cash', amount: 300 }] }, pharmacie.token).expect(201)).body.sale.id;
    // 2 boîtes cassées : 8 $ de perte au coût d'achat.
    await harness.post('/inventory/adjustments', { productId: produit, quantity: 2, reason: 'Boîtes écrasées', kind: 'damage' }, pharmacie.token).expect(201);
  }, 90_000);

  afterAll(async () => {
    await harness.stop();
  });

  it('enregistre une dépense en dollars et une en francs au taux du jour', async () => {
    const loyer = await harness
      .post('/expenses', { category: 'loyer', label: 'Loyer du mois', amount: 80, paymentMethod: 'bank', supplierName: 'Bailleur' }, pharmacie.token)
      .expect(201);
    expect(loyer.body.number).toMatch(/^DEP-\d{4}-\d{5}$/);
    expect(loyer.body).toMatchObject({ amount_base: '80.00', currency: 'USD', cash_session_id: null });

    // 56 000 FC à 2 800 FC le dollar = 20 $, sortis de la caisse ouverte.
    const avant = (await harness.get('/cash/current', pharmacie.token).expect(200)).body;
    const c = await harness
      .post('/expenses', { category: 'carburant', label: 'Gasoil du groupe', amount: 56000, currency: 'CDF', fromCash: true }, pharmacie.token)
      .expect(201);
    carburant = c.body.id;
    expect(c.body).toMatchObject({ amount_base: '20.00', exchange_rate: '2800.000000' });
    const apres = (await harness.get('/cash/current', pharmacie.token).expect(200)).body;
    const fc = (x: { currencies?: { currency: string; expected_cash: string }[] }) =>
      Number(x.currencies?.find((d) => d.currency === 'CDF')?.expected_cash ?? 0);
    expect(fc(apres) - fc(avant)).toBe(-56000);

    await harness.post('/expenses', { category: 'loyer', label: 'Demain', amount: 5, expenseDate: '2099-01-01' }, pharmacie.token).expect(409);
    await harness.post('/expenses', { category: 'inconnue', label: 'X', amount: 5 }, pharmacie.token).expect(400);
    const sansCaisse = await harness.post('/expenses', { category: 'eau', label: 'REGIDESO', amount: 5, paymentMethod: 'bank', fromCash: true }, pharmacie.token).expect(409);
    expect(sansCaisse.body.message).toContain('espèces');
  });

  it('calcule le bénéfice réel du mois', async () => {
    const r = await harness.get(`/reports/profit?month=${mois()}`, pharmacie.token).expect(200);
    expect(r.body).toMatchObject({ month: mois(), currency: 'USD', vatRegistered: false, vat: null, inProgress: true });
    expect(r.body.sales).toMatchObject({ count: 1, revenue: 300, vat: 41.38, revenueExclVat: 258.62, cost: 120, grossMargin: 138.62 });
    expect(r.body.stockLosses).toMatchObject({ total: 8, byKind: { damage: 8 } });
    expect(r.body.expenses.total).toBe(100);
    expect(r.body.expenses.byCategory[0]).toMatchObject({ category: 'loyer', label: 'Loyer', amount: 80, cost: 80 });
    // 138,62 − 8 − 100 = 30,62 $, soit 11,84 % du chiffre d'affaires HT.
    expect(r.body.netProfit).toBe(30.62);
    expect(r.body.netMarginPercent).toBe(11.84);
    expect(r.body.series).toHaveLength(6);
    expect(r.body.series[5]).toMatchObject({ month: mois(), netProfit: 30.62 });
    await harness.get('/reports/profit?month=2026-13', pharmacie.token).expect(409);
  });

  it('annule une dépense et rend l’argent à la caisse encore ouverte', async () => {
    const a = await harness.post(`/expenses/${carburant}/cancel`, { reason: 'Saisie en double' }, pharmacie.token).expect(201);
    expect(a.body.cashReturned).toBe(true);
    await harness.post(`/expenses/${carburant}/cancel`, { reason: 'Saisie en double' }, pharmacie.token).expect(409);
    const r = await harness.get(`/reports/profit?month=${mois()}`, pharmacie.token).expect(200);
    expect(r.body.netProfit).toBe(50.62);
    const liste = await harness.get('/expenses', pharmacie.token).expect(200);
    expect(liste.body).toHaveLength(1);
    const tout = await harness.get('/expenses?includeCancelled=true', pharmacie.token).expect(200);
    expect(tout.body).toHaveLength(2);
  });

  it('assujettie à la TVA : déductible seulement sur facture normalisée', async () => {
    await harness.put('/finance/settings', { vatRegistered: true, defNumber: 'EMCF-000123' }, pharmacie.token).expect(200);
    await harness
      .post('/expenses', { category: 'entretien', label: 'Climatiseur', amount: 116, vatAmount: 16, normalizedInvoice: true }, pharmacie.token)
      .expect(409);
    await harness
      .post('/expenses', { category: 'entretien', label: 'Climatiseur', amount: 116, vatAmount: 16, normalizedInvoice: true, normalizedReference: 'FN-2026-778 / DEF EMCF-555' }, pharmacie.token)
      .expect(201);
    await harness.post('/expenses', { category: 'fournitures', label: 'Sachets', amount: 23.2, vatAmount: 3.2 }, pharmacie.token).expect(201);

    const r = await harness.get('/reports/profit', pharmacie.token).expect(200);
    const entretien = r.body.expenses.byCategory.find((d: { category: string }) => d.category === 'entretien');
    expect(entretien).toMatchObject({ amount: 116, vatDeductible: 16, cost: 100 });
    const fournitures = r.body.expenses.byCategory.find((d: { category: string }) => d.category === 'fournitures');
    expect(fournitures).toMatchObject({ amount: 23.2, vatDeductible: 0, cost: 23.2 });
    expect(r.body.vat).toMatchObject({
      collected: 41.38, deductibleOnExpenses: 16, balance: 25.38,
      expensesWithoutNormalizedInvoice: { count: 1, vat: 3.2 }, salesWithoutNormalizedReference: 1,
    });
    // 138,62 − 8 − (80 + 100 + 23,20) = −72,58 $.
    expect(r.body.netProfit).toBe(-72.58);
  });

  it('garde la référence de la facture normalisée d’une vente, jusque sur la facture et le ticket', async () => {
    await harness.put(`/sales/${vente}/normalized-reference`, { reference: 'FN-0001 · EMCF-000123 · code 8F3K-29QD' }, pharmacie.token).expect(200);
    const recu = await harness.get(`/sales/${vente}/receipt`, pharmacie.token).expect(200);
    expect(recu.body.sale.normalized_reference).toBe('FN-0001 · EMCF-000123 · code 8F3K-29QD');
    const r = await harness.get('/reports/profit', pharmacie.token).expect(200);
    expect(r.body.vat.salesWithoutNormalizedReference).toBe(0);
  });
});
