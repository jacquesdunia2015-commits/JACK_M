import { describe, expect, it } from 'vitest';
import { api, propertyInput, registerLandlord, tenantInput } from './helpers.js';
import { outbox } from '../src/lib/mailer.js';

async function landlordWithLease() {
  const a = await registerLandlord();
  const p = await api().post('/api/properties').set(a.auth).send(propertyInput({ title: 'Villa Rapport' }));
  const t = await api().post('/api/tenants').set(a.auth).send(tenantInput({ email: `msg-${Date.now()}@test.cd` }));
  const l = await api()
    .post('/api/leases')
    .set(a.auth)
    .send({ propertyId: p.body.id, tenantId: t.body.id, startDate: '2026-01-01', endDate: '2026-12-31', monthlyRent: 500 });
  return { a, p: p.body, t: t.body, lease: l.body };
}

describe('messagerie bailleur ↔ locataire', () => {
  it('échange, compteurs non lus, marquage lu et email de notification', async () => {
    const { a, t } = await landlordWithLease();
    await api().post(`/api/tenants/${t.id}/portal`).set(a.auth).send({ password: 'locataire1' });
    const login = await api().post('/api/auth/login').send({ email: t.email, password: 'locataire1' });
    const tenantAuth = { Authorization: `Bearer ${login.body.token}` };

    outbox.length = 0;
    const sent = await api().post(`/api/messages/${t.id}`).set(a.auth).send({ body: 'Bonjour, la garantie arrive à échéance.' });
    expect(sent.status).toBe(201);
    expect(outbox.map((m) => m.to)).toEqual([t.email]);
    expect(outbox[0].text).not.toContain('garantie arrive'); // le contenu reste dans l'application

    expect((await api().get('/api/notifications').set(tenantAuth)).body.unreadMessages).toBe(1);
    const inbox = await api().get('/api/portal/messages').set(tenantAuth);
    expect(inbox.body.messages).toHaveLength(1);
    expect((await api().get('/api/notifications').set(tenantAuth)).body.unreadMessages).toBe(0);

    await api().post('/api/portal/messages').set(tenantAuth).send({ body: 'Merci, je passe demain.' });
    expect((await api().get('/api/notifications').set(a.auth)).body.unreadMessages).toBe(1);
    const convs = await api().get('/api/messages').set(a.auth);
    expect(convs.body[0]).toMatchObject({ tenant_id: t.id, unread: 1, last_sender: 'locataire' });
    const conv = await api().get(`/api/messages/${t.id}`).set(a.auth);
    expect(conv.body.messages.map((m: any) => m.sender_role)).toEqual(['bailleur', 'locataire']);
    expect((await api().get('/api/notifications').set(a.auth)).body.unreadMessages).toBe(0);
  });

  it('refuse un message vide et isole les bailleurs', async () => {
    const { a, t } = await landlordWithLease();
    const b = await registerLandlord();
    expect((await api().post(`/api/messages/${t.id}`).set(a.auth).send({ body: '   ' })).status).toBe(400);
    expect((await api().get(`/api/messages/${t.id}`).set(b.auth)).status).toBe(404);
    expect((await api().post(`/api/messages/${t.id}`).set(b.auth).send({ body: 'x' })).status).toBe(404);
  });
});

describe('rapports et reçus', () => {
  it('rapport mensuel : lignes, totaux, occupation, export CSV', async () => {
    const { a, lease } = await landlordWithLease();
    await api().post(`/api/leases/${lease.id}/payments`).set(a.auth).send({ period: '2026-03', amount: 300, paidOn: '2026-03-02' });
    const r = await api().get('/api/reports/monthly?month=2026-03').set(a.auth);
    expect(r.status).toBe(200);
    expect(r.body.lines).toHaveLength(1);
    expect(r.body.lines[0]).toMatchObject({ property: 'Villa Rapport', rent: 500, paid: 300, remaining: 200, state: 'impaye' });
    expect(r.body.totals.USD).toEqual({ expected: 500, collected: 300, remaining: 200 });
    expect(r.body.occupancy).toMatchObject({ properties: 1, occupied: 1, rate: 100 });
    expect(r.body.payments).toHaveLength(1);

    const csv = await api().get('/api/reports/monthly?month=2026-03&format=csv').set(a.auth);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.headers['content-disposition']).toContain('locagest-rapport-2026-03.csv');
    expect(csv.text.charCodeAt(0)).toBe(0xfeff);
    expect(csv.text).toContain('Villa Rapport;Grâce Kabeya;USD;500;300;200;2026-03-01;Impayé');

    // Mois hors bail
    expect((await api().get('/api/reports/monthly?month=2025-06').set(a.auth)).body.lines).toEqual([]);
    expect((await api().get('/api/reports/monthly?month=2026-13x').set(a.auth)).status).toBe(400);
  });

  it('rapport annuel', async () => {
    const { a, lease } = await landlordWithLease();
    await api().post(`/api/leases/${lease.id}/payments`).set(a.auth).send({ period: '2026-01', amount: 500, paidOn: '2026-01-03' });
    const r = await api().get('/api/reports/annual?year=2026').set(a.auth);
    expect(r.body.months).toHaveLength(12);
    expect(r.body.months[0].totals.USD).toMatchObject({ expected: 500, collected: 500, remaining: 0 });
    expect(r.body.totals.USD.expected).toBe(6000);
    expect(r.body.totals.USD.collected).toBe(500);
    const csv = await api().get('/api/reports/annual?year=2026&format=csv').set(a.auth);
    expect(csv.text).toContain('Mois;Attendu USD;Encaissé USD;Arriérés USD;Taux d');
    expect(csv.text).toContain('2026-01;500;500;0;100');
  });

  it("ne compte pas les mois à venir dans les arriérés", async () => {
    const a = await registerLandlord();
    const next = Number(new Date().getFullYear()) + 1;
    const p = await api().post('/api/properties').set(a.auth).send(propertyInput());
    const t = await api().post('/api/tenants').set(a.auth).send(tenantInput());
    await api()
      .post('/api/leases')
      .set(a.auth)
      .send({ propertyId: p.body.id, tenantId: t.body.id, startDate: `${next}-01-01`, endDate: `${next}-12-31`, monthlyRent: 500 });
    const r = await api().get(`/api/reports/annual?year=${next}`).set(a.auth);
    expect(r.body.totals.USD).toEqual({ expected: 6000, collected: 0, remaining: 0 });
    const m = await api().get(`/api/reports/monthly?month=${next}-06`).set(a.auth);
    expect(m.body.lines[0]).toMatchObject({ state: 'a_venir', remaining: 500 });
    expect(m.body.totals.USD.remaining).toBe(0);
  });

  it('reçu de paiement', async () => {
    const { a, lease } = await landlordWithLease();
    const pay = await api()
      .post(`/api/leases/${lease.id}/payments`)
      .set(a.auth)
      .send({ period: '2026-02', amount: 200, paidOn: '2026-02-04', method: 'mobile_money', reference: 'MP123' });
    const r = await api().get(`/api/leases/${lease.id}/payments/${pay.body.id}/receipt`).set(a.auth);
    expect(r.status).toBe(200);
    expect(r.text).toContain('REÇU DE LOYER');
    expect(r.text).toContain('février 2026');
    expect(r.text).toContain('MP123');
    expect(r.text).toContain('Paiement partiel');
    const b = await registerLandlord();
    expect((await api().get(`/api/leases/${lease.id}/payments/${pay.body.id}/receipt`).set(b.auth)).status).toBe(404);
  });
});
