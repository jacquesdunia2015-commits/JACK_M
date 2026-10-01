import { Harness, Session, uniqueSlug } from './harness';

/**
 * Tiers payant : organismes payeurs, bénéficiaires, partage de la vente
 * entre payeur et patient sous plafonds, relevé mensuel, règlement.
 */
describe('Tiers payant', () => {
  const harness = new Harness();
  const PASSWORD = 'Pharmacie2026!';
  let superAdmin: Session;
  let pharmacie: Session;
  let produit: string;
  let mutuelle: { id: string; code: string };
  let furaha: { id: string };
  const ventes: string[] = [];

  const vendre = (quantite: number, payments: unknown[], coverage?: Record<string, unknown>) =>
    harness.post('/sales', {
      lines: [{ productId: produit, quantity: quantite }],
      payments,
      ...(coverage ? { coverage } : {}),
    }, pharmacie.token);

  const aujourdhui = () => new Date().toISOString().slice(0, 10);

  beforeAll(async () => {
    await harness.start();
    superAdmin = await harness.loginPlatform('admin@novapharmaos.com');
    const slug = uniqueSlug('tiers');
    await harness
      .post('/platform/organizations', {
        slug, legalName: `PHARMACIE ${slug.toUpperCase()}`, countryCode: 'CD', city: 'Goma',
        planCode: 'starter', startTrial: true,
        owner: { fullName: 'Gérante', email: `gerant@${slug}.cd`, password: PASSWORD },
      }, superAdmin.token)
      .expect(201);
    pharmacie = await harness.loginPharmacy(`gerant@${slug}.cd`, PASSWORD);
    const p = await harness.post('/catalog/products', { name: 'Metformine 500 mg', salePrice: 1.75 }, pharmacie.token).expect(201);
    produit = p.body.id ?? p.body.product?.id;
    await harness
      .post('/inventory/receptions', {
        lines: [{ productId: produit, quantity: 200, unitCost: 0.7, lotNumber: 'MET-1', expiryDate: '2028-12-31' }],
      }, pharmacie.token)
      .expect(201);
    await harness.post('/cash/sessions', { openingFloat: 10 }, pharmacie.token).expect(201);
  }, 90_000);

  afterAll(async () => {
    await harness.stop();
  });

  it('enregistre un organisme payeur et ses bénéficiaires', async () => {
    const m = await harness
      .post('/payers', { name: 'Mutuelle de santé Umoja', kind: 'mutuelle', coveragePercent: 80, perSaleCeiling: 20 }, pharmacie.token)
      .expect(201);
    mutuelle = m.body;
    expect(mutuelle.code).toBe('MUTU-SANT');

    const b = await harness
      .post(`/payers/${mutuelle.id}/members`, {
        memberNumber: 'UMJ-00451', fullName: 'Furaha Bahati', annualCeiling: 30, validUntil: '2030-12-31',
      }, pharmacie.token)
      .expect(201);
    furaha = b.body;
    const doublon = await harness
      .post(`/payers/${mutuelle.id}/members`, { memberNumber: 'UMJ-00451', fullName: 'Quelqu’un' }, pharmacie.token)
      .expect(409);
    expect(doublon.body.message).toContain('Furaha Bahati');

    const trouve = await harness.get('/payers/members?q=00451', pharmacie.token).expect(200);
    expect(trouve.body).toHaveLength(1);
    expect(trouve.body[0]).toMatchObject({ full_name: 'Furaha Bahati', payer_name: 'Mutuelle de santé Umoja' });
    expect(Number(trouve.body[0].coverage_percent)).toBe(80);
  });

  it('montre le partage avant d’encaisser', async () => {
    const a = await harness.get(`/payers/members/${furaha.id}/coverage?amount=10`, pharmacie.token).expect(200);
    expect(a.body).toMatchObject({ percent: 80, payerShare: 8, patientShare: 2, remainingCeiling: 30, capped: false });
  });

  it('partage la vente : la mutuelle paie sa part, le patient le reste', async () => {
    // 4 × 1,75 = 7,00 ; 80 % = 5,60 à la mutuelle ; le patient donne 2 $ pour 1,40.
    const avant = (await harness.get('/cash/current', pharmacie.token).expect(200)).body;
    const v = await vendre(4, [{ method: 'cash', amount: 2 }], { payerMemberId: furaha.id, authorizationNumber: 'BON-77' })
      .expect(201);
    ventes.push(v.body.sale.id);
    expect(v.body.sale).toMatchObject({
      total: '7.00', payer_share: '5.60', patient_share: '1.40', change_given: '0.60', balance_due: '0.00',
      authorization_number: 'BON-77',
    });
    expect(v.body.payments).toEqual(expect.arrayContaining([
      expect.objectContaining({ method: 'insurance', provider: 'Mutuelle de santé Umoja', amount: '5.60', reference: 'BON-77' }),
    ]));
    const apres = (await harness.get('/cash/current', pharmacie.token).expect(200)).body;
    expect(Number(apres.session.expected_cash) - Number(avant.session.expected_cash)).toBeCloseTo(1.4, 2);
  });

  it('applique le plafond par vente puis le plafond annuel', async () => {
    // 20 × 1,75 = 35 ; 80 % = 28, ramené au plafond par vente de 20.
    const grosse = await vendre(20, [{ method: 'cash', amount: 15 }], { payerMemberId: furaha.id }).expect(201);
    ventes.push(grosse.body.sale.id);
    expect(grosse.body.sale.payer_share).toBe('20.00');

    // Reste annuel : 30 − 5,60 − 20 = 4,40 < 5,60.
    const apercu = await harness.get(`/payers/members/${furaha.id}/coverage?amount=7`, pharmacie.token).expect(200);
    expect(apercu.body).toMatchObject({ payerShare: 4.4, patientShare: 2.6, capped: true });
    expect(apercu.body.reason).toContain('Plafond annuel');
    const reste = await vendre(4, [{ method: 'cash', amount: 2.6 }], { payerMemberId: furaha.id }).expect(201);
    ventes.push(reste.body.sale.id);
    expect(reste.body.sale.payer_share).toBe('4.40');

    const epuise = await vendre(1, [{ method: 'cash', amount: 1.75 }], { payerMemberId: furaha.id }).expect(409);
    expect(epuise.body.message).toContain('Plafond annuel');
  });

  it('refuse une carte expirée et une part patient non payée', async () => {
    const autre = await harness
      .post(`/payers/${mutuelle.id}/members`, { memberNumber: 'UMJ-00999', fullName: 'Amani Kahindo', validUntil: '2025-01-31' }, pharmacie.token)
      .expect(201);
    const expiree = await vendre(1, [{ method: 'cash', amount: 1 }], { payerMemberId: autre.body.id }).expect(409);
    expect(expiree.body.message).toContain('a expiré');

    await harness.patch(`/payers/members/${autre.body.id}`, { validUntil: '2031-01-31' }, pharmacie.token).expect(200);
    const impaye = await vendre(4, [{ method: 'cash', amount: 0.5 }], { payerMemberId: autre.body.id }).expect(409);
    expect(impaye.body.message).toContain('Règlement incomplet');
  });

  let releve: string;
  it('établit le relevé du mois et le PDF à présenter', async () => {
    const r = await harness
      .post('/payers/claims', { payerId: mutuelle.id, periodStart: aujourdhui().slice(0, 8) + '01', periodEnd: aujourdhui() }, pharmacie.token)
      .expect(201);
    releve = r.body.id;
    expect(r.body.number).toMatch(/^RL-\d{4}-\d{5}$/);
    expect(Number(r.body.total)).toBe(30);

    const detail = await harness.get(`/payers/claims/${releve}`, pharmacie.token).expect(200);
    expect(detail.body.sales).toHaveLength(3);
    expect(detail.body.sales[0]).toMatchObject({ member_name: 'Furaha Bahati', member_number: 'UMJ-00451' });

    const vide = await harness
      .post('/payers/claims', { payerId: mutuelle.id, periodStart: aujourdhui(), periodEnd: aujourdhui() }, pharmacie.token)
      .expect(409);
    expect(vide.body.message).toContain('Aucune vente');

    const pdf = await harness.http().get(`/api/payers/claims/${releve}/pdf`)
      .set('Authorization', `Bearer ${pharmacie.token}`).buffer(true)
      .parse((res, fin) => { const m: Buffer[] = []; res.on('data', (c: Buffer) => m.push(c)); res.on('end', () => fin(null, Buffer.concat(m))); })
      .expect(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect((pdf.body as Buffer).subarray(0, 4).toString()).toBe('%PDF');
  });

  it('retire du relevé en brouillon une vente annulée, refuse une fois le relevé présenté', async () => {
    await harness.post(`/sales/${ventes[2]}/cancel`, { reason: 'Erreur de saisie' }, pharmacie.token).expect(201);
    const apres = await harness.get(`/payers/claims/${releve}`, pharmacie.token).expect(200);
    expect(apres.body.sales).toHaveLength(2);
    expect(Number(apres.body.claim.total)).toBe(25.6);

    await harness.post(`/payers/claims/${releve}/send`, {}, pharmacie.token).expect(201);
    const refus = await harness.post(`/sales/${ventes[0]}/cancel`, { reason: 'Erreur de saisie' }, pharmacie.token).expect(409);
    expect(refus.body.message).toContain('annulez d\'abord ce relevé');
  });

  it('suit le règlement du payeur jusqu’au solde', async () => {
    const partiel = await harness
      .post(`/payers/claims/${releve}/payments`, { amount: 10, reference: 'VIR-0912' }, pharmacie.token)
      .expect(201);
    expect(partiel.body.status).toBe('partially_paid');
    await harness.post(`/payers/claims/${releve}/payments`, { amount: 50 }, pharmacie.token).expect(409);
    const solde = await harness.post(`/payers/claims/${releve}/payments`, { amount: 15.6 }, pharmacie.token).expect(201);
    expect(solde.body.status).toBe('paid');
    await harness.post(`/payers/claims/${releve}/cancel`, {}, pharmacie.token).expect(409);

    const liste = await harness.get('/payers', pharmacie.token).expect(200);
    const m = liste.body.find((p: { id: string }) => p.id === mutuelle.id);
    expect(Number(m.claimed_due)).toBe(0);
    expect(Number(m.members)).toBe(2);
  });
});
