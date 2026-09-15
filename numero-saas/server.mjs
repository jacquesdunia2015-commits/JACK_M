#!/usr/bin/env node
/**
 * NuméroGo — SaaS de numéros de téléphone temporaires (Phase 1 MVP)
 *
 * Implémentation de la Phase 1 (§11) du cahier des charges « Plateforme SaaS
 * mondiale de numéros de téléphone temporaires » v1.0 (19/07/2026) : compte
 * utilisateur, wallet, sélection de pays, attribution d'un numéro, réception
 * de SMS en temps réel, dashboard simple, API de base, paiement simple — et
 * une bonne partie de la Phase 2 (multi-pays, multi-devises, webhooks,
 * anti-abus léger, reporting admin) déjà posée pour ne pas bloquer la suite.
 *
 * Zéro dépendance externe : Node.js >= 18 uniquement.
 * Démarrage :  node server.mjs   [PORT=8080]
 *
 * Fournisseur télécom : ce MVP SIMULE un fournisseur (pool de numéros
 * généré à la volée, réception de SMS simulée + OTP de démonstration
 * automatique après activation) derrière une frontière nette — les
 * fonctions de la section « Fournisseur simulé » et la route
 * POST /api/provider/inbound — afin de pouvoir brancher un vrai fournisseur
 * (Twilio, Vonage, Telnyx…) sans toucher au reste du serveur.
 */

import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = process.env.NUMEROGO_DATA || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const PORT = Number(process.env.PORT || 8080);
const PROVIDER_SECRET = process.env.PROVIDER_SECRET || 'dev-provider-secret';

/* ============================== Persistance ============================== */

let db = null;
let saveTimer = null;

function loadDb() {
  if (fs.existsSync(DB_FILE)) {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  } else {
    db = {
      users: [], countries: [], numbers: [], messages: [],
      webhooks: [], transactions: [], audit: [], rateHistory: [],
    };
    seed();
  }
  rebuildApiKeyIndex();
}

function saveDb() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db, null, 1));
    fs.renameSync(tmp, DB_FILE);
  }, 100);
}

const uid = () => crypto.randomBytes(9).toString('base64url');
const now = () => new Date().toISOString();
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/* ========================= Authentification (§3.1, §7.1) ================= */

const sessions = new Map(); // token -> { userId, created }
const SESSION_TTL = 12 * 3600 * 1000;

function hashSecret(secret, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(secret, salt, 32).toString('hex');
  return { salt, hash };
}

function checkSecret(secret, salt, hash) {
  const h = crypto.scryptSync(secret, salt, 32).toString('hex');
  try { return crypto.timingSafeEqual(Buffer.from(h), Buffer.from(hash)); }
  catch { return false; }
}

/* ============================ Clés API (§6.3) ============================= */
/* Format rendu au client : ngo_<id>_<secret>. Seul un hash scrypt du secret
 * est conservé côté serveur (comme un mot de passe) ; l'identifiant sert
 * d'index pour retrouver rapidement l'utilisateur. */

const apiKeyIndex = new Map(); // id -> userId

function rebuildApiKeyIndex() {
  apiKeyIndex.clear();
  for (const u of db.users) if (u.apiKey) apiKeyIndex.set(u.apiKey.id, u.id);
}

function issueApiKey(user) {
  const id = crypto.randomBytes(6).toString('hex');
  const secret = crypto.randomBytes(24).toString('hex');
  const { salt, hash } = hashSecret(secret);
  user.apiKey = { id, salt, hash, createdAt: now() };
  apiKeyIndex.set(id, user.id);
  saveDb();
  return `ngo_${id}_${secret}`;
}

function userFromApiKey(raw) {
  const parts = String(raw).split('_');
  if (parts.length !== 3 || parts[0] !== 'ngo') return null;
  const [, id, secret] = parts;
  const userId = apiKeyIndex.get(id);
  if (!userId) return null;
  const user = db.users.find((u) => u.id === userId);
  if (!user || !user.apiKey) return null;
  return checkSecret(secret, user.apiKey.salt, user.apiKey.hash) ? user : null;
}

function getUser(req, url) {
  const auth = req.headers['authorization'] || '';
  let token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token && url) token = url.searchParams.get('token'); // pour EventSource (§3.3 temps réel)
  if (token) {
    const s = sessions.get(token);
    if (s) {
      if (Date.now() - s.created > SESSION_TTL) { sessions.delete(token); return null; }
      return db.users.find((u) => u.id === s.userId) || null;
    }
  }
  const apiKey = req.headers['x-api-key'];
  if (apiKey) return userFromApiKey(apiKey);
  return null;
}

const sanitizeUser = (u) => ({
  id: u.id, email: u.email, role: u.role, walletUsd: round2(u.walletUsd),
  suspended: !!u.suspended, createdAt: u.createdAt, hasApiKey: !!u.apiKey,
});

function audit(user, action, details) {
  db.audit.push({ id: uid(), ts: now(), userId: user ? user.id : null, userEmail: user ? user.email : null, action, details: details || '' });
  if (db.audit.length > 5000) db.audit.splice(0, db.audit.length - 5000);
  saveDb();
}

function txn(user, type, amountUsd, description) {
  user.walletUsd = round2(user.walletUsd + amountUsd);
  db.transactions.push({ id: uid(), userId: user.id, type, amountUsd: round2(amountUsd), balanceAfter: user.walletUsd, description, createdAt: now() });
}

/* =============== Anti-abus léger : rate limiting sur l'auth (§7.1) ======== */

const rateBuckets = new Map();
function rateLimited(ip, limit = 20, windowMs = 60000) {
  const t = Date.now();
  const b = rateBuckets.get(ip);
  if (!b || t > b.resetAt) { rateBuckets.set(ip, { count: 1, resetAt: t + windowMs }); return false; }
  b.count += 1;
  return b.count > limit;
}

/* ===================== Pays et tarification (§4) =========================
 * `rate` = unités de devise locale pour 1 USD (USD = devise de référence
 * interne, cf. §4). Les prix affichés localement sont dérivés du prix USD
 * pour ne jamais désynchroniser les deux. */

const PAYS_DEFAUT = [
  { code: 'CD', name: 'RD Congo', dial: '+243', currency: 'CDF', rate: 2870, priceEntryUsd: 0.35, priceRenewUsd: 0.20 },
  { code: 'US', name: 'États-Unis', dial: '+1', currency: 'USD', rate: 1, priceEntryUsd: 1.20, priceRenewUsd: 0.80 },
  { code: 'FR', name: 'France', dial: '+33', currency: 'EUR', rate: 0.92, priceEntryUsd: 1.10, priceRenewUsd: 0.70 },
  { code: 'GB', name: 'Royaume-Uni', dial: '+44', currency: 'GBP', rate: 0.79, priceEntryUsd: 1.00, priceRenewUsd: 0.65 },
  { code: 'NG', name: 'Nigeria', dial: '+234', currency: 'NGN', rate: 1550, priceEntryUsd: 0.45, priceRenewUsd: 0.25 },
  { code: 'KE', name: 'Kenya', dial: '+254', currency: 'KES', rate: 129, priceEntryUsd: 0.40, priceRenewUsd: 0.22 },
  { code: 'RW', name: 'Rwanda', dial: '+250', currency: 'RWF', rate: 1300, priceEntryUsd: 0.38, priceRenewUsd: 0.20 },
  { code: 'SN', name: 'Sénégal', dial: '+221', currency: 'XOF', rate: 600, priceEntryUsd: 0.40, priceRenewUsd: 0.22 },
  { code: 'IN', name: 'Inde', dial: '+91', currency: 'INR', rate: 84, priceEntryUsd: 0.30, priceRenewUsd: 0.18 },
  { code: 'BR', name: 'Brésil', dial: '+55', currency: 'BRL', rate: 5.6, priceEntryUsd: 0.55, priceRenewUsd: 0.32 },
];

function getCountry(code) {
  return db.countries.find((c) => c.code === String(code || '').toUpperCase());
}

function publicCountry(c) {
  return {
    code: c.code, name: c.name, dial: c.dial, currency: c.currency, active: c.active,
    priceEntry: { usd: c.priceEntryUsd, local: round2(c.priceEntryUsd * c.rate) },
    priceRenew: { usd: c.priceRenewUsd, local: round2(c.priceRenewUsd * c.rate) },
    durationHours: c.durationHours,
    availableCount: db.numbers.filter((n) => n.countryCode === c.code && n.status === 'available').length,
  };
}

/* ===================== Fournisseur simulé (§6, §5) =========================
 * Génère des numéros factices à la volée (provisioning "instantané") et
 * simule la réception de SMS. À remplacer par l'intégration d'un vrai
 * fournisseur télécom sans changer le reste de l'application. */

function genPhoneNumber(country) {
  let phone;
  do {
    const local = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join('');
    phone = `${country.dial}${local}`;
  } while (db.numbers.some((n) => n.phoneNumber === phone));
  return phone;
}

function blankNumber(country) {
  return {
    id: uid(), countryCode: country.code, phoneNumber: genPhoneNumber(country), status: 'available',
    ownerId: null, reservedAt: null, activatedAt: null, expiresAt: null, releasedAt: null, renewals: 0,
  };
}

function pickAvailableNumber(country) {
  let n = db.numbers.find((x) => x.countryCode === country.code && x.status === 'available');
  if (!n) { n = blankNumber(country); db.numbers.push(n); }
  return n;
}

function publicNumber(n) {
  return {
    id: n.id, countryCode: n.countryCode, phoneNumber: n.phoneNumber, status: n.status,
    reservedAt: n.reservedAt, activatedAt: n.activatedAt, expiresAt: n.expiresAt, renewals: n.renewals,
    messageCount: db.messages.filter((m) => m.numberId === n.id).length,
  };
}

const RESERVATION_TTL_MS = 3 * 60 * 1000;
const REFUND_WINDOW_MS = 2 * 60 * 1000;
const MAX_CONCURRENT_NUMBERS = 5;

function sweep() {
  if (!db) return;
  const t = Date.now();
  let changed = false;
  for (const n of db.numbers) {
    if (n.status === 'reserved' && t - Date.parse(n.reservedAt) > RESERVATION_TTL_MS) {
      Object.assign(n, { status: 'available', ownerId: null, reservedAt: null });
      changed = true;
    } else if (n.status === 'active' && n.expiresAt && t > Date.parse(n.expiresAt)) {
      n.status = 'expired';
      changed = true;
      pushSse(n.ownerId, 'number-expired', { numberId: n.id });
    }
  }
  if (changed) saveDb();
}
setInterval(sweep, 15000);

/* ===================== Temps réel (§3.3) et webhooks (§6, §7.1) =========== */

const sseClients = new Map(); // userId -> Set(res)

function pushSse(userId, event, data) {
  const set = sseClients.get(userId);
  if (!set) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of set) { try { res.write(payload); } catch { /* client déconnecté */ } }
}

function dispatchWebhooks(userId, event, data) {
  for (const w of db.webhooks.filter((x) => x.userId === userId)) {
    const body = JSON.stringify({ event, data, ts: now() });
    const signature = crypto.createHmac('sha256', w.secret).update(body).digest('hex');
    fetch(w.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Signature': `sha256=${signature}` },
      body,
      signal: AbortSignal.timeout(5000),
    }).catch(() => {}); // best-effort : un webhook injoignable ne bloque jamais l'API
  }
}

function receiveMessage(number, from, text) {
  const msg = { id: uid(), numberId: number.id, ownerId: number.ownerId, from, text, receivedAt: now() };
  db.messages.push(msg);
  saveDb();
  pushSse(number.ownerId, 'message', msg);
  dispatchWebhooks(number.ownerId, 'message.received', msg);
  return msg;
}

function scheduleDemoOtp(number) {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  setTimeout(() => {
    const fresh = db.numbers.find((n) => n.id === number.id);
    if (fresh && fresh.status === 'active') {
      receiveMessage(fresh, 'Vérification', `Votre code de vérification est ${code}. Valable 10 minutes.`);
    }
  }, 4000 + Math.random() * 5000);
}

/* ===================== Données de démonstration =========================== */

function seed() {
  for (const c of PAYS_DEFAUT) {
    db.countries.push({ ...c, durationHours: 24, active: true });
    for (let i = 0; i < 12; i++) db.numbers.push(blankNumber(c));
  }

  const mkUser = (email, password, role) => {
    const { salt, hash } = hashSecret(password);
    const u = { id: uid(), email, salt, hash, role, walletUsd: 0, suspended: false, createdAt: now(), apiKey: null };
    db.users.push(u);
    return u;
  };

  mkUser('admin@numerogo.dev', 'admin123', 'admin');
  const demo = mkUser('demo@numerogo.dev', 'demo1234', 'user');
  txn(demo, 'trial_credit', 4.5, 'Crédit d’essai de bienvenue');

  const cd = db.numbers.find((n) => n.countryCode === 'CD' && n.status === 'available');
  if (cd) {
    cd.status = 'active'; cd.ownerId = demo.id; cd.activatedAt = now();
    cd.expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    db.messages.push({ id: uid(), numberId: cd.id, ownerId: demo.id, from: 'WhatsApp', text: 'Votre code WhatsApp est 482-193. Ne le partagez avec personne.', receivedAt: now() });
  }

  saveDb();
}

/* ===================== Aides HTTP / routage ================================ */

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e6) { reject(new Error('Payload trop volumineux')); req.destroy(); } });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch { reject(new Error('JSON invalide')); } });
    req.on('error', reject);
  });
}

const routes = [];
function route(method, pattern, handler, opts = {}) {
  routes.push({ method, pattern, handler, admin: !!opts.admin, public: !!opts.public });
}

/* ---- Authentification (§3.1, §6.3) ---------------------------------------- */

route('POST', /^\/api\/auth\/register$/, async (req, res, user, m, url, body) => {
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(res, 400, { erreur: 'Adresse e-mail invalide' });
  if (password.length < 6) return json(res, 400, { erreur: 'Mot de passe : 6 caractères minimum' });
  if (db.users.some((u) => u.email === email)) return json(res, 409, { erreur: 'Un compte existe déjà avec cet e-mail' });
  const { salt, hash } = hashSecret(password);
  const u = { id: uid(), email, salt, hash, role: 'user', walletUsd: 0, suspended: false, createdAt: now(), apiKey: null };
  db.users.push(u);
  txn(u, 'trial_credit', 2.0, 'Crédit d’essai de bienvenue');
  audit(u, 'register', email);
  const token = crypto.randomBytes(24).toString('base64url');
  sessions.set(token, { userId: u.id, created: Date.now() });
  json(res, 201, { token, user: sanitizeUser(u) });
}, { public: true });

route('POST', /^\/api\/auth\/login$/, async (req, res, user, m, url, body) => {
  const email = String(body.email || '').trim().toLowerCase();
  const u = db.users.find((x) => x.email === email);
  if (!u || !checkSecret(String(body.password || ''), u.salt, u.hash)) {
    audit(null, 'login_failed', email);
    return json(res, 401, { erreur: 'Identifiants invalides' });
  }
  if (u.suspended) return json(res, 403, { erreur: 'Compte suspendu' });
  const token = crypto.randomBytes(24).toString('base64url');
  sessions.set(token, { userId: u.id, created: Date.now() });
  audit(u, 'login', email);
  json(res, 200, { token, user: sanitizeUser(u) });
}, { public: true });

route('POST', /^\/api\/auth\/logout$/, async (req, res) => {
  const auth = req.headers['authorization'] || '';
  if (auth.startsWith('Bearer ')) sessions.delete(auth.slice(7));
  json(res, 200, { ok: true });
});

route('POST', /^\/api\/auth\/api-key$/, async (req, res, user) => {
  const key = issueApiKey(user);
  audit(user, 'api_key_issued', '');
  json(res, 200, { apiKey: key }); // affichée UNE SEULE fois : au client de la stocker
});

route('GET', /^\/api\/me$/, async (req, res, user) => json(res, 200, { user: sanitizeUser(user) }));

/* ---- Pays et tarification (§4, §6.3) --------------------------------------- */

route('GET', /^\/api\/countries$/, async (req, res) => {
  json(res, 200, { countries: db.countries.filter((c) => c.active).map(publicCountry) });
}, { public: true });

route('GET', /^\/api\/pricing$/, async (req, res, user, m, url) => {
  const code = url.searchParams.get('country');
  if (!code) return json(res, 200, { countries: db.countries.filter((c) => c.active).map(publicCountry) });
  const c = getCountry(code);
  if (!c || !c.active) return json(res, 404, { erreur: 'Pays inconnu ou indisponible' });
  json(res, 200, publicCountry(c));
}, { public: true });

/* ---- Numéros (§3.2, §6.3) --------------------------------------------------- */

route('GET', /^\/api\/numbers\/available$/, async (req, res, user, m, url) => {
  const code = url.searchParams.get('country');
  const c = code ? getCountry(code) : null;
  if (code && (!c || !c.active)) return json(res, 404, { erreur: 'Pays inconnu ou indisponible' });
  const list = db.countries.filter((x) => x.active && (!code || x.code === c.code)).map(publicCountry);
  json(res, 200, { countries: list });
}, { public: true });

route('GET', /^\/api\/numbers$/, async (req, res, user, m, url) => {
  const status = url.searchParams.get('status');
  let mine = db.numbers.filter((n) => n.ownerId === user.id);
  if (status) mine = mine.filter((n) => n.status === status);
  json(res, 200, { numbers: mine.map(publicNumber) });
});

route('GET', /^\/api\/numbers\/([^/]+)$/, async (req, res, user, m) => {
  const n = db.numbers.find((x) => x.id === m[1]);
  if (!n || (n.ownerId !== user.id && user.role !== 'admin')) return json(res, 404, { erreur: 'Numéro introuvable' });
  json(res, 200, publicNumber(n));
});

route('POST', /^\/api\/numbers\/reserve$/, async (req, res, user, m, url, body) => {
  const c = getCountry(body.country);
  if (!c || !c.active) return json(res, 404, { erreur: 'Pays inconnu ou indisponible' });
  const concurrent = db.numbers.filter((n) => n.ownerId === user.id && ['active', 'reserved'].includes(n.status)).length;
  if (concurrent >= MAX_CONCURRENT_NUMBERS) return json(res, 429, { erreur: `Limite de ${MAX_CONCURRENT_NUMBERS} numéros actifs/réservés simultanés atteinte (anti-abus)` });
  const n = pickAvailableNumber(c);
  n.status = 'reserved'; n.ownerId = user.id; n.reservedAt = now();
  saveDb();
  audit(user, 'number_reserved', n.phoneNumber);
  json(res, 200, { number: publicNumber(n), expiresInSeconds: RESERVATION_TTL_MS / 1000 });
});

route('POST', /^\/api\/numbers\/([^/]+)\/activate$/, async (req, res, user, m) => {
  const n = db.numbers.find((x) => x.id === m[1]);
  if (!n || n.ownerId !== user.id) return json(res, 404, { erreur: 'Numéro introuvable' });
  if (n.status !== 'reserved') return json(res, 409, { erreur: `Numéro non réservé (statut actuel : ${n.status})` });
  const c = getCountry(n.countryCode);
  if (user.walletUsd < c.priceEntryUsd) return json(res, 402, { erreur: 'Solde insuffisant, veuillez recharger votre wallet' });
  txn(user, 'debit_reserve', -c.priceEntryUsd, `Location ${n.phoneNumber} (${c.name})`);
  n.status = 'active'; n.activatedAt = now();
  n.expiresAt = new Date(Date.now() + c.durationHours * 3600 * 1000).toISOString();
  saveDb();
  audit(user, 'number_activated', n.phoneNumber);
  scheduleDemoOtp(n);
  json(res, 200, { number: publicNumber(n), wallet: round2(user.walletUsd) });
});

route('POST', /^\/api\/numbers\/([^/]+)\/renew$/, async (req, res, user, m) => {
  const n = db.numbers.find((x) => x.id === m[1]);
  if (!n || n.ownerId !== user.id) return json(res, 404, { erreur: 'Numéro introuvable' });
  const graceOk = n.status === 'expired' && Date.now() - Date.parse(n.expiresAt) < 3600 * 1000;
  if (n.status !== 'active' && !graceOk) return json(res, 409, { erreur: `Numéro non renouvelable (statut actuel : ${n.status})` });
  const c = getCountry(n.countryCode);
  if (user.walletUsd < c.priceRenewUsd) return json(res, 402, { erreur: 'Solde insuffisant, veuillez recharger votre wallet' });
  txn(user, 'debit_renew', -c.priceRenewUsd, `Renouvellement ${n.phoneNumber} (${c.name})`);
  const base = graceOk ? Date.now() : Date.parse(n.expiresAt);
  n.status = 'active'; n.renewals += 1;
  n.expiresAt = new Date(base + c.durationHours * 3600 * 1000).toISOString();
  saveDb();
  audit(user, 'number_renewed', n.phoneNumber);
  json(res, 200, { number: publicNumber(n), wallet: round2(user.walletUsd) });
});

function releaseNumber(user, id) {
  const n = db.numbers.find((x) => x.id === id);
  if (!n || n.ownerId !== user.id) return { code: 404, body: { erreur: 'Numéro introuvable' } };
  if (!['reserved', 'active', 'expired'].includes(n.status)) return { code: 409, body: { erreur: 'Numéro déjà libéré' } };
  const c = getCountry(n.countryCode);
  const hasMessages = db.messages.some((msg) => msg.numberId === n.id);
  // Politique de remboursement (§3.4, §7.2) : libération < 2 min après
  // activation ET aucun SMS reçu → remboursement intégral du prix d'entrée.
  if (n.status === 'active' && !hasMessages && n.activatedAt && Date.now() - Date.parse(n.activatedAt) < REFUND_WINDOW_MS) {
    txn(user, 'refund', c.priceEntryUsd, `Remboursement libération anticipée ${n.phoneNumber}`);
  }
  const phoneFreed = n.phoneNumber;
  Object.assign(n, { status: 'available', ownerId: null, reservedAt: null, activatedAt: null, expiresAt: null, releasedAt: now() });
  saveDb();
  audit(user, 'number_released', phoneFreed);
  return { code: 200, body: { ok: true, wallet: round2(user.walletUsd) } };
}

route('POST', /^\/api\/numbers\/([^/]+)\/release$/, async (req, res, user, m) => {
  const r = releaseNumber(user, m[1]); json(res, r.code, r.body);
});
route('DELETE', /^\/api\/numbers\/([^/]+)$/, async (req, res, user, m) => {
  const r = releaseNumber(user, m[1]); json(res, r.code, r.body);
});

/* ---- Réception SMS (§3.3, §6.2) -------------------------------------------- */

route('GET', /^\/api\/messages$/, async (req, res, user, m, url) => {
  const numberId = url.searchParams.get('numberId');
  let list = db.messages.filter((msg) => msg.ownerId === user.id);
  if (numberId) list = list.filter((msg) => msg.numberId === numberId);
  json(res, 200, { messages: list.slice(-200).reverse() });
});

// Aide de démonstration/test : injecte un SMS sur un numéro actif, sans
// passer par le fournisseur simulé (utile pour la recette et les démos).
route('POST', /^\/api\/numbers\/([^/]+)\/simulate-sms$/, async (req, res, user, m, url, body) => {
  const n = db.numbers.find((x) => x.id === m[1]);
  if (!n || (n.ownerId !== user.id && user.role !== 'admin')) return json(res, 404, { erreur: 'Numéro introuvable' });
  if (n.status !== 'active') return json(res, 409, { erreur: 'Le numéro doit être actif pour recevoir un SMS' });
  const msg = receiveMessage(n, String(body.from || 'Test').slice(0, 40), String(body.text || 'Message de test').slice(0, 300));
  json(res, 200, { message: msg });
});

// Point d'entrée qu'un VRAI fournisseur appellerait en production
// (webhook entrant, §6.2 étape 8) — sécurisé par un secret partagé.
route('POST', /^\/api\/provider\/inbound$/, async (req, res, user, m, url, body) => {
  if (req.headers['x-provider-secret'] !== PROVIDER_SECRET) return json(res, 401, { erreur: 'Secret fournisseur invalide' });
  const n = db.numbers.find((x) => x.phoneNumber === String(body.phoneNumber || '') && x.status === 'active');
  if (!n) return json(res, 404, { erreur: 'Numéro inconnu ou inactif' });
  const msg = receiveMessage(n, String(body.from || 'Inconnu'), String(body.text || ''));
  json(res, 200, { ok: true, messageId: msg.id });
}, { public: true });

/* ---- Webhooks client (§6.3, §7.1) ------------------------------------------ */

route('GET', /^\/api\/webhooks$/, async (req, res, user) => {
  json(res, 200, { webhooks: db.webhooks.filter((w) => w.userId === user.id).map((w) => ({ id: w.id, url: w.url, createdAt: w.createdAt })) });
});

route('POST', /^\/api\/webhooks\/register$/, async (req, res, user, m, url, body) => {
  const target = String(body.url || '');
  if (!/^https?:\/\//.test(target)) return json(res, 400, { erreur: 'URL de webhook invalide' });
  if (db.webhooks.filter((w) => w.userId === user.id).length >= 5) return json(res, 429, { erreur: 'Limite de 5 webhooks atteinte' });
  const w = { id: uid(), userId: user.id, url: target, secret: crypto.randomBytes(16).toString('hex'), createdAt: now() };
  db.webhooks.push(w); saveDb();
  json(res, 201, { id: w.id, url: w.url, secret: w.secret }); // secret affiché une seule fois (signature HMAC)
});

route('DELETE', /^\/api\/webhooks\/([^/]+)$/, async (req, res, user, m) => {
  const idx = db.webhooks.findIndex((w) => w.id === m[1] && w.userId === user.id);
  if (idx === -1) return json(res, 404, { erreur: 'Webhook introuvable' });
  db.webhooks.splice(idx, 1); saveDb();
  json(res, 200, { ok: true });
});

/* ---- Wallet et facturation (§3.4) ------------------------------------------ */

route('GET', /^\/api\/billing\/balance$/, async (req, res, user) => json(res, 200, { walletUsd: round2(user.walletUsd) }));

route('GET', /^\/api\/billing\/transactions$/, async (req, res, user) => {
  json(res, 200, { transactions: db.transactions.filter((t) => t.userId === user.id).slice(-200).reverse() });
});

route('POST', /^\/api\/billing\/recharge$/, async (req, res, user, m, url, body) => {
  const amount = Number(body.amountUsd);
  if (!Number.isFinite(amount) || amount < 1 || amount > 500) return json(res, 400, { erreur: 'Montant invalide (1 à 500 USD)' });
  // MVP : rechargement instantané simulé (mode « bac à sable »). En
  // production, remplacer par la confirmation d'un webhook Stripe / PayPal /
  // Mobile Money (§9.6) avant de créditer le wallet.
  txn(user, 'recharge', amount, `Rechargement (${String(body.method || 'simulé').slice(0, 30)})`);
  audit(user, 'wallet_recharge', `${amount} USD`);
  json(res, 200, { walletUsd: round2(user.walletUsd) });
});

/* ---- Flux temps réel (§3.3) ------------------------------------------------- */

route('GET', /^\/api\/stream$/, async (req, res, user) => {
  res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.write(': connecté\n\n');
  if (!sseClients.has(user.id)) sseClients.set(user.id, new Set());
  sseClients.get(user.id).add(res);
  const heartbeat = setInterval(() => { try { res.write(': ping\n\n'); } catch { /* ignore */ } }, 25000);
  req.on('close', () => { clearInterval(heartbeat); sseClients.get(user.id)?.delete(res); });
});

/* ---- Administration (§3.5) -------------------------------------------------- */

route('GET', /^\/api\/admin\/overview$/, async (req, res) => {
  const revenue = db.transactions.filter((t) => ['debit_reserve', 'debit_renew'].includes(t.type)).reduce((s, t) => s - t.amountUsd, 0);
  const dayAgo = Date.now() - 24 * 3600 * 1000;
  json(res, 200, {
    users: db.users.length,
    activeNumbers: db.numbers.filter((n) => n.status === 'active').length,
    reservedNumbers: db.numbers.filter((n) => n.status === 'reserved').length,
    revenueUsd: round2(revenue),
    messagesLast24h: db.messages.filter((mm) => Date.parse(mm.receivedAt) > dayAgo).length,
    byCountry: db.countries.map((c) => ({
      code: c.code, name: c.name, active: c.active,
      available: db.numbers.filter((n) => n.countryCode === c.code && n.status === 'available').length,
      active_: db.numbers.filter((n) => n.countryCode === c.code && n.status === 'active').length,
    })),
  });
}, { admin: true });

route('GET', /^\/api\/admin\/countries$/, async (req, res) => json(res, 200, { countries: db.countries }), { admin: true });

route('POST', /^\/api\/admin\/countries$/, async (req, res, user, m, url, body) => {
  const code = String(body.code || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return json(res, 400, { erreur: 'Code pays ISO2 requis' });
  if (getCountry(code)) return json(res, 409, { erreur: 'Ce pays existe déjà' });
  const c = {
    code, name: String(body.name || code).slice(0, 80), dial: String(body.dial || '+000').slice(0, 6),
    currency: String(body.currency || 'USD').toUpperCase().slice(0, 6), rate: Number(body.rate) || 1,
    priceEntryUsd: Number(body.priceEntryUsd) || 0.5, priceRenewUsd: Number(body.priceRenewUsd) || 0.3,
    durationHours: Number(body.durationHours) || 24, active: true,
  };
  db.countries.push(c);
  for (let i = 0; i < 8; i++) db.numbers.push(blankNumber(c));
  saveDb();
  audit(user, 'country_created', c.code);
  json(res, 201, { country: c });
}, { admin: true });

route('PATCH', /^\/api\/admin\/countries\/([^/]+)$/, async (req, res, user, m, url, body) => {
  const c = getCountry(m[1]);
  if (!c) return json(res, 404, { erreur: 'Pays inconnu' });
  for (const f of ['priceEntryUsd', 'priceRenewUsd', 'durationHours']) if (body[f] != null) c[f] = Math.max(0, Number(body[f]) || 0);
  if (body.active != null) c.active = !!body.active;
  if (body.rate != null && Number(body.rate) > 0 && Number(body.rate) !== c.rate) {
    db.rateHistory.push({ countryCode: c.code, rate: Number(body.rate), previousRate: c.rate, changedAt: now() }); // §4 : historiser les taux
    c.rate = Number(body.rate);
  }
  saveDb();
  audit(user, 'country_updated', c.code);
  json(res, 200, { country: c });
}, { admin: true });

route('GET', /^\/api\/admin\/users$/, async (req, res) => json(res, 200, { users: db.users.map(sanitizeUser) }), { admin: true });

route('PATCH', /^\/api\/admin\/users\/([^/]+)$/, async (req, res, user, m, url, body) => {
  const target = db.users.find((u) => u.id === m[1]);
  if (!target) return json(res, 404, { erreur: 'Utilisateur introuvable' });
  if (body.suspended != null) target.suspended = !!body.suspended;
  saveDb();
  audit(user, target.suspended ? 'user_suspended' : 'user_unsuspended', target.email);
  json(res, 200, { user: sanitizeUser(target) });
}, { admin: true });

route('GET', /^\/api\/admin\/audit$/, async (req, res) => json(res, 200, { audit: db.audit.slice(-300).reverse() }), { admin: true });

/* ===================== Fichiers statiques =================================== */

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };

function serveStatic(req, res, pathname) {
  const rel = pathname === '/' ? '/index.html' : pathname;
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) {
      fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (e2, idx) => {
        if (e2) { res.writeHead(404); return res.end('Not found'); }
        res.writeHead(200, { 'Content-Type': MIME['.html'] }); res.end(idx);
      });
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
}

/* ===================== Serveur ================================================ */

loadDb();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Api-Key');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');

  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (!pathname.startsWith('/api/')) return serveStatic(req, res, pathname);

  if (pathname.startsWith('/api/auth/') && rateLimited(req.socket.remoteAddress || 'unknown')) {
    return json(res, 429, { erreur: 'Trop de requêtes, réessayez plus tard' });
  }

  try {
    for (const r of routes) {
      if (r.method !== req.method) continue;
      const m = pathname.match(r.pattern);
      if (!m) continue;
      const user = getUser(req, url);
      if (!r.public && !user) return json(res, 401, { erreur: 'Authentification requise' });
      if (user && user.suspended) return json(res, 403, { erreur: 'Compte suspendu' });
      if (r.admin && (!user || user.role !== 'admin')) return json(res, 403, { erreur: 'Accès administrateur requis' });
      const body = ['POST', 'PATCH', 'PUT'].includes(req.method) ? await readBody(req) : {};
      return await r.handler(req, res, user, m, url, body);
    }
    json(res, 404, { erreur: 'Route inconnue' });
  } catch (e) {
    json(res, 400, { erreur: e.message || 'Erreur serveur' });
  }
});

server.listen(PORT, () => {
  console.log(`NuméroGo démarré : http://localhost:${PORT}`);
  console.log(`Données : ${DB_FILE}`);
});

export { server, db };
