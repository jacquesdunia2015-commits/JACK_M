import { describe, expect, it } from 'vitest';
import { api, propertyInput, registerLandlord, tenantInput } from './helpers.js';
import { COUNTRY_CURRENCY, CURRENCIES } from '../src/lib/geo.js';
import * as webGeo from '../../web/src/lib/geo.js';
import { fmtMoney } from '../src/lib/contract.js';

describe('pays et monnaies', () => {
  it('la liste des pays est identique côté serveur et côté interface', () => {
    expect(webGeo.COUNTRY_CURRENCY).toEqual(COUNTRY_CURRENCY);
  });

  it("à l'inscription, la monnaie par défaut suit le pays", async () => {
    const r = await api()
      .post('/api/auth/register')
      .send({ email: `sn${Date.now()}@test.sn`, password: 'motdepasse', fullName: 'Awa Diop', country: 'SN', locale: 'wo' });
    expect(r.body.user).toMatchObject({ country: 'SN', currency: 'XOF', locale: 'wo' });
    const cd = await api()
      .post('/api/auth/register')
      .send({ email: `cd${Date.now()}@test.cd`, password: 'motdepasse', fullName: 'Jean', country: 'CD' });
    expect(cd.body.user.currency).toBe('CDF');
    const none = await api().post('/api/auth/register').send({ email: `x${Date.now()}@test.cd`, password: 'motdepasse', fullName: 'Sans Pays' });
    expect(none.status, JSON.stringify(none.body)).toBe(201);
    expect(none.body.user).toMatchObject({ country: null, currency: 'USD' });
    expect((await api().post('/api/auth/register').send({ email: 'z@z.cd', password: 'motdepasse', fullName: 'Z', country: 'ZZ' })).status).toBe(400);
  });

  it('propriétés et baux prennent la monnaie par défaut du bailleur, ou celle choisie', async () => {
    const a = await registerLandlord();
    await api().patch('/api/auth/me').set(a.auth).send({ country: 'RW', currency: 'RWF' });
    const { currency: _c, ...noCurrency } = propertyInput();
    const p = await api().post('/api/properties').set(a.auth).send(noCurrency);
    expect(p.body.currency).toBe('RWF');
    const eur = await api().post('/api/properties').set(a.auth).send(propertyInput({ currency: 'EUR' }));
    expect(eur.body.currency).toBe('EUR');
    expect((await api().post('/api/properties').set(a.auth).send(propertyInput({ currency: 'ABC' }))).status).toBe(400);

    const t = await api().post('/api/tenants').set(a.auth).send(tenantInput());
    const l = await api()
      .post('/api/leases')
      .set(a.auth)
      .send({ propertyId: p.body.id, tenantId: t.body.id, startDate: '2026-01-01', endDate: '2026-12-31', monthlyRent: 150000 });
    expect(l.body.currency).toBe('RWF');
    const dash = await api().get('/api/dashboard').set(a.auth);
    expect(dash.body.currencies).toEqual(['RWF']);
    expect(dash.body.expectedMonthly).toEqual({ RWF: 150000 });
  });

  it('formate les montants avec le bon symbole', () => {
    const clean = (s: string) => s.replace(/\s/g, ' ');
    expect(clean(fmtMoney(1500, 'USD'))).toBe('1 500,00 $');
    expect(clean(fmtMoney(25000, 'CDF'))).toContain('FC');
    expect(clean(fmtMoney(300, 'EUR'))).toBe('300,00 €');
    expect(clean(fmtMoney(45000, 'XOF'))).toContain('F CFA');
    expect(CURRENCIES).toContain('XAF');
  });
});
