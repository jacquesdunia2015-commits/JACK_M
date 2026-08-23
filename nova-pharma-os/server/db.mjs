// NOVA PHARMA OS — Persistance (MVP)
//
// Stockage JSON sur fichier, choix assumé pour le pilote NOVA SANTÉ
// PHARMA (Bukavu) : zéro dépendance, zéro infrastructure à opérer.
// La couche d'accès est isolée ici pour permettre une migration vers
// PostgreSQL (cf. cahier des charges §82) sans toucher aux routes.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const DATA_DIR = process.env.NOVA_DATA || path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

export const uid = () => crypto.randomBytes(9).toString('base64url');
export const now = () => new Date().toISOString();

let db = null;

const COLLECTIONS = [
  'organizations', 'branches', 'users',
  'suppliers', 'categories', 'products', 'batches',
  'stockMovements', 'inventoryCounts',
  'purchaseOrders',
  'customers', 'quotes', 'customerOrders',
  'sales', 'deliveries', 'payments',
  'cashSessions', 'cashMovements', 'expenses',
  'auditLog',
];

export function loadDb() {
  if (fs.existsSync(DB_FILE)) {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    for (const c of COLLECTIONS) if (!db[c]) db[c] = [];
    if (!db.seq) db.seq = 1000;
  } else {
    db = Object.fromEntries(COLLECTIONS.map((c) => [c, []]));
    db.seq = 1000;
  }
  return db;
}

export function getDb() {
  if (!db) loadDb();
  return db;
}

/**
 * Écriture synchrone et immédiate (tmp + renommage atomique). Pas de
 * différé : pour un pilote de cette taille, la durabilité prime sur la
 * micro-optimisation, et un différé introduirait une fenêtre où un arrêt
 * du serveur (ou un rechargement en mémoire) perdrait des écritures.
 */
export function saveDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 1));
  fs.renameSync(tmp, DB_FILE);
}

export function nextNum(prefix) {
  db.seq += 1;
  return `${prefix}-2026-${String(db.seq).padStart(6, '0')}`;
}
