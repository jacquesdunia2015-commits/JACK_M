import { Harness, Session, uniqueSlug } from './harness';

/**
 * Tickets de support : chaque pharmacie écrit au support, l'équipe NOVA
 * PHARMA OS répond ; ses notes internes restent invisibles pour la pharmacie.
 */
describe('Tickets de support', () => {
  const harness = new Harness();
  const PASSWORD = 'Pharmacie2026!';
  let superAdmin: Session;

  const creerPharmacie = async () => {
    const slug = uniqueSlug('ticket');
    await harness
      .post(
        '/platform/organizations',
        {
          slug, legalName: `PHARMACIE ${slug.toUpperCase()}`, countryCode: 'CD', planCode: 'starter', startTrial: true,
          owner: { fullName: 'Gérante', email: `gerant@${slug}.cd`, password: PASSWORD },
        },
        superAdmin.token,
      )
      .expect(201);
    return harness.loginPharmacy(`gerant@${slug}.cd`, PASSWORD);
  };

  beforeAll(async () => {
    await harness.start();
    superAdmin = await harness.loginPlatform('admin@novapharmaos.com');
  }, 90_000);

  afterAll(async () => {
    await harness.stop();
  });

  it('deux pharmacies ouvrent chacune leur premier ticket', async () => {
    const a = await creerPharmacie();
    const b = await creerPharmacie();
    const ticket = { subject: 'Question sur les factures', description: 'Comment ajouter notre numéro d’impôt ?' };
    const ta = await harness.post('/account/support/tickets', ticket, a.token).expect(201);
    const tb = await harness.post('/account/support/tickets', ticket, b.token).expect(201);
    expect(ta.body.reference).toBe(tb.body.reference);

    // Réponse du support, puis note interne.
    await harness.post(`/platform/support/tickets/${ta.body.id}/messages`, { body: 'Nous vous guidons.' }, superAdmin.token).expect(201);
    await harness
      .post(`/platform/support/tickets/${ta.body.id}/messages`, { body: 'Note : client prioritaire.', isInternalNote: true }, superAdmin.token)
      .expect(201);
    await harness.patch(`/platform/support/tickets/${ta.body.id}`, { status: 'pending_customer' }, superAdmin.token).expect(200);

    const vu = await harness.get(`/account/support/tickets/${ta.body.id}`, a.token).expect(200);
    const corps = vu.body.messages.map((m: { body: string }) => m.body);
    expect(corps).toContain('Nous vous guidons.');
    expect(corps).not.toContain('Note : client prioritaire.');
    expect(vu.body.ticket.status).toBe('pending_customer');

    // La pharmacie répond ; l'autre pharmacie ne voit pas ce ticket.
    await harness.post(`/account/support/tickets/${ta.body.id}/messages`, { body: 'Merci, c’est fait.' }, a.token).expect(201);
    await harness.get(`/account/support/tickets/${ta.body.id}`, b.token).expect(404);
    expect((await harness.get('/account/support/tickets', b.token).expect(200)).body).toHaveLength(1);
  });
});
