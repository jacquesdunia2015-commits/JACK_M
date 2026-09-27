import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { one, query } from '../db/pool.js';
import { authenticate, currentUser, signToken } from '../lib/auth.js';
import { HttpError } from '../lib/errors.js';
import { country, currency, email, optText } from '../lib/validation.js';
import { COUNTRY_CURRENCY } from '../lib/geo.js';
import { PLANS } from '../lib/plans.js';
import { config } from '../lib/config.js';
import { LOCALES } from '../lib/locales.js';

export const authRouter = Router();

const limiter = rateLimit({ windowMs: 15 * 60_000, limit: config.isTest ? 10_000 : 30, standardHeaders: true });

const registerSchema = z.object({
  email,
  password: z.string().min(8, 'Mot de passe : 8 caractères minimum').max(200),
  fullName: z.string().trim().min(2, 'Nom requis').max(200),
  phone: optText,
  locale: z.enum(LOCALES).default('fr'),
  country: country.nullish(),
  currency: currency.optional(),
});

export function publicUser(u: any) {
  return {
    id: u.id,
    email: u.email,
    fullName: u.full_name,
    phone: u.phone,
    role: u.role,
    plan: u.plan,
    locale: u.locale,
    country: u.country,
    currency: u.currency,
    planInfo: PLANS[u.plan as keyof typeof PLANS],
  };
}

/** Inscription d'un bailleur (offre Starter par défaut). */
authRouter.post('/register', limiter, async (req, res) => {
  const data = registerSchema.parse(req.body);
  const exists = await one('SELECT 1 FROM users WHERE email = $1', [data.email]);
  if (exists) throw new HttpError(409, 'Un compte existe déjà avec cet email', 'email_taken');
  const hash = await bcrypt.hash(data.password, 10);
  const user = await one(
    `INSERT INTO users(email, password_hash, full_name, phone, role, locale, country, currency)
     VALUES ($1,$2,$3,$4,'bailleur',$5,$6,$7) RETURNING *`,
    [
      data.email, hash, data.fullName, data.phone, data.locale, data.country ?? null,
      // Monnaie par défaut : celle choisie, sinon celle du pays, sinon le dollar
      data.currency ?? (data.country ? COUNTRY_CURRENCY[data.country] : undefined) ?? 'USD',
    ],
  );
  res.status(201).json({ token: signToken(user.id), user: publicUser(user) });
});

authRouter.post('/login', limiter, async (req, res) => {
  const data = z.object({ email, password: z.string().min(1) }).parse(req.body);
  const user = await one('SELECT * FROM users WHERE email = $1', [data.email]);
  if (!user || !(await bcrypt.compare(data.password, user.password_hash))) {
    throw new HttpError(401, 'Email ou mot de passe incorrect', 'bad_credentials');
  }
  if (!user.active) throw new HttpError(403, 'Compte désactivé, contactez le support', 'account_disabled');
  res.json({ token: signToken(user.id), user: publicUser(user) });
});

authRouter.get('/me', authenticate, async (req, res) => {
  const user = await one('SELECT * FROM users WHERE id = $1', [currentUser(req).id]);
  res.json({ user: publicUser(user) });
});

authRouter.patch('/me', authenticate, async (req, res) => {
  const data = z
    .object({
      fullName: z.string().trim().min(2).max(200).optional(),
      phone: optText.optional(),
      currentPassword: z.string().optional(),
      newPassword: z.string().min(8, 'Mot de passe : 8 caractères minimum').max(200).optional(),
      locale: z.enum(LOCALES).optional(),
      country: country.nullish(),
      currency: currency.optional(),
    })
    .parse(req.body);
  const me = currentUser(req);
  const user = await one('SELECT * FROM users WHERE id = $1', [me.id]);
  let hash = user.password_hash;
  if (data.newPassword) {
    if (!data.currentPassword || !(await bcrypt.compare(data.currentPassword, user.password_hash))) {
      throw new HttpError(400, 'Mot de passe actuel incorrect', 'wrong_password');
    }
    hash = await bcrypt.hash(data.newPassword, 10);
  }
  const { rows } = await query(
    `UPDATE users SET full_name = $2, phone = $3, password_hash = $4, locale = $5, country = $6, currency = $7
      WHERE id = $1 RETURNING *`,
    [
      me.id, data.fullName ?? user.full_name, data.phone === undefined ? user.phone : data.phone, hash,
      data.locale ?? user.locale, data.country === undefined ? user.country : data.country, data.currency ?? user.currency,
    ],
  );
  res.json({ user: publicUser(rows[0]) });
});
