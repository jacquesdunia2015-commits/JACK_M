import { Harness, Session, uniqueSlug } from './harness';

/**
 * Place de marché : un dépôt publie ses offres, une pharmacie compare et
 * commande, le dépôt accepte (commande professionnelle créée chez lui) et
 * expédie, la pharmacie réceptionne en stock. Une troisième organisation,
 * non publiée, ne voit ni ne touche rien de tout cela.
 */
describe('Place de marché entre pharmacies et dépôts', () => {
  const harness = new Harness();
  const PASSWORD = 'Pharmacie2026!';
  let depot: Session;
  let pharmacie: Session;
  let tiers: Session;
  let depotId: string;
  let offreAmox: string;
  let offreGants: string;
  let commande: string;
  let produitAcheteur: string;

  const creerOrganisation = async (prefixe: string, kind = 'pharmacy') => {
    const superAdmin = await harness.loginPlatform('admin@novapharmaos.com');
    const slug = uniqueSlug(prefixe);
    const r = await harness
      .post('/platform/organizations', {
        slug, legalName: `${kind === 'wholesaler' ? 'DÉPÔT' : 'PHARMACIE'} ${slug.toUpperCase()}`, countryCode: 'CD', city: 'Goma', kind,
        planCode: 'business', startTrial: true,
        owner: { fullName: 'Gérant', email: `gerant@${slug}.cd`, password: PASSWORD },
      }, superAdmin.token)
      .expect(201);
    return { session: await harness.loginPharmacy(`gerant@${slug}.cd`, PASSWORD), id: (r.body.organization?.id ?? r.body.id) as string };
  };

  beforeAll(async () => {
    await harness.start();
    const d = await creerOrganisation('dep', 'wholesaler');
    depot = d.session; depotId = d.id;
    pharmacie = (await creerOrganisation('ach')).session;
    tiers = (await creerOrganisation('tie')).session;
    const amox = (await harness.post('/catalog/products', { name: 'Amoxicilline 500 mg', salePrice: 0.15 }, depot.token).expect(201)).body.id;
    await harness.post('/inventory/receptions', { lines: [{ productId: amox, quantity: 5000, unitCost: 0.05, lotNumber: 'AMX-D1', expiryDate: '2028-03-31' }] }, depot.token).expect(201);
    await harness.put('/market/seller', { isListed: true, city: 'Goma', deliveryZones: 'Goma, Bukavu', minOrderAmount: 20, whatsapp: '0991230000', paymentTerms: 'Comptant à la livraison' }, depot.token).expect(200);
    offreAmox = (await harness.post('/market/offers', { productId: amox, unitPrice: 0.08, minQuantity: 100, presentation: 'Boîte de 1000' }, depot.token).expect(201)).body.id;
    offreGants = (await harness.post('/market/offers', { name: 'Gants d’examen', presentation: 'Boîte de 100', unitPrice: 5, minQuantity: 1 }, depot.token).expect(201)).body.id;
    // Le tiers propose moins cher, mais n'a pas publié sa fiche : invisible.
    await harness.post('/market/offers', { name: 'Amoxicilline 500 mg', unitPrice: 0.05 }, tiers.token).expect(201);
    produitAcheteur = (await harness.post('/catalog/products', { name: 'Amoxicilline 500 mg gélules', salePrice: 0.2 }, pharmacie.token).expect(201)).body.id;
  }, 120_000);

  afterAll(async () => {
    await harness.stop();
  });

  it('la pharmacie trouve les offres publiées, pas les siennes ni celles d’un vendeur non publié', async () => {
    const r = await harness.get('/market/search?q=amox', pharmacie.token).expect(200);
    expect(r.body).toHaveLength(1);
    expect(r.body[0]).toMatchObject({ id: offreAmox, seller_id: depotId, seller_city: 'Goma', unit_price: '0.0800', availability: 'in_stock' });
    expect((await harness.get('/market/search?q=amox', depot.token).expect(200)).body).toHaveLength(0);
    expect((await harness.get('/market/search?q=amox&city=Kinshasa', pharmacie.token).expect(200)).body).toHaveLength(0);
    expect((await harness.get('/market/search?q=amox&city=Bukavu', pharmacie.token).expect(200)).body).toHaveLength(1);
  });

  it('refuse une commande sous les minimums, puis l’envoie avec un lien WhatsApp vers le dépôt', async () => {
    const sousQuantite = await harness.post('/market/orders', { sellerOrganizationId: depotId, lines: [{ offerId: offreAmox, quantity: 50 }] }, pharmacie.token).expect(409);
    expect(sousQuantite.body.message).toContain('au moins 100');
    const sousMontant = await harness.post('/market/orders', { sellerOrganizationId: depotId, lines: [{ offerId: offreAmox, quantity: 100 }] }, pharmacie.token).expect(409);
    expect(sousMontant.body.message).toContain('Commande minimum');
    const c = await harness.post('/market/orders', { sellerOrganizationId: depotId, lines: [{ offerId: offreAmox, quantity: 300 }], delivery: 'Jeudi matin' }, pharmacie.token).expect(201);
    commande = c.body.id;
    expect(c.body).toMatchObject({ total: 24 });
    expect(c.body.number).toMatch(/^MKT-\d{4}-\d{5}$/);
    expect(c.body.whatsappLink).toMatch(/^https:\/\/wa\.me\/243991230000\?text=/);
  });

  it('seuls l’acheteur et le vendeur voient la commande', async () => {
    expect((await harness.get('/market/orders', pharmacie.token).expect(200)).body).toHaveLength(1);
    const ventes = await harness.get('/market/orders?side=sales', depot.token).expect(200);
    expect(ventes.body).toHaveLength(1);
    expect(ventes.body[0]).toMatchObject({ status: 'sent', buyer_city: 'Goma', delivery_preference: 'Jeudi matin' });
    expect((await harness.get('/market/orders?side=sales', tiers.token).expect(200)).body).toHaveLength(0);
    expect((await harness.get('/market/orders', tiers.token).expect(200)).body).toHaveLength(0);
    await harness.post(`/market/orders/${commande}/accept`, {}, tiers.token).expect(404);
    await harness.post(`/market/orders/${commande}/accept`, {}, pharmacie.token).expect(409);
  });

  it('le dépôt accepte : la commande devient une commande professionnelle chez lui', async () => {
    const a = await harness.post(`/market/orders/${commande}/accept`, { note: 'Livraison jeudi' }, depot.token).expect(201);
    expect(a.body).toMatchObject({ status: 'accepted', seller_note: 'Livraison jeudi' });
    expect(a.body.seller_b2b_order_id).toBeTruthy();
    const b2b = await harness.get('/b2b/orders', depot.token).expect(200);
    const o = (b2b.body.data ?? b2b.body).find((x: { id: string }) => x.id === a.body.seller_b2b_order_id);
    expect(o).toBeTruthy();
    expect(Number(o.total)).toBeCloseTo(24, 2);
    await harness.post(`/market/orders/${commande}/ship`, {}, depot.token).expect(201);
    await harness.post(`/market/orders/${commande}/cancel`, {}, pharmacie.token).expect(409);
  });

  it('la pharmacie réceptionne en stock, au prix de la commande', async () => {
    const r = await harness.post(`/market/orders/${commande}/receive`, {
      lines: [{ index: 0, productId: produitAcheteur, lotNumber: 'AMX-D1', expiryDate: '2028-03-31' }],
    }, pharmacie.token).expect(201);
    expect(r.body.status).toBe('received');
    expect(r.body.buyer_receipt_id).toBeTruthy();
    const fefo = await harness.get(`/inventory/products/${produitAcheteur}/fefo`, pharmacie.token).expect(200);
    expect(fefo.body.reduce((s: number, l: { available_quantity: string }) => s + Number(l.available_quantity), 0)).toBe(300);
  });

  it('une offre libre (sans produit relié) s’accepte sans commande professionnelle ; refus motivé', async () => {
    const c = await harness.post('/market/orders', { sellerOrganizationId: depotId, lines: [{ offerId: offreGants, quantity: 5 }] }, pharmacie.token).expect(201);
    const a = await harness.post(`/market/orders/${c.body.id}/accept`, {}, depot.token).expect(201);
    expect(a.body.seller_b2b_order_id).toBeNull();
    const c2 = await harness.post('/market/orders', { sellerOrganizationId: depotId, lines: [{ offerId: offreGants, quantity: 4 }] }, pharmacie.token).expect(201);
    await harness.post(`/market/orders/${c2.body.id}/reject`, { note: 'Rupture chez notre fournisseur' }, depot.token).expect(201);
  });

  it('le dépôt retire une offre et met à jour la disponibilité depuis son stock', async () => {
    const r = await harness.post('/market/offers/refresh', {}, depot.token).expect(201);
    expect(r.body.updated).toBe(1);
    await harness.patch(`/market/offers/${offreGants}`, { isActive: false }, depot.token).expect(200);
    expect((await harness.get('/market/search?q=gants', pharmacie.token).expect(200)).body).toHaveLength(0);
    await harness.patch(`/market/offers/${offreGants}`, { isActive: true }, pharmacie.token).expect(404);
  });
});
