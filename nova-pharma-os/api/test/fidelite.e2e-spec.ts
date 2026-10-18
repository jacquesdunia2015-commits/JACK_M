import { Harness, Session, uniqueSlug } from './harness';

/**
 * Fidélité : points gagnés à chaque achat, utilisés pour payer une partie
 * d'un achat (seuil, part maximale), rendus à l'annulation, ajustements
 * motivés, et remise permanente par catégorie de clients.
 */
describe('Fidélité : points et remises', () => {
  const harness = new Harness();
  const PASSWORD = 'Pharmacie2026!';
  let pharmacie: Session;
  let produit: string;
  let client: string;
  let venteAvecPoints: string;

  const vendre = (corps: Record<string, unknown>, quantite = 1) =>
    harness.post('/sales', { lines: [{ productId: produit, quantity: quantite }], ...corps }, pharmacie.token);
  const solde = async () => (await harness.get(`/loyalty/customers/${client}`, pharmacie.token).expect(200)).body.balance;

  beforeAll(async () => {
    await harness.start();
    const superAdmin = await harness.loginPlatform('admin@novapharmaos.com');
    const slug = uniqueSlug('fid');
    await harness
      .post('/platform/organizations', {
        slug, legalName: `PHARMACIE ${slug.toUpperCase()}`, countryCode: 'CD', city: 'Bukavu',
        planCode: 'starter', startTrial: true,
        owner: { fullName: 'Gérant', email: `gerant@${slug}.cd`, password: PASSWORD },
      }, superAdmin.token)
      .expect(201);
    pharmacie = await harness.loginPharmacy(`gerant@${slug}.cd`, PASSWORD);
    const p = await harness.post('/catalog/products', { name: 'Vitamine C 500 mg', salePrice: 10 }, pharmacie.token).expect(201);
    produit = p.body.id ?? p.body.product?.id;
    await harness
      .post('/inventory/receptions', {
        lines: [{ productId: produit, quantity: 100, unitCost: 4, lotNumber: 'VIT-1', expiryDate: '2028-12-31' }],
      }, pharmacie.token)
      .expect(201);
    await harness.post('/cash/sessions', { openingFloat: 10 }, pharmacie.token).expect(201);
  }, 90_000);

  afterAll(async () => {
    await harness.stop();
  });

  it('ne donne aucun point tant que la pharmacie n’a pas activé le programme', async () => {
    const prog = await harness.get('/loyalty/program', pharmacie.token).expect(200);
    expect(prog.body).toMatchObject({ is_enabled: false, outstandingPoints: 0 });
    const avant = (await harness.post('/customers', { name: 'Avant Programme', phone: '0990000001' }, pharmacie.token).expect(201)).body;
    const v = await vendre({ customerId: avant.id, payments: [{ method: 'cash', amount: 10 }] }).expect(201);
    expect(v.body.sale.loyalty_points_earned).toBe(0);
    const refus = await vendre({ customerId: avant.id, loyaltyPoints: 10, payments: [{ method: 'cash', amount: 10 }] }).expect(409);
    expect(refus.body.message).toContain('pas activé');
  });

  it('active le programme et offre les points de bienvenue', async () => {
    const r = await harness
      .put('/loyalty/program', { isEnabled: true, pointsPerUnit: 1, pointValue: 0.05, minRedeemPoints: 100, maxRedeemPercent: 50, welcomePoints: 20 }, pharmacie.token)
      .expect(200);
    expect(r.body).toMatchObject({ is_enabled: true, point_value: 0.05, welcome_points: 20 });
    const c = await harness.post('/customers', { name: 'Maman Furaha', phone: '0991112233' }, pharmacie.token).expect(201);
    client = c.body.id;
    expect(c.body.loyalty_points).toBe(20);
  });

  it('gagne des points sur ce que le client paie, affichés sur le ticket', async () => {
    const v = await vendre({ customerId: client, payments: [{ method: 'cash', amount: 120 }] }, 12).expect(201);
    expect(v.body.sale.loyalty_points_earned).toBe(120);
    expect(await solde()).toBe(140);
    const recu = await harness.get(`/sales/${v.body.sale.id}/receipt`, pharmacie.token).expect(200);
    expect(recu.body.loyalty).toEqual({ earned: 120, redeemed: 0, balance: 140 });
  });

  it('utilise des points dans les limites du programme', async () => {
    // 50 % de 10 $ = 5 $ = 100 points au plus.
    const q = await harness.get(`/loyalty/customers/${client}/quote?amount=10`, pharmacie.token).expect(200);
    expect(q.body).toMatchObject({ enabled: true, balance: 140, value: 7, maxPoints: 100, maxValue: 5 });

    const trop = await vendre({ customerId: client, loyaltyPoints: 150, payments: [{ method: 'cash', amount: 10 }] }).expect(409);
    expect(trop.body.message).toContain("n'a que 140 points");
    const plafond = await vendre({ customerId: client, loyaltyPoints: 120, payments: [{ method: 'cash', amount: 10 }] }).expect(409);
    expect(plafond.body.message).toContain('Au plus 100 points');
    await vendre({ loyaltyPoints: 100, payments: [{ method: 'cash', amount: 5 }] }).expect(409);

    const caisseAvant = (await harness.get('/cash/current', pharmacie.token).expect(200)).body.session.expected_cash;
    const v = await vendre({ customerId: client, loyaltyPoints: 100, payments: [{ method: 'cash', amount: 5 }] }).expect(201);
    venteAvecPoints = v.body.sale.id;
    expect(v.body.sale).toMatchObject({ total: '10.00', loyalty_points_redeemed: 100, loyalty_points_earned: 5, balance_due: '0.00' });
    expect(v.body.payments).toEqual(expect.arrayContaining([
      expect.objectContaining({ method: 'loyalty', amount: '5.00', reference: '100 points' }),
    ]));
    // Seuls les 5 $ d'espèces entrent en caisse.
    const caisseApres = (await harness.get('/cash/current', pharmacie.token).expect(200)).body.session.expected_cash;
    expect(Number(caisseApres) - Number(caisseAvant)).toBeCloseTo(5, 2);
    expect(await solde()).toBe(45);

    const sousSeuil = await vendre({ customerId: client, loyaltyPoints: 40, payments: [{ method: 'cash', amount: 10 }] }).expect(409);
    expect(sousSeuil.body.message).toContain('au moins 100 points');
  });

  it('rend les points utilisés et retire les points gagnés à l’annulation', async () => {
    await harness.post(`/sales/${venteAvecPoints}/cancel`, { reason: 'Erreur de produit' }, pharmacie.token).expect(201);
    expect(await solde()).toBe(140);
    const historique = await harness.get(`/loyalty/customers/${client}`, pharmacie.token).expect(200);
    expect(historique.body.entries[0]).toMatchObject({ kind: 'reverse', points: 95, balance_after: 140 });
  });

  it('ajuste à la main, avec un motif, sans solde négatif', async () => {
    await harness.post(`/loyalty/customers/${client}/adjust`, { points: 10, reason: 'Geste commercial' }, pharmacie.token).expect(201);
    expect(await solde()).toBe(150);
    const refus = await harness.post(`/loyalty/customers/${client}/adjust`, { points: -1000, reason: 'Correction' }, pharmacie.token).expect(409);
    expect(refus.body.message).toContain("n'a que 150 points");
    await harness.post(`/loyalty/customers/${client}/adjust`, { points: 5, reason: '' }, pharmacie.token).expect(400);
  });

  it('applique d’office la remise de la catégorie du client', async () => {
    const g = await harness.post('/loyalty/groups', { name: 'Personnel', discountPercent: 10 }, pharmacie.token).expect(201);
    expect(g.body.code).toBe('PERSONNEL');
    await harness.put(`/loyalty/customers/${client}/group`, { groupId: g.body.id }, pharmacie.token).expect(200);

    const v = await vendre({ customerId: client, payments: [{ method: 'cash', amount: 9 }] }).expect(201);
    expect(v.body.sale).toMatchObject({ total: '9.00', group_discount_percent: '10.00', loyalty_points_earned: 9 });
    // Une remise saisie à la ligne l'emporte.
    const saisie = await harness
      .post('/sales', { customerId: client, lines: [{ productId: produit, quantity: 1, discountPercent: 0 }], payments: [{ method: 'cash', amount: 10 }] }, pharmacie.token)
      .expect(201);
    expect(saisie.body.sale.total).toBe('10.00');

    const liste = await harness.get('/loyalty/groups', pharmacie.token).expect(200);
    expect(liste.body[0]).toMatchObject({ name: 'Personnel', customers: 1 });
    await harness.patch(`/loyalty/groups/${g.body.id}`, { isActive: false }, pharmacie.token).expect(200);
    const sansRemise = await vendre({ customerId: client, payments: [{ method: 'cash', amount: 10 }] }).expect(201);
    expect(sansRemise.body.sale.total).toBe('10.00');
  });

  it('montre les meilleurs clients et les points en circulation', async () => {
    const t = await harness.get('/loyalty/dashboard', pharmacie.token).expect(200);
    expect(t.body.customers[0]).toMatchObject({ name: 'Maman Furaha', group_name: 'Personnel' });
    expect(t.body.entries.length).toBeGreaterThan(3);
    const prog = await harness.get('/loyalty/program', pharmacie.token).expect(200);
    expect(prog.body.outstandingPoints).toBe(t.body.customers[0].loyalty_points);
    expect(prog.body.outstandingValue).toBeCloseTo(prog.body.outstandingPoints * 0.05, 2);
  });
});
