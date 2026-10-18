import { DatabaseService } from '../src/common/database/database.service';
import { SYSTEM_CONTEXT, systemTenantContext } from '../src/common/database/request-context';
import { Harness, Session, uniqueSlug } from './harness';

/**
 * Alertes d'interactions : par le nom ou la molécule du produit, par
 * classe thérapeutique, entre produits du ticket et avec les traitements
 * suivis du patient ; sans fausse alerte sur un mot voisin ; liste tenue et
 * importée par le back-office.
 */
describe('Interactions médicamenteuses', () => {
  const harness = new Harness();
  const PASSWORD = 'Pharmacie2026!';
  let superAdmin: Session;
  let pharmacie: Session;
  let orgId: string;
  const p: Record<string, string> = {};

  const verifier = (ids: string[], customerId?: string) =>
    harness.post('/interactions/check', { productIds: ids, ...(customerId ? { customerId } : {}) }, pharmacie.token).expect(201);

  beforeAll(async () => {
    await harness.start();
    superAdmin = await harness.loginPlatform('admin@novapharmaos.com');
    const slug = uniqueSlug('int');
    await harness
      .post('/platform/organizations', {
        slug, legalName: `PHARMACIE ${slug.toUpperCase()}`, countryCode: 'CD', city: 'Goma',
        planCode: 'business', startTrial: true,
        owner: { fullName: 'Gérant', email: `gerant@${slug}.cd`, password: PASSWORD },
      }, superAdmin.token)
      .expect(201);
    pharmacie = await harness.loginPharmacy(`gerant@${slug}.cd`, PASSWORD);
    orgId = (await harness.app.get(DatabaseService).readTransaction(SYSTEM_CONTEXT, (tx) =>
      tx.oneOrFail<{ id: string }>('SELECT id FROM organizations WHERE slug = $1', [slug]))).id;
    for (const [cle, nom] of [
      ['warfarine', 'Warfarine 5 mg'], ['ibuprofene', 'Ibuprofène 400 mg'], ['paracetamol', 'Paracétamol 500 mg'],
      ['sildenafil', 'Sildénafil 50 mg'], ['trinitrine', 'Trinitrine 0,15 mg spray'], ['cipro', 'Ciprofloxacine 500 mg'],
      ['fer', 'Sulfate ferreux 200 mg'], ['losartan', 'Losartan 50 mg'], ['augmentin', 'Amoxicilline acide clavulanique (clavulanate de potassium)'],
      ['coumadine', 'Coumadine 2 mg'],
    ]) {
      p[cle] = (await harness.post('/catalog/products', { name: nom, salePrice: 1 }, pharmacie.token).expect(201)).body.id;
    }
    // « Coumadine » ne dit rien de sa substance : sa molécule (DCI) est renseignée.
    await harness.app.get(DatabaseService).transaction(systemTenantContext(orgId), (tx) => tx.query(
      `WITH m AS (INSERT INTO molecules (organization_id, inn) VALUES ($1, 'Warfarine') RETURNING id)
       UPDATE products SET molecule_id = (SELECT id FROM m) WHERE id = $2`,
      [orgId, p.coumadine],
    ));
  }, 90_000);

  afterAll(async () => {
    await harness.stop();
  });

  it('signale une association déconseillée par classe (antivitamine K + AINS), pas le paracétamol', async () => {
    const r = await verifier([p.warfarine, p.ibuprofene, p.paracetamol]);
    expect(r.body.alerts).toHaveLength(1);
    expect(r.body.alerts[0]).toMatchObject({ severity: 'deconseillee', source: 'Thésaurus ANSM' });
    expect(r.body.alerts[0].products.map((x: { name: string }) => x.name).sort()).toEqual(['Ibuprofène 400 mg', 'Warfarine 5 mg']);
    expect((await verifier([p.warfarine, p.paracetamol])).body.alerts).toHaveLength(0);
  });

  it('classe les contre-indications en premier', async () => {
    const r = await verifier([p.cipro, p.fer, p.sildenafil, p.trinitrine]);
    expect(r.body.alerts.map((a: { severity: string }) => a.severity)).toEqual(['contre_indication', 'precaution']);
    expect(r.body.alerts[1].advice).toContain('à distance');
  });

  it('reconnaît la substance par la molécule renseignée', async () => {
    const r = await verifier([p.coumadine, p.ibuprofene]);
    expect(r.body.alerts).toHaveLength(1);
  });

  it('confronte le ticket aux traitements suivis du patient', async () => {
    const client = (await harness.post('/customers', { name: 'Papa Kasongo', phone: '0991231231' }, pharmacie.token).expect(201)).body.id;
    await harness.post('/treatments', { customerId: client, productId: p.warfarine, condition: 'cardiaque', daysPerUnit: 30 }, pharmacie.token).expect(201);
    const r = await verifier([p.ibuprofene], client);
    expect(r.body.alerts).toHaveLength(1);
    expect(r.body.alerts[0].products).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'Warfarine 5 mg', origin: 'traitement' })]));
  });

  it('ne s’alarme pas d’un mot voisin (sel de potassium d’un antibiotique)', async () => {
    expect((await verifier([p.losartan, p.augmentin])).body.alerts).toHaveLength(0);
  });

  it('consulte la liste par substance, classes comprises', async () => {
    const r = await harness.get('/interactions?q=ibuprofene', pharmacie.token).expect(200);
    expect(r.body.interactions.some((i: { label_a: string; label_b: string }) => [i.label_a, i.label_b].includes('Antivitamines K'))).toBe(true);
    expect(r.body.classes.length).toBeGreaterThan(10);
  });

  it('le back-office complète, importe et désactive', async () => {
    await harness.post('/platform/interactions', { termA: 'paracetamol', termB: 'classe:avk', severity: 'a_prendre_en_compte', effect: 'Risque d’augmentation de l’effet de l’antivitamine K à fortes doses prolongées.' }, pharmacie.token).expect(403);
    const c = await harness.post('/platform/interactions', { termA: 'Paracétamol', termB: 'classe:avk', severity: 'a_prendre_en_compte', effect: 'Risque d’augmentation de l’effet de l’antivitamine K à fortes doses prolongées.', advice: 'Contrôle de l’INR si doses élevées plusieurs jours.' }, superAdmin.token).expect(201);
    expect(c.body.term_a).toBe('paracetamol');
    expect((await verifier([p.warfarine, p.paracetamol])).body.alerts[0].severity).toBe('a_prendre_en_compte');

    const imp = await harness.post('/platform/interactions/import', {
      csv: [
        'terme_a;terme_b;niveau;effet;conduite;source',
        'losartan;chlorure de potassium;deconseillee;Hyperkaliémie.;Contrôle de la kaliémie.;Test',
        'losartan;ibuprofene;inconnu;Effet;;',
        'losartan;classe:inexistante;precaution;Effet;;',
        'paracetamol;classe:avk;precaution;Effet mis à jour.;;Test',
      ].join('\n'),
    }, superAdmin.token).expect(201);
    expect(imp.body).toMatchObject({ added: 1, updated: 1 });
    expect(imp.body.errors.map((e: { line: number }) => e.line)).toEqual([2, 3]);

    await harness.patch(`/platform/interactions/${c.body.id}`, { isActive: false }, superAdmin.token).expect(200);
    expect((await verifier([p.warfarine, p.paracetamol])).body.alerts).toHaveLength(0);
  });
});
