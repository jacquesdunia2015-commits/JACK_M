import { DatabaseService } from '../src/common/database/database.service';
import { RequestContext, SYSTEM_CONTEXT } from '../src/common/database/request-context';
import { Harness, Session, uniqueSlug } from './harness';

/**
 * Isolation au niveau de la base de données.
 *
 * Les tests précédents passent par l'API, où le filtre applicatif est
 * appliqué. Ceux-ci s'en affranchissent : ils exécutent des requêtes
 * SANS clause `WHERE organization_id`, comme le ferait un code fautif.
 *
 * Si l'isolation ne tenait qu'au code applicatif, ces requêtes
 * ramèneraient les données de toutes les pharmacies. Le fait qu'elles
 * ne ramènent rien démontre que la garantie est portée par PostgreSQL
 * lui-même, via Row-Level Security.
 */
describe('Isolation multi-tenant au niveau base de données', () => {
  const harness = new Harness();
  let db: DatabaseService;
  let superAdmin: Session;

  const pharmacies: { id: string; slug: string; token: string }[] = [];

  const tenantContext = (organizationId: string): RequestContext => ({
    organizationId,
    actorKind: 'system',
    platform: false,
    readonly: false,
  });

  beforeAll(async () => {
    await harness.start();
    db = harness.app.get(DatabaseService);
    superAdmin = await harness.loginPlatform('admin@novapharmaos.com');

    for (const label of ['alpha', 'beta']) {
      const slug = uniqueSlug(`iso-${label}`);
      const email = `gerant@${slug}.cd`;
      const created = await harness
        .post(
          '/platform/organizations',
          {
            slug,
            legalName: `PHARMACIE ${label.toUpperCase()}`,
            countryCode: 'CD',
            planCode: 'professional',
            owner: { fullName: 'Gérant', email, password: 'Pharmacie2026!' },
          },
          superAdmin.token,
        )
        .expect(201);

      const session = await harness.loginPharmacy(email, 'Pharmacie2026!');
      await harness
        .post(
          '/catalog/products',
          { sku: `SKU-${label}`, name: `Produit ${label}`, salePrice: 1 },
          session.token,
        )
        .expect(201);

      pharmacies.push({ id: created.body.organization.id, slug, token: session.token });
    }
  }, 90_000);

  afterAll(async () => {
    await harness.stop();
  });

  it("une requête sans filtre ne voit que l'organisation du contexte", async () => {
    for (const pharmacy of pharmacies) {
      const rows = await db.readTransaction(tenantContext(pharmacy.id), (tx) =>
        // Aucune clause WHERE : c'est PostgreSQL qui filtre.
        tx.many<{ sku: string }>('SELECT sku FROM products'),
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].sku).toContain(pharmacy.slug.split('-')[1]);
    }
  });

  it('un filtre explicite sur une autre organisation ne ramène rien', async () => {
    const [alpha, beta] = pharmacies;
    const rows = await db.readTransaction(tenantContext(alpha.id), (tx) =>
      tx.many('SELECT sku FROM products WHERE organization_id = $1', [beta.id]),
    );
    expect(rows).toHaveLength(0);
  });

  it("une écriture au nom d'une autre organisation est rejetée par la base", async () => {
    const [alpha, beta] = pharmacies;
    await expect(
      db.transaction(tenantContext(alpha.id), (tx) =>
        tx.query(
          `INSERT INTO products (organization_id, sku, name, sale_price)
           VALUES ($1, 'INJECTION', 'Injection croisée', 1)`,
          [beta.id],
        ),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it('hors contexte tenant, aucune donnée métier n’est visible', async () => {
    const rows = await db.readTransaction(
      { actorKind: 'system', platform: false, readonly: true },
      (tx) => tx.many('SELECT sku FROM products'),
    );
    expect(rows).toHaveLength(0);
  });

  it("le contexte back-office ne donne pas accès aux données métier", async () => {
    const rows = await db.readTransaction(SYSTEM_CONTEXT, (tx) =>
      tx.many('SELECT sku FROM products'),
    );
    expect(rows).toHaveLength(0);
  });

  it('un contexte en lecture seule bloque toute écriture', async () => {
    const [alpha] = pharmacies;
    await expect(
      db.transaction({ ...tenantContext(alpha.id), readonly: true }, (tx) =>
        tx.query(
          `INSERT INTO products (organization_id, sku, name, sale_price)
           VALUES ($1, 'LECTURE-SEULE', 'Refusé', 1)`,
          [alpha.id],
        ),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it("le rôle applicatif ne peut pas contourner les politiques", async () => {
    const role = await db.readTransaction(SYSTEM_CONTEXT, (tx) =>
      tx.oneOrFail<{ rolbypassrls: boolean; rolsuper: boolean; rolname: string }>(
        `SELECT rolname, rolbypassrls, rolsuper FROM pg_roles WHERE rolname = current_user`,
      ),
    );
    expect(role.rolbypassrls).toBe(false);
    expect(role.rolsuper).toBe(false);
  });

  it('toutes les tables publiques sont protégées, sans exception', async () => {
    const gaps = await db.readTransaction(SYSTEM_CONTEXT, (tx) =>
      tx.many<{ table_name: string; issue: string }>(
        'SELECT * FROM nova.assert_rls_coverage()',
      ),
    );
    expect(gaps).toEqual([]);
  });

  it('chaque table métier porte bien une colonne organization_id', async () => {
    const missing = await db.readTransaction(SYSTEM_CONTEXT, (tx) =>
      tx.many<{ relname: string }>(
        `SELECT c.relname
           FROM pg_class c
           JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relkind = 'r'
            AND c.relname NOT IN (
              -- Référentiels partagés, tables plateforme et tables
              -- rattachées à leur parent : elles ont leurs propres
              -- politiques, vérifiées par le test précédent.
              'country_settings', 'subscription_plans', 'plan_addons', 'promo_codes',
              'permissions', 'organizations', 'platform_users', 'platform_settings',
              'platform_incidents', 'platform_audit_logs', 'knowledge_base_articles',
              'leads', 'organization_backups', 'subscription_invoice_lines',
              'refresh_tokens', 'schema_migrations')
            AND NOT EXISTS (
              SELECT 1 FROM pg_attribute a
               WHERE a.attrelid = c.oid AND a.attname = 'organization_id'
                 AND NOT a.attisdropped)
          ORDER BY c.relname`,
      ),
    );
    expect(missing.map((m) => m.relname)).toEqual([]);
  });

  /**
   * Les tests ci-dessus interrogent la base directement. Ceux-ci passent
   * par l'API, comme le navigateur d'un utilisateur.
   *
   * La distinction n'est pas théorique : une configuration qui connecte
   * l'application avec un rôle privilégié laisse la base répondre
   * correctement aux tests précédents — le contexte y est posé à la main
   * — tout en montrant, à l'écran, les données de toutes les pharmacies.
   * Seul un appel HTTP avec le jeton d'une pharmacie le révèle.
   */
  it("l'API ne montre à chaque pharmacie que son propre catalogue", async () => {
    for (const pharmacy of pharmacies) {
      const res = await harness
        .get('/catalog/products?pageSize=100', pharmacy.token)
        .expect(200);
      const skus = (res.body.data as { sku: string }[]).map((p) => p.sku);
      expect(skus).toEqual([`SKU-${pharmacy.slug.split('-')[1]}`]);
    }
  });

  it("l'API ne montre à chaque pharmacie que ses propres réglages livrés", async () => {
    // Modèles de message et opérateurs Mobile Money sont posés à
    // l'identique dans chaque pharmacie lors de sa création. Deux
    // pharmacies qui en voient le double, ce sont deux pharmacies qui
    // voient les lignes l'une de l'autre.
    for (const pharmacy of pharmacies) {
      const modeles = await harness.get('/messaging/templates', pharmacy.token).expect(200);
      const operateurs = await harness
        .get('/payments/mobile-money/operators', pharmacy.token)
        .expect(200);

      const codesModeles = (modeles.body as { code: string }[]).map((m) => m.code);
      const codesOperateurs = (operateurs.body as { code: string }[]).map((o) => o.code);

      expect(codesModeles).toHaveLength(new Set(codesModeles).size);
      expect(codesOperateurs).toHaveLength(new Set(codesOperateurs).size);
    }
  });

  it("la sauvegarde d'une pharmacie ne capte pas les données d'une autre", async () => {
    const [alpha, beta] = pharmacies;
    const backup = await harness
      .post(`/platform/organizations/${alpha.id}/backups`, {}, superAdmin.token)
      .expect(201);

    const counts = backup.body.table_counts as Record<string, number>;
    expect(counts.products).toBe(1);

    // Contrôle direct du fichier produit.
    const { readFileSync } = await import('node:fs');
    const { join, resolve } = await import('node:path');
    const dir = resolve(process.env.BACKUP_DIR ?? './storage/backups');
    const content = readFileSync(join(dir, backup.body.storage_key), 'utf8');
    expect(content).not.toContain(beta.id);
    expect(content).not.toContain(`SKU-${beta.slug.split('-')[1]}`);
  });
});
