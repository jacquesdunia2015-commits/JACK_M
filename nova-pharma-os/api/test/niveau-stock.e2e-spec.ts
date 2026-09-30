import { niveauPeremption } from '../src/common/niveau-peremption';
import { evaluerStock } from '../src/modules/tenant/inventory/niveau-stock';
import { Harness, Session, uniqueSlug } from './harness';

/**
 * Couleurs d'alerte du stock : rouge (rupture), orange (presque épuisé),
 * jaune (il en reste peu), vert (suffisant).
 */
describe('Niveau de stock', () => {
  describe('règle de calcul', () => {
    const niveau = (enStock: number, seuil: number, ventesPeriode: number) =>
      evaluerStock({ enStock, seuil, ventesPeriode }).niveau;

    it('rouge dès que le stock est à zéro', () => {
      expect(niveau(0, 0, 0)).toBe('rupture');
      expect(niveau(0, 20, 90)).toBe('rupture');
    });

    it('d’après les ventes : orange sous une semaine, jaune sous deux', () => {
      // 30 vendus en 30 jours : un par jour.
      expect(niveau(6, 0, 30)).toBe('critique');
      expect(niveau(7, 0, 30)).toBe('bas');
      expect(niveau(13, 0, 30)).toBe('bas');
      expect(niveau(14, 0, 30)).toBe('suffisant');
    });

    it("d'après le seuil : orange à sa moitié, jaune à son niveau", () => {
      expect(niveau(10, 20, 0)).toBe('critique');
      expect(niveau(20, 20, 0)).toBe('bas');
      expect(niveau(21, 20, 0)).toBe('suffisant');
    });

    it('le plus prudent des deux avis l’emporte', () => {
      // Seuil atteint mais produit qui se vend peu : reste jaune.
      expect(niveau(20, 20, 3)).toBe('bas');
      // Au-dessus du seuil mais ventes rapides : orange.
      expect(niveau(50, 20, 300)).toBe('critique');
    });

    it('sans seuil ni vente récente, la quantité seule décide', () => {
      expect(niveau(5, 0, 0)).toBe('critique');
      expect(niveau(10, 0, 0)).toBe('bas');
      expect(niveau(11, 0, 0)).toBe('suffisant');
    });

    it('les retours ne font pas une consommation négative', () => {
      const e = evaluerStock({ enStock: 50, seuil: 0, ventesPeriode: -4 });
      expect(e.couvertureJours).toBeNull();
      expect(e.niveau).toBe('suffisant');
    });
  });

  describe('couleur de la péremption', () => {
    it('rouge passée, orange dans le délai, jaune sous le double, vert au-delà', () => {
      expect(niveauPeremption(-1)).toBe('perime');
      expect(niveauPeremption(0)).toBe('proche');
      expect(niveauPeremption(90)).toBe('proche');
      expect(niveauPeremption(91)).toBe('a_surveiller');
      expect(niveauPeremption(180)).toBe('a_surveiller');
      expect(niveauPeremption(181)).toBe('eloignee');
      expect(niveauPeremption(null)).toBeNull();
    });

    it('suit le délai d’alerte propre au produit', () => {
      expect(niveauPeremption(40, 30)).toBe('a_surveiller');
      expect(niveauPeremption(61, 30)).toBe('eloignee');
      expect(niveauPeremption(100, 0)).toBe('a_surveiller'); // délai absent : 90 jours
    });
  });

  describe('API', () => {
    const harness = new Harness();
    const PASSWORD = 'Pharmacie2026!';
    let pharmacy: Session;
    let branchId: string;
    const ids: Record<string, string> = {};

    const niveauDe = async (sku: string) => {
      const res = await harness.get(`/inventory/stock?search=${sku}`, pharmacy.token).expect(200);
      return res.body[0];
    };

    beforeAll(async () => {
      await harness.start();
      const superAdmin = await harness.loginPlatform('admin@novapharmaos.com');
      const slug = uniqueSlug('niveaux');
      const email = `gerant@${slug}.cd`;
      const created = await harness
        .post(
          '/platform/organizations',
          {
            slug,
            legalName: `OFFICINE ${slug.toUpperCase()}`,
            countryCode: 'CD',
            city: 'Bukavu',
            planCode: 'business',
            startTrial: true,
            owner: { fullName: 'Gérant', email, password: PASSWORD },
          },
          superAdmin.token,
        )
        .expect(201);
      branchId = created.body.mainBranch.id;
      pharmacy = await harness.loginPharmacy(email, PASSWORD);

      const produit = (sku: string, reorderPoint = 0) => ({
        sku, name: `Produit ${sku}`, salePrice: 1, costPrice: 0.5,
        isBatchTracked: false, hasExpiry: false, reorderPoint,
      });
      await harness
        .post(
          '/catalog/products/import',
          {
            products: [
              produit('NIV-RUPT'), produit('NIV-VITE'), produit('NIV-MOYEN'),
              produit('NIV-SEUIL', 40), produit('NIV-CALME'),
              { sku: 'EXP-PROCHE', name: 'Produit EXP-PROCHE', salePrice: 1, costPrice: 0.5 },
              { sku: 'EXP-SURV', name: 'Produit EXP-SURV', salePrice: 1, costPrice: 0.5 },
              { sku: 'EXP-LOIN', name: 'Produit EXP-LOIN', salePrice: 1, costPrice: 0.5 },
            ],
          },
          pharmacy.token,
        )
        .expect(201);
      const catalogue = await harness.get('/catalog/products', pharmacy.token).expect(200);
      for (const p of catalogue.body.data) ids[p.sku] = p.id;

      const entrer = (sku: string, quantity: number) =>
        harness
          .post(
            '/inventory/adjustments',
            { branchId, productId: ids[sku], quantity, reason: 'Stock initial.' },
            pharmacy.token,
          )
          .expect(201);
      const vendre = (sku: string, quantity: number) =>
        harness
          .post(
            '/sales',
            {
              lines: [{ productId: ids[sku], quantity }],
              payments: [{ method: 'cash', amount: quantity }],
            },
            pharmacy.token,
          )
          .expect(201);

      await entrer('NIV-VITE', 80);
      await vendre('NIV-VITE', 70);   // reste 10, ~2,3 par jour : ~4 jours
      await entrer('NIV-MOYEN', 85);
      await vendre('NIV-MOYEN', 60);  // reste 25, 2 par jour : 12 jours
      await entrer('NIV-SEUIL', 30);  // seuil 40, aucune vente
      await entrer('NIV-CALME', 50);  // ni seuil ni vente

      // Lots périssables : 30, 120 et 400 jours avant expiration.
      const dansNJours = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
      const fournisseur = await harness
        .post('/purchasing/suppliers', { name: 'Dépôt Test', phone: '0990000600' }, pharmacy.token)
        .expect(201);
      await harness
        .post(
          '/purchasing/receipts',
          {
            supplierId: fournisseur.body.id,
            lines: [
              { productId: ids['EXP-PROCHE'], lotNumber: 'L1', expiryDate: dansNJours(30), quantity: 50, unitCost: 0.5 },
              { productId: ids['EXP-SURV'], lotNumber: 'L2', expiryDate: dansNJours(120), quantity: 50, unitCost: 0.5 },
              { productId: ids['EXP-LOIN'], lotNumber: 'L3', expiryDate: dansNJours(400), quantity: 50, unitCost: 0.5 },
            ],
          },
          pharmacy.token,
        )
        .expect(201);
    }, 90_000);

    afterAll(async () => {
      await harness.stop();
    });

    it('attribue la bonne couleur à chaque produit', async () => {
      expect((await niveauDe('NIV-RUPT')).stock_level).toBe('rupture');

      const vite = await niveauDe('NIV-VITE');
      expect(vite.stock_level).toBe('critique');
      expect(Number(vite.sales_last_30_days)).toBe(70);
      expect(vite.days_of_cover).toBe(4);

      const moyen = await niveauDe('NIV-MOYEN');
      expect(moyen.stock_level).toBe('bas');
      expect(moyen.days_of_cover).toBe(12);

      const seuil = await niveauDe('NIV-SEUIL');
      expect(seuil.stock_level).toBe('bas');
      expect(seuil.days_of_cover).toBeNull();

      expect((await niveauDe('NIV-CALME')).stock_level).toBe('suffisant');
    });

    it('colore la péremption la plus proche de chaque produit', async () => {
      expect((await niveauDe('EXP-PROCHE')).expiry_level).toBe('proche');
      expect((await niveauDe('EXP-PROCHE')).days_to_expiry).toBe(30);
      expect((await niveauDe('EXP-SURV')).expiry_level).toBe('a_surveiller');
      expect((await niveauDe('EXP-LOIN')).expiry_level).toBe('eloignee');
      expect((await niveauDe('NIV-CALME')).expiry_level).toBeNull(); // sans date

      const bord = await harness.get('/reports/dashboard', pharmacy.token).expect(200);
      const lot = bord.body.expiringSoon.find((l: { sku: string }) => l.sku === 'EXP-PROCHE');
      expect(lot.expiry_level).toBe('proche');
    });

    it('« à traiter » écarte les produits au vert', async () => {
      const res = await harness
        .get('/inventory/stock?search=NIV-&onlyIssues=true', pharmacy.token)
        .expect(200);
      const skus = res.body.map((l: { sku: string }) => l.sku).sort();
      expect(skus).toEqual(['NIV-MOYEN', 'NIV-RUPT', 'NIV-SEUIL', 'NIV-VITE']);
    });
  });
});
