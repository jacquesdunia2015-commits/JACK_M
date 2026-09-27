import { describe, expect, it } from 'vitest';
import { api, propertyInput, registerLandlord, tenantInput } from './helpers.js';
import { addDays, today } from '../src/lib/dates.js';
import { runAlerts } from '../src/lib/notifier.js';
import { outbox } from '../src/lib/mailer.js';
import { query } from '../src/db/pool.js';

describe('authentification', () => {
  it('inscription, connexion et profil', async () => {
    const reg = await api().post('/api/auth/register').send({ email: 'Jean@Test.cd', password: 'motdepasse', fullName: 'Jean' });
    expect(reg.status).toBe(201);
    expect(reg.body.user).toMatchObject({ email: 'jean@test.cd', role: 'bailleur', plan: 'starter' });
    expect(reg.body.user.password_hash).toBeUndefined();

    const dup = await api().post('/api/auth/register').send({ email: 'jean@test.cd', password: 'motdepasse', fullName: 'Jean' });
    expect(dup.status).toBe(409);

    const bad = await api().post('/api/auth/login').send({ email: 'jean@test.cd', password: 'mauvais' });
    expect(bad.status).toBe(401);

    const ok = await api().post('/api/auth/login').send({ email: 'jean@test.cd', password: 'motdepasse' });
    expect(ok.status).toBe(200);
    const me = await api().get('/api/auth/me').set('Authorization', `Bearer ${ok.body.token}`);
    expect(me.body.user.fullName).toBe('Jean');
  });

  it('refuse les requêtes sans jeton ou avec un jeton invalide', async () => {
    expect((await api().get('/api/properties')).status).toBe(401);
    expect((await api().get('/api/properties').set('Authorization', 'Bearer abc')).status).toBe(401);
  });

  it('valide les données', async () => {
    const res = await api().post('/api/auth/register').send({ email: 'pas-un-email', password: 'court', fullName: '' });
    expect(res.status).toBe(400);
    expect(res.body.details.map((d: any) => d.field)).toEqual(expect.arrayContaining(['email', 'password', 'fullName']));
  });
});

describe('propriétés et locataires', () => {
  it('CRUD d’une propriété et isolation entre bailleurs', async () => {
    const a = await registerLandlord();
    const b = await registerLandlord();
    const created = await api().post('/api/properties').set(a.auth).send(propertyInput());
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ title: 'Maison Test', status: 'vacante', monthly_rent: 500 });

    const upd = await api().put(`/api/properties/${created.body.id}`).set(a.auth).send(propertyInput({ title: 'Renommée' }));
    expect(upd.body.title).toBe('Renommée');

    // L'autre bailleur ne voit ni ne modifie rien
    expect((await api().get(`/api/properties/${created.body.id}`).set(b.auth)).status).toBe(404);
    expect((await api().get('/api/properties').set(b.auth)).body).toEqual([]);
    expect((await api().delete(`/api/properties/${created.body.id}`).set(b.auth)).status).toBe(404);

    expect((await api().delete(`/api/properties/${created.body.id}`).set(a.auth)).status).toBe(204);
  });

  it('applique les limites de l’offre Starter (3 propriétés, 10 locataires)', async () => {
    const a = await registerLandlord();
    for (let i = 0; i < 3; i++) expect((await api().post('/api/properties').set(a.auth).send(propertyInput())).status).toBe(201);
    const over = await api().post('/api/properties').set(a.auth).send(propertyInput());
    expect(over.status).toBe(402);
    for (let i = 0; i < 10; i++) expect((await api().post('/api/tenants').set(a.auth).send(tenantInput())).status).toBe(201);
    expect((await api().post('/api/tenants').set(a.auth).send(tenantInput())).status).toBe(402);
  });

  it('liste noire : motif obligatoire, détection, confirmation avant bail', async () => {
    const a = await registerLandlord();
    const noReason = await api().post('/api/tenants').set(a.auth).send(tenantInput({ blacklisted: true }));
    expect(noReason.status).toBe(400);
    const t = await api().post('/api/tenants').set(a.auth).send(tenantInput({ blacklisted: true, blacklistReason: 'Impayés' }));
    expect(t.status).toBe(201);
    const check = await api().get('/api/tenants/check-blacklist?idNumber=CD-1').set(a.auth);
    expect(check.body.matches).toHaveLength(1);

    const p = await api().post('/api/properties').set(a.auth).send(propertyInput());
    const lease = { propertyId: p.body.id, tenantId: t.body.id, startDate: '2026-01-01', endDate: '2026-12-31', monthlyRent: 500 };
    expect((await api().post('/api/leases').set(a.auth).send(lease)).status).toBe(409);
    expect((await api().post('/api/leases').set(a.auth).send({ ...lease, acceptBlacklisted: true })).status).toBe(201);
  });

  it('seul le bailleur accède à ces routes', async () => {
    const admin = await registerLandlord();
    await query("UPDATE users SET role = 'admin' WHERE id = $1", [admin.user.id]);
    expect((await api().get('/api/properties').set(admin.auth)).status).toBe(403);
  });
});

describe('baux, alertes et paiements', () => {
  async function setup(expiresIn: number) {
    const a = await registerLandlord();
    const p = await api().post('/api/properties').set(a.auth).send(propertyInput());
    const t = await api().post('/api/tenants').set(a.auth).send(tenantInput({ email: `loc-${Date.now()}@test.cd` }));
    const end = addDays(today(), expiresIn);
    const l = await api()
      .post('/api/leases')
      .set(a.auth)
      .send({ propertyId: p.body.id, tenantId: t.body.id, startDate: addDays(end, -365), endDate: end, monthlyRent: 500, guaranteeAmount: 1500 });
    expect(l.status).toBe(201);
    return { a, p: p.body, t: t.body, lease: l.body };
  }

  it('attribue la couleur de garantie et occupe la propriété', async () => {
    const { a, p, lease } = await setup(45);
    expect(lease.guarantee).toMatchObject({ level: 'jaune', daysRemaining: 45 });
    expect(lease.guarantee_expires_on).toBe(lease.end_date);
    expect((await api().get(`/api/properties/${p.id}`).set(a.auth)).body.status).toBe('occupee');
    const filtered = await api().get('/api/leases?level=jaune').set(a.auth);
    expect(filtered.body.map((l: any) => l.id)).toEqual([lease.id]);
  });

  it('refuse un second bail actif sur la même propriété', async () => {
    const { a, p, t } = await setup(100);
    const again = await api()
      .post('/api/leases')
      .set(a.auth)
      .send({ propertyId: p.id, tenantId: t.id, startDate: '2027-01-01', endDate: '2027-12-31', monthlyRent: 1 });
    expect(again.status).toBe(409);
  });

  it('renouvelle un bail en archivant l’ancien', async () => {
    const { a, lease } = await setup(10);
    const renewed = await api().post(`/api/leases/${lease.id}/renew`).set(a.auth).send({ monthlyRent: 550 });
    expect(renewed.status).toBe(201);
    expect(renewed.body).toMatchObject({ status: 'actif', previous_lease_id: lease.id, monthly_rent: 550 });
    expect(renewed.body.start_date).toBe(addDays(lease.end_date, 1));
    expect(renewed.body.guarantee.level).toBe('vert');
    const old = await api().get(`/api/leases/${lease.id}`).set(a.auth);
    expect(old.body.status).toBe('renouvele');
    expect((await api().put(`/api/leases/${lease.id}`).set(a.auth).send({ startDate: '2026-01-01', endDate: '2026-02-01', monthlyRent: 1 })).status).toBe(409);
  });

  it('clôture un bail et libère la propriété', async () => {
    const { a, p, lease } = await setup(100);
    const res = await api().post(`/api/leases/${lease.id}/terminate`).set(a.auth);
    expect(res.body.status).toBe('termine');
    expect(res.body.guarantee.level).toBeNull();
    expect((await api().get(`/api/properties/${p.id}`).set(a.auth)).body.status).toBe('vacante');
  });

  it('génère le contrat de bail', async () => {
    const { a, lease } = await setup(100);
    const res = await api().get(`/api/leases/${lease.id}/contract`).set(a.auth);
    expect(res.status).toBe(200);
    expect(res.text).toContain('CONTRAT DE BAIL');
    expect(res.text).toContain('Grâce Kabeya');
  });

  it('enregistre les paiements et calcule l’échéancier', async () => {
    const { a, lease } = await setup(200);
    const period = today().slice(0, 7);
    const pay = await api()
      .post(`/api/leases/${lease.id}/payments`)
      .set(a.auth)
      .send({ period, amount: 500, paidOn: today(), method: 'mobile_money' });
    expect(pay.status).toBe(201);
    const detail = await api().get(`/api/leases/${lease.id}`).set(a.auth);
    const current = detail.body.schedule.find((s: any) => s.period === `${period}-01`);
    expect(current.state).toBe('paye');
    // Les mois précédents non payés sont en retard / impayés
    expect(detail.body.schedule.some((s: any) => s.state === 'impaye')).toBe(true);

    const dash = await api().get('/api/dashboard').set(a.auth);
    expect(dash.body.revenueThisMonth.USD).toBe(500);
    expect(dash.body.occupancyRate).toBe(100);
    expect(dash.body.arrears.USD).toBeGreaterThan(0);
  });

  it('envoie chaque alerte de garantie une seule fois, au bailleur et au locataire', async () => {
    const { a, lease, t } = await setup(12);
    outbox.length = 0;
    await runAlerts();
    const mine = outbox.filter((m) => m.subject.includes('Garantie') && [a.user.email, t.email].includes(m.to));
    expect(mine.map((m) => m.to).sort()).toEqual([a.user.email, t.email].sort());
    expect(mine[0].subject).toContain('🟠');

    await runAlerts();
    expect(outbox.filter((m) => m.subject.includes('Garantie') && m.to === a.user.email)).toHaveLength(1);

    const hist = await api().get('/api/alerts').set(a.auth);
    const g = hist.body.filter((x: any) => x.kind === 'garantie' && x.lease_id === lease.id);
    expect(g).toHaveLength(2);
    expect(g[0]).toMatchObject({ threshold: 14, level: 'orange', status: 'simule' });
  });
});

describe('espace locataire et administration', () => {
  it('le locataire ne voit que ses propres baux', async () => {
    const a = await registerLandlord();
    const p = await api().post('/api/properties').set(a.auth).send(propertyInput());
    const t = await api().post('/api/tenants').set(a.auth).send(tenantInput({ email: 'portail@test.cd' }));
    await api()
      .post('/api/leases')
      .set(a.auth)
      .send({ propertyId: p.body.id, tenantId: t.body.id, startDate: today(), endDate: addDays(today(), 300), monthlyRent: 500 });
    const open = await api().post(`/api/tenants/${t.body.id}/portal`).set(a.auth).send({ password: 'locataire1' });
    expect(open.status).toBe(201);

    const login = await api().post('/api/auth/login').send({ email: 'portail@test.cd', password: 'locataire1' });
    expect(login.body.user.role).toBe('locataire');
    const auth = { Authorization: `Bearer ${login.body.token}` };
    const mine = await api().get('/api/portal/leases').set(auth);
    expect(mine.body.leases).toHaveLength(1);
    expect(mine.body.leases[0].guarantee.level).toBe('vert');
    expect(mine.body.landlord.email).toBe(a.user.email);
    expect((await api().get('/api/properties').set(auth)).status).toBe(403);

    await api().delete(`/api/tenants/${t.body.id}/portal`).set(a.auth);
    expect((await api().get('/api/portal/leases').set(auth)).status).toBe(401);
  });

  it('l’administrateur change l’offre d’un bailleur', async () => {
    const admin = await registerLandlord();
    await query("UPDATE users SET role = 'admin' WHERE id = $1", [admin.user.id]);
    const b = await registerLandlord();
    const list = await api().get('/api/admin/users').set(admin.auth);
    expect(list.body.users.some((u: any) => u.id === b.user.id)).toBe(true);
    const upd = await api().patch(`/api/admin/users/${b.user.id}`).set(admin.auth).send({ plan: 'pro' });
    expect(upd.body.plan).toBe('pro');
    expect((await api().get('/api/admin/users').set(b.auth)).status).toBe(403);
  });
});

describe('galerie photos', () => {
  it('ajoute puis supprime une photo, refuse les autres formats', async () => {
    const a = await registerLandlord();
    const p = await api().post('/api/properties').set(a.auth).send(propertyInput());
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    const up = await api().post(`/api/properties/${p.body.id}/photos`).set(a.auth).attach('photos', png, { filename: 'a.png', contentType: 'image/png' });
    expect(up.status).toBe(201);
    expect((await api().get(up.body[0].url)).status).toBe(200);
    const bad = await api().post(`/api/properties/${p.body.id}/photos`).set(a.auth).attach('photos', Buffer.from('x'), { filename: 'a.txt', contentType: 'text/plain' });
    expect(bad.status).toBe(400);
    expect((await api().delete(`/api/properties/${p.body.id}/photos/${up.body[0].id}`).set(a.auth)).status).toBe(204);
    expect((await api().get(up.body[0].url)).status).toBe(404);
  });
});
