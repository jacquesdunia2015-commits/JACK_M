#!/usr/bin/env node
// Serveur de la plateforme de recensement CNBM-RDC — zéro dépendance externe.
//
// Rôle : comptes accessibles depuis n'importe quel appareil, réception
// automatique des fiches (données, photo, vidéo, pièces justificatives),
// registre partagé par conseil provincial, tableau de bord du créateur.
// Il sert aussi l'application elle-même (dossier cnbm/), de sorte qu'une seule
// adresse suffit.
//
//   Lancement :  node cnbm/serveur/serveur.mjs
//   Variables :  PORT (8080), DONNEES (./donnees-cnbm), ORIGINES (origines web
//                autorisées en plus de la sienne, séparées par des virgules),
//                CLES_PUBLIQUES (JSON, sinon lues dans cnbm/index.html)
//
// Stockage : base SQLite (node:sqlite) + fichiers sur disque, dans DONNEES.
// Sauvegarder ce dossier = sauvegarder toute la plateforme.

import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { webcrypto, randomBytes, createHash, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync, createReadStream, statSync, renameSync } from "node:fs";
import { join, dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ICI = dirname(fileURLToPath(import.meta.url));
const APP = resolve(ICI, "..");                       // dossier cnbm/ servi tel quel
const PORT = Number(process.env.PORT) || 8080;
const DONNEES = resolve(process.env.DONNEES || join(process.cwd(), "donnees-cnbm"));
const FICHIERS = join(DONNEES, "fichiers");
const ORIGINES = (process.env.ORIGINES || "https://jacquesdunia2015-commits.github.io").split(",").map(s => s.trim()).filter(Boolean);
const MAX_JSON = 2 * 1024 * 1024, MAX_FICHIER = 60 * 1024 * 1024;
const DUREE_SESSION = 90 * 24 * 3600 * 1000;
mkdirSync(FICHIERS, { recursive: true });

/* ------------------------------------------------------------------ clés publiques du créateur */
function clesPubliques() {
  if (process.env.CLES_PUBLIQUES) return JSON.parse(process.env.CLES_PUBLIQUES);
  const html = readFileSync(join(APP, "index.html"), "utf8");
  const m = html.match(/const CLES_PUBLIQUES_CREATEUR = (\[[\s\S]*?\]);/);
  if (!m) throw new Error("CLES_PUBLIQUES_CREATEUR introuvable dans index.html");
  return JSON.parse(m[1]);
}
const CLES = await Promise.all(clesPubliques().map(j => webcrypto.subtle.importKey("jwk", j, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"])));
const b64u = t => Buffer.from(t.replace(/-/g, "+").replace(/_/g, "/"), "base64");
async function verifierSignature(corps, sig) {
  for (const k of CLES) if (await webcrypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, k, b64u(sig), new TextEncoder().encode(corps))) return true;
  return false;
}
async function verifierJeton(jeton) {
  try {
    const t = String(jeton || "").trim().replace(/\s+/g, "").replace(/^CNBM1\./, "");
    const [corps, sig] = t.split(".");
    if (!corps || !sig || !(await verifierSignature(corps, sig))) return null;
    return JSON.parse(b64u(corps).toString("utf8"));
  } catch { return null; }
}
const finJour = d => new Date(d + "T23:59:59").getTime();
const NATIONAL = "National (toutes les provinces)";

/* ------------------------------------------------------------------ base de données */
const db = new DatabaseSync(join(DONNEES, "cnbm.sqlite"));
db.exec(`
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS conseils (id TEXT PRIMARY KEY, province TEXT, nom TEXT, email TEXT, expire TEXT, cle TEXT, maj INTEGER);
CREATE TABLE IF NOT EXISTS comptes (id TEXT PRIMARY KEY, type TEXT, nom TEXT, role TEXT, province TEXT, conseil_id TEXT,
  hash TEXT, hash_code TEXT, cree INTEGER, echecs INTEGER DEFAULT 0, bloque INTEGER DEFAULT 0, derniere INTEGER);
CREATE TABLE IF NOT EXISTS sessions (jeton TEXT PRIMARY KEY, compte_id TEXT, cree INTEGER, expire INTEGER);
CREATE TABLE IF NOT EXISTS fiches (id TEXT PRIMARY KEY, compte_id TEXT, province TEXT, meta TEXT, statut TEXT,
  modifie INTEGER, recu INTEGER, maj INTEGER, adhesion_validee INTEGER);
CREATE TABLE IF NOT EXISTS fichiers (fiche_id TEXT, nom TEXT, mime TEXT, taille INTEGER, empreinte TEXT, maj INTEGER, PRIMARY KEY (fiche_id, nom));
CREATE INDEX IF NOT EXISTS fiches_province ON fiches(province, maj);
CREATE INDEX IF NOT EXISTS fiches_compte ON fiches(compte_id);
`);
const un = (sql, ...a) => db.prepare(sql).get(...a);
const tous = (sql, ...a) => db.prepare(sql).all(...a);
const exe = (sql, ...a) => db.prepare(sql).run(...a);

/* ------------------------------------------------------------------ mots de passe & sessions */
const hacher = mdp => { const sel = randomBytes(16); return sel.toString("base64") + "$" + scryptSync(String(mdp), sel, 32).toString("base64"); };
function verifier(mdp, h) {
  if (!h) return false;
  const [sel, v] = h.split("$"), a = scryptSync(String(mdp), Buffer.from(sel, "base64"), 32), b = Buffer.from(v, "base64");
  return a.length === b.length && timingSafeEqual(a, b);
}
const empreinte = t => createHash("sha256").update(t).digest("hex");
function nouvelleSession(compteId) {
  const jeton = randomBytes(32).toString("base64url");
  exe("INSERT INTO sessions VALUES (?,?,?,?)", empreinte(jeton), compteId, Date.now(), Date.now() + DUREE_SESSION);
  exe("DELETE FROM sessions WHERE expire < ?", Date.now());
  return jeton;
}
const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const codeAleatoire = n => [...randomBytes(n)].map(x => ALPHA[x % ALPHA.length]).join("");
const codeRecup = () => codeAleatoire(12).replace(/(.{4})(?=.)/g, "$1-");
const normCode = c => String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
function normIdent(v) {
  v = String(v || "").trim();
  if (v.includes("@")) return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? { id: v.toLowerCase(), type: "email" } : null;
  let d = v.replace(/[^\d]/g, "");
  if (v.startsWith("00")) d = d.slice(2);
  if (d.length === 10 && d.startsWith("0")) d = "243" + d.slice(1);
  if (d.length === 9) d = "243" + d;
  if (d.length < 9 || d.length > 15) return null;
  return { id: "+" + d, type: "tel" };
}
const comptePublic = c => c && { id: c.id, type: c.type, nom: c.nom, role: c.role, province: c.province, conseil: c.conseil_id, cree: c.cree };
function conseilDe(c) { return c && c.conseil_id ? un("SELECT * FROM conseils WHERE id = ?", c.conseil_id) : null; }
function enregistrerConseil(p, cle) {
  const ex = un("SELECT * FROM conseils WHERE id = ?", p.id);
  if (ex && ex.expire >= p.expire && cle === ex.cle) return;
  exe(`INSERT INTO conseils VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET province=excluded.province, nom=excluded.nom,
       email=excluded.email, expire=excluded.expire, cle=excluded.cle, maj=excluded.maj`, p.id, p.province, p.conseil, p.email || "", p.expire, cle || null, Date.now());
}

/* ------------------------------------------------------------------ HTTP utilitaires */
class Erreur extends Error { constructor(code, msg) { super(msg); this.code = code; } }
function entetesCors(req, res) {
  const o = req.headers.origin;
  if (o && ORIGINES.includes(o)) {
    res.setHeader("Access-Control-Allow-Origin", o);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "authorization, content-type, x-createur, x-fichier-mime");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Max-Age", "86400");
  }
}
const json = (res, code, obj) => { res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }); res.end(JSON.stringify(obj)); };
function lireCorps(req, max) {
  return new Promise((ok, ko) => {
    const morceaux = []; let n = 0;
    req.on("data", c => { n += c.length; if (n > max) { ko(new Erreur(413, "Fichier trop volumineux.")); req.destroy(); } else morceaux.push(c); });
    req.on("end", () => ok(Buffer.concat(morceaux)));
    req.on("error", ko);
  });
}
async function lireJson(req) {
  const b = await lireCorps(req, MAX_JSON);
  try { return JSON.parse(b.toString("utf8") || "{}"); } catch { throw new Erreur(400, "Requête illisible."); }
}
function authentifier(req, obligatoire = true) {
  const h = req.headers.authorization || "";
  const jeton = h.startsWith("Bearer ") ? h.slice(7) : "";
  const s = jeton && un("SELECT * FROM sessions WHERE jeton = ? AND expire > ?", empreinte(jeton), Date.now());
  const c = s && un("SELECT * FROM comptes WHERE id = ?", s.compte_id);
  if (!c && obligatoire) throw new Erreur(401, "Session expirée : reconnectez-vous.");
  return c || null;
}
function exigerAdmin(c) {
  if (c.role !== "admin") throw new Erreur(403, "Réservé aux administrateurs.");
  const k = conseilDe(c);
  if (!k || finJour(k.expire) < Date.now()) throw new Erreur(402, "L'abonnement de votre conseil a expiré : renouvelez-le.");
  return k;
}
const voitProvince = (c, province) => c.role === "admin" && (c.province === NATIONAL || c.province === province);
const RE_FICHE = /^CNBM-\d{8}-[A-Z0-9]{6}$/;
const RE_NOM = /^[A-Za-z0-9._-]{1,120}$/;

/* ------------------------------------------------------------------ routes API */
const routes = [];
const route = (m, motif, f) => routes.push({ m, re: new RegExp("^" + motif.replace(/:(\w+)/g, "(?<$1>[^/]+)") + "$"), f });

route("GET", "/api/sante", () => ({ ok: true, service: "cnbm-recensement", heure: Date.now() }));

route("POST", "/api/inscription", async (req) => {
  const v = await lireJson(req), n = normIdent(v.ident);
  if (!String(v.nom || "").trim()) throw new Erreur(400, "Indiquez votre nom complet.");
  if (!n) throw new Erreur(400, "Numéro de téléphone ou adresse e-mail non valide.");
  if (String(v.mdp || "").length < 6) throw new Erreur(400, "Le mot de passe doit contenir au moins 6 caractères.");
  if (un("SELECT id FROM comptes WHERE id = ?", n.id)) throw new Erreur(409, "Un compte existe déjà avec ce téléphone/e-mail. Connectez-vous.");
  let province = null, conseilId = null;
  if (v.jetonConseil) {
    const p = await verifierJeton(v.jetonConseil);
    if (!p || p.type !== "membre") throw new Erreur(400, "Lien d'inscription invalide.");
    province = p.province; conseilId = p.id; enregistrerConseil(p, null);
  }
  const code = codeRecup();
  exe("INSERT INTO comptes (id,type,nom,role,province,conseil_id,hash,hash_code,cree) VALUES (?,?,?,?,?,?,?,?,?)",
      n.id, n.type, String(v.nom).trim().slice(0, 120), "membre", province, conseilId, hacher(v.mdp), hacher(normCode(code)), Date.now());
  const c = un("SELECT * FROM comptes WHERE id = ?", n.id);
  return { jeton: nouvelleSession(c.id), compte: comptePublic(c), codeRecup: code };
});

route("POST", "/api/admin/inscription", async (req) => {
  const v = await lireJson(req), n = normIdent(v.ident);
  const p = await verifierJeton(v.cle);
  if (!p || p.type !== "admin") throw new Erreur(400, "Clé d'abonnement invalide.");
  if (finJour(p.expire) < Date.now()) throw new Erreur(400, "Cette clé d'abonnement a expiré.");
  if (!n) throw new Erreur(400, "Numéro de téléphone ou adresse e-mail non valide.");
  if (String(v.mdp || "").length < 8) throw new Erreur(400, "Le mot de passe administrateur doit contenir au moins 8 caractères.");
  if (!String(v.nom || "").trim()) throw new Erreur(400, "Indiquez votre nom complet.");
  enregistrerConseil(p, String(v.cle).trim());
  const ex = un("SELECT * FROM comptes WHERE id = ?", n.id);
  if (ex) {
    // Un compte existant devient administrateur s'il prouve son mot de passe.
    if (!verifier(v.mdp, ex.hash)) throw new Erreur(409, "Un compte existe déjà avec cet identifiant : saisissez son mot de passe actuel.");
    exe("UPDATE comptes SET role='admin', province=?, conseil_id=? WHERE id=?", p.province, p.id, n.id);
    const c = un("SELECT * FROM comptes WHERE id = ?", n.id);
    return { jeton: nouvelleSession(c.id), compte: comptePublic(c), conseil: p };
  }
  const code = codeRecup();
  exe("INSERT INTO comptes (id,type,nom,role,province,conseil_id,hash,hash_code,cree) VALUES (?,?,?,?,?,?,?,?,?)",
      n.id, n.type, String(v.nom).trim().slice(0, 120), "admin", p.province, p.id, hacher(v.mdp), hacher(normCode(code)), Date.now());
  const c = un("SELECT * FROM comptes WHERE id = ?", n.id);
  return { jeton: nouvelleSession(c.id), compte: comptePublic(c), codeRecup: code, conseil: p };
});

route("POST", "/api/connexion", async (req) => {
  const v = await lireJson(req), n = normIdent(v.ident);
  const c = n && un("SELECT * FROM comptes WHERE id = ?", n.id);
  if (!c) throw new Erreur(404, "Aucun compte avec ce téléphone/e-mail. Touchez « Créer un compte ».");
  if (c.bloque > Date.now()) throw new Erreur(429, `Trop d'essais. Réessayez dans ${Math.ceil((c.bloque - Date.now()) / 60000)} minute(s).`);
  if (!verifier(v.mdp, c.hash)) {
    const e = (c.echecs || 0) + 1;
    exe("UPDATE comptes SET echecs=?, bloque=? WHERE id=?", e >= 5 ? 0 : e, e >= 5 ? Date.now() + 5 * 60000 : 0, c.id);
    throw new Erreur(401, "Mot de passe incorrect.");
  }
  exe("UPDATE comptes SET echecs=0, bloque=0, derniere=? WHERE id=?", Date.now(), c.id);
  const k = conseilDe(c);
  return { jeton: nouvelleSession(c.id), compte: comptePublic(c), conseil: k && { id: k.id, province: k.province, conseil: k.nom, email: k.email, expire: k.expire, cle: c.role === "admin" ? k.cle : undefined } };
});

route("POST", "/api/recuperation", async (req) => {
  const v = await lireJson(req), n = normIdent(v.ident);
  const c = n && un("SELECT * FROM comptes WHERE id = ?", n.id);
  if (!c || !verifier(normCode(v.code), c.hash_code)) throw new Erreur(400, "Identifiant ou code de récupération incorrect.");
  if (String(v.mdp || "").length < (c.role === "admin" ? 8 : 6)) throw new Erreur(400, "Nouveau mot de passe trop court.");
  exe("UPDATE comptes SET hash=?, echecs=0, bloque=0 WHERE id=?", hacher(v.mdp), c.id);
  exe("DELETE FROM sessions WHERE compte_id=?", c.id);
  return { ok: true };
});

route("GET", "/api/moi", (req) => {
  const c = authentifier(req), k = conseilDe(c);
  return { compte: comptePublic(c), conseil: k && { id: k.id, province: k.province, conseil: k.nom, email: k.email, expire: k.expire, cle: c.role === "admin" ? k.cle : undefined } };
});
route("POST", "/api/deconnexion", (req) => {
  const h = req.headers.authorization || ""; if (h.startsWith("Bearer ")) exe("DELETE FROM sessions WHERE jeton=?", empreinte(h.slice(7)));
  return { ok: true };
});
route("POST", "/api/mdp", async (req) => {
  const c = authentifier(req), v = await lireJson(req);
  if (!verifier(v.ancien, c.hash)) throw new Erreur(400, "Mot de passe actuel incorrect.");
  if (String(v.mdp || "").length < (c.role === "admin" ? 8 : 6)) throw new Erreur(400, "Nouveau mot de passe trop court.");
  exe("UPDATE comptes SET hash=? WHERE id=?", hacher(v.mdp), c.id);
  return { ok: true };
});
route("POST", "/api/code-recuperation", (req) => {
  const c = authentifier(req), code = codeRecup();
  exe("UPDATE comptes SET hash_code=? WHERE id=?", hacher(normCode(code)), c.id);
  return { codeRecup: code };
});
route("POST", "/api/rattachement", async (req) => {
  // Un membre déjà inscrit ouvre le lien d'inscription de son conseil.
  const c = authentifier(req), v = await lireJson(req), p = await verifierJeton(v.jetonConseil);
  if (!p || p.type !== "membre") throw new Erreur(400, "Lien d'inscription invalide.");
  if (c.role === "admin") return { ok: true };
  enregistrerConseil(p, null);
  exe("UPDATE comptes SET province=?, conseil_id=? WHERE id=?", p.province, p.id, c.id);
  return { ok: true };
});
route("POST", "/api/abonnement", async (req) => {
  const c = authentifier(req);
  if (c.role !== "admin") throw new Erreur(403, "Réservé aux administrateurs.");
  const v = await lireJson(req), p = await verifierJeton(v.cle);
  if (!p || p.type !== "admin") throw new Erreur(400, "Clé d'abonnement invalide.");
  if (finJour(p.expire) < Date.now()) throw new Erreur(400, "Cette clé a expiré.");
  if (c.province && p.province !== c.province) throw new Erreur(403, `Cette clé est celle du ${p.conseil}.`);
  enregistrerConseil(p, String(v.cle).trim());
  // Tous les comptes du conseil précédent passent au nouvel abonnement.
  exe("UPDATE comptes SET conseil_id=? WHERE province=? AND conseil_id IS NOT NULL", p.id, p.province);
  return { ok: true, conseil: p };
});

/* ---- fiches ---- */
function ficheAccessible(c, f) { return f && (f.compte_id === c.id || voitProvince(c, f.province)); }
function fichiersDe(id) { return tous("SELECT nom, mime, taille, empreinte, maj FROM fichiers WHERE fiche_id = ?", id); }
route("PUT", "/api/fiches/:id", async (req, { id }) => {
  const c = authentifier(req);
  if (!RE_FICHE.test(id)) throw new Erreur(400, "Identifiant de fiche invalide.");
  const meta = await lireJson(req);
  if (meta.id !== id || !meta.data) throw new Erreur(400, "Fiche incomplète.");
  const ex = un("SELECT * FROM fiches WHERE id = ?", id);
  if (ex && ex.compte_id !== c.id && !voitProvince(c, ex.province)) throw new Erreur(403, "Cette fiche appartient à un autre compte.");
  // Province de rattachement : celle du conseil du membre ; pour un lien national, la province où il travaille.
  const provTravail = (meta.lieux || []).map(l => l.province).find(x => x && !/Hors RDC/.test(x)) || meta.data.adrProvince;
  const base = c.role === "admin" ? (ex?.province || meta.conseil?.province || c.province) : (c.province || meta.conseil?.province);
  const province = ex?.province && c.role === "admin" ? ex.province : (!base || base === NATIONAL ? (provTravail || base || "Sans conseil") : base);
  delete meta.photo; delete meta.video;
  exe(`INSERT INTO fiches (id,compte_id,province,meta,statut,modifie,recu,maj,adhesion_validee) VALUES (?,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET meta=excluded.meta, statut=excluded.statut, modifie=excluded.modifie, maj=excluded.maj`,
      id, ex?.compte_id || c.id, province, JSON.stringify(meta), "envoyee", meta.modifie || Date.now(), ex?.recu || Date.now(), Date.now(), ex?.adhesion_validee || null);
  // Fichiers retirés par le membre : supprimés du serveur.
  const gardes = new Set(Array.isArray(meta.fichiers) ? meta.fichiers : []);
  for (const f of fichiersDe(id)) if (!gardes.has(f.nom)) { exe("DELETE FROM fichiers WHERE fiche_id=? AND nom=?", id, f.nom); rmSync(join(FICHIERS, id, f.nom), { force: true }); }
  return { ok: true, fichiers: fichiersDe(id) };
});
route("PUT", "/api/fiches/:id/fichiers/:nom", async (req, { id, nom }) => {
  const c = authentifier(req), f = un("SELECT * FROM fiches WHERE id = ?", id);
  if (!ficheAccessible(c, f)) throw new Erreur(404, "Fiche introuvable : envoyez d'abord la fiche.");
  if (!RE_NOM.test(nom) || !nom.startsWith(id + "_")) throw new Erreur(400, "Nom de fichier invalide.");
  const corps = await lireCorps(req, MAX_FICHIER), dossier = join(FICHIERS, id);
  mkdirSync(dossier, { recursive: true });
  const tmp = join(dossier, "." + nom + ".tmp"); writeFileSync(tmp, corps); renameSync(tmp, join(dossier, nom));
  const mime = String(req.headers["x-fichier-mime"] || req.headers["content-type"] || "application/octet-stream").slice(0, 100);
  exe(`INSERT INTO fichiers VALUES (?,?,?,?,?,?) ON CONFLICT(fiche_id,nom) DO UPDATE SET mime=excluded.mime, taille=excluded.taille, empreinte=excluded.empreinte, maj=excluded.maj`,
      id, nom, mime, corps.length, empreinte(corps), Date.now());
  exe("UPDATE fiches SET maj=? WHERE id=?", Date.now(), id);
  return { ok: true };
});
route("GET", "/api/fiches/:id/fichiers/:nom", (req, { id, nom }, res) => {
  const c = authentifier(req), f = un("SELECT * FROM fiches WHERE id = ?", id);
  if (!ficheAccessible(c, f)) throw new Erreur(404, "Fichier introuvable.");
  const m = un("SELECT * FROM fichiers WHERE fiche_id=? AND nom=?", id, nom), chemin = join(FICHIERS, id, nom);
  if (!m || !RE_NOM.test(nom) || !existsSync(chemin)) throw new Erreur(404, "Fichier introuvable.");
  res.writeHead(200, { "content-type": m.mime, "content-length": statSync(chemin).size, "cache-control": "private, max-age=31536000, immutable" });
  createReadStream(chemin).pipe(res);
  return undefined;
});
const ficheSortie = f => ({ ...JSON.parse(f.meta), province: f.province, compteServeur: f.compte_id, recu: f.recu, maj: f.maj,
  adhesionValidee: f.adhesion_validee || JSON.parse(f.meta).adhesionValidee || null, fichiersServeur: fichiersDe(f.id) });
route("GET", "/api/mes-fiches", (req) => {
  const c = authentifier(req);
  return { fiches: tous("SELECT * FROM fiches WHERE compte_id = ?", c.id).map(ficheSortie) };
});

/* ---- registre (administrateurs) ---- */
route("GET", "/api/registre", (req, _p, _r, url) => {
  const c = authentifier(req), k = exigerAdmin(c), depuis = Number(url.searchParams.get("depuis")) || 0;
  const lignes = c.province === NATIONAL ? tous("SELECT * FROM fiches WHERE maj > ? ORDER BY maj", depuis)
                                         : tous("SELECT * FROM fiches WHERE province = ? AND maj > ? ORDER BY maj", c.province, depuis);
  return { fiches: lignes.map(ficheSortie), maintenant: Date.now(), conseil: { id: k.id, province: k.province, conseil: k.nom, expire: k.expire } };
});
route("POST", "/api/fiches/:id/adhesion", async (req, { id }) => {
  const c = authentifier(req); exigerAdmin(c);
  const f = un("SELECT * FROM fiches WHERE id = ?", id);
  if (!f || !voitProvince(c, f.province)) throw new Erreur(404, "Fiche introuvable.");
  const v = await lireJson(req), meta = JSON.parse(f.meta);
  meta.data.adhMembre = "Oui"; meta.data.adhAnnee = meta.data.adhAnnee || String(new Date().getFullYear());
  if (v.numero) meta.data.numeroOrdre = String(v.numero).slice(0, 40);
  meta.adhesionValidee = Date.now();
  exe("UPDATE fiches SET meta=?, adhesion_validee=?, maj=? WHERE id=?", JSON.stringify(meta), meta.adhesionValidee, Date.now(), id);
  return { ok: true };
});
route("DELETE", "/api/fiches/:id", (req, { id }) => {
  const c = authentifier(req); exigerAdmin(c);
  const f = un("SELECT * FROM fiches WHERE id = ?", id);
  if (!f || !voitProvince(c, f.province)) throw new Erreur(404, "Fiche introuvable.");
  exe("DELETE FROM fiches WHERE id=?", id); exe("DELETE FROM fichiers WHERE fiche_id=?", id);
  rmSync(join(FICHIERS, id), { recursive: true, force: true });
  return { ok: true };
});
route("GET", "/api/comptes", (req) => {
  const c = authentifier(req); exigerAdmin(c);
  const l = c.province === NATIONAL ? tous("SELECT * FROM comptes ORDER BY role, nom") : tous("SELECT * FROM comptes WHERE province = ? ORDER BY role, nom", c.province);
  const nb = Object.fromEntries(tous("SELECT compte_id, COUNT(*) n FROM fiches GROUP BY compte_id").map(x => [x.compte_id, x.n]));
  return { comptes: l.map(x => ({ ...comptePublic(x), derniere: x.derniere, fiches: nb[x.id] || 0 })) };
});
route("POST", "/api/comptes/:id/reinitialiser", (req, { id }) => {
  const c = authentifier(req); exigerAdmin(c);
  const x = un("SELECT * FROM comptes WHERE id = ?", decodeURIComponent(id));
  if (!x || x.id === c.id || !voitProvince(c, x.province)) throw new Erreur(404, "Compte introuvable.");
  const tmp = codeAleatoire(8);
  exe("UPDATE comptes SET hash=?, echecs=0, bloque=0 WHERE id=?", hacher(tmp), x.id);
  exe("DELETE FROM sessions WHERE compte_id=?", x.id);
  return { provisoire: tmp };
});
route("POST", "/api/comptes/:id/role", (req, { id }) => {
  const c = authentifier(req); exigerAdmin(c);
  const x = un("SELECT * FROM comptes WHERE id = ?", decodeURIComponent(id));
  if (!x || x.id === c.id || !voitProvince(c, x.province)) throw new Erreur(404, "Compte introuvable.");
  const role = x.role === "admin" ? "membre" : "admin";
  exe("UPDATE comptes SET role=?, province=?, conseil_id=? WHERE id=?", role, x.province || c.province, x.conseil_id || c.conseil_id, x.id);
  return { role };
});

/* ---- créateur : requête signée avec la clé privée (en-tête X-Createur = horodatage.signature) ---- */
async function exigerCreateur(req) {
  const [ts, sig] = String(req.headers["x-createur"] || "").split(".");
  if (!ts || !sig || Math.abs(Date.now() - Number(ts)) > 5 * 60000 || !(await verifierSignature("createur:" + ts, sig))) throw new Erreur(401, "Signature du créateur invalide.");
}
route("GET", "/api/createur/tableau", async (req) => {
  await exigerCreateur(req);
  const nbFiches = Object.fromEntries(tous("SELECT province, COUNT(*) n FROM fiches GROUP BY province").map(x => [x.province, x.n]));
  const nbComptes = Object.fromEntries(tous("SELECT province, role, COUNT(*) n FROM comptes GROUP BY province, role").map(x => [x.province + "|" + x.role, x.n]));
  const conseils = tous("SELECT id, province, nom, email, expire, maj FROM conseils ORDER BY province").map(k => ({ ...k,
    fiches: nbFiches[k.province] || 0, membres: nbComptes[k.province + "|membre"] || 0, admins: nbComptes[k.province + "|admin"] || 0 }));
  return { conseils, totaux: { comptes: un("SELECT COUNT(*) n FROM comptes").n, fiches: un("SELECT COUNT(*) n FROM fiches").n,
    fichiers: un("SELECT COUNT(*) n, COALESCE(SUM(taille),0) t FROM fichiers") }, heure: Date.now() };
});

/* ------------------------------------------------------------------ fichiers statiques (l'application) */
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png",
  ".jpg": "image/jpeg", ".pdf": "application/pdf", ".webmanifest": "application/manifest+json", ".json": "application/json", ".md": "text/plain; charset=utf-8" };
function statique(req, res, chemin) {
  if (chemin === "/" || chemin === "") chemin = "/index.html";
  if (chemin.endsWith("/")) chemin += "index.html";
  const f = resolve(APP, "." + decodeURIComponent(chemin));
  if (!f.startsWith(APP + sep) || f.includes(sep + "serveur" + sep) || !existsSync(f) || !statSync(f).isFile()) { res.writeHead(404); return res.end("Introuvable"); }
  res.writeHead(200, { "content-type": TYPES[extname(f)] || "application/octet-stream", "cache-control": extname(f) === ".html" || f.endsWith("sw.js") ? "no-cache" : "public, max-age=3600" });
  createReadStream(f).pipe(res);
}

/* ------------------------------------------------------------------ serveur */
const serveur = createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  if (!url.pathname.startsWith("/api/")) return req.method === "GET" || req.method === "HEAD" ? statique(req, res, url.pathname) : json(res, 405, { erreur: "Méthode non permise." });
  entetesCors(req, res);
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
  const o = req.headers.origin, hote = req.headers.host;
  if (o && !ORIGINES.includes(o) && new URL(o).host !== hote) return json(res, 403, { erreur: "Origine non autorisée." });
  for (const r of routes) {
    if (r.m !== req.method) continue;
    const m = url.pathname.match(r.re);
    if (!m) continue;
    try {
      const out = await r.f(req, m.groups || {}, res, url);
      if (out !== undefined) json(res, 200, out);
    } catch (e) {
      if (!(e instanceof Erreur)) console.error(new Date().toISOString(), req.method, url.pathname, e);
      if (!res.headersSent) json(res, e.code || 500, { erreur: e instanceof Erreur ? e.message : "Erreur interne du serveur." });
    }
    return;
  }
  json(res, 404, { erreur: "Adresse inconnue." });
});
serveur.listen(PORT, () => console.log(`CNBM-RDC : http://localhost:${PORT}  (données : ${DONNEES})`));
