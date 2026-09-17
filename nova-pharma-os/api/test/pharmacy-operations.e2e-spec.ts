import { Harness, Session, uniqueSlug } from './harness';

/**
 * MVP 1 — exploitation d'une officine.
 *
 * Vérifie les règles qui font la valeur du produit au comptoir : FEFO,
 * intégrité du stock, caisse, encours client, inventaire et commerce
 * professionnel.
 */
describe('Opérations pharmacie', () => {
  const harness = new Harness();
  const PASSWORD = 'Pharmacie2026!';

  let superAdmin: Session;
  let pharmacy: Session;
  let organizationId: string;
  let branchId: string;
  const productIds: Record<string, string> = {};

  beforeAll(async () => {
    await harness.start();
    superAdmin = await harness.loginPlatform('admin@novapharmaos.com');

    const slug = uniqueSlug('officine');
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

    organizationId = created.body.organization.id;
    branchId = created.body.mainBranch.id;
    pharmacy = await harness.loginPharmacy(email, PASSWORD);

    await harness
      .post(
        '/catalog/products/import',
        {
          products: [
            {
              sku: 'PARA500',
              name: 'Paracétamol 500 mg',
              inn: 'Paracétamol',
              salePrice: 1.5,
              costPrice: 0.85,
              wholesalePrice: 1.1,
              reorderPoint: 40,
            },
            {
              sku: 'AMOX250',
              name: 'Amoxicilline 250 mg',
              salePrice: 3.5,
              costPrice: 2.1,
              requiresPrescription: true,
            },
            {
              sku: 'GANTS',
              name: "Gants d'examen",
              salePrice: 7,
              costPrice: 4.5,
              isBatchTracked: false,
              hasExpiry: false,
              reorderPoint: 15,
            },
          ],
        },
        pharmacy.token,
      )
      .expect(201);

    const catalogue = await harness.get('/catalog/products', pharmacy.token).expect(200);
    for (const product of catalogue.body.data) {
      productIds[product.sku] = product.id;
    }
  }, 90_000);

  afterAll(async () => {
    await harness.stop();
  });

  // -----------------------------------------------------------------
  describe('Réception et suivi des lots', () => {
    let supplierId: string;

    it('crée un fournisseur', async () => {
      const res = await harness
        .post(
          '/purchasing/suppliers',
          { code: 'UBI', name: 'Ubipharm RDC', leadTimeDays: 10 },
          pharmacy.token,
        )
        .expect(201);
      supplierId = res.body.id;
    });

    it("refuse une réception sans date de péremption sur un produit périssable", async () => {
      const res = await harness
        .post(
          '/purchasing/receipts',
          {
            supplierId,
            lines: [
              { productId: productIds.PARA500, lotNumber: 'SANS-DATE', quantity: 10, unitCost: 0.85 },
            ],
          },
          pharmacy.token,
        )
        .expect(409);
      expect(res.body.message).toContain('péremption');
    });

    it('réceptionne deux lots de péremptions différentes', async () => {
      const res = await harness
        .post(
          '/purchasing/receipts',
          {
            supplierId,
            supplierInvoiceNumber: 'UBI-001',
            idempotencyKey: 'reception-ubi-001',
            lines: [
              {
                productId: productIds.PARA500,
                lotNumber: 'LOT-PROCHE',
                expiryDate: '2026-11-30',
                quantity: 60,
                unitCost: 0.85,
              },
              {
                productId: productIds.PARA500,
                lotNumber: 'LOT-LOINTAIN',
                expiryDate: '2028-04-30',
                quantity: 240,
                unitCost: 0.8,
              },
              {
                productId: productIds.AMOX250,
                lotNumber: 'AMX-01',
                expiryDate: '2027-07-31',
                quantity: 100,
                unitCost: 2.1,
              },
              { productId: productIds.GANTS, quantity: 40, unitCost: 4.5 },
            ],
          },
          pharmacy.token,
        )
        .expect(201);
      expect(res.body.receipt.status).toBe('validated');
      expect(res.body.duplicate).toBe(false);
    });

    it('ne réceptionne pas deux fois le même bon', async () => {
      const res = await harness
        .post(
          '/purchasing/receipts',
          {
            supplierId,
            idempotencyKey: 'reception-ubi-001',
            lines: [
              {
                productId: productIds.PARA500,
                lotNumber: 'LOT-PROCHE',
                expiryDate: '2026-11-30',
                quantity: 60,
                unitCost: 0.85,
              },
            ],
          },
          pharmacy.token,
        )
        .expect(201);
      expect(res.body.duplicate).toBe(true);

      const stock = await harness
        .get(`/inventory/products/${productIds.PARA500}/fefo`, pharmacy.token)
        .expect(200);
      const total = stock.body.reduce(
        (sum: number, l: { available_quantity: string }) => sum + Number(l.available_quantity),
        0,
      );
      expect(total).toBe(300);
    });

    it('ordonne les lots selon la règle FEFO', async () => {
      const res = await harness
        .get(`/inventory/products/${productIds.PARA500}/fefo`, pharmacy.token)
        .expect(200);
      expect(res.body[0].lot_number).toBe('LOT-PROCHE');
      expect(res.body[1].lot_number).toBe('LOT-LOINTAIN');
    });
  });

  // -----------------------------------------------------------------
  describe('Ventes au comptoir', () => {
    it('ouvre la caisse', async () => {
      const res = await harness
        .post('/cash/sessions', { registerCode: 'CAISSE-1', openingFloat: 50 }, pharmacy.token)
        .expect(201);
      expect(Number(res.body.opening_float)).toBe(50);
    });

    it('sert le lot le plus proche de la péremption en premier', async () => {
      const res = await harness
        .post(
          '/sales',
          {
            lines: [{ productId: productIds.PARA500, quantity: 80 }],
            payments: [{ method: 'cash', amount: 120 }],
            clientOperationId: 'pos-fefo-1',
          },
          pharmacy.token,
        )
        .expect(201);

      // 60 du lot proche, puis 20 du lot lointain.
      const lines = res.body.lines;
      expect(lines).toHaveLength(2);
      expect(lines[0].lot_number).toBe('LOT-PROCHE');
      expect(Number(lines[0].quantity)).toBe(60);
      expect(lines[1].lot_number).toBe('LOT-LOINTAIN');
      expect(Number(lines[1].quantity)).toBe(20);
      expect(Number(res.body.sale.total)).toBe(120);
    });

    it("rejoue une vente hors ligne sans créer de doublon", async () => {
      const res = await harness
        .post(
          '/sales',
          {
            lines: [{ productId: productIds.PARA500, quantity: 80 }],
            payments: [{ method: 'cash', amount: 120 }],
            clientOperationId: 'pos-fefo-1',
          },
          pharmacy.token,
        )
        .expect(201);
      expect(res.body.duplicate).toBe(true);

      const sales = await harness.get('/sales', pharmacy.token).expect(200);
      expect(sales.body.pagination.total).toBe(1);
    });

    it('refuse une vente dépassant le stock disponible', async () => {
      const res = await harness
        .post(
          '/sales',
          {
            lines: [{ productId: productIds.GANTS, quantity: 999 }],
            payments: [{ method: 'cash', amount: 6993 }],
          },
          pharmacy.token,
        )
        .expect(409);
      expect(res.body.message).toContain('Stock insuffisant');
      expect(res.body.details).toMatchObject({ available: 40, requested: 999 });
    });

    it("refuse un médicament sur ordonnance sans prescription", async () => {
      const res = await harness
        .post(
          '/sales',
          {
            lines: [{ productId: productIds.AMOX250, quantity: 1 }],
            payments: [{ method: 'cash', amount: 3.5 }],
          },
          pharmacy.token,
        )
        .expect(409);
      expect(res.body.message).toContain('ordonnance');
    });

    it('accepte la même vente avec la prescription renseignée', async () => {
      await harness
        .post(
          '/sales',
          {
            lines: [{ productId: productIds.AMOX250, quantity: 2 }],
            payments: [{ method: 'mobile_money', amount: 7, provider: 'M-Pesa' }],
            prescription: {
              patientName: 'Mwamini B.',
              prescriberName: 'Dr Kabila',
              prescriberNumber: 'CNOM-4471',
            },
          },
          pharmacy.token,
        )
        .expect(201);
    });

    it("alimente la caisse des seules espèces encaissées", async () => {
      const res = await harness.get('/cash/current', pharmacy.token).expect(200);
      // 50 de fonds + 120 en espèces ; le Mobile Money n'entre pas en caisse.
      expect(Number(res.body.session.expected_cash)).toBe(170);
    });

    it("annule une vente et remet les articles sur leurs lots d'origine", async () => {
      const sales = await harness.get('/sales', pharmacy.token).expect(200);
      const sale = sales.body.data.find(
        (s: { status: string; total: string }) => s.status === 'completed' && Number(s.total) === 7,
      );

      await harness
        .post(
          `/sales/${sale.id}/cancel`,
          { reason: 'Erreur de saisie au comptoir.' },
          pharmacy.token,
        )
        .expect(201);

      const fefo = await harness
        .get(`/inventory/products/${productIds.AMOX250}/fefo`, pharmacy.token)
        .expect(200);
      expect(Number(fefo.body[0].available_quantity)).toBe(100);
    });
  });

  // -----------------------------------------------------------------
  describe('Crédit client et commerce professionnel', () => {
    let customerId: string;

    it('crée un client professionnel avec un plafond de crédit', async () => {
      const res = await harness
        .post(
          '/customers',
          {
            kind: 'professional',
            name: 'Clinique du Lac',
            phone: '+243990001111',
            creditLimit: 100,
            creditDays: 30,
          },
          pharmacy.token,
        )
        .expect(201);
      customerId = res.body.id;
      expect(res.body.code).toMatch(/^CLI-/);
    });

    it("refuse une vente à crédit qui dépasse l'encours autorisé", async () => {
      const res = await harness
        .post(
          '/sales',
          {
            customerId,
            channel: 'b2b',
            lines: [{ productId: productIds.PARA500, quantity: 150 }],
            payments: [{ method: 'credit', amount: 165 }],
          },
          pharmacy.token,
        )
        .expect(409);
      expect(res.body.message).toContain('Encours dépassé');
    });

    it('accepte une vente à crédit dans la limite, et met à jour l’encours', async () => {
      await harness
        .post(
          '/sales',
          {
            customerId,
            channel: 'b2b',
            lines: [{ productId: productIds.PARA500, quantity: 50 }],
            payments: [{ method: 'credit', amount: 55 }],
          },
          pharmacy.token,
        )
        .expect(201);

      const customer = await harness.get(`/customers/${customerId}`, pharmacy.token).expect(200);
      expect(Number(customer.body.customer.outstanding_balance)).toBe(55);
      // Une vente à crédit émet toujours une facture.
      expect(customer.body.invoices.length).toBeGreaterThan(0);
    });

    it("encaisse un règlement et solde l'encours", async () => {
      await harness
        .post(
          `/customers/${customerId}/payments`,
          { amount: 55, method: 'mobile_money', reference: 'MP-0001' },
          pharmacy.token,
        )
        .expect(201);

      const customer = await harness.get(`/customers/${customerId}`, pharmacy.token).expect(200);
      expect(Number(customer.body.customer.outstanding_balance)).toBe(0);
    });

    it("refuse un règlement supérieur à l'encours", async () => {
      const res = await harness
        .post(
          `/customers/${customerId}/payments`,
          { amount: 500, method: 'cash' },
          pharmacy.token,
        )
        .expect(409);
      expect(res.body.message).toContain('dépasse');
    });

    it('établit un devis, le transforme en commande, la livre et la facture', async () => {
      const quote = await harness
        .post(
          '/b2b/quotes',
          {
            customerId,
            lines: [{ productId: productIds.PARA500, quantity: 20 }],
          },
          pharmacy.token,
        )
        .expect(201);
      expect(quote.body.quote.number).toMatch(/^DV-/);

      const order = await harness
        .post(`/b2b/quotes/${quote.body.quote.id}/convert`, {}, pharmacy.token)
        .expect(201);
      expect(order.body.order.status).toBe('confirmed');

      const before = await harness
        .get(`/inventory/products/${productIds.PARA500}/fefo`, pharmacy.token)
        .expect(200);
      const stockBefore = before.body.reduce(
        (sum: number, l: { available_quantity: string }) => sum + Number(l.available_quantity),
        0,
      );

      const fulfilled = await harness
        .post(
          `/b2b/orders/${order.body.order.id}/fulfil`,
          { payments: [{ method: 'cash', amount: Number(order.body.order.total) }] },
          pharmacy.token,
        )
        .expect(201);

      expect(fulfilled.body.order.status).toBe('invoiced');
      expect(fulfilled.body.invoice).toBeTruthy();

      const after = await harness
        .get(`/inventory/products/${productIds.PARA500}/fefo`, pharmacy.token)
        .expect(200);
      const stockAfter = after.body.reduce(
        (sum: number, l: { available_quantity: string }) => sum + Number(l.available_quantity),
        0,
      );
      expect(stockBefore - stockAfter).toBe(20);
    });
  });

  // -----------------------------------------------------------------
  describe('Inventaire et alertes', () => {
    it("ouvre un inventaire, saisit un écart et le régularise", async () => {
      const count = await harness
        .post('/inventory/counts', { branchId, kind: 'partial' }, pharmacy.token)
        .expect(201);

      const sheet = await harness
        .get(`/inventory/counts/${count.body.id}`, pharmacy.token)
        .expect(200);
      const line = sheet.body.lines.find((l: { sku: string }) => l.sku === 'GANTS');
      const expected = Number(line.expected_quantity);

      await harness
        .post(
          `/inventory/counts/${count.body.id}/lines`,
          {
            lines: [
              {
                productId: productIds.GANTS,
                countedQuantity: expected - 3,
                reason: 'Casse constatée en rayon.',
              },
            ],
          },
          pharmacy.token,
        )
        .expect(201);

      const validated = await harness
        .post(`/inventory/counts/${count.body.id}/validate`, {}, pharmacy.token)
        .expect(201);
      expect(validated.body.adjustments).toBe(1);

      // L'écart devient un mouvement tracé, pas une correction silencieuse.
      const movements = await harness
        .get(`/inventory/movements?productId=${productIds.GANTS}&kind=inventory`, pharmacy.token)
        .expect(200);
      expect(movements.body).toHaveLength(1);
      expect(Number(movements.body[0].quantity)).toBe(-3);
      expect(movements.body[0].reason).toContain('Casse');
    });

    it('signale le passage sous le seuil de réapprovisionnement', async () => {
      // Le seuil des gants est fixé à 15 ; on descend le stock à 5.
      const before = await harness
        .get(`/inventory/stock?search=GANTS`, pharmacy.token)
        .expect(200);
      const onHand = Number(before.body[0].on_hand);

      await harness
        .post(
          '/sales',
          {
            lines: [{ productId: productIds.GANTS, quantity: onHand - 5 }],
            payments: [{ method: 'cash', amount: (onHand - 5) * 7 }],
          },
          pharmacy.token,
        )
        .expect(201);

      const alerts = await harness
        .get('/inventory/alerts?kind=low_stock', pharmacy.token)
        .expect(200);
      const gants = alerts.body.find((a: { sku: string }) => a.sku === 'GANTS');
      expect(gants).toBeDefined();
      expect(gants.severity).toBe('warning');
      expect(gants.details).toMatchObject({ onHand: 5, reorderPoint: 15 });
    });

    it("referme l'alerte une fois le stock reconstitué", async () => {
      await harness
        .post(
          '/inventory/adjustments',
          {
            branchId,
            productId: productIds.GANTS,
            quantity: 60,
            reason: 'Réapprovisionnement d’urgence.',
          },
          pharmacy.token,
        )
        .expect(201);

      const alerts = await harness
        .get('/inventory/alerts?kind=low_stock', pharmacy.token)
        .expect(200);
      expect(alerts.body.find((a: { sku: string }) => a.sku === 'GANTS')).toBeUndefined();
    });

    it('bloque un lot mis en quarantaine', async () => {
      const fefo = await harness
        .get(`/inventory/products/${productIds.AMOX250}/fefo`, pharmacy.token)
        .expect(200);
      const lotId = fefo.body[0].lot_id;

      await harness
        .post(
          `/inventory/lots/${lotId}/quarantine`,
          { quarantined: true, reason: 'Rappel de lot du fabricant.' },
          pharmacy.token,
        )
        .expect(201);

      const after = await harness
        .get(`/inventory/products/${productIds.AMOX250}/fefo`, pharmacy.token)
        .expect(200);
      expect(after.body).toHaveLength(0);

      const sale = await harness
        .post(
          '/sales',
          {
            lines: [{ productId: productIds.AMOX250, quantity: 1 }],
            payments: [{ method: 'cash', amount: 3.5 }],
            prescription: { patientName: 'Test' },
          },
          pharmacy.token,
        )
        .expect(409);
      expect(sale.body.message).toContain('Stock insuffisant');
    });
  });

  // -----------------------------------------------------------------
  describe('Caisse et pilotage', () => {
    it('clôture la caisse en conservant l’écart constaté', async () => {
      const current = await harness.get('/cash/current', pharmacy.token).expect(200);
      const expected = Number(current.body.session.expected_cash);

      const closed = await harness
        .post(
          `/cash/sessions/${current.body.session.id}/close`,
          { countedCash: expected - 2, notes: 'Deux dollars manquants.' },
          pharmacy.token,
        )
        .expect(201);

      expect(closed.body.variance).toBe(-2);
      expect(closed.body.message).toContain('manquant');
    });

    it('produit le tableau de bord opérationnel', async () => {
      const res = await harness.get('/reports/dashboard', pharmacy.token).expect(200);
      expect(res.body.today).toHaveProperty('revenue');
      expect(res.body.month.marginPercent).toBeGreaterThan(0);
      expect(res.body.stock.value).toBeGreaterThan(0);
      expect(res.body.topProducts.length).toBeGreaterThan(0);
      expect(res.body.timeline).toHaveLength(30);
    });

    it('trace toutes les opérations dans le journal d’audit', async () => {
      const res = await harness.get('/admin/audit-logs?limit=500', pharmacy.token).expect(200);
      const actions = res.body.map((l: { action: string }) => l.action);
      expect(actions).toContain('sales.completed');
      expect(actions).toContain('sales.cancelled');
      expect(actions).toContain('purchasing.goods_received');
      expect(actions).toContain('inventory.count_validated');
      expect(actions).toContain('cash.session_opened');
      expect(actions).toContain('cash.session_closed');
    });

    it("suggère un réapprovisionnement fondé sur la consommation", async () => {
      const res = await harness.get('/purchasing/replenishment', pharmacy.token).expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      const para = res.body.find((r: { sku: string }) => r.sku === 'PARA500');
      if (para) {
        expect(Number(para.daily_average)).toBeGreaterThan(0);
      }
    });
  });

  // -----------------------------------------------------------------
  describe("Parcours d'activation", () => {
    it('mesure la progression sur les données réelles', async () => {
      const res = await harness.get('/onboarding', pharmacy.token).expect(200);
      expect(res.body.total).toBe(12);
      const done = Object.fromEntries(
        res.body.steps.map((s: { code: string; done: boolean }) => [s.code, s.done]),
      );
      expect(done.organization_created).toBe(true);
      expect(done.catalog_import).toBe(true);
      expect(done.stock_import).toBe(true);
      expect(done.cash_register_configured).toBe(true);
      expect(done.production_validated).toBe(false);
      expect(res.body.progressPercent).toBeGreaterThan(50);
    });

    it("refuse la mise en production tant que des étapes manquent", async () => {
      const res = await harness
        .post('/onboarding/validate-production', {}, pharmacy.token)
        .expect(201);
      if (!res.body.validated) {
        expect(res.body.missing.length).toBeGreaterThan(0);
      }
    });

    it('valide la mise en production une fois le parcours complet', async () => {
      await harness
        .post(
          '/onboarding/payment-methods',
          { methods: ['cash', 'mobile_money', 'bank_transfer'] },
          pharmacy.token,
        )
        .expect(201);
      await harness.post('/onboarding/training', {}, pharmacy.token).expect(201);
      await harness
        .post(
          '/admin/users',
          {
            email: `vendeur@${organizationId.slice(0, 8)}.cd`,
            fullName: 'Vendeur',
            password: 'Nova2026Agent!',
            roleCodes: ['vendeur'],
          },
          pharmacy.token,
        )
        .expect(201);

      const res = await harness
        .post('/onboarding/validate-production', {}, pharmacy.token)
        .expect(201);
      expect(res.body.validated).toBe(true);
    });
  });
});
