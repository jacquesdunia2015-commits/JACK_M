import { Harness, Session, uniqueSlug } from './harness';

/**
 * Page publique et réservations : page invisible tant qu'elle n'est pas
 * publiée, médicaments disponibles sans les quantités, réservation et
 * photo d'ordonnance sans compte, limites contre les abus, traitement par
 * la pharmacie et message WhatsApp, suivi par le client.
 */
describe('Page publique et réservations', () => {
  const harness = new Harness();
  const PASSWORD = 'Pharmacie2026!';
  let pharmacie: Session;
  let slug: string;
  let para: string;
  let rare: string;
  let reservation: { id: string; number: string };
  // Plus petit JPEG reconnu par sa signature.
  const JPEG = `data:image/jpeg;base64,${Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(2000, 1)]).toString('base64')}`;
  const pub = (chemin: string) => `/public/pharmacies/${slug}${chemin}`;

  beforeAll(async () => {
    await harness.start();
    const superAdmin = await harness.loginPlatform('admin@novapharmaos.com');
    slug = uniqueSlug('pub');
    await harness
      .post('/platform/organizations', {
        slug, legalName: `PHARMACIE ${slug.toUpperCase()}`, countryCode: 'CD', city: 'Goma',
        planCode: 'business', startTrial: true,
        owner: { fullName: 'Gérante', email: `gerant@${slug}.cd`, password: PASSWORD },
      }, superAdmin.token)
      .expect(201);
    pharmacie = await harness.loginPharmacy(`gerant@${slug}.cd`, PASSWORD);
    para = (await harness.post('/catalog/products', { name: 'Paracétamol 500 mg', salePrice: 1.5 }, pharmacie.token).expect(201)).body.id;
    rare = (await harness.post('/catalog/products', { name: 'Sirop Pédiatrique Rare', salePrice: 6 }, pharmacie.token).expect(201)).body.id;
    await harness
      .post('/inventory/receptions', { lines: [{ productId: para, quantity: 40, unitCost: 0.5, lotNumber: 'PUB-1', expiryDate: '2028-01-31' }] }, pharmacie.token)
      .expect(201);
  }, 90_000);

  afterAll(async () => {
    await harness.stop();
  });

  it('reste invisible tant que la pharmacie ne publie pas sa page', async () => {
    await harness.get(pub('')).expect(404);
    await harness.get('/public/pharmacies/inconnue-xyz').expect(404);
    const p = await harness
      .put('/public-profile', { isPublished: true, openingHours: 'Lun–Sam 7 h 30–21 h', whatsapp: '0991234567', addressHint: 'En face du marché' }, pharmacie.token)
      .expect(200);
    expect(p.body).toMatchObject({ is_published: true, opening_hours: 'Lun–Sam 7 h 30–21 h' });
    const page = await harness.get(pub('')).expect(200);
    expect(page.body).toMatchObject({ slug, openingHours: 'Lun–Sam 7 h 30–21 h', addressHint: 'En face du marché', acceptReservations: true, currency: 'USD' });
    expect(page.body.name).toContain('PHARMACIE');
  });

  it('montre les médicaments disponibles ou sur commande, sans les quantités', async () => {
    const r = await harness.get(pub('/products?q=para')).expect(200);
    expect(r.body).toEqual([{ id: para, name: 'Paracétamol 500 mg', dosage: null, form: null, price: 1.5, available: true, prescription: false }]);
    const s = await harness.get(pub('/products?q=sirop')).expect(200);
    expect(s.body[0]).toMatchObject({ id: rare, available: false });
    await harness.put('/public-profile', { showPrices: false }, pharmacie.token).expect(200);
    expect((await harness.get(pub('/products?q=para')).expect(200)).body[0].price).toBeNull();
    await harness.put('/public-profile', { showPrices: true }, pharmacie.token).expect(200);
  });

  it('prend une réservation sans compte, et refuse les demandes vides ou suspectes', async () => {
    const r = await harness
      .post(pub('/reservations'), { name: 'Maman Furaha', phone: '0997001122', lines: [{ productId: para, quantity: 2 }, { productId: rare, quantity: 1 }], pickup: 'Ce soir' })
      .expect(201);
    expect(r.body.number).toMatch(/^RES-\d{4}-\d{5}$/);
    await harness.post(pub('/reservations'), { name: 'Robot', phone: '0997001122', lines: [{ productId: para, quantity: 1 }], website: 'http://spam' }).expect(409);
    await harness.post(pub('/reservations'), { name: 'Vide', phone: '0997001122' }).expect(409);
    await harness.post(pub('/reservations'), { name: 'Faux', phone: '12', lines: [{ productId: para, quantity: 1 }] }).expect(400);
    const photoFausse = await harness
      .post(pub('/reservations'), { name: 'Papa Jean', phone: '0812345678', prescriptionPhoto: 'data:image/jpeg;base64,AAAA' })
      .expect(409);
    expect(photoFausse.body.message).toContain('JPEG ou PNG');
  });

  it('reçoit la photo d’une ordonnance', async () => {
    const r = await harness.post(pub('/reservations'), { name: 'Papa Jean', phone: '0812345678', prescriptionPhoto: JPEG, message: 'Pour mon fils' }).expect(201);
    const liste = await harness.get('/reservations', pharmacie.token).expect(200);
    expect(liste.body).toHaveLength(2);
    const avecPhoto = liste.body.find((x: { number: string }) => x.number === r.body.number);
    expect(avecPhoto).toMatchObject({ has_photo: true, has_prescription: true, customer_phone: '+243812345678', message: 'Pour mon fils', status: 'new' });
    const image = await harness.http().get(`/api/reservations/${avecPhoto.id}/prescription`)
      .set('Authorization', `Bearer ${pharmacie.token}`).buffer(true)
      .parse((res, fin) => { const m: Buffer[] = []; res.on('data', (c: Buffer) => m.push(c)); res.on('end', () => fin(null, Buffer.concat(m))); })
      .expect(200);
    expect(image.headers['content-type']).toContain('image/jpeg');
    expect((image.body as Buffer).subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]));
  });

  it('la pharmacie prépare, prévient sur WhatsApp, et le client suit sa demande', async () => {
    const liste = await harness.get('/reservations', pharmacie.token).expect(200);
    reservation = liste.body.find((x: { customer_name: string }) => x.customer_name === 'Maman Furaha');
    expect(reservation).toMatchObject({ customer_phone: '+243997001122' });
    const lignes = (reservation as unknown as { lines: { name: string; quantity: number; available: boolean }[] }).lines;
    expect(lignes).toEqual([
      expect.objectContaining({ name: 'Paracétamol 500 mg', quantity: 2, unitPrice: 1.5, available: true }),
      expect.objectContaining({ name: 'Sirop Pédiatrique Rare', quantity: 1, available: false }),
    ]);

    await harness.post(`/reservations/${reservation.id}/status`, { status: 'ready', note: 'Sirop commandé pour demain' }, pharmacie.token).expect(201);
    const m = await harness.post(`/reservations/${reservation.id}/notify`, {}, pharmacie.token).expect(201);
    expect(m.body.send_link).toMatch(/^https:\/\/wa\.me\/243997001122\?text=/);
    expect(m.body.body).toContain(`${reservation.number} est prête`);

    const suivi = await harness.get(pub(`/reservations/${reservation.number}?phone=0997001122`)).expect(200);
    expect(suivi.body.status).toBe('ready');
    await harness.get(pub(`/reservations/${reservation.number}?phone=0990000000`)).expect(404);

    await harness.post(`/reservations/${reservation.id}/status`, { status: 'collected' }, pharmacie.token).expect(201);
    await harness.post(`/reservations/${reservation.id}/status`, { status: 'cancelled' }, pharmacie.token).expect(409);
    expect((await harness.get('/reservations', pharmacie.token).expect(200)).body).toHaveLength(1);
    expect((await harness.get('/reservations?status=all', pharmacie.token).expect(200)).body).toHaveLength(2);
    expect((await harness.get('/reservations/summary', pharmacie.token).expect(200)).body).toEqual({ new: 1, ready: 0 });
  });

  it('limite les demandes répétées d’un même numéro', async () => {
    // Déjà une demande aujourd'hui pour ce numéro : 4 de plus passent, la suivante est refusée.
    for (let i = 0; i < 4; i++) {
      await harness.post(pub('/reservations'), { name: 'Maman Furaha', phone: '0997001122', lines: [{ productId: para, quantity: 1 }] }).expect(201);
    }
    const refus = await harness.post(pub('/reservations'), { name: 'Maman Furaha', phone: '+243 997 001 122', lines: [{ productId: para, quantity: 1 }] }).expect(429);
    expect(refus.body.message).toContain('appelez');
  });

  it('dépublier la page la fait disparaître aussitôt', async () => {
    await harness.put('/public-profile', { isPublished: false }, pharmacie.token).expect(200);
    await harness.get(pub('')).expect(404);
    await harness.post(pub('/reservations'), { name: 'Maman Furaha', phone: '0997001122', lines: [{ productId: para, quantity: 1 }] }).expect(404);
  });
});
