import { QueryResultRow } from 'pg';
import { DatabaseService } from '../src/common/database/database.service';
import { SYSTEM_CONTEXT, systemTenantContext } from '../src/common/database/request-context';
import { Harness, Session, uniqueSlug } from './harness';

/**
 * Sauvegarde et restauration d'une pharmacie, sur des données qui
 * touchent toutes les difficultés : tables ajoutées au fil des versions
 * (traitements suivis, fidélité, réservations, rappels, dépenses), cycle de
 * clés entre commande professionnelle, devis et facture, catégorie
 * rattachée à une catégorie parente, photo binaire, lignes JSON, tableau
 * de numéros de lot.
 */
describe('Sauvegarde complète d’une pharmacie', () => {
  const harness = new Harness();
  const PASSWORD = 'Pharmacie2026!';
  let superAdmin: Session;
  let pharmacie: Session;
  let slug: string;
  let orgId: string;
  let produit: string;
  let client: string;
  let sauvegarde: string;
  const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('ordonnance-de-test')]);

  const sql = <T extends QueryResultRow = Record<string, unknown>>(texte: string, params: unknown[] = []) =>
    harness.app.get(DatabaseService).readTransaction(systemTenantContext(orgId), (tx) => tx.many<T>(texte, params));
  /** Empreinte de toutes les données de la pharmacie, table par table. */
  const comptes = async () => {
    const tables = await sql<{ t: string }>(
      `SELECT DISTINCT c.relname AS t FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
        WHERE p.polname = c.relname || '_tenant_select' ORDER BY 1`,
    );
    const r: Record<string, number> = {};
    for (const { t } of tables) {
      // Le journal d'audit grandit à chaque opération, sauvegarde comprise : il n'entre pas dans la comparaison.
      if (t === 'audit_logs') continue;
      r[t] = Number((await sql<{ n: string }>(`SELECT count(*) AS n FROM "${t}" WHERE organization_id = $1`, [orgId]))[0].n);
    }
    return r;
  };

  beforeAll(async () => {
    await harness.start();
    superAdmin = await harness.loginPlatform('admin@novapharmaos.com');
    slug = uniqueSlug('svg');
    await harness
      .post('/platform/organizations', {
        slug, legalName: `PHARMACIE ${slug.toUpperCase()}`, countryCode: 'CD', city: 'Goma',
        planCode: 'business', startTrial: true,
        owner: { fullName: 'Gérante', email: `gerant@${slug}.cd`, password: PASSWORD },
      }, superAdmin.token)
      .expect(201);
    pharmacie = await harness.loginPharmacy(`gerant@${slug}.cd`, PASSWORD);
    orgId = (await harness.app.get(DatabaseService).readTransaction(SYSTEM_CONTEXT, (tx) =>
      tx.oneOrFail<{ id: string }>('SELECT id FROM organizations WHERE slug = $1', [slug]))).id;

    produit = (await harness.post('/catalog/products', { name: 'Paracétamol 500 mg', salePrice: 1 }, pharmacie.token).expect(201)).body.id;
    await harness.post('/inventory/receptions', { lines: [{ productId: produit, quantity: 200, unitCost: 0.4, lotNumber: 'SVG-1', expiryDate: '2028-12-31' }] }, pharmacie.token).expect(201);
    await harness.post('/cash/rates', { baseCurrency: 'USD', quoteCurrency: 'CDF', rate: 2800, changeRounding: 100 }, pharmacie.token).expect(201);
    await harness.post('/cash/sessions', { openingFloat: 10, openingFloats: [{ currency: 'CDF', amount: 20000 }] }, pharmacie.token).expect(201);
    client = (await harness.post('/customers', { name: 'Clinique Amani', phone: '0991112233', kind: 'professional', creditLimit: 500 }, pharmacie.token).expect(201)).body.id;

    // Catégorie rattachée à une catégorie parente (clé vers la même table).
    await harness.app.get(DatabaseService).transaction(systemTenantContext(orgId), (tx) => tx.query(
      `WITH m AS (INSERT INTO product_categories (organization_id, code, name) VALUES ($1, 'MED', 'Médicaments') RETURNING id)
       INSERT INTO product_categories (organization_id, parent_id, code, name) SELECT $1, id, 'ANALG', 'Antalgiques' FROM m`,
      [orgId],
    ));
    // Cycle devis → commande → facture → commande.
    const devis = await harness.post('/b2b/quotes', { customerId: client, lines: [{ productId: produit, quantity: 20 }] }, pharmacie.token).expect(201);
    const commande = await harness.post(`/b2b/quotes/${devis.body.quote.id}/convert`, {}, pharmacie.token).expect(201);
    await harness.post(`/b2b/orders/${commande.body.order.id}/fulfil`, { payments: [{ method: 'cash', amount: Number(commande.body.order.total) }] }, pharmacie.token).expect(201);
    // Tables récentes.
    await harness.post('/treatments', { customerId: client, productId: produit, daysPerUnit: 30, lastDispensedAt: '2026-09-01', lastQuantity: 1 }, pharmacie.token).expect(201);
    await harness.put('/loyalty/program', { isEnabled: true }, pharmacie.token).expect(200);
    await harness.post('/sales', { customerId: client, lines: [{ productId: produit, quantity: 5 }], payments: [{ method: 'cash', amount: 14000, currency: 'CDF' }] }, pharmacie.token).expect(201);
    await harness.post('/expenses', { category: 'carburant', label: 'Gasoil', amount: 28000, currency: 'CDF', fromCash: true }, pharmacie.token).expect(201);
    await harness.post('/recalls', { kind: 'recall', title: 'Rappel du lot SVG-1', productId: produit, lotNumbers: ['SVG-1', 'SVG 2'] }, pharmacie.token).expect(201);
    await harness.put('/public-profile', { isPublished: true }, pharmacie.token).expect(200);
    await harness.post(`/public/pharmacies/${slug}/reservations`, {
      name: 'Maman Furaha', phone: '0997001122', lines: [{ productId: produit, quantity: 2 }],
      prescriptionPhoto: `data:image/jpeg;base64,${JPEG.toString('base64')}`,
    }).expect(201);
  }, 120_000);

  afterAll(async () => {
    await harness.stop();
  });

  it('sauvegarde toutes les tables de la pharmacie, y compris les plus récentes', async () => {
    const b = await harness.post(`/platform/organizations/${orgId}/backups`, {}, superAdmin.token).expect(201);
    sauvegarde = b.body.id;
    const tables = b.body.table_counts as Record<string, number>;
    for (const t of ['treatment_plans', 'loyalty_entries', 'loyalty_programs', 'reservations', 'reservation_files', 'lot_recalls',
      'expenses', 'exchange_rates', 'cash_session_currencies', 'payers', 'outbound_messages', 'public_profiles', 'b2b_orders', 'product_categories']) {
      expect(tables).toHaveProperty(t);
    }
    expect(tables.treatment_plans).toBe(1);
    expect(tables.reservation_files).toBe(1);
    expect(tables.product_categories).toBe(2);
  });

  it('restaure exactement l’état sauvegardé, sans rien perdre en route', async () => {
    const avant = await comptes();
    // Après la sauvegarde : nouvelles données, suppressions.
    const p2 = (await harness.post('/catalog/products', { name: 'Ibuprofène 400 mg', salePrice: 1 }, pharmacie.token).expect(201)).body.id;
    await harness.post('/treatments', { customerId: client, productId: p2, daysPerUnit: 15 }, pharmacie.token).expect(201);
    await harness.post('/expenses', { category: 'loyer', label: 'Loyer', amount: 100, paymentMethod: 'bank' }, pharmacie.token).expect(201);
    expect(await comptes()).not.toEqual(avant);

    const r = await harness.post('/platform/backups/restore', { backupId: sauvegarde, confirmSlug: slug }, superAdmin.token).expect(201);
    expect(r.body.message).toContain(slug);
    expect(await comptes()).toEqual(avant);

    // Le cycle de clés est rétabli : la commande pointe vers sa facture et son devis.
    const [cmd] = await sql<{ invoice_id: string | null; quote_id: string | null }>('SELECT invoice_id, quote_id FROM b2b_orders');
    expect(cmd.invoice_id).toBeTruthy();
    expect(cmd.quote_id).toBeTruthy();
    const [lien] = await sql<{ n: string }>('SELECT count(*) AS n FROM b2b_orders o JOIN invoices i ON i.id = o.invoice_id JOIN b2b_quotes q ON q.id = o.quote_id');
    expect(Number(lien.n)).toBe(1);
    // La catégorie fille retrouve sa mère.
    const [fille] = await sql<{ parent: string }>(`SELECT p.code AS parent FROM product_categories c JOIN product_categories p ON p.id = c.parent_id WHERE c.code = 'ANALG'`);
    expect(fille.parent).toBe('MED');
    // Photo, lignes JSON et tableau de lots intacts.
    const [photo] = await sql<{ data: Buffer }>('SELECT data FROM reservation_files');
    expect(Buffer.compare(photo.data, JPEG)).toBe(0);
    const [res] = await sql<{ lines: { quantity: number }[] }>('SELECT lines FROM reservations');
    expect(res.lines).toEqual([expect.objectContaining({ productId: produit, quantity: 2 })]);
    const [rappel] = await sql<{ lot_numbers: string[] }>('SELECT lot_numbers FROM lot_recalls');
    expect(rappel.lot_numbers).toEqual(['SVG-1', 'SVG 2']);

    // La pharmacie fonctionne après restauration : le lot rappelé reste en quarantaine, les créations repartent.
    await harness.post('/sales', { customerId: client, lines: [{ productId: produit, quantity: 1 }], payments: [{ method: 'cash', amount: 1 }] }, pharmacie.token).expect(409);
    const libre = (await harness.post('/catalog/products', { name: 'Vitamine C', salePrice: 1 }, pharmacie.token).expect(201)).body.id;
    expect(libre).toBeTruthy();
  });
});
