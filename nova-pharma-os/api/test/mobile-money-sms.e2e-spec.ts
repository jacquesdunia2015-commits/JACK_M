import { lireMontant, lireSmsOperateur } from '../src/modules/tenant/payments/sms-operateur';
import { Harness, Session, uniqueSlug } from './harness';

/**
 * Mobile Money confirmé par le SMS de l'opérateur, sans contrat : lecture
 * des SMS, confirmation par SMS collé (montant vérifié), transfert
 * automatique depuis le téléphone marchand par un lien secret, boîte des
 * SMS à examiner.
 */
describe('Mobile Money : confirmation par le SMS de l’opérateur', () => {
  const harness = new Harness();
  const PASSWORD = 'Pharmacie2026!';
  let pharmacie: Session;
  let jeton: string;

  const demander = (amount: number, payerPhone = '0991234567', operatorCode = 'mpesa') =>
    harness.post('/payments/mobile-money', { operatorCode, payerPhone, amount }, pharmacie.token).expect(201);

  beforeAll(async () => {
    await harness.start();
    const superAdmin = await harness.loginPlatform('admin@novapharmaos.com');
    const slug = uniqueSlug('mms');
    await harness
      .post('/platform/organizations', {
        slug, legalName: `PHARMACIE ${slug.toUpperCase()}`, countryCode: 'CD', city: 'Goma',
        planCode: 'business', startTrial: true,
        owner: { fullName: 'Gérant', email: `gerant@${slug}.cd`, password: PASSWORD },
      }, superAdmin.token)
      .expect(201);
    pharmacie = await harness.loginPharmacy(`gerant@${slug}.cd`, PASSWORD);
  }, 90_000);

  afterAll(async () => {
    await harness.stop();
  });

  it('lit les SMS des opérateurs malgré leurs formats différents', () => {
    expect(lireMontant('25,000.00')).toBe(25000);
    expect(lireMontant('25.000,50')).toBe(25000.5);
    expect(lireMontant('1.250.000')).toBe(1250000);
    expect(lireMontant('12,5')).toBe(12.5);
    expect(lireSmsOperateur('QJK4XY7Z2B Confirmé. 5 000 FC reçus de 243812345678 MAMAN NEEMA. M-PESA')).toEqual({
      operator: 'mpesa', direction: 'received', amount: 5000, currency: 'CDF', phone: '+243812345678', transactionId: 'QJK4XY7Z2B',
    });
    expect(lireSmsOperateur('Orange Money: Vous avez reçu 10.50 USD du 0851234567. Ref: OM2610011405.1234')).toMatchObject({
      operator: 'orange', amount: 10.5, currency: 'USD', phone: '+243851234567', transactionId: 'OM2610011405.1234',
    });
    // Un numéro de téléphone voisin n'est pas pris pour le montant.
    expect(lireSmsOperateur('Vous avez recu de 243991234567 25 000 FC. Ref: XY12345')).toMatchObject({ amount: 25000, phone: '+243991234567' });
    expect(lireSmsOperateur('Vous avez envoyé 2 000 FC à 0991112233. ID: ABC123456').direction).toBe('sent');
  });

  it('confirme un versement avec le SMS collé, après avoir vérifié le montant', async () => {
    const d = await demander(12.5);
    const analyse = await harness.post('/payments/mobile-money/sms/analyse',
      { text: 'M-PESA Confirmé. Vous avez reçu 12.50 USD de 0991234567. ID de transaction: 8J3K2L1M9P' }, pharmacie.token).expect(201);
    expect(analyse.body.candidates.map((c: { id: string }) => c.id)).toEqual([d.body.id]);

    const faux = await harness.post(`/payments/mobile-money/${d.body.id}/confirm-sms`,
      { text: 'M-PESA Confirmé. Vous avez reçu 1.25 USD de 0991234567. ID de transaction: 8J3K2L1M9X' }, pharmacie.token).expect(409);
    expect(faux.body.message).toContain('vérifiez le versement');
    const autreOperateur = await harness.post(`/payments/mobile-money/${d.body.id}/confirm-sms`,
      { text: 'Airtel Money: vous avez recu 12.50 USD de 0991234567. Trans ID: CI0001234' }, pharmacie.token).expect(409);
    expect(autreOperateur.body.message).toContain('airtel');

    const ok = await harness.post(`/payments/mobile-money/${d.body.id}/confirm-sms`,
      { text: 'M-PESA Confirmé. Vous avez reçu 12.50 USD de 0991234567. ID de transaction: 8J3K2L1M9P' }, pharmacie.token).expect(201);
    expect(ok.body).toMatchObject({ status: 'confirmed', operator_reference: '8J3K2L1M9P' });
  });

  it('confirme tout seul le versement attendu quand le téléphone marchand transfère le SMS', async () => {
    await harness.post('/payments/mobile-money/sms-link', {}, pharmacie.token).expect(201).then((r) => { jeton = r.body.token; expect(r.body.path).toContain(jeton); });
    const etat = await harness.get('/payments/mobile-money/sms-link', pharmacie.token).expect(200);
    expect(etat.body).toMatchObject({ is_active: true, token_hint: `…${jeton.slice(-4)}` });

    const d = await demander(20, '0812345678');
    const r = await harness.post(`/public/mobile-money/sms/${jeton}`, { message: 'QWE123RTY9 Confirmé. 20.00 USD reçus de 243812345678. M-PESA', from: 'MPESA' }).expect(201);
    expect(r.body).toEqual({ status: 'matched', reference: d.body.reference });
    const liste = await harness.get('/payments/mobile-money', pharmacie.token).expect(200);
    expect((liste.body.data ?? liste.body).find((c: { id: string }) => c.id === d.body.id)).toMatchObject({ status: 'confirmed', operator_reference: 'QWE123RTY9' });

    // Le même SMS renvoyé n'encaisse pas deux fois.
    expect((await harness.post(`/public/mobile-money/sms/${jeton}`, { text: 'QWE123RTY9 Confirmé. 20.00 USD reçus de 243812345678. M-PESA' }).expect(201)).body.status).toBe('duplicate');
    // Un envoi d'argent est ignoré ; un lien inconnu est refusé.
    expect((await harness.post(`/public/mobile-money/sms/${jeton}`, { text: 'Vous avez envoyé 5 USD à 0991112233. ID: OUT12345' }).expect(201)).body.status).toBe('ignored');
    await harness.post('/public/mobile-money/sms/jeton-inconnu', { text: 'Vous avez reçu 5 USD. ID: AAA11111' }).expect(404);
  });

  it('laisse en attente un SMS ambigu, que le caissier rapproche à la main', async () => {
    const a = await demander(7, '0971111111', 'airtel');
    await demander(7, '0972222222', 'airtel');
    // Sans numéro dans le SMS, deux versements de 7 $ conviennent : NOVA ne choisit pas.
    const r = await harness.post(`/public/mobile-money/sms/${jeton}`, { text: 'Airtel Money: vous avez recu 7.00 USD. Trans ID: CI261001A77' }).expect(201);
    expect(r.body.status).toBe('unmatched');
    const boite = await harness.get('/payments/mobile-money/sms?status=unmatched', pharmacie.token).expect(200);
    expect(boite.body).toHaveLength(1);
    expect(boite.body[0]).toMatchObject({ amount: '7.00', transaction_id: 'CI261001A77', note: '2 versements attendus du même montant' });

    await harness.post(`/payments/mobile-money/sms/${boite.body[0].id}/match`, { collectionId: a.body.id }, pharmacie.token).expect(201);
    expect((await harness.get('/payments/mobile-money/sms?status=unmatched', pharmacie.token).expect(200)).body).toHaveLength(0);
    const tous = await harness.get('/payments/mobile-money/sms', pharmacie.token).expect(200);
    expect(tous.body.filter((s: { transaction_id: string }) => s.transaction_id === 'CI261001A77')).toHaveLength(1);

    // Couper le lien : le transfert s'arrête aussitôt.
    await harness.delete('/payments/mobile-money/sms-link', pharmacie.token).expect(200);
    await harness.post(`/public/mobile-money/sms/${jeton}`, { text: 'Vous avez reçu 5 USD. ID: AAA11111' }).expect(404);
  });
});
