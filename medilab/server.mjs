#!/usr/bin/env node
/**
 * MediLab SaaS — Serveur (Phase 1 MVP)
 * SaaS de gestion des dossiers médicaux et des résultats de laboratoire.
 *
 * Implémentation du cahier des charges v1.0 (19/07/2026) — Phase 1 :
 *   gestion patients, consultations, demandes de laboratoire, saisie et
 *   validation des résultats, export PDF, authentification, audit trail,
 *   séparation multi-établissement (multi-tenant).
 *
 * Zéro dépendance externe : Node.js >= 18 uniquement.
 * Démarrage :  node server.mjs  [PORT=8080]
 */

import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = process.env.MEDILAB_DATA || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const PORT = Number(process.env.PORT || 8080);

/* ============================== Persistance ============================== */

let db = null;
let saveTimer = null;

function loadDb() {
  if (fs.existsSync(DB_FILE)) {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  } else {
    db = { etablissements: [], users: [], patients: [], consultations: [], tests: [], demandes: [], audit: [], seq: 1000 };
    seed();
  }
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
const nextNum = (prefix) => `${prefix}-${++db.seq}`;

/* ========================= Authentification ============================= */

const sessions = new Map(); // token -> { userId, created }
const SESSION_TTL = 12 * 3600 * 1000;

function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 32).toString('hex');
  return { salt, hash };
}

function checkPassword(password, salt, hash) {
  const h = crypto.scryptSync(password, salt, 32).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(h), Buffer.from(hash));
}

/* ==================== Rôles et permissions (Art. 5, 10) ================== */

const ROLES = {
  admin_systeme: { label: 'Administrateur système', perms: ['*'] },
  admin_etablissement: {
    label: "Administrateur d'établissement",
    perms: ['users:manage', 'tests:manage', 'patients:read', 'consultations:read',
      'demandes:read', 'resultats:read', 'audit:read'],
  },
  medecin: {
    label: 'Médecin',
    perms: ['patients:read', 'patients:write', 'consultations:read', 'consultations:write',
      'demandes:read', 'demandes:create', 'resultats:read'],
  },
  infirmier: {
    label: 'Infirmier',
    perms: ['patients:read', 'consultations:read', 'demandes:read', 'demandes:prelever'],
  },
  receptionniste: {
    label: 'Réceptionniste',
    perms: ['patients:read', 'patients:write'],
  },
  laborantin: {
    label: 'Laborantin',
    perms: ['patients:read', 'demandes:read', 'demandes:traiter', 'resultats:write'],
  },
  biologiste: {
    label: 'Biologiste',
    perms: ['patients:read', 'demandes:read', 'demandes:traiter', 'resultats:write',
      'resultats:valider', 'resultats:read'],
  },
  qualite: {
    label: 'Responsable qualité',
    perms: ['patients:read', 'demandes:read', 'resultats:read', 'audit:read'],
  },
};

function can(user, perm) {
  const role = ROLES[user.role];
  if (!role) return false;
  return role.perms.includes('*') || role.perms.includes(perm);
}

/* ===================== Audit trail (Art. 16) ============================ */
/* Journal en append-only : aucune API de modification ni de suppression.  */

function audit(user, action, entite, entiteId, details) {
  db.audit.push({
    id: uid(),
    ts: now(),
    userId: user ? user.id : null,
    userNom: user ? user.nom : 'anonyme',
    etablissementId: user ? user.etablissementId : null,
    action,
    entite,
    entiteId: entiteId || null,
    details: details || '',
  });
  saveDb();
}

/* ===================== Données de démonstration ========================= */

const CATALOGUE_DEFAUT = [
  { code: 'GLY', nom: 'Glycémie à jeun', categorie: 'Biochimie', unite: 'mmol/L', type: 'quantitatif', refMin: 3.9, refMax: 6.1, critMin: 2.5, critMax: 20 },
  { code: 'CREAT', nom: 'Créatinine sérique', categorie: 'Biochimie', unite: 'µmol/L', type: 'quantitatif', refMin: 60, refMax: 115, critMin: null, critMax: 500 },
  { code: 'URE', nom: 'Urée sanguine', categorie: 'Biochimie', unite: 'mmol/L', type: 'quantitatif', refMin: 2.5, refMax: 7.5, critMin: null, critMax: 30 },
  { code: 'HB', nom: 'Hémoglobine', categorie: 'Hématologie', unite: 'g/dL', type: 'quantitatif', refMin: 12, refMax: 17, critMin: 6, critMax: 22 },
  { code: 'GB', nom: 'Leucocytes', categorie: 'Hématologie', unite: '10³/µL', type: 'quantitatif', refMin: 4, refMax: 10, critMin: 1, critMax: 50 },
  { code: 'PLT', nom: 'Plaquettes', categorie: 'Hématologie', unite: '10³/µL', type: 'quantitatif', refMin: 150, refMax: 400, critMin: 20, critMax: 1000 },
  { code: 'CRP', nom: 'Protéine C réactive (CRP)', categorie: 'Immunologie', unite: 'mg/L', type: 'quantitatif', refMin: 0, refMax: 5, critMin: null, critMax: 300 },
  { code: 'ALAT', nom: 'ALAT (SGPT)', categorie: 'Biochimie', unite: 'UI/L', type: 'quantitatif', refMin: 7, refMax: 40, critMin: null, critMax: 1000 },
  { code: 'PALU', nom: 'Paludisme — frottis sanguin', categorie: 'Parasitologie', unite: '', type: 'qualitatif', refMin: null, refMax: null, critMin: null, critMax: null },
  { code: 'VIH', nom: 'Sérologie VIH (test rapide)', categorie: 'Sérologie', unite: '', type: 'qualitatif', refMin: null, refMax: null, critMin: null, critMax: null, sensible: true },
];

function seed() {
  const e1 = { id: uid(), nom: 'Clinique Horizon Santé', ville: 'Kinshasa', actif: true, cree: now() };
  const e2 = { id: uid(), nom: 'Centre Médical du Lac', ville: 'Goma', actif: true, cree: now() };
  db.etablissements.push(e1, e2);

  const mkUser = (login, password, nom, role, etabId) => {
    const { salt, hash } = hashPassword(password);
    const u = { id: uid(), login, nom, role, etablissementId: etabId, salt, hash, actif: true, cree: now() };
    db.users.push(u);
    return u;
  };

  mkUser('admin', 'admin123', 'Administrateur Plateforme', 'admin_systeme', null);
  mkUser('admin.horizon', 'demo1234', 'Chantal Mbuyi', 'admin_etablissement', e1.id);
  mkUser('dr.mukendi', 'demo1234', 'Dr Patrice Mukendi', 'medecin', e1.id);
  mkUser('inf.kalala', 'demo1234', 'Grâce Kalala', 'infirmier', e1.id);
  mkUser('accueil', 'demo1234', 'Sylvie Tshala', 'receptionniste', e1.id);
  mkUser('lab.kanya', 'demo1234', 'Jean Kanya', 'laborantin', e1.id);
  mkUser('bio.ilunga', 'demo1234', 'Dr Micheline Ilunga', 'biologiste', e1.id);
  mkUser('qualite', 'demo1234', 'Robert Nsimba', 'qualite', e1.id);
  mkUser('dr.amani', 'demo1234', 'Dr Claude Amani', 'medecin', e2.id);
  mkUser('lab.furaha', 'demo1234', 'Esther Furaha', 'laborantin', e2.id);

  for (const etab of [e1, e2]) {
    for (const t of CATALOGUE_DEFAUT) {
      db.tests.push({ id: uid(), etablissementId: etab.id, actif: true, ...t });
    }
  }
  saveDb();
}

/* ===================== Aides HTTP / routage ============================= */

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 1e6) { reject(new Error('payload trop volumineux')); req.destroy(); }
    });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch { reject(new Error('JSON invalide')); }
    });
    req.on('error', reject);
  });
}

function getUser(req) {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  const s = sessions.get(token);
  if (!s) return null;
  if (Date.now() - s.created > SESSION_TTL) { sessions.delete(token); return null; }
  return db.users.find((u) => u.id === s.userId && u.actif) || null;
}

/** Étanchéité multi-tenant (Art. 4, 14, 23) : un utilisateur ne voit que
 *  les données de son établissement ; l'admin système voit tout. */
function tenantFilter(user, rows) {
  if (user.role === 'admin_systeme') return rows;
  return rows.filter((r) => r.etablissementId === user.etablissementId);
}

function tenantCheck(user, row) {
  if (!row) return false;
  return user.role === 'admin_systeme' || row.etablissementId === user.etablissementId;
}

const sanitizeUser = (u) => ({
  id: u.id, login: u.login, nom: u.nom, role: u.role,
  roleLabel: (ROLES[u.role] || {}).label || u.role,
  etablissementId: u.etablissementId, actif: u.actif,
});

/* ===================== Cycle de vie des demandes (Art. 7.2) ============= */

const STATUTS = ['demandee', 'prelevee', 'recue', 'en_analyse', 'saisie', 'validee', 'publiee'];
const TRANSITIONS = {
  demandee: ['prelevee'],
  prelevee: ['recue'],
  recue: ['en_analyse'],
  en_analyse: ['saisie'],
  saisie: ['validee'],
  validee: ['publiee'],
  publiee: [],
};

function flagFor(test, valeur) {
  if (test.type !== 'quantitatif') return null;
  const v = Number(valeur);
  if (!Number.isFinite(v)) return null;
  if (test.critMax != null && v >= test.critMax) return 'critique';
  if (test.critMin != null && v <= test.critMin) return 'critique';
  if (test.refMax != null && v > test.refMax) return 'haut';
  if (test.refMin != null && v < test.refMin) return 'bas';
  return 'normal';
}

/* =========================== API ======================================== */

const routes = [];
function route(method, pattern, handler, perm) {
  routes.push({ method, pattern, handler, perm });
}

/* ---- Authentification -------------------------------------------------- */

route('POST', /^\/api\/login$/, async (req, res) => {
  const { login, password } = await readBody(req);
  const user = db.users.find((u) => u.login === login && u.actif);
  if (!user || !checkPassword(String(password || ''), user.salt, user.hash)) {
    audit(null, 'connexion_echec', 'utilisateur', null, `login: ${String(login || '').slice(0, 40)}`);
    return json(res, 401, { erreur: 'Identifiants invalides' });
  }
  const token = crypto.randomBytes(24).toString('base64url');
  sessions.set(token, { userId: user.id, created: Date.now() });
  audit(user, 'connexion', 'utilisateur', user.id, '');
  json(res, 200, { token, user: sanitizeUser(user) });
});

route('POST', /^\/api\/logout$/, async (req, res, user) => {
  const auth = req.headers['authorization'] || '';
  sessions.delete(auth.slice(7));
  audit(user, 'deconnexion', 'utilisateur', user.id, '');
  json(res, 200, { ok: true });
});

route('GET', /^\/api\/me$/, async (req, res, user) => {
  const etab = db.etablissements.find((e) => e.id === user.etablissementId);
  json(res, 200, { user: sanitizeUser(user), etablissement: etab || null });
});

/* ---- Établissements (Art. 14) ------------------------------------------ */

route('GET', /^\/api\/etablissements$/, async (req, res, user) => {
  const rows = user.role === 'admin_systeme'
    ? db.etablissements
    : db.etablissements.filter((e) => e.id === user.etablissementId);
  json(res, 200, rows);
});

route('POST', /^\/api\/etablissements$/, async (req, res, user) => {
  if (user.role !== 'admin_systeme') return json(res, 403, { erreur: 'Accès refusé' });
  const b = await readBody(req);
  if (!b.nom) return json(res, 400, { erreur: 'Nom requis' });
  const e = { id: uid(), nom: String(b.nom), ville: String(b.ville || ''), actif: true, cree: now() };
  db.etablissements.push(e);
  for (const t of CATALOGUE_DEFAUT) db.tests.push({ id: uid(), etablissementId: e.id, actif: true, ...t });
  audit(user, 'creation', 'etablissement', e.id, e.nom);
  saveDb();
  json(res, 201, e);
});

/* ---- Utilisateurs (Art. 5, 10) ----------------------------------------- */

route('GET', /^\/api\/users$/, async (req, res, user) => {
  if (!can(user, 'users:manage')) return json(res, 403, { erreur: 'Accès refusé' });
  json(res, 200, tenantFilter(user, db.users).map(sanitizeUser));
}, null);

route('POST', /^\/api\/users$/, async (req, res, user) => {
  if (!can(user, 'users:manage')) return json(res, 403, { erreur: 'Accès refusé' });
  const b = await readBody(req);
  if (!b.login || !b.password || !b.nom || !ROLES[b.role]) return json(res, 400, { erreur: 'Champs requis : login, password, nom, role' });
  if (b.role === 'admin_systeme' && user.role !== 'admin_systeme') return json(res, 403, { erreur: 'Réservé à l’administrateur système' });
  if (db.users.some((u) => u.login === b.login)) return json(res, 409, { erreur: 'Login déjà utilisé' });
  const etabId = user.role === 'admin_systeme' ? (b.etablissementId || null) : user.etablissementId;
  const { salt, hash } = hashPassword(String(b.password));
  const u = { id: uid(), login: String(b.login), nom: String(b.nom), role: b.role, etablissementId: etabId, salt, hash, actif: true, cree: now() };
  db.users.push(u);
  audit(user, 'creation', 'utilisateur', u.id, `${u.login} (${u.role})`);
  saveDb();
  json(res, 201, sanitizeUser(u));
});

route('PUT', /^\/api\/users\/([\w-]+)$/, async (req, res, user, m) => {
  if (!can(user, 'users:manage')) return json(res, 403, { erreur: 'Accès refusé' });
  const u = db.users.find((x) => x.id === m[1]);
  if (!u || !tenantCheck(user, u)) return json(res, 404, { erreur: 'Utilisateur introuvable' });
  const b = await readBody(req);
  if (b.nom) u.nom = String(b.nom);
  if (b.role && ROLES[b.role] && (b.role !== 'admin_systeme' || user.role === 'admin_systeme')) u.role = b.role;
  if (typeof b.actif === 'boolean') u.actif = b.actif;
  if (b.password) Object.assign(u, hashPassword(String(b.password)));
  audit(user, 'modification', 'utilisateur', u.id, `changement de droits/profil : ${u.login}`);
  saveDb();
  json(res, 200, sanitizeUser(u));
});

/* ---- Catalogue de tests (Art. 7.1) ------------------------------------- */

route('GET', /^\/api\/tests$/, async (req, res, user) => {
  json(res, 200, tenantFilter(user, db.tests));
});

route('POST', /^\/api\/tests$/, async (req, res, user) => {
  if (!can(user, 'tests:manage')) return json(res, 403, { erreur: 'Accès refusé' });
  const b = await readBody(req);
  if (!b.nom || !b.code) return json(res, 400, { erreur: 'Code et nom requis' });
  const t = {
    id: uid(), etablissementId: user.role === 'admin_systeme' ? (b.etablissementId || null) : user.etablissementId,
    code: String(b.code).toUpperCase(), nom: String(b.nom), categorie: String(b.categorie || 'Général'),
    unite: String(b.unite || ''), type: b.type === 'qualitatif' ? 'qualitatif' : 'quantitatif',
    refMin: b.refMin != null ? Number(b.refMin) : null, refMax: b.refMax != null ? Number(b.refMax) : null,
    critMin: b.critMin != null ? Number(b.critMin) : null, critMax: b.critMax != null ? Number(b.critMax) : null,
    sensible: !!b.sensible, actif: true,
  };
  db.tests.push(t);
  audit(user, 'parametrage', 'test', t.id, `${t.code} — ${t.nom}`);
  saveDb();
  json(res, 201, t);
});

route('PUT', /^\/api\/tests\/([\w-]+)$/, async (req, res, user, m) => {
  if (!can(user, 'tests:manage')) return json(res, 403, { erreur: 'Accès refusé' });
  const t = db.tests.find((x) => x.id === m[1]);
  if (!t || !tenantCheck(user, t)) return json(res, 404, { erreur: 'Test introuvable' });
  const b = await readBody(req);
  for (const k of ['nom', 'categorie', 'unite']) if (b[k] != null) t[k] = String(b[k]);
  for (const k of ['refMin', 'refMax', 'critMin', 'critMax']) if (k in b) t[k] = b[k] == null ? null : Number(b[k]);
  if (typeof b.actif === 'boolean') t.actif = b.actif;
  audit(user, 'parametrage', 'test', t.id, `modification ${t.code}`);
  saveDb();
  json(res, 200, t);
});

/* ---- Patients (Art. 6.1) ----------------------------------------------- */

route('GET', /^\/api\/patients$/, async (req, res, user, m, url) => {
  if (!can(user, 'patients:read')) return json(res, 403, { erreur: 'Accès refusé' });
  const q = (url.searchParams.get('q') || '').toLowerCase();
  let rows = tenantFilter(user, db.patients);
  if (q) {
    rows = rows.filter((p) =>
      [p.numero, p.nom, p.prenom, p.telephone].some((v) => (v || '').toLowerCase().includes(q)));
  }
  const inclureArchives = url.searchParams.get('archives') === '1';
  if (!inclureArchives) rows = rows.filter((p) => !p.archive);
  json(res, 200, rows.slice(0, 200));
});

route('POST', /^\/api\/patients$/, async (req, res, user) => {
  if (!can(user, 'patients:write')) return json(res, 403, { erreur: 'Accès refusé' });
  const b = await readBody(req);
  if (!b.nom || !b.prenom) return json(res, 400, { erreur: 'Nom et prénom requis' });
  const p = {
    id: uid(), numero: nextNum('PAT'), etablissementId: user.etablissementId,
    nom: String(b.nom), prenom: String(b.prenom), sexe: b.sexe === 'F' ? 'F' : 'M',
    dateNaissance: String(b.dateNaissance || ''), telephone: String(b.telephone || ''),
    adresse: String(b.adresse || ''), groupeSanguin: String(b.groupeSanguin || ''),
    antecedents: String(b.antecedents || ''), allergies: String(b.allergies || ''),
    contactUrgence: String(b.contactUrgence || ''), archive: false, cree: now(), creePar: user.id,
  };
  db.patients.push(p);
  audit(user, 'creation', 'patient', p.id, `${p.numero} — ${p.nom} ${p.prenom}`);
  saveDb();
  json(res, 201, p);
});

route('GET', /^\/api\/patients\/([\w-]+)$/, async (req, res, user, m) => {
  if (!can(user, 'patients:read')) return json(res, 403, { erreur: 'Accès refusé' });
  const p = db.patients.find((x) => x.id === m[1]);
  if (!p || !tenantCheck(user, p)) return json(res, 404, { erreur: 'Patient introuvable' });
  const consultations = db.consultations.filter((c) => c.patientId === p.id).sort((a, b) => b.cree.localeCompare(a.cree));
  const demandes = db.demandes.filter((d) => d.patientId === p.id).sort((a, b) => b.cree.localeCompare(a.cree));
  json(res, 200, { patient: p, consultations, demandes });
});

route('PUT', /^\/api\/patients\/([\w-]+)$/, async (req, res, user, m) => {
  if (!can(user, 'patients:write')) return json(res, 403, { erreur: 'Accès refusé' });
  const p = db.patients.find((x) => x.id === m[1]);
  if (!p || !tenantCheck(user, p)) return json(res, 404, { erreur: 'Patient introuvable' });
  const b = await readBody(req);
  const champs = ['nom', 'prenom', 'dateNaissance', 'telephone', 'adresse', 'groupeSanguin', 'antecedents', 'allergies', 'contactUrgence'];
  for (const k of champs) if (b[k] != null) p[k] = String(b[k]);
  if (b.sexe === 'M' || b.sexe === 'F') p.sexe = b.sexe;
  if (typeof b.archive === 'boolean') p.archive = b.archive;
  audit(user, b.archive === true ? 'archivage' : 'modification', 'patient', p.id, `${p.numero}`);
  saveDb();
  json(res, 200, p);
});

/* ---- Consultations (Art. 6.2) ------------------------------------------ */

route('POST', /^\/api\/consultations$/, async (req, res, user) => {
  if (!can(user, 'consultations:write')) return json(res, 403, { erreur: 'Accès refusé' });
  const b = await readBody(req);
  const p = db.patients.find((x) => x.id === b.patientId);
  if (!p || !tenantCheck(user, p)) return json(res, 404, { erreur: 'Patient introuvable' });
  const c = {
    id: uid(), numero: nextNum('CONS'), etablissementId: user.etablissementId,
    patientId: p.id, medecinId: user.id, medecinNom: user.nom,
    motif: String(b.motif || ''), symptomes: String(b.symptomes || ''),
    diagnostic: String(b.diagnostic || ''), constantes: String(b.constantes || ''),
    cree: now(),
  };
  db.consultations.push(c);
  audit(user, 'creation', 'consultation', c.id, `${c.numero} — patient ${p.numero}`);
  saveDb();
  json(res, 201, c);
});

route('PUT', /^\/api\/consultations\/([\w-]+)$/, async (req, res, user, m) => {
  if (!can(user, 'consultations:write')) return json(res, 403, { erreur: 'Accès refusé' });
  const c = db.consultations.find((x) => x.id === m[1]);
  if (!c || !tenantCheck(user, c)) return json(res, 404, { erreur: 'Consultation introuvable' });
  const b = await readBody(req);
  for (const k of ['motif', 'symptomes', 'diagnostic', 'constantes']) if (b[k] != null) c[k] = String(b[k]);
  audit(user, 'modification', 'consultation', c.id, c.numero);
  saveDb();
  json(res, 200, c);
});

/* ---- Demandes de laboratoire (Art. 6.3, 7) ----------------------------- */

route('GET', /^\/api\/demandes$/, async (req, res, user, m, url) => {
  if (!can(user, 'demandes:read')) return json(res, 403, { erreur: 'Accès refusé' });
  let rows = tenantFilter(user, db.demandes);
  const statut = url.searchParams.get('statut');
  if (statut) rows = rows.filter((d) => d.statut === statut);
  rows = rows.slice().sort((a, b) => b.cree.localeCompare(a.cree));
  const enrichi = rows.slice(0, 200).map((d) => {
    const p = db.patients.find((x) => x.id === d.patientId);
    return { ...d, patientNumero: p ? p.numero : '?', patientNom: p ? `${p.nom} ${p.prenom}` : '?' };
  });
  json(res, 200, enrichi);
});

route('POST', /^\/api\/demandes$/, async (req, res, user) => {
  if (!can(user, 'demandes:create')) return json(res, 403, { erreur: 'Accès refusé' });
  const b = await readBody(req);
  const p = db.patients.find((x) => x.id === b.patientId);
  if (!p || !tenantCheck(user, p)) return json(res, 404, { erreur: 'Patient introuvable' });
  const testIds = Array.isArray(b.testIds) ? b.testIds : [];
  const tests = testIds.map((tid) => db.tests.find((t) => t.id === tid && tenantCheck(user, t) && t.actif)).filter(Boolean);
  if (!tests.length) return json(res, 400, { erreur: 'Au moins un test valide requis' });
  const d = {
    id: uid(), numero: nextNum('LAB'), etablissementId: user.etablissementId,
    patientId: p.id, consultationId: b.consultationId || null,
    prescripteurId: user.id, prescripteurNom: user.nom,
    priorite: b.priorite === 'urgent' ? 'urgent' : 'normal',
    statut: 'demandee', echantillon: null,
    lignes: tests.map((t) => ({
      testId: t.id, code: t.code, nom: t.nom, unite: t.unite, type: t.type,
      refMin: t.refMin, refMax: t.refMax, sensible: !!t.sensible,
      valeur: null, flag: null, commentaire: '',
    })),
    commentaireBiologiste: '', historique: [{ ts: now(), statut: 'demandee', par: user.nom }],
    validation: null, cree: now(),
  };
  db.demandes.push(d);
  audit(user, 'creation', 'demande', d.id, `${d.numero} — ${tests.map((t) => t.code).join(', ')} — patient ${p.numero}`);
  saveDb();
  json(res, 201, d);
});

route('GET', /^\/api\/demandes\/([\w-]+)$/, async (req, res, user, m) => {
  if (!can(user, 'demandes:read')) return json(res, 403, { erreur: 'Accès refusé' });
  const d = db.demandes.find((x) => x.id === m[1]);
  if (!d || !tenantCheck(user, d)) return json(res, 404, { erreur: 'Demande introuvable' });
  const p = db.patients.find((x) => x.id === d.patientId);
  json(res, 200, { ...d, patient: p });
});

/** Avancement du cycle de vie de l'échantillon (Art. 7.2). */
route('POST', /^\/api\/demandes\/([\w-]+)\/statut$/, async (req, res, user, m) => {
  const d = db.demandes.find((x) => x.id === m[1]);
  if (!d || !tenantCheck(user, d)) return json(res, 404, { erreur: 'Demande introuvable' });
  const b = await readBody(req);
  const cible = String(b.statut || '');
  if (!STATUTS.includes(cible)) return json(res, 400, { erreur: 'Statut inconnu' });
  if (!TRANSITIONS[d.statut].includes(cible)) {
    return json(res, 409, { erreur: `Transition ${d.statut} → ${cible} non autorisée` });
  }
  const permParStatut = {
    prelevee: ['demandes:prelever', 'demandes:traiter'],
    recue: ['demandes:traiter'],
    en_analyse: ['demandes:traiter'],
    saisie: ['resultats:write'],
    validee: ['resultats:valider'],
    publiee: ['resultats:valider'],
  };
  if (!(permParStatut[cible] || []).some((perm) => can(user, perm))) {
    return json(res, 403, { erreur: 'Votre rôle ne permet pas cette étape' });
  }
  if (cible === 'prelevee') {
    d.echantillon = { numero: nextNum('ECH'), type: String(b.typeEchantillon || 'Sang veineux'), preleveLe: now(), prelevePar: user.nom };
  }
  if (cible === 'saisie') {
    if (d.lignes.some((l) => l.valeur == null || l.valeur === '')) {
      return json(res, 409, { erreur: 'Tous les résultats doivent être saisis avant soumission' });
    }
  }
  if (cible === 'validee') {
    d.validation = { par: user.nom, parId: user.id, le: now() };
  }
  d.statut = cible;
  d.historique.push({ ts: now(), statut: cible, par: user.nom });
  audit(user, cible === 'validee' ? 'validation' : cible === 'publiee' ? 'publication' : 'changement_statut',
    'demande', d.id, `${d.numero} → ${cible}`);
  saveDb();
  json(res, 200, d);
});

/** Saisie (ou correction sous audit) des résultats (Art. 6.3, 7.2, 7.3). */
route('PUT', /^\/api\/demandes\/([\w-]+)\/resultats$/, async (req, res, user, m) => {
  if (!can(user, 'resultats:write')) return json(res, 403, { erreur: 'Accès refusé' });
  const d = db.demandes.find((x) => x.id === m[1]);
  if (!d || !tenantCheck(user, d)) return json(res, 404, { erreur: 'Demande introuvable' });
  const modifiable = ['en_analyse', 'saisie'];
  const correction = ['validee', 'publiee'].includes(d.statut);
  if (!modifiable.includes(d.statut) && !correction) {
    return json(res, 409, { erreur: `Saisie impossible au statut « ${d.statut} »` });
  }
  if (correction && !can(user, 'resultats:valider')) {
    return json(res, 403, { erreur: 'La correction d’un résultat validé requiert un biologiste' });
  }
  const b = await readBody(req);
  const valeurs = b.valeurs || {};
  const anciennes = [];
  for (const ligne of d.lignes) {
    if (!(ligne.testId in valeurs)) continue;
    const v = valeurs[ligne.testId];
    anciennes.push(`${ligne.code}: ${ligne.valeur ?? '—'} → ${v.valeur}`);
    ligne.valeur = String(v.valeur ?? '');
    ligne.commentaire = String(v.commentaire || '');
    const test = db.tests.find((t) => t.id === ligne.testId);
    ligne.flag = test ? flagFor(test, ligne.valeur) : null;
    if (test && test.type === 'qualitatif') {
      ligne.flag = v.anormal ? 'anormal' : 'normal';
    }
    ligne.saisiPar = user.nom;
    ligne.saisiLe = now();
  }
  if (b.commentaireBiologiste != null) d.commentaireBiologiste = String(b.commentaireBiologiste);
  if (correction) {
    d.historique.push({ ts: now(), statut: d.statut, par: user.nom, note: 'correction post-validation' });
  }
  audit(user, correction ? 'correction_resultat' : 'saisie_resultat', 'demande', d.id,
    `${d.numero} — ${anciennes.join(' ; ')}`);
  saveDb();
  json(res, 200, d);
});

/* ---- Export PDF (Art. 6.3, 18) ----------------------------------------- */

route('GET', /^\/api\/demandes\/([\w-]+)\/pdf$/, async (req, res, user, m) => {
  if (!can(user, 'resultats:read') && !can(user, 'demandes:read')) return json(res, 403, { erreur: 'Accès refusé' });
  const d = db.demandes.find((x) => x.id === m[1]);
  if (!d || !tenantCheck(user, d)) return json(res, 404, { erreur: 'Demande introuvable' });
  if (!['validee', 'publiee'].includes(d.statut)) {
    return json(res, 409, { erreur: 'Le compte rendu PDF n’est disponible qu’après validation' });
  }
  const p = db.patients.find((x) => x.id === d.patientId);
  const etab = db.etablissements.find((e) => e.id === d.etablissementId);
  const pdf = buildResultPdf(d, p, etab);
  audit(user, 'export_pdf', 'demande', d.id, d.numero);
  res.writeHead(200, {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `inline; filename="resultats-${d.numero}.pdf"`,
    'Content-Length': pdf.length,
  });
  res.end(pdf);
});

/* ---- Audit trail (Art. 16) --------------------------------------------- */

route('GET', /^\/api\/audit$/, async (req, res, user, m, url) => {
  if (!can(user, 'audit:read')) return json(res, 403, { erreur: 'Accès refusé' });
  let rows = user.role === 'admin_systeme' ? db.audit
    : db.audit.filter((a) => a.etablissementId === user.etablissementId);
  const q = (url.searchParams.get('q') || '').toLowerCase();
  if (q) rows = rows.filter((a) => [a.action, a.entite, a.userNom, a.details].some((v) => (v || '').toLowerCase().includes(q)));
  json(res, 200, rows.slice(-500).reverse());
});

/* ---- Tableau de bord (Art. 6.5) ---------------------------------------- */

route('GET', /^\/api\/dashboard$/, async (req, res, user) => {
  const patients = tenantFilter(user, db.patients).filter((p) => !p.archive);
  const demandes = tenantFilter(user, db.demandes);
  const depuis = Date.now() - 30 * 24 * 3600 * 1000;
  const recentes = demandes.filter((d) => new Date(d.cree).getTime() > depuis);
  const enAttente = demandes.filter((d) => !['validee', 'publiee'].includes(d.statut));
  const critiques = demandes.flatMap((d) => d.lignes.filter((l) => l.flag === 'critique').map((l) => ({ demande: d.numero, test: l.nom })));
  const delais = demandes.filter((d) => ['validee', 'publiee'].includes(d.statut) && d.validation)
    .map((d) => (new Date(d.validation.le) - new Date(d.cree)) / 3600000);
  const delaiMoyenH = delais.length ? delais.reduce((a, b) => a + b, 0) / delais.length : null;
  json(res, 200, {
    patientsActifs: patients.length,
    demandes30j: recentes.length,
    demandesEnAttente: enAttente.length,
    resultatsCritiques: critiques.slice(0, 10),
    delaiMoyenHeures: delaiMoyenH,
    parStatut: STATUTS.map((s) => ({ statut: s, n: demandes.filter((d) => d.statut === s).length })),
  });
});

/* ===================== Générateur PDF minimal =========================== */
/* Écrit un PDF 1.4 valide sans dépendance : polices Helvetica standard,   */
/* encodage WinAnsi (Latin-1) compatible avec le français.                  */

/* Translittération des caractères hors Latin-1 vers leurs codes WinAnsi
   (CP1252), afin que tirets et apostrophes typographiques s'affichent. */
const WINANSI = { '€': '\x80', '‚': '\x82', '„': '\x84', '…': '\x85', '‘': '\x91', '’': '\x92', '“': '\x93', '”': '\x94', '•': '\x95', '–': '\x96', '—': '\x97', '˜': '\x98', '™': '\x99', 'œ': '\x9c', 'Œ': '\x8c' };

function pdfEsc(s) {
  return String(s)
    .replace(/[\u0100-\uffff]/g, (c) => WINANSI[c] || '?')
    .replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

class Pdf {
  constructor() { this.ops = []; this.pages = []; }
  text(x, y, size, str, bold = false) {
    this.ops.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf 1 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)} Tm (${pdfEsc(str)}) Tj ET`);
  }
  line(x1, y1, x2, y2, w = 0.7) {
    this.ops.push(`${w} w ${x1.toFixed(1)} ${y1.toFixed(1)} m ${x2.toFixed(1)} ${y2.toFixed(1)} l S`);
  }
  rect(x, y, w, h, gray) {
    this.ops.push(`${gray} g ${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re f 0 g`);
  }
  endPage() { this.pages.push(this.ops.join('\n')); this.ops = []; }
  build() {
    if (this.ops.length) this.endPage();
    const objs = [];
    const nPages = this.pages.length;
    const pageIds = [], contentIds = [];
    let nextId = 5;
    for (let i = 0; i < nPages; i++) { pageIds.push(nextId++); contentIds.push(nextId++); }
    objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    objs[2] = `<< /Type /Pages /Count ${nPages} /Kids [${pageIds.map((i) => `${i} 0 R`).join(' ')}] >>`;
    objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    objs[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
    for (let i = 0; i < nPages; i++) {
      objs[pageIds[i]] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentIds[i]} 0 R >>`;
      const stream = this.pages[i];
      objs[contentIds[i]] = { stream };
    }
    const chunks = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'latin1')];
    const offsets = [0];
    let pos = chunks[0].length;
    for (let id = 1; id < nextId; id++) {
      let body;
      if (typeof objs[id] === 'object') {
        const s = Buffer.from(objs[id].stream, 'latin1');
        body = Buffer.concat([
          Buffer.from(`${id} 0 obj\n<< /Length ${s.length} >>\nstream\n`, 'latin1'),
          s, Buffer.from('\nendstream\nendobj\n', 'latin1'),
        ]);
      } else {
        body = Buffer.from(`${id} 0 obj\n${objs[id]}\nendobj\n`, 'latin1');
      }
      offsets[id] = pos;
      chunks.push(body);
      pos += body.length;
    }
    const xrefPos = pos;
    let xref = `xref\n0 ${nextId}\n0000000000 65535 f \n`;
    for (let id = 1; id < nextId; id++) xref += String(offsets[id]).padStart(10, '0') + ' 00000 n \n';
    xref += `trailer\n<< /Size ${nextId} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`;
    chunks.push(Buffer.from(xref, 'latin1'));
    return Buffer.concat(chunks);
  }
}

const FLAG_LABEL = { normal: 'Normal', bas: 'Bas', haut: 'Élevé', critique: 'CRITIQUE', anormal: 'Anormal' };
const fmtDate = (iso) => iso ? new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

function buildResultPdf(d, p, etab) {
  const pdf = new Pdf();
  const L = 50, R = 545, W = R - L;
  let y = 800;
  const newPageIfNeeded = () => {
    if (y < 80) {
      pdf.text(L, 40, 8, `MediLab SaaS — ${d.numero} — document confidentiel`, false);
      pdf.endPage();
      y = 800;
    }
  };
  pdf.rect(0, 812, 595, 30, 0.92);
  pdf.text(L, 822, 14, etab ? etab.nom : 'Établissement', true);
  pdf.text(R - 150, 822, 9, `Édité le ${fmtDate(now())}`);
  y = 785;
  pdf.text(L, y, 16, 'COMPTE RENDU DE RÉSULTATS DE LABORATOIRE', true); y -= 10;
  pdf.line(L, y, R, y, 1.2); y -= 22;

  pdf.text(L, y, 10, 'Patient', true);
  pdf.text(L + 160, y, 10, 'Demande', true); y -= 14;
  pdf.text(L, y, 10, `${p.nom.toUpperCase()} ${p.prenom}`);
  pdf.text(L + 160, y, 10, `N° ${d.numero}   Priorité : ${d.priorite === 'urgent' ? 'URGENT' : 'normale'}`); y -= 13;
  pdf.text(L, y, 10, `Dossier : ${p.numero}   Sexe : ${p.sexe}`);
  pdf.text(L + 160, y, 10, `Prescripteur : ${d.prescripteurNom}`); y -= 13;
  pdf.text(L, y, 10, `Né(e) le : ${p.dateNaissance || '—'}`);
  pdf.text(L + 160, y, 10, `Prescrit le : ${fmtDate(d.cree)}`); y -= 13;
  if (d.echantillon) {
    pdf.text(L + 160, y, 10, `Échantillon : ${d.echantillon.numero} (${d.echantillon.type}), prélevé le ${fmtDate(d.echantillon.preleveLe)}`);
    y -= 13;
  }
  y -= 8;

  pdf.rect(L, y - 4, W, 18, 0.88);
  pdf.text(L + 4, y, 9, 'Examen', true);
  pdf.text(L + 200, y, 9, 'Résultat', true);
  pdf.text(L + 280, y, 9, 'Unité', true);
  pdf.text(L + 340, y, 9, 'Valeurs de référence', true);
  pdf.text(L + 450, y, 9, 'Interprétation', true);
  y -= 18;
  for (const ligne of d.lignes) {
    newPageIfNeeded();
    const ref = ligne.type === 'quantitatif'
      ? `${ligne.refMin ?? ''} – ${ligne.refMax ?? ''}`.trim()
      : '—';
    const horsNorme = ligne.flag && ligne.flag !== 'normal';
    pdf.text(L + 4, y, 9, ligne.nom);
    pdf.text(L + 200, y, 9, String(ligne.valeur ?? '—'), horsNorme);
    pdf.text(L + 280, y, 9, ligne.unite || '');
    pdf.text(L + 340, y, 9, ref);
    pdf.text(L + 450, y, 9, FLAG_LABEL[ligne.flag] || '—', horsNorme);
    y -= 12;
    if (ligne.commentaire) { pdf.text(L + 14, y, 8, `Note : ${ligne.commentaire}`); y -= 11; }
    pdf.line(L, y + 8, R, y + 8, 0.3);
  }
  y -= 10;
  if (d.commentaireBiologiste) {
    newPageIfNeeded();
    pdf.text(L, y, 10, 'Commentaire du biologiste', true); y -= 13;
    for (const lgn of String(d.commentaireBiologiste).match(/.{1,95}(\s|$)/g) || []) {
      newPageIfNeeded();
      pdf.text(L, y, 9, lgn.trim()); y -= 11;
    }
    y -= 6;
  }
  newPageIfNeeded();
  pdf.line(L, y, R, y, 0.7); y -= 16;
  pdf.text(L, y, 10, `Validé par : ${d.validation ? d.validation.par : '—'}`, true);
  pdf.text(L + 260, y, 10, `Le : ${d.validation ? fmtDate(d.validation.le) : '—'}`); y -= 14;
  pdf.text(L, y, 8, 'Signature électronique enregistrée dans le journal d’audit de la plateforme.');
  pdf.text(L, 40, 8, `MediLab SaaS — ${d.numero} — document confidentiel, réservé aux personnes autorisées.`);
  return pdf.build();
}

/* ===================== Fichiers statiques =============================== */

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };

function serveStatic(req, res, pathname) {
  let rel = pathname === '/' ? '/index.html' : pathname;
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) {
      // SPA : toute route inconnue renvoie l'application
      fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (e2, idx) => {
        if (e2) { res.writeHead(404); return res.end('Not found'); }
        res.writeHead(200, { 'Content-Type': MIME['.html'] });
        res.end(idx);
      });
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
}

/* ===================== Serveur ========================================== */

loadDb();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');

  if (!pathname.startsWith('/api/')) return serveStatic(req, res, pathname);

  try {
    for (const r of routes) {
      if (r.method !== req.method) continue;
      const m = pathname.match(r.pattern);
      if (!m) continue;
      if (pathname === '/api/login') return await r.handler(req, res, null, m, url);
      const user = getUser(req);
      if (!user) return json(res, 401, { erreur: 'Authentification requise' });
      return await r.handler(req, res, user, m, url);
    }
    json(res, 404, { erreur: 'Route inconnue' });
  } catch (e) {
    json(res, 400, { erreur: e.message || 'Erreur serveur' });
  }
});

server.listen(PORT, () => {
  console.log(`MediLab SaaS démarré : http://localhost:${PORT}`);
  console.log(`Données : ${DB_FILE}`);
});

export { server, db, ROLES };
