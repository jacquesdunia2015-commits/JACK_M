import { Harness, Session, uniqueSlug } from './harness';

/**
 * Traitements suivis des malades chroniques : date de fin recalculée à
 * chaque vente au patient, liste des patients à prévenir, rappel WhatsApp
 * préparé en lien wa.me (gratuit, envoyé depuis le téléphone de la pharmacie).
 */
describe('Traitements suivis (malades chroniques)', () => {
  const harness = new Harness();
  const PASSWORD = 'Pharmacie2026!';
  let pharmacie: Session;
  let produit: string;
  let patient: string;
  let sansTelephone: string;
  let plan: string;

  // Jour au fuseau de la pharmacie (Goma : Africa/Lubumbashi), décalé de N jours.
  const jour = (decalage: number) => {
    const local = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Lubumbashi' });
    const d = new Date(`${local}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + decalage);
    return d.toISOString().slice(0, 10);
  };

  beforeAll(async () => {
    await harness.start();
    const superAdmin = await harness.loginPlatform('admin@novapharmaos.com');
    const slug = uniqueSlug('trait');
    await harness
      .post('/platform/organizations', {
        slug, legalName: `PHARMACIE ${slug.toUpperCase()}`, countryCode: 'CD', city: 'Goma',
        planCode: 'business', startTrial: true,
        owner: { fullName: 'Gérante', email: `gerant@${slug}.cd`, password: PASSWORD },
      }, superAdmin.token)
      .expect(201);
    pharmacie = await harness.loginPharmacy(`gerant@${slug}.cd`, PASSWORD);
    const p = await harness.post('/catalog/products', { name: 'Amlodipine 5 mg', salePrice: 3 }, pharmacie.token).expect(201);
    produit = p.body.id ?? p.body.product?.id;
    await harness
      .post('/inventory/receptions', {
        lines: [{ productId: produit, quantity: 50, unitCost: 1.2, lotNumber: 'AML-1', expiryDate: '2028-12-31' }],
      }, pharmacie.token)
      .expect(201);
    patient = (await harness.post('/customers', { name: 'Maman Neema', phone: '0997001122' }, pharmacie.token).expect(201)).body.id;
    sansTelephone = (await harness.post('/customers', { name: 'Papa Jean' }, pharmacie.token).expect(201)).body.id;
    await harness.post('/cash/sessions', { openingFloat: 10 }, pharmacie.token).expect(201);
  }, 90_000);

  afterAll(async () => {
    await harness.stop();
  });

  it('suit un traitement et calcule la date de fin de la boîte', async () => {
    // Boîte de 30 jours délivrée il y a 28 jours : fin dans 2 jours.
    const t = await harness
      .post('/treatments', {
        customerId: patient, productId: produit, condition: 'hypertension', daysPerUnit: 30,
        lastDispensedAt: jour(-28), lastQuantity: 1,
      }, pharmacie.token)
      .expect(201);
    plan = t.body.id;
    expect(String(t.body.next_refill_date).slice(0, 10)).toBe(jour(2));
    expect(t.body.sansTelephone).toBe(false);

    const doublon = await harness.post('/treatments', { customerId: patient, productId: produit, daysPerUnit: 30 }, pharmacie.token).expect(409);
    expect(doublon.body.message).toContain('déjà suivi');
    await harness.post('/treatments', { customerId: patient, productId: produit, daysPerUnit: 0 }, pharmacie.token).expect(400);
  });

  it('liste les patients à prévenir, en retard compris', async () => {
    const autre = await harness
      .post('/treatments', {
        customerId: sansTelephone, productId: produit, condition: 'diabete', daysPerUnit: 15,
        lastDispensedAt: jour(-20), lastQuantity: 1,
      }, pharmacie.token)
      .expect(201);
    expect(autre.body.sansTelephone).toBe(true);

    const a = await harness.get('/treatments?etat=a_prevenir', pharmacie.token).expect(200);
    expect(a.body).toHaveLength(2);
    // Le plus en retard d'abord.
    expect(a.body[0]).toMatchObject({ customer_name: 'Papa Jean', etat: 'en_retard', days_left: -5 });
    expect(a.body[1]).toMatchObject({ customer_name: 'Maman Neema', etat: 'a_prevenir', days_left: 2, deja_prevenu: false });

    const retard = await harness.get('/treatments?etat=en_retard', pharmacie.token).expect(200);
    expect(retard.body).toHaveLength(1);
    const duPatient = await harness.get(`/treatments?customerId=${patient}`, pharmacie.token).expect(200);
    expect(duPatient.body).toHaveLength(1);
  });

  it('prépare le rappel WhatsApp gratuit et note que le patient est prévenu', async () => {
    const r = await harness.post(`/treatments/${plan}/remind`, {}, pharmacie.token).expect(201);
    expect(r.body).toMatchObject({ channel: 'whatsapp', mode: 'manual', status: 'ready' });
    expect(r.body.send_link).toMatch(/^https:\/\/wa\.me\/243997001122\?text=/);
    expect(r.body.body).toContain('Maman Neema');
    expect(r.body.body).toContain('Amlodipine 5 mg');
    const fin = new Date(`${jour(2)}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' });
    expect(r.body.body).toContain(`vers le ${fin}.`);

    const apres = await harness.get(`/treatments?customerId=${patient}`, pharmacie.token).expect(200);
    expect(apres.body[0]).toMatchObject({ deja_prevenu: true, reminders_sent: 1 });

    const sans = (await harness.get(`/treatments?customerId=${sansTelephone}`, pharmacie.token).expect(200)).body[0];
    const refus = await harness.post(`/treatments/${sans.id}/remind`, {}, pharmacie.token).expect(409);
    expect(refus.body.message).toContain('pas de numéro');
    // Boîte déjà finie : le message ne parle plus d'une fin à venir.
    await harness.patch('/customers/' + sansTelephone, { phone: '0812000111' }, pharmacie.token).expect(200);
    const retard = await harness.post(`/treatments/${sans.id}/remind`, {}, pharmacie.token).expect(201);
    expect(retard.body.body).toContain('devait être renouvelé le');
  });

  it('recalcule la date de fin quand le patient achète son médicament', async () => {
    await harness
      .post('/sales', {
        customerId: patient,
        lines: [{ productId: produit, quantity: 2 }],
        payments: [{ method: 'cash', amount: 6 }],
      }, pharmacie.token)
      .expect(201);
    const t = (await harness.get(`/treatments?customerId=${patient}`, pharmacie.token).expect(200)).body[0];
    expect(String(t.last_dispensed_at).slice(0, 10)).toBe(jour(0));
    expect(String(t.next_refill_date).slice(0, 10)).toBe(jour(60));
    expect(t).toMatchObject({ etat: 'en_cours', deja_prevenu: false });
  });

  it('arrête puis reprend un traitement', async () => {
    const arrete = await harness.patch(`/treatments/${plan}`, { isActive: false }, pharmacie.token).expect(200);
    expect(arrete.body.is_active).toBe(false);
    await harness.post(`/treatments/${plan}/remind`, {}, pharmacie.token).expect(409);
    // Un traitement arrêté ne bouge plus avec les ventes.
    const modifie = await harness.patch(`/treatments/${plan}`, { isActive: true, daysPerUnit: 15 }, pharmacie.token).expect(200);
    expect(String(modifie.body.next_refill_date).slice(0, 10)).toBe(jour(30));
  });
});
