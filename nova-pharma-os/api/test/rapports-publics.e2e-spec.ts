import { DatabaseService } from '../src/common/database/database.service';
import { SYSTEM_CONTEXT, systemTenantContext } from '../src/common/database/request-context';
import { Harness, Session, uniqueSlug } from './harness';

/**
 * Rapport mensuel pour les programmes publics (LOGIMEV / DHIS2) : calculé
 * depuis le registre des mouvements, dans le fuseau de la pharmacie (Goma,
 * UTC+2), équilibré, avec les jours de rupture et la quantité à commander ;
 * exporté en Excel et en fichier DHIS2 selon les codes saisis.
 */
describe('Rapport mensuel pour les programmes publics', () => {
  const harness = new Harness();
  const PASSWORD = 'Pharmacie2026!';
  let pharmacie: Session;
  let orgId: string;
  let amox: { id: string; sku: string };
  let sro: { id: string; sku: string };

  beforeAll(async () => {
    await harness.start();
    const superAdmin = await harness.loginPlatform('admin@novapharmaos.com');
    const slug = uniqueSlug('lmis');
    await harness
      .post('/platform/organizations', {
        slug, legalName: `PHARMACIE ${slug.toUpperCase()}`, countryCode: 'CD', city: 'Goma',
        planCode: 'business', startTrial: true,
        owner: { fullName: 'Gérant', email: `gerant@${slug}.cd`, password: PASSWORD },
      }, superAdmin.token)
      .expect(201);
    pharmacie = await harness.loginPharmacy(`gerant@${slug}.cd`, PASSWORD);
    const db = harness.app.get(DatabaseService);
    orgId = (await db.readTransaction(SYSTEM_CONTEXT, (tx) =>
      tx.oneOrFail<{ id: string }>('SELECT id FROM organizations WHERE slug = $1', [slug]))).id;
    amox = (await harness.post('/catalog/products', { name: 'Amoxicilline 500 mg', salePrice: 0.15 }, pharmacie.token).expect(201)).body;
    sro = (await harness.post('/catalog/products', { name: 'SRO sachet', salePrice: 0.1 }, pharmacie.token).expect(201)).body;
    // Mouvements datés, heure de Goma (UTC+2).
    const mouvements: [string, string, number][] = [
      ['2026-01-05 09:00', 'reception', 100],
      ['2026-01-20 10:00', 'sale', -15],
      ['2026-02-10 10:00', 'sale', -25],          // stock initial de mars : 60
      ['2026-03-03 10:00', 'sale', -40],
      ['2026-03-10 23:30', 'sale', -20],          // rupture le soir du 10…
      ['2026-03-14 08:00', 'reception', 200],     // … jusqu'au 14 : 4 jours
      ['2026-03-20 10:00', 'expiry_write_off', -5],
      ['2026-03-25 10:00', 'sale_return', 2],
      ['2026-03-28 10:00', 'inventory', -3],
      ['2026-03-31 23:30', 'sale', -10],          // encore mars à Goma (21 h 30 UTC)
      ['2026-04-01 00:30', 'sale', -7],           // déjà avril à Goma (22 h 30 UTC le 31)
    ];
    await db.transaction(systemTenantContext(orgId), async (tx) => {
      const branche = await tx.oneOrFail<{ id: string }>('SELECT id FROM branches WHERE organization_id = $1 LIMIT 1', [orgId]);
      for (const [quand, nature, q] of mouvements) {
        await tx.query(
          `INSERT INTO stock_movements (organization_id, branch_id, product_id, kind, quantity, occurred_at)
           VALUES ($1, $2, $3, $4, $5, ($6::timestamp AT TIME ZONE 'Africa/Lubumbashi'))`,
          [orgId, branche.id, amox.id, nature, q, quand],
        );
      }
    });
  }, 90_000);

  afterAll(async () => {
    await harness.stop();
  });

  it('calcule le mois dans le fuseau de la pharmacie, ligne équilibrée', async () => {
    const r = await harness.get('/reports/public-programs?month=2026-03', pharmacie.token).expect(200);
    expect(r.body.period).toMatchObject({ start: '2026-03-01', end: '2026-03-31', partial: false });
    expect(r.body.rows).toHaveLength(1);
    expect(r.body.rows[0]).toMatchObject({
      product: 'Amoxicilline 500 mg', opening: 60, received: 200, consumed: 68, losses: 5, adjustments: -3,
      closing: 184, stockoutDays: 4, amc: 36, requested: 0, mapped: false,
    });
    const l = r.body.rows[0];
    expect(l.opening + l.received - l.consumed - l.losses + l.adjustments).toBe(l.closing);
    const avril = await harness.get('/reports/public-programs?month=2026-04', pharmacie.token).expect(200);
    expect(avril.body.rows[0]).toMatchObject({ opening: 184, consumed: 7, closing: 177 });
  });

  it('la quantité à commander suit le stock maximum choisi', async () => {
    await harness.put('/reports/public-programs/settings', { maxMonths: 6, facilityCode: 'GOM-PH-0042' }, pharmacie.token).expect(200);
    const r = await harness.get('/reports/public-programs?month=2026-03', pharmacie.token).expect(200);
    expect(r.body.rows[0].requested).toBe(32); // 36 × 6 − 184
    expect(r.body.facility.code).toBe('GOM-PH-0042');
  });

  it('refuse un mois mal écrit, une agence inconnue, un identifiant DHIS2 invalide', async () => {
    await harness.get('/reports/public-programs?month=2026-13', pharmacie.token).expect(400);
    await harness.get('/reports/public-programs?month=2026-03&branchId=00000000-0000-4000-8000-000000000000', pharmacie.token).expect(400);
    await harness.put('/reports/public-programs/settings', { dhis2OrgUnit: 'trop-court' }, pharmacie.token).expect(400);
    await harness.put(`/reports/public-programs/mappings/${amox.id}`, { dhis2: { consumed: { de: '123' } } }, pharmacie.token).expect(400);
    await harness.put(`/reports/public-programs/mappings/${amox.id}`, { dhis2: { inconnu: { de: 'AbCdEfGhIj1' } } }, pharmacie.token).expect(400);
  });

  it('produit le fichier DHIS2 selon les correspondances saisies', async () => {
    await harness.get('/reports/public-programs/dhis2?month=2026-03', pharmacie.token).expect(400); // structure pas encore codée
    await harness.put('/reports/public-programs/settings', { dhis2OrgUnit: 'DiszpKrYNg8', dhis2DataSet: 'QX4ZTUbOt3a' }, pharmacie.token).expect(200);
    await harness.put(`/reports/public-programs/mappings/${amox.id}`, {
      nationalCode: 'MED-0001',
      dhis2: { consumed: { de: 'AbCdEfGhIj1' }, closing: { de: 'AbCdEfGhIj2', coc: 'ZyXwVuTsRq1' }, stockoutDays: { de: 'AbCdEfGhIj3' } },
    }, pharmacie.token).expect(200);
    const r = await harness.get('/reports/public-programs/dhis2?month=2026-03', pharmacie.token).expect(200);
    expect(r.body.fichier).toMatchObject({ dataSet: 'QX4ZTUbOt3a', period: '202603', orgUnit: 'DiszpKrYNg8', completeDate: '2026-03-31' });
    expect(r.body.fichier.dataValues).toEqual(expect.arrayContaining([
      { dataElement: 'AbCdEfGhIj1', period: '202603', orgUnit: 'DiszpKrYNg8', value: '68' },
      { dataElement: 'AbCdEfGhIj2', period: '202603', orgUnit: 'DiszpKrYNg8', categoryOptionCombo: 'ZyXwVuTsRq1', value: '184' },
      { dataElement: 'AbCdEfGhIj3', period: '202603', orgUnit: 'DiszpKrYNg8', value: '4' },
    ]));
    const fichier = await harness.get('/reports/public-programs/dhis2?month=2026-03&download=1', pharmacie.token).expect(200);
    expect(fichier.headers['content-disposition']).toContain('dhis2-2026-03.json');
  });

  it('importe les correspondances et signale les lignes fautives', async () => {
    const r = await harness.post('/reports/public-programs/mappings/import', {
      csv: [
        'reference_nova;code_national;rubrique;data_element;category_option_combo',
        `${sro.sku};MED-0107;consumed;SrOcOnSoMm1;`,
        `${sro.sku};;closing;SrOsToCkFn1;`,
        `${amox.sku};;received;AbCdEfGhIj4;`,
        'INCONNU;MED-9;;;',
        `${sro.sku};;consumed;mauvais;`,
      ].join('\n'),
    }, pharmacie.token).expect(201);
    expect(r.body).toMatchObject({ products: 2, added: 1, updated: 1 });
    expect(r.body.errors.map((e: { line: number }) => e.line)).toEqual([5, 6]);
    const liste = await harness.get('/reports/public-programs/mappings', pharmacie.token).expect(200);
    const a = liste.body.find((m: { product_id: string }) => m.product_id === amox.id);
    expect(Object.keys(a.dhis2).sort()).toEqual(['closing', 'consumed', 'received', 'stockoutDays']);
    expect(a.national_code).toBe('MED-0001');
    expect(liste.body.find((m: { product_id: string }) => m.product_id === sro.id)).toMatchObject({ national_code: 'MED-0107' });
  });

  it('exporte le classeur Excel ; seuls les produits reliés si demandé', async () => {
    const x = await harness.get('/reports/public-programs/workbook?month=2026-03', pharmacie.token).expect(200);
    expect(x.headers['content-type']).toContain('spreadsheetml');
    expect(x.headers['content-disposition']).toContain('rapport-mensuel-stock-2026-03.xlsx');
    // Le SRO, relié mais sans mouvement, n'apparaît pas : rien à déclarer.
    const relies = await harness.get('/reports/public-programs?month=2026-03&mappedOnly=true', pharmacie.token).expect(200);
    expect(relies.body.rows.map((l: { nationalCode: string }) => l.nationalCode)).toEqual(['MED-0001']);
  });
});
