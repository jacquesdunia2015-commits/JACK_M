import request from 'supertest';
import { createApp } from '../src/app.js';

export const app = createApp();
export const api = () => request(app);

let n = 0;
export async function registerLandlord(name = 'Bailleur') {
  n++;
  const res = await api()
    .post('/api/auth/register')
    .send({ email: `bailleur${n}-${Date.now()}@test.cd`, password: 'motdepasse', fullName: `${name} ${n}` });
  if (res.status !== 201) throw new Error(JSON.stringify(res.body));
  const token = res.body.token as string;
  return { token, user: res.body.user, auth: { Authorization: `Bearer ${token}` } };
}

export const propertyInput = (over: Record<string, unknown> = {}) => ({
  title: 'Maison Test',
  province: 'Kinshasa',
  commune: 'Gombe',
  quartier: 'Golf',
  avenue: 'Av. Test',
  numero: '1',
  type: 'maison',
  bedrooms: 3,
  livingRooms: 1,
  toiletsInternal: 1,
  toiletsExternal: 0,
  kitchens: 1,
  monthlyRent: 500,
  currency: 'USD',
  ...over,
});

export const tenantInput = (over: Record<string, unknown> = {}) => ({
  firstName: 'Grâce',
  lastName: 'Kabeya',
  email: 'grace@test.cd',
  phone: '+243 81 000 0000',
  idNumber: 'CD-1',
  ...over,
});
