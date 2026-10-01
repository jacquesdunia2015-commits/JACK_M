import { codePour, pasActuel } from '../src/modules/auth/totp';
import { Harness, Session, uniqueSlug } from './harness';

/**
 * Changement de mot de passe et double authentification : activation par
 * un premier code, connexion qui demande le code, code à usage unique,
 * codes de secours, désactivation, verrouillage après plusieurs échecs.
 */
describe('Mot de passe et double authentification', () => {
  const harness = new Harness();
  const PASSWORD = 'Pharmacie2026!';
  let email: string;
  let gerant: Session;
  let secret: string;
  let secours: string[];

  beforeAll(async () => {
    await harness.start();
    const superAdmin = await harness.loginPlatform('admin@novapharmaos.com');
    const slug = uniqueSlug('mfa');
    email = `gerant@${slug}.cd`;
    await harness
      .post('/platform/organizations', {
        slug, legalName: `PHARMACIE ${slug.toUpperCase()}`, countryCode: 'CD', city: 'Goma',
        planCode: 'starter', startTrial: true,
        owner: { fullName: 'Gérant', email, password: PASSWORD },
      }, superAdmin.token)
      .expect(201);
    gerant = await harness.loginPharmacy(email, PASSWORD);
  }, 90_000);

  afterAll(async () => {
    await harness.stop();
  });

  const connexion = (corps: Record<string, unknown>) => harness.post('/auth/login', { email, password: PASSWORD, ...corps });

  it('change le mot de passe, ferme les autres sessions et en ouvre une neuve', async () => {
    const autre = await harness.post('/auth/login', { email, password: PASSWORD }).expect(201);
    await harness.post('/auth/password', { currentPassword: 'Faux2026!', newPassword: 'Nouveau2026!' }, gerant.token).expect(401);
    await harness.post('/auth/password', { currentPassword: PASSWORD, newPassword: PASSWORD }, gerant.token).expect(403);
    await harness.post('/auth/password', { currentPassword: PASSWORD, newPassword: 'sanschiffre' }, gerant.token).expect(403);

    const r = await harness.post('/auth/password', { currentPassword: PASSWORD, newPassword: 'Nouveau2026!' }, gerant.token).expect(201);
    expect(r.body).toMatchObject({ message: expect.stringContaining('Mot de passe modifié') });
    expect(r.body.accessToken).toBeTruthy();
    // La session de l'autre appareil est fermée ; la session neuve fonctionne.
    await harness.post('/auth/refresh', { refreshToken: autre.body.refreshToken }).expect(401);
    await harness.post('/auth/refresh', { refreshToken: r.body.refreshToken }).expect(201);
    await harness.post('/auth/login', { email, password: PASSWORD }).expect(401);
    await harness.post('/auth/login', { email, password: 'Nouveau2026!' }).expect(201);

    // Retour à l'ancien mot de passe pour la suite.
    const s = await harness.loginPharmacy(email, 'Nouveau2026!');
    await harness.post('/auth/password', { currentPassword: 'Nouveau2026!', newPassword: PASSWORD }, s.token).expect(201);
    gerant = await harness.loginPharmacy(email, PASSWORD);
  });

  it('active la double authentification avec un premier code juste', async () => {
    const etat = await harness.get('/auth/2fa', gerant.token).expect(200);
    expect(etat.body).toMatchObject({ enabled: false, recoveryCodesLeft: 0 });

    await harness.post('/auth/2fa/enable', { code: '123456' }, gerant.token).expect(403);
    const prep = await harness.post('/auth/2fa/setup', {}, gerant.token).expect(201);
    secret = prep.body.secret;
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(prep.body.otpauthUrl).toContain(`otpauth://totp/NOVA%20PHARMA%20OS%3A${encodeURIComponent(email)}?secret=${secret}`);

    const faux = codePour(secret, pasActuel() + 5);
    await harness.post('/auth/2fa/enable', { code: faux }, gerant.token).expect(401);
    const ok = await harness.post('/auth/2fa/enable', { code: codePour(secret, pasActuel()) }, gerant.token).expect(201);
    secours = ok.body.recoveryCodes;
    expect(secours).toHaveLength(8);
    expect(secours[0]).toMatch(/^[A-Z2-7]{4}-[A-Z2-7]{4}$/);
    await harness.post('/auth/2fa/setup', {}, gerant.token).expect(403);
    const apres = await harness.get('/auth/2fa', gerant.token).expect(200);
    expect(apres.body).toMatchObject({ enabled: true, recoveryCodesLeft: 8 });
  });

  it('demande le code à la connexion, et ne l’accepte qu’une fois', async () => {
    const sans = await connexion({}).expect(401);
    expect(sans.body).toMatchObject({ mfaRequired: true });
    expect(sans.body.message).toContain('code à 6 chiffres');
    // Le code qui a servi à l'activation ne ressert pas.
    const rejoue = await connexion({ code: codePour(secret, pasActuel()) }).expect(401);
    expect(rejoue.body.message).toBe('Code de vérification incorrect.');
    // Le code suivant (horloge du téléphone en avance de 30 s) passe.
    const ok = await connexion({ code: codePour(secret, pasActuel() + 1) }).expect(201);
    expect(ok.body.accessToken).toBeTruthy();
    // Un mauvais mot de passe reste refusé avant même de parler de code.
    await harness.post('/auth/login', { email, password: 'Mauvais2026!', code: '000000' }).expect(401);
  });

  it('accepte un code de secours une seule fois', async () => {
    await connexion({ code: secours[0].toLowerCase() }).expect(201);
    await connexion({ code: secours[0] }).expect(401);
    const etat = await harness.get('/auth/2fa', gerant.token).expect(200);
    expect(etat.body.recoveryCodesLeft).toBe(7);
  });

  it('se désactive avec le mot de passe et un code', async () => {
    await harness.post('/auth/2fa/disable', { password: 'Faux2026!', code: secours[1] }, gerant.token).expect(401);
    await harness.post('/auth/2fa/disable', { password: PASSWORD, code: '000000' }, gerant.token).expect(401);
    await harness.post('/auth/2fa/disable', { password: PASSWORD, code: secours[1] }, gerant.token).expect(201);
    await connexion({}).expect(201);
  });

  it('protège aussi le back-office et le verrouille après plusieurs échecs', async () => {
    const superAdmin = await harness.loginPlatform('admin@novapharmaos.com');
    const mail = `agent.${Date.now()}@novapharmaos.com`;
    await harness.post('/platform/users', {
      fullName: 'Agent commercial', phone: '+243991230001', email: mail, password: 'Interne2026!', role: 'commercial',
    }, superAdmin.token).expect(201);
    const agent = await harness.loginPlatform(mail, 'Interne2026!');
    const prep = await harness.post('/auth/2fa/setup', {}, agent.token).expect(201);
    await harness.post('/auth/2fa/enable', { code: codePour(prep.body.secret, pasActuel()) }, agent.token).expect(201);

    const sans = await harness.post('/auth/platform/login', { email: mail, password: 'Interne2026!' }).expect(401);
    expect(sans.body.mfaRequired).toBe(true);
    await harness.post('/auth/platform/login', { email: mail, password: 'Interne2026!', code: codePour(prep.body.secret, pasActuel() + 1) }).expect(201);

    for (let i = 0; i < 5; i++) {
      await harness.post('/auth/platform/login', { email: mail, password: 'Interne2026!', code: '000000' }).expect(401);
    }
    const verrou = await harness.post('/auth/platform/login', { email: mail, password: 'Interne2026!', code: '111111' }).expect(403);
    expect(verrou.body.message).toContain('verrouillé');
  });
});
