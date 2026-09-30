import { Harness, Session, uniqueSlug } from './harness';

/**
 * Création de comptes : téléphone, adresse e-mail et mot de passe.
 *
 * Trois portes, trois niveaux de confiance :
 *   — l'inscription publique crée une pharmacie et son administrateur ;
 *   — l'administrateur d'une pharmacie crée les comptes de son équipe ;
 *   — seul le super-administrateur crée des comptes internes.
 * Aucune des deux premières ne doit pouvoir mener à la troisième.
 */
describe('Création de comptes', () => {
  const harness = new Harness();
  const MOT_DE_PASSE = 'Officine2026!';
  let superAdmin: Session;

  const inscription = (champs: Record<string, unknown> = {}) => {
    const id = uniqueSlug('lac');
    return {
      pharmacyName: `Pharmacie ${id}`,
      city: 'Bukavu',
      fullName: 'Espérance Nsimire',
      phone: '0991 234 567',
      email: `gerante@${id}.cd`,
      password: MOT_DE_PASSE,
      ...champs,
    };
  };

  beforeAll(async () => {
    process.env.INSCRIPTION_LIMITE_PAR_HEURE = '1000';
    await harness.start();
    superAdmin = await harness.loginPlatform('admin@novapharmaos.com');
  }, 90_000);

  afterAll(async () => {
    await harness.stop();
  });

  // ------------------------------------------------------------------
  // Inscription publique
  // ------------------------------------------------------------------

  it("l'inscription crée la pharmacie et son administrateur, téléphone normalisé", async () => {
    const donnees = inscription();
    const res = await harness.post('/auth/register', donnees).expect(201);
    expect(res.body.organizationSlug).toMatch(/^pharmacie-lac-/);

    // La personne peut se connecter aussitôt…
    const session = await harness.loginPharmacy(donnees.email, MOT_DE_PASSE);

    // … et elle est l'administratrice de sa pharmacie, avec son numéro
    // au format international.
    const equipe = await harness.get('/admin/users', session.token).expect(200);
    expect(equipe.body).toHaveLength(1);
    expect(equipe.body[0].is_owner).toBe(true);
    expect(equipe.body[0].phone).toBe('+243991234567');

    // La pharmacie apparaît au back-office, en période d'essai.
    const liste = await harness.get('/platform/organizations', superAdmin.token).expect(200);
    const creee = (liste.body.data as { slug: string; status: string }[]).find(
      (o) => o.slug === res.body.organizationSlug,
    );
    expect(creee?.status).toBe('trial');
  });

  it("l'identifiant court est tiré du nom, sans accents, et reste unique", async () => {
    const id = uniqueSlug('etoile');
    const nom = `Pharmacie Étoile ${id}`;
    const a = await harness
      .post('/auth/register', inscription({ pharmacyName: nom, email: `a@${id}.cd` }))
      .expect(201);
    const b = await harness
      .post('/auth/register', inscription({ pharmacyName: nom, email: `b@${id}.cd` }))
      .expect(201);
    expect(a.body.organizationSlug).toBe(`pharmacie-etoile-${id}`);
    expect(b.body.organizationSlug).toBe(`pharmacie-etoile-${id}-2`);
  });

  it('une adresse qui a déjà un compte est renvoyée vers la connexion', async () => {
    const donnees = inscription();
    await harness.post('/auth/register', donnees).expect(201);
    const res = await harness
      .post('/auth/register', { ...donnees, pharmacyName: 'Autre officine' })
      .expect(409);
    expect(res.body.message).toMatch(/déjà un compte/);
  });

  it('téléphone, adresse et mot de passe sont tous exigés', async () => {
    const { phone: _sansTelephone, ...sansTelephone } = inscription();
    await harness.post('/auth/register', sansTelephone).expect(400);
    await harness.post('/auth/register', inscription({ phone: '12' })).expect(400);
    await harness.post('/auth/register', inscription({ email: 'pas-une-adresse' })).expect(400);
    await harness.post('/auth/register', inscription({ password: 'court' })).expect(400);
  });

  it("l'inscription ne peut jamais créer de compte interne", async () => {
    // Un champ « rôle » glissé dans la requête est refusé, pas ignoré.
    await harness
      .post('/auth/register', inscription({ role: 'super_admin' }))
      .expect(400);

    // Et le compte créé n'ouvre pas le back-office.
    const donnees = inscription();
    await harness.post('/auth/register', donnees).expect(201);
    await harness
      .post('/auth/platform/login', { email: donnees.email, password: MOT_DE_PASSE })
      .expect(401);
  });

  it("l'interrupteur ferme les inscriptions", async () => {
    process.env.INSCRIPTION_PUBLIQUE = 'off';
    try {
      await harness.post('/auth/register', inscription()).expect(403);
    } finally {
      delete process.env.INSCRIPTION_PUBLIQUE;
    }
  });

  it('le plafond horaire arrête un afflux d’inscriptions', async () => {
    process.env.INSCRIPTION_LIMITE_PAR_HEURE = '0';
    try {
      await harness.post('/auth/register', inscription()).expect(429);
    } finally {
      process.env.INSCRIPTION_LIMITE_PAR_HEURE = '1000';
    }
  });

  // ------------------------------------------------------------------
  // Équipe d'une pharmacie
  // ------------------------------------------------------------------

  describe("équipe d'une pharmacie", () => {
    let administrateur: Session;
    let domaine: string;

    beforeAll(async () => {
      const donnees = inscription();
      domaine = donnees.email.split('@')[1];
      await harness.post('/auth/register', donnees).expect(201);
      administrateur = await harness.loginPharmacy(donnees.email, MOT_DE_PASSE);
    });

    it("l'administrateur crée un vendeur avec téléphone, adresse et mot de passe", async () => {
      const res = await harness
        .post(
          '/admin/users',
          {
            fullName: 'Vendeur au comptoir',
            phone: '+243 81 234 5678',
            email: `vendeur@${domaine}`,
            password: 'Vendeur2026!',
            roleCodes: ['vendeur'],
          },
          administrateur.token,
        )
        .expect(201);
      expect(res.body.phone).toBe('+243812345678');
      await harness.loginPharmacy(`vendeur@${domaine}`, 'Vendeur2026!');
    });

    it('sans téléphone, le compte est refusé', async () => {
      await harness
        .post(
          '/admin/users',
          { fullName: 'Livreur', email: `livreur@${domaine}`, password: 'Livreur2026!' },
          administrateur.token,
        )
        .expect(400);
    });
  });

  // ------------------------------------------------------------------
  // Comptes internes NOVA PHARMA OS
  // ------------------------------------------------------------------

  describe('comptes internes', () => {
    it('le super-administrateur crée un compte avec téléphone, adresse et mot de passe', async () => {
      const email = `support-${uniqueSlug('agent')}@novapharmaos.com`;
      const res = await harness
        .post(
          '/platform/users',
          {
            fullName: 'Agent support',
            phone: '0970000001',
            email,
            password: 'Support2026!',
            role: 'support_admin',
          },
          superAdmin.token,
        )
        .expect(201);
      expect(res.body.phone).toBe('+243970000001');
      await harness.loginPlatform(email, 'Support2026!');
    });

    it('téléphone manquant ou rôle inconnu sont refusés', async () => {
      const base = {
        fullName: 'Agent',
        email: `x-${uniqueSlug('agent')}@novapharmaos.com`,
        password: 'Support2026!',
      };
      await harness
        .post('/platform/users', { ...base, role: 'commercial' }, superAdmin.token)
        .expect(400);
      await harness
        .post(
          '/platform/users',
          { ...base, phone: '0970000002', role: 'dieu' },
          superAdmin.token,
        )
        .expect(400);
    });

    it("un compte support ne peut pas créer de compte interne", async () => {
      const email = `support2-${uniqueSlug('agent')}@novapharmaos.com`;
      await harness
        .post(
          '/platform/users',
          {
            fullName: 'Agent support 2',
            phone: '0970000003',
            email,
            password: 'Support2026!',
            role: 'support_admin',
          },
          superAdmin.token,
        )
        .expect(201);
      const support = await harness.loginPlatform(email, 'Support2026!');
      await harness
        .post(
          '/platform/users',
          {
            fullName: 'Intrus',
            phone: '0970000004',
            email: `intrus-${uniqueSlug('agent')}@novapharmaos.com`,
            password: 'Intrus2026!',
            role: 'super_admin',
          },
          support.token,
        )
        .expect(403);
    });
  });
});
