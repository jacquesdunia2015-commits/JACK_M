import { DatabaseService } from '../src/common/database/database.service';
import { SYSTEM_CONTEXT } from '../src/common/database/request-context';
import { Harness, Session, uniqueSlug } from './harness';

/**
 * Connexion à l'espace pharmacie : les refus doivent être des refus.
 *
 * Un mot de passe mal tapé est l'événement le plus fréquent de toute
 * l'application. Il doit produire « Identifiants incorrects », compter
 * l'échec, et verrouiller le compte au cinquième. Une erreur interne à
 * cet endroit est pire qu'inutile : l'interface l'affiche comme une
 * panne (« Connexion impossible »), l'utilisateur cherche le problème du
 * mauvais côté, et le verrouillage ne s'applique jamais.
 */
describe('Authentification pharmacie', () => {
  const harness = new Harness();
  const PASSWORD = 'Pharmacie2026!';

  let superAdmin: Session;
  let email: string;

  beforeAll(async () => {
    await harness.start();
    superAdmin = await harness.loginPlatform('admin@novapharmaos.com');

    const slug = uniqueSlug('auth');
    email = `gerant@${slug}.cd`;
    await harness
      .post(
        '/platform/organizations',
        {
          slug,
          legalName: `OFFICINE ${slug.toUpperCase()}`,
          countryCode: 'CD',
          planCode: 'professional',
          owner: { fullName: 'Gérant', email, password: PASSWORD },
        },
        superAdmin.token,
      )
      .expect(201);
  }, 90_000);

  afterAll(async () => {
    await harness.stop();
  });

  it('renouvelle la session, tolère deux renouvellements simultanés, refuse après déconnexion', async () => {
    const connexion = await harness.post('/auth/login', { email, password: PASSWORD }).expect(201);
    const jeton = connexion.body.refreshToken as string;

    // Deux requêtes d'une même page renouvellent au même instant.
    const [a, b] = await Promise.all([
      harness.post('/auth/refresh', { refreshToken: jeton }),
      harness.post('/auth/refresh', { refreshToken: jeton }),
    ]);
    expect([a.status, b.status]).toEqual([201, 201]);
    await harness.get('/catalog/products', a.body.accessToken).expect(200);

    // Le jeton renouvelé sert à son tour ; après déconnexion, plus rien.
    const suivant = await harness.post('/auth/refresh', { refreshToken: a.body.refreshToken }).expect(201);
    await harness.post('/auth/logout', { refreshToken: suivant.body.refreshToken }, suivant.body.accessToken).expect(201);
    await harness.post('/auth/refresh', { refreshToken: suivant.body.refreshToken }).expect(401);
    await harness.post('/auth/refresh', { refreshToken: 'jeton-inventé' }).expect(401);
  });

  it('un mot de passe erroné est refusé proprement, sans erreur interne', async () => {
    const res = await harness
      .post('/auth/login', { email, password: 'MauvaisMotDePasse1' })
      .expect(401);
    expect(res.body.message).toBe('Identifiants incorrects.');
  });

  it('une adresse inconnue reçoit exactement le même refus', async () => {
    // Ne pas révéler quels comptes existent.
    const res = await harness
      .post('/auth/login', { email: `inconnu-${email}`, password: PASSWORD })
      .expect(401);
    expect(res.body.message).toBe('Identifiants incorrects.');
  });

  it('le bon mot de passe remet le compteur d’échecs à zéro', async () => {
    await harness.post('/auth/login', { email, password: PASSWORD }).expect(201);
    // Quatre échecs après une réussite ne suffisent pas à verrouiller.
    for (let i = 0; i < 4; i += 1) {
      await harness.post('/auth/login', { email, password: 'MauvaisMotDePasse1' }).expect(401);
    }
    await harness.post('/auth/login', { email, password: PASSWORD }).expect(201);
  });

  it('le compte se verrouille au cinquième échec, même contre le bon mot de passe', async () => {
    for (let i = 0; i < 5; i += 1) {
      await harness.post('/auth/login', { email, password: 'MauvaisMotDePasse1' }).expect(401);
    }
    const res = await harness.post('/auth/login', { email, password: PASSWORD }).expect(403);
    expect(res.body.message).toMatch(/verrouillé/);
  });

  /**
   * Les fonctions qui franchissent le cloisonnement (connexion, quotas)
   * appartiennent à un rôle sans droit de connexion. Si l'application
   * pouvait l'endosser, elle lirait toutes les pharmacies.
   */
  it("l'application ne peut pas endosser le rôle des dérogations", async () => {
    const db = harness.app.get(DatabaseService);
    const etat = await db.readTransaction(SYSTEM_CONTEXT, (tx) =>
      tx.oneOrFail<{ membre: boolean; connexion: boolean; proprietaires: string[] }>(
        `SELECT pg_has_role(current_user, 'nova_derogation', 'MEMBER') AS membre,
                (SELECT rolcanlogin FROM pg_roles WHERE rolname = 'nova_derogation') AS connexion,
                ARRAY(
                  SELECT DISTINCT pg_get_userbyid(p.proowner)::text
                    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                   WHERE n.nspname = 'nova' AND p.prosecdef
                ) AS proprietaires`,
      ),
    );
    expect(etat.membre).toBe(false);
    expect(etat.connexion).toBe(false);
    expect(etat.proprietaires).toEqual(['nova_derogation']);
  });
});
