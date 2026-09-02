import { Harness, Session, uniqueSlug } from './harness';

/**
 * Critères d'acceptation SaaS du cahier des charges NOVA PHARMA OS.
 *
 * Chaque test porte le numéro du critère qu'il vérifie. Les appels
 * traversent l'application complète — authentification, autorisation,
 * limites de forfait et Row-Level Security comprises.
 */
describe("Critères d'acceptation — commercialisation SaaS", () => {
  const harness = new Harness();

  let superAdmin: Session;
  let support: Session;

  // Pharmacie principale du scénario.
  let pharmacyOrgId: string;
  let pharmacySlug: string;
  let pharmacyOwnerEmail: string;
  let pharmacy: Session;

  // Pharmacie témoin, pour l'isolation.
  let otherOrgId: string;
  let other: Session;

  const OWNER_PASSWORD = 'Pharmacie2026!';

  beforeAll(async () => {
    await harness.start();
    superAdmin = await harness.loginPlatform('admin@novapharmaos.com');
    support = await harness.loginPlatform('support@novapharmaos.com');
  }, 90_000);

  afterAll(async () => {
    await harness.stop();
  });

  async function createPharmacy(
    planCode: string,
    startTrial = true,
  ): Promise<{ id: string; slug: string; email: string }> {
    const slug = uniqueSlug('pharma');
    const email = `gerant@${slug}.cd`;
    const res = await harness
      .post(
        '/platform/organizations',
        {
          slug,
          legalName: `PHARMACIE ${slug.toUpperCase()}`,
          countryCode: 'CD',
          city: 'Bukavu',
          planCode,
          startTrial,
          owner: {
            fullName: 'Gérant de test',
            email,
            password: OWNER_PASSWORD,
          },
        },
        superAdmin.token,
      )
      .expect(201);
    return { id: res.body.organization.id, slug, email };
  }

  // -----------------------------------------------------------------
  it("1. Le Super administrateur peut créer une pharmacie cliente", async () => {
    const created = await createPharmacy('professional');
    pharmacyOrgId = created.id;
    pharmacySlug = created.slug;
    pharmacyOwnerEmail = created.email;

    const res = await harness
      .get(`/platform/organizations/${pharmacyOrgId}`, superAdmin.token)
      .expect(200);

    expect(res.body.organization.slug).toBe(pharmacySlug);
    // Le provisionnement livre une pharmacie immédiatement exploitable.
    expect(res.body.subscription.plan_code).toBe('professional');
    expect(Number(res.body.usage.branches)).toBe(1);
    expect(Number(res.body.usage.users)).toBe(1);

    pharmacy = await harness.loginPharmacy(pharmacyOwnerEmail, OWNER_PASSWORD);
    expect(pharmacy.user.organizationSlug).toBe(pharmacySlug);
  });

  it("2. Une pharmacie peut démarrer un essai gratuit", async () => {
    const res = await harness
      .get(`/platform/organizations/${pharmacyOrgId}`, superAdmin.token)
      .expect(200);

    expect(res.body.organization.status).toBe('trial');
    expect(res.body.subscription.status).toBe('trialing');
    expect(res.body.subscription.trial_ends_at).toBeTruthy();
    expect(new Date(res.body.subscription.trial_ends_at).getTime()).toBeGreaterThan(
      Date.now(),
    );
  });

  it("3. Le Super administrateur peut attribuer ou modifier un forfait", async () => {
    await harness
      .post(
        `/platform/organizations/${pharmacyOrgId}/subscription/plan`,
        { planCode: 'business', reason: 'Montée de gamme à la demande du client.' },
        superAdmin.token,
      )
      .expect(201);

    const upgraded = await harness
      .get(`/platform/organizations/${pharmacyOrgId}`, superAdmin.token)
      .expect(200);
    expect(upgraded.body.subscription.plan_code).toBe('business');
    expect(upgraded.body.subscription.max_users).toBe(30);
    // Toute modification de forfait est historisée.
    expect(upgraded.body.planChanges.length).toBeGreaterThanOrEqual(2);

    await harness
      .post(
        `/platform/organizations/${pharmacyOrgId}/subscription/plan`,
        { planCode: 'professional', reason: 'Retour au forfait initial.' },
        superAdmin.token,
      )
      .expect(201);
  });

  it("4. Chaque forfait limite les utilisateurs, branches et modules", async () => {
    const starter = await createPharmacy('starter');
    const owner = await harness.loginPharmacy(starter.email, OWNER_PASSWORD);

    // Starter : 3 utilisateurs. Le compte administrateur en occupe un.
    for (let i = 1; i <= 2; i += 1) {
      await harness
        .post(
          '/admin/users',
          {
            email: `vendeur${i}@${starter.slug}.cd`,
            fullName: `Vendeur ${i}`,
            password: 'Nova2026Agent!',
            roleCodes: ['vendeur'],
          },
          owner.token,
        )
        .expect(201);
    }
    const refused = await harness
      .post(
        '/admin/users',
        {
          email: `vendeur3@${starter.slug}.cd`,
          fullName: 'Vendeur 3',
          password: 'Nova2026Agent!',
        },
        owner.token,
      )
      .expect(402);
    expect(refused.body.error).toBe('PlanLimit');
    expect(refused.body.details).toMatchObject({ quota: 'users', limit: 3 });

    // Starter : une seule branche.
    const branchRefused = await harness
      .post(
        '/admin/branches',
        { code: 'ANNEXE', name: 'Annexe Kadutu' },
        owner.token,
      )
      .expect(402);
    expect(branchRefused.body.details).toMatchObject({ quota: 'branches', limit: 1 });

    // Starter : le module B2B n'est pas inclus.
    const moduleRefused = await harness.get('/b2b/orders', owner.token).expect(402);
    expect(moduleRefused.body.details).toMatchObject({ module: 'b2b' });

    // Une option lève la limite d'utilisateurs.
    await harness
      .post(
        `/platform/organizations/${starter.id}/subscription/addons`,
        { addonCode: 'extra_user', quantity: 1 },
        superAdmin.token,
      )
      .expect(201);
    harness.invalidate(starter.id);
    await harness
      .post(
        '/admin/users',
        {
          email: `vendeur3@${starter.slug}.cd`,
          fullName: 'Vendeur 3',
          password: 'Nova2026Agent!',
        },
        owner.token,
      )
      .expect(201);
  });

  it("5. Une facture SaaS est générée automatiquement", async () => {
    await harness.expirePeriod(pharmacyOrgId);
    const job = await harness
      .post('/platform/jobs/billing-cycle/run', {}, superAdmin.token)
      .expect(201);
    expect(job.body.details.failed).toHaveLength(0);

    const res = await harness
      .get(`/platform/billing/invoices?organizationId=${pharmacyOrgId}`, superAdmin.token)
      .expect(200);
    const invoice = res.body.data.find((i: { kind: string }) => i.kind === 'invoice');
    expect(invoice).toBeDefined();
    expect(Number(invoice.total)).toBeGreaterThan(0);
    expect(invoice.status).toBe('issued');
  });

  it("5b. Le rejeu de la facturation ne produit pas de doublon", async () => {
    const before = await harness
      .get(`/platform/billing/invoices?organizationId=${pharmacyOrgId}`, superAdmin.token)
      .expect(200);
    await harness.post('/platform/jobs/billing-cycle/run', {}, superAdmin.token).expect(201);
    const after = await harness
      .get(`/platform/billing/invoices?organizationId=${pharmacyOrgId}`, superAdmin.token)
      .expect(200);
    expect(after.body.pagination.total).toBe(before.body.pagination.total);
  });

  it("6. Les paiements d'abonnement sont enregistrés et rapprochés", async () => {
    const invoices = await harness
      .get(
        `/platform/billing/invoices?organizationId=${pharmacyOrgId}&status=issued`,
        superAdmin.token,
      )
      .expect(200);
    const invoice = invoices.body.data[0];

    const paid = await harness
      .post(
        `/platform/billing/organizations/${pharmacyOrgId}/payments`,
        {
          invoiceId: invoice.id,
          method: 'mobile_money',
          provider: 'M-Pesa',
          amount: Number(invoice.balance),
          externalReference: `MPESA-${invoice.number}`,
          idempotencyKey: `pay-${invoice.number}`,
          confirm: true,
        },
        superAdmin.token,
      )
      .expect(201);

    expect(paid.body.invoice.status).toBe('paid');
    expect(Number(paid.body.invoice.balance)).toBe(0);

    // Le rejeu du même règlement n'encaisse pas deux fois.
    const replayed = await harness
      .post(
        `/platform/billing/organizations/${pharmacyOrgId}/payments`,
        {
          invoiceId: invoice.id,
          method: 'mobile_money',
          amount: Number(invoice.total),
          idempotencyKey: `pay-${invoice.number}`,
          confirm: true,
        },
        superAdmin.token,
      )
      .expect(201);
    expect(replayed.body.duplicate).toBe(true);
  });

  it("7. Les relances d'impayé sont envoyées automatiquement", async () => {
    // Nouvelle période facturée, laissée impayée 10 jours.
    await harness.expirePeriod(pharmacyOrgId);
    await harness.post('/platform/jobs/billing-cycle/run', {}, superAdmin.token).expect(201);
    await harness.setInvoiceOverdue(pharmacyOrgId, 10);

    const job = await harness
      .post('/platform/jobs/dunning/run', {}, superAdmin.token)
      .expect(201);
    expect(job.body.details.sent.length).toBeGreaterThan(0);

    const invoices = await harness
      .get(
        `/platform/billing/invoices?organizationId=${pharmacyOrgId}&status=overdue`,
        superAdmin.token,
      )
      .expect(200);
    const overdue = invoices.body.data[0];
    const detail = await harness
      .get(`/platform/billing/invoices/${overdue.id}`, superAdmin.token)
      .expect(200);
    expect(detail.body.dunning.length).toBeGreaterThan(0);

    // Une seconde exécution ne redouble pas les relances déjà émises.
    const replay = await harness
      .post('/platform/jobs/dunning/run', {}, superAdmin.token)
      .expect(201);
    const again = await harness
      .get(`/platform/billing/invoices/${overdue.id}`, superAdmin.token)
      .expect(200);
    expect(again.body.dunning.length).toBe(detail.body.dunning.length);
    expect(replay.body.details.sent).toHaveLength(0);
  });

  it("8. Une pharmacie impayée peut être suspendue sans perdre ses données", async () => {
    // Catalogue créé avant la suspension : il doit survivre.
    await harness
      .post(
        '/catalog/products',
        { sku: 'TEST-SUSP', name: 'Produit témoin', salePrice: 1 },
        pharmacy.token,
      )
      .expect(201);

    await harness.setInvoiceOverdue(pharmacyOrgId, 45);
    const job = await harness
      .post('/platform/jobs/dunning/run', {}, superAdmin.token)
      .expect(201);
    expect(job.body.details.suspended).toContain(pharmacySlug);

    harness.invalidate(pharmacyOrgId);
    pharmacy = await harness.loginPharmacy(pharmacyOwnerEmail, OWNER_PASSWORD);
    expect(pharmacy.user.readonly).toBe(true);

    // Les données critiques restent consultables.
    const catalogue = await harness.get('/catalog/products', pharmacy.token).expect(200);
    expect(catalogue.body.pagination.total).toBeGreaterThan(0);
    await harness.get('/reports/dashboard', pharmacy.token).expect(200);

    // Toute écriture est refusée.
    const refused = await harness
      .post(
        '/catalog/products',
        { sku: 'TEST-BLOQUE', name: 'Refusé', salePrice: 1 },
        pharmacy.token,
      )
      .expect(403);
    expect(refused.body.message).toContain('suspendu');
  });

  it("9. Une pharmacie réactivée retrouve ses données et ses accès", async () => {
    const invoices = await harness
      .get(
        `/platform/billing/invoices?organizationId=${pharmacyOrgId}&status=overdue`,
        superAdmin.token,
      )
      .expect(200);

    for (const invoice of invoices.body.data) {
      await harness
        .post(
          `/platform/billing/organizations/${pharmacyOrgId}/payments`,
          {
            invoiceId: invoice.id,
            method: 'bank_transfer',
            amount: Number(invoice.balance),
            idempotencyKey: `settle-${invoice.number}`,
            confirm: true,
          },
          superAdmin.token,
        )
        .expect(201);
    }

    harness.invalidate(pharmacyOrgId);
    pharmacy = await harness.loginPharmacy(pharmacyOwnerEmail, OWNER_PASSWORD);
    expect(pharmacy.user.readonly).toBe(false);
    expect(pharmacy.user.subscriptionStatus).toBe('active');

    // Les données antérieures à la suspension sont intactes.
    const catalogue = await harness
      .get('/catalog/products?q=TEST-SUSP', pharmacy.token)
      .expect(200);
    expect(catalogue.body.pagination.total).toBe(1);

    // L'écriture est de nouveau possible.
    await harness
      .post(
        '/catalog/products',
        { sku: 'TEST-REACTIVE', name: 'Après réactivation', salePrice: 1 },
        pharmacy.token,
      )
      .expect(201);
  });

  it("10. Les données d'une pharmacie sont invisibles aux autres pharmacies", async () => {
    const otherPharmacy = await createPharmacy('professional');
    otherOrgId = otherPharmacy.id;
    other = await harness.loginPharmacy(otherPharmacy.email, OWNER_PASSWORD);

    // Aucune donnée de la première pharmacie n'apparaît chez la seconde.
    const catalogue = await harness.get('/catalog/products', other.token).expect(200);
    expect(catalogue.body.pagination.total).toBe(0);
    const sales = await harness.get('/sales', other.token).expect(200);
    expect(sales.body.pagination.total).toBe(0);

    // L'accès direct par identifiant échoue également.
    const mine = await harness
      .get('/catalog/products?q=TEST-SUSP', pharmacy.token)
      .expect(200);
    const productId = mine.body.data[0].id;
    await harness.get(`/catalog/products/${productId}`, other.token).expect(404);

    // Comme la tentative d'écriture croisée.
    await harness
      .post(
        '/sales',
        {
          lines: [{ productId, quantity: 1 }],
          payments: [{ method: 'cash', amount: 1 }],
        },
        other.token,
      )
      .expect(404);

    // Et les utilisateurs de l'une ne sont pas visibles de l'autre.
    const users = await harness.get('/admin/users', other.token).expect(200);
    expect(users.body).toHaveLength(1);
  });

  it("11. Les accès du support sont limités, autorisés et journalisés", async () => {
    const requested = await harness
      .post(
        `/platform/organizations/${pharmacyOrgId}/support-access`,
        {
          reason: "Vérification d'un écart de stock signalé par la pharmacie.",
          mode: 'read_only',
          durationHours: 2,
        },
        support.token,
      )
      .expect(201);
    const grantId = requested.body.grant.id;
    expect(requested.body.grant.status).toBe('requested');

    // Sans validation du client, aucune session n'est délivrée.
    await harness
      .post(`/platform/support/access-grants/${grantId}/session`, {}, support.token)
      .expect(403);

    // La pharmacie voit qui demande l'accès, et pourquoi.
    const seen = await harness.get('/account/support-access', pharmacy.token).expect(200);
    const grant = seen.body.find((g: { id: string }) => g.id === grantId);
    expect(grant.agent_email).toBe('support@novapharmaos.com');
    expect(grant.reason).toContain('écart de stock');

    await harness
      .post(`/account/support-access/${grantId}/approve`, {}, pharmacy.token)
      .expect(201);

    const session = await harness
      .post(`/platform/support/access-grants/${grantId}/session`, {}, support.token)
      .expect(201);
    expect(session.body.mode).toBe('read_only');

    // L'agent lit, mais n'écrit pas.
    await harness.get('/inventory/stock', session.body.accessToken).expect(200);
    await harness
      .post(
        '/catalog/products',
        { sku: 'SUPPORT-ECRIT', name: 'Interdit', salePrice: 1 },
        session.body.accessToken,
      )
      .expect(403);

    // Il ne voit pas davantage les autres pharmacies.
    await harness
      .get(`/platform/organizations/${otherOrgId}`, session.body.accessToken)
      .expect(404);

    // La pharmacie consulte le détail des actions réalisées.
    await new Promise((resolve) => setTimeout(resolve, 200));
    const events = await harness
      .get(`/account/support-access/${grantId}/events`, pharmacy.token)
      .expect(200);
    const actions = events.body.map((e: { action: string }) => e.action);
    expect(actions).toContain('support.session_opened');
    expect(actions).toContain('support.request.success');
    expect(actions).toContain('support.request.refused');

    // Elle peut révoquer l'accès à tout moment.
    await harness
      .post(
        `/account/support-access/${grantId}/revoke`,
        { reason: 'Intervention terminée.' },
        pharmacy.token,
      )
      .expect(201);
    await harness.get('/inventory/stock', session.body.accessToken).expect(403);
  });

  it("11b. Le back-office SaaS ne voit pas les données métier sans accès accordé", async () => {
    // Le contexte plateforme n'ouvre aucune politique sur les tables tenant.
    await harness.get('/catalog/products', superAdmin.token).expect(403);
    await harness.get('/sales', superAdmin.token).expect(403);
  });

  it("12. Le tableau de bord SaaS affiche abonnements, revenus et impayés", async () => {
    await harness.post('/platform/jobs/usage-metrics/run', {}, superAdmin.token).expect(201);
    const res = await harness
      .get('/platform/metrics/dashboard', superAdmin.token)
      .expect(200);

    expect(res.body.portfolio.totalPharmacies).toBeGreaterThanOrEqual(3);
    expect(res.body.revenue).toHaveProperty('mrr');
    expect(res.body.revenue).toHaveProperty('arr');
    expect(res.body.revenue.byPlan.length).toBeGreaterThan(0);
    expect(res.body.conversion).toHaveProperty('rate');
    expect(res.body.churn).toHaveProperty('rate');
    expect(res.body.receivables).toHaveProperty('outstanding');
    expect(res.body.support).toHaveProperty('openTickets');
    expect(res.body.platform).toHaveProperty('availabilityPercent');
    expect(res.body.moduleAdoption.length).toBeGreaterThan(0);

    // Un forfait sans abonnement compte zéro, pas un.
    const enterprise = res.body.revenue.byPlan.find(
      (p: { planCode: string }) => p.planCode === 'enterprise',
    );
    expect(enterprise.subscriptions).toBe(0);
  });

  it("13. Les journaux d'audit fonctionnent au niveau pharmacie et plateforme", async () => {
    const tenantLogs = await harness.get('/admin/audit-logs', pharmacy.token).expect(200);
    expect(tenantLogs.body.length).toBeGreaterThan(0);
    expect(tenantLogs.body.some((l: { action: string }) => l.action === 'auth.login')).toBe(
      true,
    );

    const platformLogs = await harness
      .get(`/platform/audit-logs?organizationId=${pharmacyOrgId}`, superAdmin.token)
      .expect(200);
    expect(
      platformLogs.body.some(
        (l: { action: string }) => l.action === 'organization.provisioned',
      ),
    ).toBe(true);
    expect(
      platformLogs.body.some((l: { action: string }) => l.action.startsWith('billing.')),
    ).toBe(true);

    // Le journal de la pharmacie ne fuit pas vers une autre pharmacie.
    const otherLogs = await harness.get('/admin/audit-logs', other.token).expect(200);
    expect(
      otherLogs.body.every((l: { entity_id: string }) => l.entity_id !== pharmacyOrgId),
    ).toBe(true);
  });

  it("14. Les sauvegardes permettent une restauration ciblée par organisation", async () => {
    const backup = await harness
      .post(`/platform/organizations/${pharmacyOrgId}/backups`, {}, superAdmin.token)
      .expect(201);
    expect(backup.body.status).toBe('completed');
    expect(backup.body.checksum).toHaveLength(64);

    const before = await harness.get('/catalog/products', pharmacy.token).expect(200);
    expect(before.body.pagination.total).toBeGreaterThan(0);

    // Le témoin de l'autre pharmacie doit rester intact après restauration.
    await harness
      .post(
        '/catalog/products',
        { sku: 'TEMOIN-AUTRE', name: 'Témoin pharmacie voisine', salePrice: 1 },
        other.token,
      )
      .expect(201);

    // Sinistre : le catalogue de la première pharmacie est perdu.
    await harness
      .post(
        '/catalog/products',
        { sku: 'APRES-SAUVEGARDE', name: 'Créé après la sauvegarde', salePrice: 1 },
        pharmacy.token,
      )
      .expect(201);

    // Une confirmation erronée est refusée.
    await harness
      .post(
        '/platform/backups/restore',
        { backupId: backup.body.id, confirmSlug: 'mauvais-identifiant' },
        superAdmin.token,
      )
      .expect(400);

    const restored = await harness
      .post(
        '/platform/backups/restore',
        { backupId: backup.body.id, confirmSlug: pharmacySlug },
        superAdmin.token,
      )
      .expect(201);
    expect(restored.body.message).toContain(pharmacySlug);

    // L'état sauvegardé est rétabli : le produit postérieur a disparu.
    const after = await harness
      .get('/catalog/products?q=APRES-SAUVEGARDE', pharmacy.token)
      .expect(200);
    expect(after.body.pagination.total).toBe(0);
    expect(
      (await harness.get('/catalog/products', pharmacy.token)).body.pagination.total,
    ).toBe(before.body.pagination.total);

    // La pharmacie voisine n'a pas été touchée.
    const neighbour = await harness
      .get('/catalog/products?q=TEMOIN-AUTRE', other.token)
      .expect(200);
    expect(neighbour.body.pagination.total).toBe(1);
  });

  it("15. Les modules et options sont activables selon le forfait souscrit", async () => {
    const starter = await createPharmacy('starter');
    const owner = await harness.loginPharmacy(starter.email, OWNER_PASSWORD);

    await harness.get('/b2b/orders', owner.token).expect(402);

    // Activation ponctuelle par le back-office, indépendamment du forfait.
    await harness
      .post(
        '/platform/plans/features/flags',
        {
          organizationId: starter.id,
          featureCode: 'b2b',
          enabled: true,
          note: 'Pilote commercial.',
        },
        superAdmin.token,
      )
      .expect(201);

    const flags = await harness
      .get(`/platform/plans/features/flags?organizationId=${starter.id}`, superAdmin.token)
      .expect(200);
    expect(flags.body.some((f: { feature_code: string }) => f.feature_code === 'b2b')).toBe(
      true,
    );

    // Le passage au forfait supérieur ouvre le module de plein droit.
    await harness
      .post(
        `/platform/organizations/${starter.id}/subscription/plan`,
        { planCode: 'business', reason: 'Souscription du forfait Business.' },
        superAdmin.token,
      )
      .expect(201);
    harness.invalidate(starter.id);
    const upgraded = await harness.loginPharmacy(starter.email, OWNER_PASSWORD);
    await harness.get('/b2b/orders', upgraded.token).expect(200);
  });

  it("16. La résiliation conserve les données pendant la durée contractuelle", async () => {
    const doomed = await createPharmacy('starter');
    const res = await harness
      .post(
        `/platform/organizations/${doomed.id}/terminate`,
        { reason: 'Fermeture de l’officine.', retentionDays: 365 },
        superAdmin.token,
      )
      .expect(201);

    expect(res.body.organization.status).toBe('terminated');
    expect(res.body.organization.data_retention_until).toBeTruthy();

    // Une sauvegarde préalable est planifiée avant toute purge.
    const backups = await harness
      .get(`/platform/organizations/${doomed.id}/backups`, superAdmin.token)
      .expect(200);
    expect(backups.body.some((b: { kind: string }) => b.kind === 'pre_termination')).toBe(
      true,
    );

    // L'accès est fermé, mais l'organisation reste consultable côté éditeur.
    harness.invalidate(doomed.id);
    await harness.post('/auth/login', { email: doomed.email, password: OWNER_PASSWORD }).expect(403);
    await harness.get(`/platform/organizations/${doomed.id}`, superAdmin.token).expect(200);
  });

  it("17. Paiements et abonnements sont protégés des doublons de synchronisation", async () => {
    await harness.expirePeriod(pharmacyOrgId);
    await harness.post('/platform/jobs/billing-cycle/run', {}, superAdmin.token).expect(201);

    const invoices = await harness
      .get(
        `/platform/billing/invoices?organizationId=${pharmacyOrgId}&status=issued`,
        superAdmin.token,
      )
      .expect(200);
    const invoice = invoices.body.data[0];

    // Deux appels concurrents portant la même clé d'idempotence.
    const [first, second] = await Promise.all([
      harness.post(
        `/platform/billing/organizations/${pharmacyOrgId}/payments`,
        {
          invoiceId: invoice.id,
          method: 'mobile_money',
          amount: Number(invoice.balance),
          idempotencyKey: `concurrent-${invoice.number}`,
          confirm: true,
        },
        superAdmin.token,
      ),
      harness.post(
        `/platform/billing/organizations/${pharmacyOrgId}/payments`,
        {
          invoiceId: invoice.id,
          method: 'mobile_money',
          amount: Number(invoice.balance),
          idempotencyKey: `concurrent-${invoice.number}`,
          confirm: true,
        },
        superAdmin.token,
      ),
    ]);

    // L'un aboutit, l'autre est rejeté ou reconnu comme doublon : dans
    // tous les cas, la facture n'est réglée qu'une fois.
    const outcomes = [first.status, second.status];
    expect(outcomes.filter((s) => s === 201).length).toBeGreaterThanOrEqual(1);

    const detail = await harness
      .get(`/platform/billing/invoices/${invoice.id}`, superAdmin.token)
      .expect(200);
    const confirmed = detail.body.payments.filter(
      (p: { status: string }) => p.status === 'confirmed',
    );
    const total = confirmed.reduce(
      (sum: number, p: { amount: string }) => sum + Number(p.amount),
      0,
    );
    expect(total).toBeCloseTo(Number(invoice.total), 2);
    expect(Number(detail.body.invoice.balance)).toBe(0);
  });
});
