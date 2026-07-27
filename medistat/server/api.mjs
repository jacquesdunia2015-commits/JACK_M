#!/usr/bin/env node
// medistat/server/api.mjs
// Serveur d'API REST multi-établissement — articles 8.2 et 14.
// Zéro dépendance : uniquement la bibliothèque standard de Node (node:sqlite,
// node:http, node:crypto). Aucun « npm install » n'est nécessaire.
//
//   Lancement :  node server/api.mjs [--port 8080] [--db medistat.db]
//   Production : à placer derrière un proxy TLS (nginx, Caddy). Le chiffrement
//                en transit exigé par l'article 9 est assuré par ce proxy.
//
// Le serveur est facultatif : l'application fonctionne intégralement hors
// ligne. Il sert à mutualiser les données entre plusieurs postes et plusieurs
// établissements, avec un cloisonnement strict.

import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { randomBytes, pbkdf2Sync, timingSafeEqual, createHmac, createHash } from "node:crypto";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { extname, join, resolve, dirname, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/* ===================== Configuration ===================== */

function argument(nom, defaut) {
  const i = process.argv.indexOf(`--${nom}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : defaut;
}

const CONFIG = {
  port: Number(argument("port", process.env.MEDISTAT_PORT || 8080)),
  hote: argument("hote", process.env.MEDISTAT_HOTE || "0.0.0.0"),
  base: argument("db", process.env.MEDISTAT_DB || join(RACINE, "data", "medistat.db")),
  // Le secret signe les jetons de session. En production il DOIT être fourni :
  // un secret aléatoire à chaque démarrage invaliderait toutes les sessions.
  secret: process.env.MEDISTAT_SECRET || null,
  servirStatique: process.env.MEDISTAT_STATIQUE !== "0",
  dureeSessionHeures: Number(process.env.MEDISTAT_SESSION_H || 12),
  itérationsPBKDF2: 250000,
};

if (!CONFIG.secret) {
  CONFIG.secret = randomBytes(32).toString("base64");
  console.warn(
    "\x1b[33m⚠  MEDISTAT_SECRET n'est pas défini : un secret temporaire a été engendré.\n" +
    "   Les sessions seront invalidées au prochain redémarrage.\n" +
    "   En production, définissez :  export MEDISTAT_SECRET=\"$(openssl rand -base64 32)\"\x1b[0m");
}

mkdirSync(dirname(CONFIG.base), { recursive: true });

/* ===================== Base de données ===================== */

const db = new DatabaseSync(CONFIG.base);
db.exec("PRAGMA journal_mode = WAL");        // lectures concurrentes pendant l'écriture
db.exec("PRAGMA foreign_keys = ON");
db.exec("PRAGMA busy_timeout = 5000");

// Schéma relationnel reprenant les entités de l'article 17.
// Chaque table porte etablissement_id : c'est la clé du cloisonnement.
db.exec(`
CREATE TABLE IF NOT EXISTS etablissements (
  id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, nom TEXT NOT NULL,
  type TEXT, adresse TEXT, ville TEXT, pays TEXT, telephone TEXT, email TEXT,
  responsable TEXT, modules TEXT, actif INTEGER DEFAULT 1,
  date_creation TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS utilisateurs (
  id TEXT PRIMARY KEY,
  identifiant TEXT NOT NULL,
  nom TEXT NOT NULL, prenom TEXT, email TEXT, telephone TEXT,
  role TEXT NOT NULL, service TEXT,
  etablissement_id TEXT NOT NULL REFERENCES etablissements(id),
  mot_de_passe TEXT NOT NULL, sel TEXT NOT NULL, iterations INTEGER NOT NULL,
  mot_de_passe_temporaire INTEGER DEFAULT 0,
  actif INTEGER DEFAULT 1,
  tentatives_echouees INTEGER DEFAULT 0, bloque_jusqua TEXT,
  derniere_connexion TEXT, date_creation TEXT NOT NULL,
  UNIQUE (identifiant, etablissement_id)
);

CREATE TABLE IF NOT EXISTS enregistrements (
  id TEXT NOT NULL,
  entite TEXT NOT NULL,
  etablissement_id TEXT NOT NULL REFERENCES etablissements(id),
  donnees TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  supprime INTEGER DEFAULT 0,
  date_creation TEXT NOT NULL, date_modification TEXT NOT NULL,
  cree_par TEXT, modifie_par TEXT,
  PRIMARY KEY (entite, id)
);

CREATE TABLE IF NOT EXISTS audit (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT UNIQUE NOT NULL, date TEXT NOT NULL,
  utilisateur_id TEXT, utilisateur_nom TEXT, role TEXT,
  action TEXT NOT NULL, entite TEXT, entite_id TEXT,
  details TEXT, ip TEXT, appareil TEXT,
  etablissement_id TEXT,
  empreinte TEXT NOT NULL, empreinte_precedente TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_enr_entite ON enregistrements (entite, etablissement_id, supprime);
CREATE INDEX IF NOT EXISTS idx_enr_modif ON enregistrements (etablissement_id, date_modification);
CREATE INDEX IF NOT EXISTS idx_audit_ets ON audit (etablissement_id, date);
CREATE INDEX IF NOT EXISTS idx_users_ets ON utilisateurs (etablissement_id, actif);
`);

/* ===================== Cryptographie ===================== */

function hacher(motDePasse, selB64 = null) {
  const sel = selB64 ? Buffer.from(selB64, "base64") : randomBytes(16);
  const empreinte = pbkdf2Sync(motDePasse, sel, CONFIG.itérationsPBKDF2, 32, "sha256");
  return { hash: empreinte.toString("base64"), sel: sel.toString("base64"),
    iterations: CONFIG.itérationsPBKDF2 };
}

function verifierMotDePasse(motDePasse, hash, sel, iterations) {
  const calcule = pbkdf2Sync(motDePasse, Buffer.from(sel, "base64"), iterations, 32, "sha256");
  const attendu = Buffer.from(hash, "base64");
  // Comparaison à temps constant : ne divulgue rien par la durée
  return calcule.length === attendu.length && timingSafeEqual(calcule, attendu);
}

const b64url = o => Buffer.from(JSON.stringify(o)).toString("base64url");

function signerJeton(charge, dureeSecondes = CONFIG.dureeSessionHeures * 3600) {
  const maintenant = Math.floor(Date.now() / 1000);
  const entete = b64url({ alg: "HS256", typ: "JWT" });
  const corps = b64url({ ...charge, iat: maintenant, exp: maintenant + dureeSecondes });
  const signature = createHmac("sha256", CONFIG.secret)
    .update(`${entete}.${corps}`).digest("base64url");
  return `${entete}.${corps}.${signature}`;
}

function verifierJeton(jeton) {
  const parts = String(jeton || "").split(".");
  if (parts.length !== 3) return null;
  const [entete, corps, signature] = parts;
  const attendue = createHmac("sha256", CONFIG.secret)
    .update(`${entete}.${corps}`).digest("base64url");
  const a = Buffer.from(signature), b = Buffer.from(attendue);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const charge = JSON.parse(Buffer.from(corps, "base64url").toString());
    if (charge.exp && charge.exp < Math.floor(Date.now() / 1000)) return null;
    return charge;
  } catch { return null; }
}

// Sérialisation canonique : la même donnée produit toujours la même empreinte
function canonique(o) {
  if (o === null || typeof o !== "object") return JSON.stringify(o);
  if (Array.isArray(o)) return "[" + o.map(canonique).join(",") + "]";
  return "{" + Object.keys(o).sort()
    .map(k => JSON.stringify(k) + ":" + canonique(o[k])).join(",") + "}";
}

/* ===================== Journal d'audit chaîné ===================== */

const derniereEmpreinte = db.prepare(
  "SELECT empreinte FROM audit ORDER BY sequence DESC LIMIT 1");
const insererAudit = db.prepare(`
  INSERT INTO audit (id, date, utilisateur_id, utilisateur_nom, role, action,
    entite, entite_id, details, ip, appareil, etablissement_id, empreinte, empreinte_precedente)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

function tracer(ctx, action, entite = null, entiteId = null, details = null) {
  const precedente = derniereEmpreinte.get()?.empreinte || "GENESE";
  const date = new Date().toISOString();
  const corps = canonique({
    date, utilisateurId: ctx?.utilisateur?.id ?? null,
    action, entite, entiteId, details,
    etablissementId: ctx?.utilisateur?.etablissementId ?? null,
  });
  const empreinte = createHash("sha256").update(`${precedente}|${corps}`).digest("hex");
  insererAudit.run(
    randomBytes(12).toString("hex"), date,
    ctx?.utilisateur?.id ?? null, ctx?.utilisateur?.nom ?? null, ctx?.utilisateur?.role ?? null,
    action, entite, entiteId, details, ctx?.ip ?? null, ctx?.appareil ?? null,
    ctx?.utilisateur?.etablissementId ?? null, empreinte, precedente);
  return empreinte;
}

// Contrôle d'intégrité de l'ensemble du journal
function verifierChaineAudit() {
  const entrees = db.prepare("SELECT * FROM audit ORDER BY sequence ASC").all();
  const ruptures = [];
  let precedente = "GENESE";
  for (const e of entrees) {
    const corps = canonique({
      date: e.date, utilisateurId: e.utilisateur_id, action: e.action,
      entite: e.entite, entiteId: e.entite_id, details: e.details,
      etablissementId: e.etablissement_id,
    });
    const attendue = createHash("sha256").update(`${precedente}|${corps}`).digest("hex");
    if (attendue !== e.empreinte) {
      ruptures.push({
        sequence: e.sequence, date: e.date, action: e.action,
        motif: e.empreinte_precedente !== precedente
          ? "Une entrée a été supprimée ou insérée avant celle-ci."
          : "Le contenu de cette entrée a été modifié après enregistrement.",
      });
    }
    precedente = e.empreinte;
  }
  return {
    valide: ruptures.length === 0, entrees: entrees.length, ruptures,
    message: ruptures.length === 0
      ? `Chaîne d'audit intègre : les ${entrees.length} entrées sont authentiques.`
      : `INTÉGRITÉ COMPROMISE : ${ruptures.length} rupture(s) détectée(s).`,
  };
}

/* ===================== Rôles et permissions ===================== */

// Table dupliquée depuis js/core/model.js. Le serveur ne fait jamais confiance
// au client : il revérifie chaque droit, quoi qu'ait décidé l'interface.
const ROLES = {
  admin_systeme: { niveau: 100, permissions: ["*"] },
  admin_etablissement: { niveau: 90, permissions: [
    "patient:*", "consultation:*", "prescription:*", "demande:*", "echantillon:*",
    "resultat:lecture", "resultat:export", "document:*", "utilisateur:*",
    "testCatalogue:*", "facture:*", "rendezVous:*", "notification:*",
    "audit:lecture", "audit:export", "etablissement:lecture", "etablissement:modification",
    "statistiques:*", "analyse:*"] },
  medecin: { niveau: 70, permissions: [
    "patient:lecture", "patient:creation", "patient:modification",
    "consultation:*", "prescription:*",
    "demande:lecture", "demande:creation", "demande:modification",
    "resultat:lecture", "resultat:export", "resultat:resultatsSensibles",
    "document:lecture", "document:creation", "rendezVous:lecture", "rendezVous:creation",
    "statistiques:lecture", "analyse:*", "notification:lecture"] },
  infirmier: { niveau: 50, permissions: [
    "patient:lecture", "patient:creation", "patient:modification",
    "consultation:lecture", "consultation:modification", "prescription:lecture",
    "demande:lecture", "demande:creation",
    "echantillon:lecture", "echantillon:creation", "echantillon:modification",
    "resultat:lecture", "document:lecture", "document:creation",
    "rendezVous:*", "notification:lecture"] },
  laborantin: { niveau: 55, permissions: [
    "patient:lecture", "demande:lecture", "demande:modification", "echantillon:*",
    "resultat:lecture", "resultat:creation", "resultat:modification",
    "testCatalogue:lecture", "document:lecture", "document:creation",
    "statistiques:lecture", "notification:lecture"] },
  biologiste: { niveau: 80, permissions: [
    "patient:lecture", "demande:*", "echantillon:*", "resultat:*",
    "testCatalogue:*", "document:lecture", "document:creation", "document:export",
    "statistiques:*", "analyse:*", "audit:lecture", "notification:*"] },
  receptionniste: { niveau: 30, permissions: [
    "patient:lecture", "patient:creation", "patient:modification",
    "consultation:lecture", "consultation:creation",
    "demande:lecture", "demande:creation", "rendezVous:*",
    "facture:lecture", "facture:creation", "document:lecture", "notification:lecture"] },
  pharmacien: { niveau: 50, permissions: [
    "patient:lecture", "prescription:lecture", "prescription:modification",
    "prescription:validation", "document:lecture", "statistiques:lecture", "notification:lecture"] },
  qualite: { niveau: 75, permissions: [
    "patient:lecture", "consultation:lecture", "demande:lecture", "echantillon:lecture",
    "resultat:lecture", "audit:lecture", "audit:export", "statistiques:*", "analyse:*",
    "document:lecture", "testCatalogue:lecture", "notification:lecture"] },
  comptable: { niveau: 40, permissions: [
    "patient:lecture", "facture:*", "statistiques:lecture", "analyse:lecture",
    "document:lecture", "notification:lecture"] },
  patient: { niveau: 10, permissions: ["portail:lecture", "portail:export"] },
};

function autorise(role, ressource, action) {
  const def = ROLES[role];
  if (!def) return false;
  const p = def.permissions;
  return p.includes("*") || p.includes(`${ressource}:*`) ||
    p.includes(`${ressource}:${action}`) || p.includes(`*:${action}`);
}

// Entités synchronisables et ressource de droit correspondante
const ENTITES = {
  patients: "patient", consultations: "consultation", prescriptions: "prescription",
  testsCatalogue: "testCatalogue", demandes: "demande", echantillons: "echantillon",
  resultats: "resultat", documents: "document", factures: "facture",
  notifications: "notification", rendezVous: "rendezVous",
  jeuxDonnees: "analyse", corpus: "analyse",
};

/* ===================== Utilitaires HTTP ===================== */

function repondre(res, code, corps, entetes = {}) {
  const donnees = typeof corps === "string" ? corps : JSON.stringify(corps);
  res.writeHead(code, {
    "content-type": typeof corps === "string"
      ? "text/plain; charset=utf-8" : "application/json; charset=utf-8",
    "cache-control": "no-store",
    // Durcissement : ces en-têtes limitent les dégâts d'une faille éventuelle
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "same-origin",
    ...entetes,
  });
  res.end(donnees);
}

const erreur = (res, code, message, detail = null) =>
  repondre(res, code, { erreur: message, ...(detail ? { detail } : {}) });

function lireCorps(req, maxOctets = 12 * 1024 * 1024) {
  return new Promise((resolve2, reject) => {
    let taille = 0;
    const morceaux = [];
    req.on("data", c => {
      taille += c.length;
      if (taille > maxOctets) { reject(new Error("Charge utile trop volumineuse.")); req.destroy(); return; }
      morceaux.push(c);
    });
    req.on("end", () => {
      if (!morceaux.length) return resolve2({});
      try { resolve2(JSON.parse(Buffer.concat(morceaux).toString("utf8"))); }
      catch { reject(new Error("Corps de requête JSON invalide.")); }
    });
    req.on("error", reject);
  });
}

// Limitation du débit, par adresse : freine les attaques par force brute
const compteurs = new Map();
function limiterDebit(ip, plafond = 300, fenetreMs = 60000) {
  const maintenant = Date.now();
  const entree = compteurs.get(ip) || { debut: maintenant, nombre: 0 };
  if (maintenant - entree.debut > fenetreMs) { entree.debut = maintenant; entree.nombre = 0; }
  entree.nombre++;
  compteurs.set(ip, entree);
  if (compteurs.size > 8000) {
    for (const [k, v] of compteurs) if (maintenant - v.debut > fenetreMs) compteurs.delete(k);
  }
  return entree.nombre <= plafond;
}

function contexte(req) {
  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim()
    || req.socket.remoteAddress || "inconnu";
  const entete = req.headers.authorization || "";
  const jeton = entete.startsWith("Bearer ") ? entete.slice(7) : null;
  const charge = jeton ? verifierJeton(jeton) : null;
  return {
    ip,
    appareil: String(req.headers["user-agent"] || "").slice(0, 160),
    utilisateur: charge ? {
      id: charge.sub, nom: charge.nom, role: charge.role,
      etablissementId: charge.ets,
    } : null,
  };
}

/* ===================== Routes ===================== */

async function router(req, res, url, ctx) {
  const chemin = url.pathname.replace(/^\/api/, "") || "/";
  const methode = req.method;

  /* ---- Santé du service ---- */
  if (chemin === "/sante") {
    return repondre(res, 200, {
      service: "MediStat API", version: "1.0",
      heure: new Date().toISOString(),
      etablissements: db.prepare("SELECT COUNT(*) n FROM etablissements").get().n,
      base: CONFIG.base,
    });
  }

  /* ---- Initialisation du premier établissement ---- */
  if (chemin === "/initialiser" && methode === "POST") {
    const existants = db.prepare("SELECT COUNT(*) n FROM etablissements").get().n;
    if (existants > 0) return erreur(res, 409, "Le serveur est déjà initialisé.");
    const corps = await lireCorps(req);
    const { etablissement, administrateur } = corps;
    if (!etablissement?.nom || !etablissement?.code) {
      return erreur(res, 400, "Le nom et le code de l'établissement sont obligatoires.");
    }
    if (!administrateur?.identifiant || !administrateur?.motDePasse || !administrateur?.nom) {
      return erreur(res, 400, "L'identifiant, le nom et le mot de passe de l'administrateur sont obligatoires.");
    }
    if (String(administrateur.motDePasse).length < 8) {
      return erreur(res, 400, "Le mot de passe doit comporter au moins 8 caractères.");
    }

    const idEts = "ets_" + randomBytes(8).toString("hex");
    const maintenant = new Date().toISOString();
    db.prepare(`INSERT INTO etablissements
      (id, code, nom, type, adresse, ville, pays, telephone, email, responsable, modules, actif, date_creation)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,1,?)`).run(
      idEts, String(etablissement.code).toUpperCase(), etablissement.nom,
      etablissement.type || "hopital", etablissement.adresse || "", etablissement.ville || "",
      etablissement.pays || "", etablissement.telephone || "", etablissement.email || "",
      `${administrateur.prenom || ""} ${administrateur.nom}`.trim(),
      JSON.stringify(etablissement.modules || { laboratoire: true, consultations: true, analyses: true }),
      maintenant);

    const idUser = "usr_" + randomBytes(8).toString("hex");
    const mdp = hacher(administrateur.motDePasse);
    db.prepare(`INSERT INTO utilisateurs
      (id, identifiant, nom, prenom, email, role, service, etablissement_id,
       mot_de_passe, sel, iterations, actif, date_creation)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,1,?)`).run(
      idUser, String(administrateur.identifiant).toLowerCase().trim(),
      administrateur.nom, administrateur.prenom || "", administrateur.email || "",
      "admin_etablissement", "Administration", idEts,
      mdp.hash, mdp.sel, mdp.iterations, maintenant);

    tracer({ ...ctx, utilisateur: { id: idUser, nom: administrateur.nom,
      role: "admin_etablissement", etablissementId: idEts } },
      "parametrage", "etablissement", idEts, `Initialisation du serveur pour « ${etablissement.nom} »`);

    return repondre(res, 201, {
      etablissement: { id: idEts, code: etablissement.code, nom: etablissement.nom },
      administrateur: { id: idUser, identifiant: administrateur.identifiant },
    });
  }

  /* ---- Connexion ---- */
  if (chemin === "/connexion" && methode === "POST") {
    if (!limiterDebit("auth:" + ctx.ip, 20, 60000)) {
      return erreur(res, 429, "Trop de tentatives. Réessayez dans une minute.");
    }
    const { identifiant, motDePasse } = await lireCorps(req);
    if (!identifiant || !motDePasse) {
      return erreur(res, 400, "Identifiant et mot de passe requis.");
    }
    const u = db.prepare("SELECT * FROM utilisateurs WHERE identifiant = ?")
      .get(String(identifiant).toLowerCase().trim());

    // Message identique que le compte existe ou non : pas d'énumération
    const refus = (motif) => {
      tracer({ ...ctx, utilisateur: u ? { id: u.id, nom: u.nom, role: u.role, etablissementId: u.etablissement_id } : null },
        "connexion_echec", "utilisateur", u?.id || null, motif);
      return erreur(res, 401, "Identifiant ou mot de passe incorrect.");
    };

    if (!u) return refus("Identifiant inconnu");
    if (!u.actif) return erreur(res, 403, "Ce compte est désactivé.");
    if (u.bloque_jusqua && new Date(u.bloque_jusqua) > new Date()) {
      const reste = Math.ceil((new Date(u.bloque_jusqua) - Date.now()) / 60000);
      return erreur(res, 429, `Compte temporairement bloqué. Réessayez dans ${reste} minute(s).`);
    }

    if (!verifierMotDePasse(motDePasse, u.mot_de_passe, u.sel, u.iterations)) {
      const tentatives = (u.tentatives_echouees || 0) + 1;
      if (tentatives >= 5) {
        db.prepare("UPDATE utilisateurs SET tentatives_echouees = 0, bloque_jusqua = ? WHERE id = ?")
          .run(new Date(Date.now() + 15 * 60000).toISOString(), u.id);
      } else {
        db.prepare("UPDATE utilisateurs SET tentatives_echouees = ? WHERE id = ?").run(tentatives, u.id);
      }
      return refus(`Mot de passe incorrect (tentative ${tentatives}/5)`);
    }

    db.prepare("UPDATE utilisateurs SET tentatives_echouees = 0, bloque_jusqua = NULL, derniere_connexion = ? WHERE id = ?")
      .run(new Date().toISOString(), u.id);

    const ets = db.prepare("SELECT * FROM etablissements WHERE id = ?").get(u.etablissement_id);
    const jeton = signerJeton({
      sub: u.id, nom: `${u.prenom || ""} ${u.nom}`.trim(), role: u.role, ets: u.etablissement_id,
    });

    tracer({ ...ctx, utilisateur: { id: u.id, nom: u.nom, role: u.role, etablissementId: u.etablissement_id } },
      "connexion", "utilisateur", u.id, `Connexion de ${u.prenom || ""} ${u.nom}`.trim());

    return repondre(res, 200, {
      jeton,
      expiration: new Date(Date.now() + CONFIG.dureeSessionHeures * 3600000).toISOString(),
      utilisateur: {
        id: u.id, identifiant: u.identifiant, nom: u.nom, prenom: u.prenom,
        email: u.email, role: u.role, service: u.service,
        etablissementId: u.etablissement_id,
        motDePasseTemporaire: !!u.mot_de_passe_temporaire,
      },
      etablissement: ets ? { ...ets, modules: JSON.parse(ets.modules || "{}") } : null,
    });
  }

  /* ---- À partir d'ici, l'authentification est exigée ---- */
  if (!ctx.utilisateur) {
    return erreur(res, 401, "Authentification requise.",
      "Transmettez le jeton dans l'en-tête : Authorization: Bearer <jeton>");
  }

  /* ---- Session courante ---- */
  if (chemin === "/moi") {
    const u = db.prepare("SELECT * FROM utilisateurs WHERE id = ?").get(ctx.utilisateur.id);
    if (!u || !u.actif) return erreur(res, 403, "Compte introuvable ou désactivé.");
    const ets = db.prepare("SELECT * FROM etablissements WHERE id = ?").get(u.etablissement_id);
    return repondre(res, 200, {
      utilisateur: {
        id: u.id, identifiant: u.identifiant, nom: u.nom, prenom: u.prenom,
        email: u.email, role: u.role, service: u.service, etablissementId: u.etablissement_id,
      },
      etablissement: ets ? { ...ets, modules: JSON.parse(ets.modules || "{}") } : null,
      permissions: ROLES[u.role]?.permissions || [],
    });
  }

  /* ---- Changement de mot de passe ---- */
  if (chemin === "/moi/mot-de-passe" && methode === "POST") {
    const { ancien, nouveau } = await lireCorps(req);
    const u = db.prepare("SELECT * FROM utilisateurs WHERE id = ?").get(ctx.utilisateur.id);
    if (!u || !verifierMotDePasse(ancien || "", u.mot_de_passe, u.sel, u.iterations)) {
      tracer(ctx, "connexion_echec", "utilisateur", ctx.utilisateur.id,
        "Changement de mot de passe refusé");
      return erreur(res, 403, "Mot de passe actuel incorrect.");
    }
    if (!nouveau || String(nouveau).length < 8) {
      return erreur(res, 400, "Le nouveau mot de passe doit comporter au moins 8 caractères.");
    }
    const mdp = hacher(nouveau);
    db.prepare(`UPDATE utilisateurs SET mot_de_passe = ?, sel = ?, iterations = ?,
      mot_de_passe_temporaire = 0 WHERE id = ?`).run(mdp.hash, mdp.sel, mdp.iterations, u.id);
    tracer(ctx, "parametrage", "utilisateur", u.id, "Changement de mot de passe");
    return repondre(res, 200, { message: "Mot de passe modifié." });
  }

  /* ---- Utilisateurs ---- */
  if (chemin === "/utilisateurs") {
    if (methode === "GET") {
      if (!autorise(ctx.utilisateur.role, "utilisateur", "lecture")) {
        tracer(ctx, "acces_refuse", "utilisateur", null, "Lecture des utilisateurs refusée");
        return erreur(res, 403, "Droit insuffisant.");
      }
      const liste = db.prepare(`SELECT id, identifiant, nom, prenom, email, telephone, role,
        service, actif, derniere_connexion, date_creation
        FROM utilisateurs WHERE etablissement_id = ? ORDER BY nom`)
        .all(ctx.utilisateur.etablissementId);
      return repondre(res, 200, { utilisateurs: liste });
    }
    if (methode === "POST") {
      if (!autorise(ctx.utilisateur.role, "utilisateur", "creation")) {
        tracer(ctx, "acces_refuse", "utilisateur", null, "Création d'utilisateur refusée");
        return erreur(res, 403, "Droit insuffisant.");
      }
      const d = await lireCorps(req);
      if (!d.identifiant || !d.nom || !ROLES[d.role]) {
        return erreur(res, 400, "Identifiant, nom et rôle valide sont obligatoires.");
      }
      // Un administrateur d'établissement ne peut pas créer d'administrateur système
      if (d.role === "admin_systeme" && ctx.utilisateur.role !== "admin_systeme") {
        return erreur(res, 403, "Seul un administrateur système peut créer un compte de ce niveau.");
      }
      const identifiant = String(d.identifiant).toLowerCase().trim();
      const existe = db.prepare("SELECT id FROM utilisateurs WHERE identifiant = ?").get(identifiant);
      if (existe) return erreur(res, 409, `L'identifiant « ${identifiant} » est déjà utilisé.`);

      const temporaire = d.motDePasse || randomBytes(9).toString("base64url").slice(0, 12);
      const mdp = hacher(temporaire);
      const id = "usr_" + randomBytes(8).toString("hex");
      db.prepare(`INSERT INTO utilisateurs
        (id, identifiant, nom, prenom, email, telephone, role, service, etablissement_id,
         mot_de_passe, sel, iterations, mot_de_passe_temporaire, actif, date_creation)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1,?)`).run(
        id, identifiant, d.nom, d.prenom || "", d.email || "", d.telephone || "",
        d.role, d.service || "", ctx.utilisateur.etablissementId,
        mdp.hash, mdp.sel, mdp.iterations, d.motDePasse ? 0 : 1, new Date().toISOString());

      tracer(ctx, "creation", "utilisateur", id, `Création du compte ${identifiant} (${d.role})`);
      return repondre(res, 201, {
        utilisateur: { id, identifiant, nom: d.nom, prenom: d.prenom, role: d.role },
        motDePasseTemporaire: d.motDePasse ? null : temporaire,
      });
    }
  }

  const majUtilisateur = chemin.match(/^\/utilisateurs\/([\w-]+)$/);
  if (majUtilisateur && methode === "PATCH") {
    if (!autorise(ctx.utilisateur.role, "utilisateur", "administration")) {
      tracer(ctx, "acces_refuse", "utilisateur", majUtilisateur[1], "Modification refusée");
      return erreur(res, 403, "Droit insuffisant.");
    }
    const cible = majUtilisateur[1];
    if (cible === ctx.utilisateur.id) {
      return erreur(res, 403, "Vous ne pouvez pas modifier votre propre compte.");
    }
    const u = db.prepare("SELECT * FROM utilisateurs WHERE id = ? AND etablissement_id = ?")
      .get(cible, ctx.utilisateur.etablissementId);
    if (!u) return erreur(res, 404, "Utilisateur introuvable.");
    const d = await lireCorps(req);

    if (d.role !== undefined) {
      if (!ROLES[d.role]) return erreur(res, 400, "Rôle inconnu.");
      if (d.role === "admin_systeme" && ctx.utilisateur.role !== "admin_systeme") {
        return erreur(res, 403, "Seul un administrateur système peut attribuer ce rôle.");
      }
      db.prepare("UPDATE utilisateurs SET role = ? WHERE id = ?").run(d.role, cible);
      tracer(ctx, "changement_droits", "utilisateur", cible, `Rôle modifié : ${u.role} → ${d.role}`);
    }
    if (d.actif !== undefined) {
      // Le dernier administrateur actif ne doit jamais être désactivé
      if (!d.actif && ["admin_etablissement", "admin_systeme"].includes(u.role)) {
        const autres = db.prepare(`SELECT COUNT(*) n FROM utilisateurs
          WHERE etablissement_id = ? AND actif = 1 AND id != ?
          AND role IN ('admin_etablissement','admin_systeme')`)
          .get(ctx.utilisateur.etablissementId, cible).n;
        if (autres === 0) {
          return erreur(res, 409, "Impossible : cet établissement n'aurait plus aucun administrateur actif.");
        }
      }
      db.prepare("UPDATE utilisateurs SET actif = ? WHERE id = ?").run(d.actif ? 1 : 0, cible);
      tracer(ctx, "changement_droits", "utilisateur", cible,
        d.actif ? "Compte réactivé" : "Compte désactivé");
    }
    if (d.reinitialiserMotDePasse) {
      const temporaire = randomBytes(9).toString("base64url").slice(0, 12);
      const mdp = hacher(temporaire);
      db.prepare(`UPDATE utilisateurs SET mot_de_passe = ?, sel = ?, iterations = ?,
        mot_de_passe_temporaire = 1, tentatives_echouees = 0, bloque_jusqua = NULL
        WHERE id = ?`).run(mdp.hash, mdp.sel, mdp.iterations, cible);
      tracer(ctx, "changement_droits", "utilisateur", cible, "Réinitialisation du mot de passe");
      return repondre(res, 200, { message: "Mot de passe réinitialisé.", motDePasseTemporaire: temporaire });
    }
    return repondre(res, 200, { message: "Utilisateur mis à jour." });
  }

  /* ---- Entités génériques ---- */
  const collection = chemin.match(/^\/([\w]+)$/);
  if (collection && ENTITES[collection[1]]) {
    const entite = collection[1];
    const ressource = ENTITES[entite];

    if (methode === "GET") {
      if (!autorise(ctx.utilisateur.role, ressource, "lecture")) {
        tracer(ctx, "acces_refuse", ressource, null, "Lecture refusée");
        return erreur(res, 403, `Droit de lecture insuffisant sur « ${ressource} ».`);
      }
      // Synchronisation incrémentale : le client ne rapatrie que le delta
      const depuis = url.searchParams.get("depuis");
      const limite = Math.min(Number(url.searchParams.get("limite")) || 1000, 5000);
      const lignes = depuis
        ? db.prepare(`SELECT * FROM enregistrements
            WHERE entite = ? AND etablissement_id = ? AND date_modification > ?
            ORDER BY date_modification ASC LIMIT ?`)
          .all(entite, ctx.utilisateur.etablissementId, depuis, limite)
        : db.prepare(`SELECT * FROM enregistrements
            WHERE entite = ? AND etablissement_id = ? AND supprime = 0
            ORDER BY date_modification DESC LIMIT ?`)
          .all(entite, ctx.utilisateur.etablissementId, limite);

      return repondre(res, 200, {
        entite,
        nombre: lignes.length,
        horodatage: new Date().toISOString(),
        enregistrements: lignes.map(l => ({
          ...JSON.parse(l.donnees), id: l.id, _version: l.version,
          _supprime: !!l.supprime, _dateModification: l.date_modification,
        })),
      });
    }

    if (methode === "POST") {
      if (!autorise(ctx.utilisateur.role, ressource, "creation")) {
        tracer(ctx, "acces_refuse", ressource, null, "Création refusée");
        return erreur(res, 403, `Droit de création insuffisant sur « ${ressource} ».`);
      }
      const corps = await lireCorps(req);
      // Deux formes acceptées : un enregistrement, ou un lot pour la synchronisation
      const lot = Array.isArray(corps.enregistrements) ? corps.enregistrements : [corps];
      const maintenant = new Date().toISOString();
      let crees = 0, majs = 0, conflits = 0;

      const inserer = db.prepare(`INSERT INTO enregistrements
        (id, entite, etablissement_id, donnees, version, supprime, date_creation, date_modification, cree_par, modifie_par)
        VALUES (?,?,?,?,?,?,?,?,?,?)`);
      const mettreAJour = db.prepare(`UPDATE enregistrements
        SET donnees = ?, version = ?, supprime = ?, date_modification = ?, modifie_par = ?
        WHERE entite = ? AND id = ? AND etablissement_id = ?`);
      const lire = db.prepare("SELECT * FROM enregistrements WHERE entite = ? AND id = ?");

      for (const enr of lot) {
        if (!enr || !enr.id) continue;
        const existant = lire.get(entite, enr.id);
        const donnees = JSON.stringify(enr);

        if (!existant) {
          inserer.run(enr.id, entite, ctx.utilisateur.etablissementId, donnees,
            enr._version || 1, enr._supprime ? 1 : 0, maintenant, maintenant,
            ctx.utilisateur.id, ctx.utilisateur.id);
          crees++;
        } else {
          if (existant.etablissement_id !== ctx.utilisateur.etablissementId) {
            tracer(ctx, "acces_refuse", ressource, enr.id, "Enregistrement d'un autre établissement");
            conflits++;
            continue;
          }
          if (!autorise(ctx.utilisateur.role, ressource, "modification")) {
            conflits++;
            continue;
          }
          // Résolution de conflit : la version la plus élevée l'emporte.
          // À version égale, la modification la plus récente est retenue.
          const versionEntrante = enr._version || 1;
          if (versionEntrante < existant.version) { conflits++; continue; }
          mettreAJour.run(donnees, Math.max(versionEntrante, existant.version + 1),
            enr._supprime ? 1 : 0, maintenant, ctx.utilisateur.id,
            entite, enr.id, ctx.utilisateur.etablissementId);
          majs++;
        }
      }

      tracer(ctx, lot.length > 1 ? "modification" : (crees ? "creation" : "modification"),
        ressource, lot.length === 1 ? lot[0]?.id : null,
        lot.length > 1
          ? `Synchronisation : ${crees} création(s), ${majs} mise(s) à jour, ${conflits} conflit(s)`
          : null);

      return repondre(res, crees && !majs ? 201 : 200,
        { crees, majs, conflits, horodatage: maintenant });
    }
  }

  const unitaire = chemin.match(/^\/([\w]+)\/([\w-]+)$/);
  if (unitaire && ENTITES[unitaire[1]]) {
    const [, entite, id] = unitaire;
    const ressource = ENTITES[entite];

    if (methode === "GET") {
      if (!autorise(ctx.utilisateur.role, ressource, "lecture")) {
        tracer(ctx, "acces_refuse", ressource, id, "Lecture refusée");
        return erreur(res, 403, "Droit insuffisant.");
      }
      const l = db.prepare("SELECT * FROM enregistrements WHERE entite = ? AND id = ?").get(entite, id);
      if (!l) return erreur(res, 404, "Enregistrement introuvable.");
      if (l.etablissement_id !== ctx.utilisateur.etablissementId) {
        tracer(ctx, "acces_refuse", ressource, id, "Établissement non autorisé");
        return erreur(res, 403, "Cet enregistrement appartient à un autre établissement.");
      }
      // La consultation d'un dossier médical est elle-même un événement tracé
      if (entite === "patients") tracer(ctx, "consultation", ressource, id);
      return repondre(res, 200, { ...JSON.parse(l.donnees), id: l.id, _version: l.version });
    }

    if (methode === "DELETE") {
      if (!autorise(ctx.utilisateur.role, ressource, "suppression")) {
        tracer(ctx, "acces_refuse", ressource, id, "Suppression refusée");
        return erreur(res, 403, "Droit insuffisant.");
      }
      const l = db.prepare("SELECT * FROM enregistrements WHERE entite = ? AND id = ?").get(entite, id);
      if (!l) return erreur(res, 404, "Enregistrement introuvable.");
      if (l.etablissement_id !== ctx.utilisateur.etablissementId) {
        return erreur(res, 403, "Cet enregistrement appartient à un autre établissement.");
      }
      // Suppression logique : en contexte médical, rien n'est réellement effacé
      db.prepare(`UPDATE enregistrements SET supprime = 1, version = version + 1,
        date_modification = ?, modifie_par = ? WHERE entite = ? AND id = ?`)
        .run(new Date().toISOString(), ctx.utilisateur.id, entite, id);
      tracer(ctx, "suppression", ressource, id);
      return repondre(res, 200, { message: "Enregistrement supprimé (suppression logique)." });
    }
  }

  /* ---- Journal d'audit ---- */
  if (chemin === "/audit" && methode === "GET") {
    if (!autorise(ctx.utilisateur.role, "audit", "lecture")) {
      tracer(ctx, "acces_refuse", "audit", null, "Lecture du journal refusée");
      return erreur(res, 403, "Droit insuffisant.");
    }
    const limite = Math.min(Number(url.searchParams.get("limite")) || 500, 5000);
    const entrees = db.prepare(`SELECT * FROM audit WHERE etablissement_id = ?
      ORDER BY sequence DESC LIMIT ?`).all(ctx.utilisateur.etablissementId, limite);
    return repondre(res, 200, { nombre: entrees.length, entrees });
  }

  if (chemin === "/audit/integrite" && methode === "GET") {
    if (!autorise(ctx.utilisateur.role, "audit", "lecture")) {
      return erreur(res, 403, "Droit insuffisant.");
    }
    return repondre(res, 200, verifierChaineAudit());
  }

  /* ---- Journal d'audit poussé par le client ---- */
  if (chemin === "/audit" && methode === "POST") {
    const corps = await lireCorps(req);
    const entrees = Array.isArray(corps.entrees) ? corps.entrees : [];
    let n = 0;
    for (const e of entrees.slice(0, 2000)) {
      if (!e?.action) continue;
      // La chaîne est recalculée côté serveur : le client ne peut pas forger
      // d'empreinte, seulement déclarer un événement.
      tracer(ctx, e.action, e.entite || null, e.entiteId || null,
        (e.details || "") + " [journalisé hors ligne]");
      n++;
    }
    return repondre(res, 200, { enregistres: n });
  }

  /* ---- Établissement ---- */
  if (chemin === "/etablissement" && methode === "GET") {
    const ets = db.prepare("SELECT * FROM etablissements WHERE id = ?")
      .get(ctx.utilisateur.etablissementId);
    if (!ets) return erreur(res, 404, "Établissement introuvable.");
    return repondre(res, 200, { ...ets, modules: JSON.parse(ets.modules || "{}") });
  }

  if (chemin === "/etablissement" && methode === "PATCH") {
    if (!autorise(ctx.utilisateur.role, "etablissement", "modification")) {
      return erreur(res, 403, "Droit insuffisant.");
    }
    const d = await lireCorps(req);
    const champs = ["nom", "type", "adresse", "ville", "pays", "telephone", "email", "responsable"];
    const majs = champs.filter(c => d[c] !== undefined);
    for (const c of majs) {
      db.prepare(`UPDATE etablissements SET ${c} = ? WHERE id = ?`)
        .run(d[c], ctx.utilisateur.etablissementId);
    }
    if (d.modules) {
      db.prepare("UPDATE etablissements SET modules = ? WHERE id = ?")
        .run(JSON.stringify(d.modules), ctx.utilisateur.etablissementId);
    }
    tracer(ctx, "parametrage", "etablissement", ctx.utilisateur.etablissementId,
      `Modification du paramétrage : ${majs.join(", ") || "modules"}`);
    return repondre(res, 200, { message: "Établissement mis à jour." });
  }

  /* ---- Statistiques du serveur ---- */
  if (chemin === "/statistiques" && methode === "GET") {
    if (!autorise(ctx.utilisateur.role, "statistiques", "lecture")) {
      return erreur(res, 403, "Droit insuffisant.");
    }
    const compteurs = {};
    for (const entite of Object.keys(ENTITES)) {
      compteurs[entite] = db.prepare(`SELECT COUNT(*) n FROM enregistrements
        WHERE entite = ? AND etablissement_id = ? AND supprime = 0`)
        .get(entite, ctx.utilisateur.etablissementId).n;
    }
    return repondre(res, 200, {
      etablissementId: ctx.utilisateur.etablissementId,
      compteurs,
      utilisateurs: db.prepare("SELECT COUNT(*) n FROM utilisateurs WHERE etablissement_id = ? AND actif = 1")
        .get(ctx.utilisateur.etablissementId).n,
      evenementsAudit: db.prepare("SELECT COUNT(*) n FROM audit WHERE etablissement_id = ?")
        .get(ctx.utilisateur.etablissementId).n,
    });
  }

  return erreur(res, 404, `Route inconnue : ${methode} ${chemin}`);
}

/* ===================== Fichiers statiques ===================== */

const TYPES_MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon",
  ".pdf": "application/pdf", ".woff2": "font/woff2",
};

function servirStatique(req, res, url) {
  let chemin = decodeURIComponent(url.pathname);
  if (chemin === "/" || chemin === "") chemin = "/index.html";
  // Neutralisation de la traversée de répertoire : le chemin résolu doit
  // impérativement rester sous la racine du projet.
  const cible = resolve(RACINE, "." + normalize(chemin));
  if (!cible.startsWith(RACINE)) return erreur(res, 403, "Accès refusé.");
  if (!existsSync(cible)) {
    // Application monopage : toute route inconnue retombe sur index.html
    const index = join(RACINE, "index.html");
    if (!existsSync(index)) return erreur(res, 404, "Ressource introuvable.");
    return repondre(res, 200, readFileSync(index, "utf8"),
      { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" });
  }
  const type = TYPES_MIME[extname(cible).toLowerCase()] || "application/octet-stream";
  const estTexte = type.includes("charset");
  res.writeHead(200, {
    "content-type": type,
    "cache-control": chemin === "/index.html" ? "no-cache" : "public, max-age=300",
    "x-content-type-options": "nosniff",
  });
  res.end(readFileSync(cible, estTexte ? "utf8" : null));
}

/* ===================== Serveur ===================== */

const serveur = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const ctx = contexte(req);

  // Le partage entre origines n'est ouvert que si une origine est déclarée :
  // par défaut, l'API n'est accessible que depuis la page qu'elle sert.
  const origineAutorisee = process.env.MEDISTAT_ORIGINE;
  if (origineAutorisee) {
    res.setHeader("access-control-allow-origin", origineAutorisee);
    res.setHeader("access-control-allow-headers", "content-type, authorization");
    res.setHeader("access-control-allow-methods", "GET, POST, PATCH, DELETE, OPTIONS");
    res.setHeader("vary", "origin");
  }
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

  if (!limiterDebit(ctx.ip)) {
    return erreur(res, 429, "Trop de requêtes. Ralentissez le rythme des appels.");
  }

  if (url.pathname.startsWith("/api")) {
    try {
      await router(req, res, url, ctx);
    } catch (e) {
      console.error(`[${new Date().toISOString()}] ${req.method} ${url.pathname} —`, e.message);
      // Le détail technique n'est jamais renvoyé au client : il pourrait
      // renseigner un attaquant sur la structure interne.
      if (!res.headersSent) erreur(res, 500, "Erreur interne du serveur.");
    }
    return;
  }

  if (CONFIG.servirStatique) return servirStatique(req, res, url);
  return erreur(res, 404, "Ressource introuvable.");
});

serveur.listen(CONFIG.port, CONFIG.hote, () => {
  const compte = db.prepare("SELECT COUNT(*) n FROM etablissements").get().n;
  console.log(`
\x1b[1m╭──────────────────────────────────────────────────────────╮
│  MediStat — serveur d'API                                │
╰──────────────────────────────────────────────────────────╯\x1b[0m

  Adresse      http://${CONFIG.hote === "0.0.0.0" ? "localhost" : CONFIG.hote}:${CONFIG.port}
  API          http://${CONFIG.hote === "0.0.0.0" ? "localhost" : CONFIG.hote}:${CONFIG.port}/api/sante
  Base         ${CONFIG.base}
  Statique     ${CONFIG.servirStatique ? "activé (application servie à la racine)" : "désactivé"}
  Session      ${CONFIG.dureeSessionHeures} heures

  ${compte === 0
    ? "\x1b[33mAucun établissement : appelez POST /api/initialiser pour commencer.\x1b[0m"
    : `${compte} établissement(s) enregistré(s).`}

  \x1b[2mEn production, placez ce serveur derrière un proxy TLS et définissez
  MEDISTAT_SECRET. Ctrl+C pour arrêter.\x1b[0m
`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    console.log("\nArrêt du serveur, fermeture de la base…");
    try { db.close(); } catch { /* déjà fermée */ }
    serveur.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000);
  });
}
