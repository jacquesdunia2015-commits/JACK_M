import { Harness, Session, uniqueSlug } from './harness';

/**
 * Messagerie client et encaissement Mobile Money.
 *
 * Les deux fonctionnent sans compte payant, et c'est justement pour cela
 * qu'il faut les tenir serrées : ce n'est plus une passerelle qui garantit
 * qu'un message part une seule fois ou qu'un versement n'est pas compté
 * deux fois — c'est ce code.
 */
describe('Messagerie et Mobile Money', () => {
  const harness = new Harness();
  const PASSWORD = 'Pharmacie2026!';

  let superAdmin: Session;
  let pharmacy: Session;
  let customerId: string;

  beforeAll(async () => {
    await harness.start();
    superAdmin = await harness.loginPlatform('admin@novapharmaos.com');

    const slug = uniqueSlug('messagerie');
    const email = `gerant@${slug}.cd`;
    await harness
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

    pharmacy = await harness.loginPharmacy(email, PASSWORD);

    const client = await harness
      .post(
        '/customers',
        { name: 'Clinique du Lac', kind: 'professional', phone: '0991234567' },
        pharmacy.token,
      )
      .expect(201);
    customerId = client.body.id;
  }, 90_000);

  afterAll(async () => {
    await harness.stop();
  });

  // -----------------------------------------------------------------
  describe('Messagerie', () => {
    it("démarre en mode manuel, qui n'engage aucun frais", async () => {
      const res = await harness.get('/messaging/settings', pharmacy.token).expect(200);
      expect(res.body.sms_mode).toBe('manual');
      expect(res.body.whatsapp_mode).toBe('manual');
    });

    it('livre des modèles de message prêts à l’emploi', async () => {
      const res = await harness.get('/messaging/templates', pharmacy.token).expect(200);
      const codes = res.body.map((m: { code: string }) => m.code);
      expect(codes).toContain('receipt');
      expect(codes).toContain('payment_reminder');
    });

    it('compose un message et rend un lien WhatsApp ouvrable depuis le téléphone', async () => {
      const res = await harness
        .post(
          '/messaging/messages',
          {
            channel: 'whatsapp',
            customerId,
            templateCode: 'receipt',
            variables: { numero: 'V-2026-000001', montant: '12,50 $US' },
            category: 'receipt',
          },
          pharmacy.token,
        )
        .expect(201);

      expect(res.body.mode).toBe('manual');
      expect(res.body.status).toBe('ready');
      // Le zéro national est remplacé par l'indicatif : wa.me n'accepte
      // que la forme internationale en chiffres seuls.
      expect(res.body.recipient_phone).toBe('243991234567');
      expect(res.body.send_link).toContain('https://wa.me/243991234567');
      expect(res.body.body).toContain('Clinique du Lac');
      expect(res.body.body).toContain('12,50 $US');
    });

    it("n'envoie pas deux fois le même message en cas de rejeu", async () => {
      const premier = await harness
        .post(
          '/messaging/messages',
          {
            channel: 'whatsapp',
            customerId,
            templateCode: 'receipt',
            clientOperationId: 'recu-unique-1',
          },
          pharmacy.token,
        )
        .expect(201);

      const second = await harness
        .post(
          '/messaging/messages',
          {
            channel: 'whatsapp',
            customerId,
            templateCode: 'receipt',
            clientOperationId: 'recu-unique-1',
          },
          pharmacy.token,
        )
        .expect(201);

      expect(second.body.id).toBe(premier.body.id);
    });

    it('refuse un destinataire sans numéro exploitable', async () => {
      const res = await harness
        .post(
          '/messaging/messages',
          { channel: 'sms', body: 'Bonjour', to: '' },
          pharmacy.token,
        )
        .expect(409);
      expect(res.body.message).toContain('numéro');
    });

    it('efface proprement un marqueur sans valeur', async () => {
      const res = await harness
        .post(
          '/messaging/messages',
          {
            channel: 'whatsapp',
            to: '0990000000',
            templateCode: 'receipt',
            variables: { numero: 'V-9', montant: '1,00 $US' },
          },
          pharmacy.token,
        )
        .expect(201);

      // Sans nom de client, la phrase doit rester lisible : « Bonjour, »
      // et non « Bonjour , ».
      expect(res.body.body).toContain('Bonjour, merci');
      expect(res.body.body).not.toContain('{{');
    });

    it('journalise et laisse confirmer un envoi manuel', async () => {
      const message = await harness
        .post(
          '/messaging/messages',
          { channel: 'sms', to: '0991112222', body: 'Votre commande est prête.' },
          pharmacy.token,
        )
        .expect(201);
      expect(message.body.send_link).toContain('sms:+243991112222');

      const confirme = await harness
        .post(`/messaging/messages/${message.body.id}/sent`, {}, pharmacy.token)
        .expect(201);
      expect(confirme.body.status).toBe('sent');

      const journal = await harness
        .get('/messaging/messages?status=sent', pharmacy.token)
        .expect(200);
      expect(journal.body.some((m: { id: string }) => m.id === message.body.id)).toBe(true);
    });

    it("refuse d'envoyer quand la pharmacie a désactivé le canal", async () => {
      await harness
        .put('/messaging/settings', { smsMode: 'disabled' }, pharmacy.token)
        .expect(200);

      const res = await harness
        .post('/messaging/messages', { channel: 'sms', to: '0991112222', body: 'Test' }, pharmacy.token)
        .expect(409);
      expect(res.body.message).toContain('désactivé');

      await harness.put('/messaging/settings', { smsMode: 'manual' }, pharmacy.token).expect(200);
    });

    it('exige une adresse de passerelle avant de passer en mode payant', async () => {
      const res = await harness
        .put('/messaging/settings', { whatsappMode: 'gateway' }, pharmacy.token)
        .expect(409);
      expect(res.body.message).toContain('passerelle');
    });
  });

  // -----------------------------------------------------------------
  describe('Encaissement Mobile Money', () => {
    let collecteId: string;

    it('livre les opérateurs courants, prêts à servir', async () => {
      const res = await harness
        .get('/payments/mobile-money/operators', pharmacy.token)
        .expect(200);
      const codes = res.body.map((o: { code: string }) => o.code);
      expect(codes).toEqual(expect.arrayContaining(['mpesa', 'airtel', 'orange']));
    });

    it('ouvre une demande avec des instructions à dicter au client', async () => {
      const res = await harness
        .post(
          '/payments/mobile-money',
          { operatorCode: 'mpesa', payerPhone: '0991234567', amount: 12.5, customerId },
          pharmacy.token,
        )
        .expect(201);

      collecteId = res.body.id;
      expect(res.body.status).toBe('requested');
      expect(res.body.reference).toMatch(/^MM-\d{6}-\d{4}$/);
      expect(res.body.instructions).toContain('*1122#');
      expect(res.body.instructions).toContain(res.body.reference);
    });

    it("refuse une confirmation sans identifiant de transaction", async () => {
      const res = await harness
        .post(`/payments/mobile-money/${collecteId}/confirm`, {}, pharmacy.token)
        .expect(409);
      expect(res.body.message).toContain('identifiant de transaction');
    });

    it('confirme le versement et le rattache à la vente', async () => {
      const res = await harness
        .post(
          `/payments/mobile-money/${collecteId}/confirm`,
          { operatorReference: 'QF8ABCDEF12', payerName: 'Jean Kabila' },
          pharmacy.token,
        )
        .expect(201);

      expect(res.body.status).toBe('confirmed');
      expect(res.body.operator_reference).toBe('QF8ABCDEF12');
      expect(res.body.confirmed_at).toBeTruthy();
    });

    it("n'encaisse pas deux fois la même transaction opérateur", async () => {
      const seconde = await harness
        .post(
          '/payments/mobile-money',
          { operatorCode: 'mpesa', payerPhone: '0991234567', amount: 12.5 },
          pharmacy.token,
        )
        .expect(201);

      const res = await harness
        .post(
          `/payments/mobile-money/${seconde.body.id}/confirm`,
          { operatorReference: 'QF8ABCDEF12' },
          pharmacy.token,
        )
        .expect(409);
      expect(res.body.message).toContain('déjà été encaissée');
    });

    it('rejoue une confirmation sans encaisser une seconde fois', async () => {
      const res = await harness
        .post(
          `/payments/mobile-money/${collecteId}/confirm`,
          { operatorReference: 'QF8ABCDEF12' },
          pharmacy.token,
        )
        .expect(201);
      expect(res.body.status).toBe('confirmed');
      expect(res.body.operator_reference).toBe('QF8ABCDEF12');
    });

    it('refuse un montant nul ou négatif', async () => {
      await harness
        .post(
          '/payments/mobile-money',
          { operatorCode: 'mpesa', payerPhone: '0991234567', amount: 0 },
          pharmacy.token,
        )
        .expect(400);
    });

    it('donne le rapprochement du jour par opérateur', async () => {
      const res = await harness
        .get('/payments/mobile-money/reconciliation', pharmacy.token)
        .expect(200);
      const mpesa = res.body.find((l: { operator_code: string }) => l.operator_code === 'mpesa');
      expect(mpesa).toBeDefined();
      expect(Number(mpesa.confirmes)).toBeGreaterThanOrEqual(1);
      expect(Number(mpesa.montant_confirme)).toBeGreaterThanOrEqual(12.5);
    });
  });
});
