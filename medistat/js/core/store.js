// medistat/js/core/store.js
// Couche de persistance hors ligne — IndexedDB, avec repli en mémoire.
// Toute la Solution fonctionne sans réseau : les données vivent sur l'appareil
// et se synchronisent avec le serveur dès qu'une connexion est disponible.
// Chaque écriture passe par le journal d'audit (article 16), chaîné par
// empreintes cryptographiques afin d'être infalsifiable.

import {
  chainerAudit, verifierChaineAudit, chiffrerChamps, dechiffrerChamps, CHAMPS_SENSIBLES,
} from "./crypto.js";
import { nouvelId, hasPermission } from "./model.js";

const DB_NOM = "medistat";
const DB_VERSION = 1;

// Magasins d'objets et index — reflètent les entités de l'article 17
const MAGASINS = {
  etablissements: { keyPath: "id", index: ["code", "actif"] },
  utilisateurs: { keyPath: "id", index: ["identifiant", "etablissementId", "role", "actif"] },
  patients: { keyPath: "id", index: ["ipp", "etablissementId", "nom", "dateNaissance", "archive"] },
  consultations: { keyPath: "id", index: ["patientId", "etablissementId", "date", "medecinId", "statut"] },
  prescriptions: { keyPath: "id", index: ["patientId", "consultationId", "etablissementId", "statut"] },
  testsCatalogue: { keyPath: "id", index: ["code", "etablissementId", "categorie", "actif"] },
  demandes: { keyPath: "id", index: ["numero", "patientId", "etablissementId", "statut", "date", "urgence"] },
  echantillons: { keyPath: "id", index: ["codeBarre", "demandeId", "patientId", "etablissementId", "statut"] },
  resultats: { keyPath: "id", index: ["demandeId", "patientId", "etablissementId", "testCode", "statut", "critique"] },
  documents: { keyPath: "id", index: ["patientId", "entite", "entiteId", "etablissementId"] },
  factures: { keyPath: "id", index: ["numero", "patientId", "etablissementId", "statut"] },
  notifications: { keyPath: "id", index: ["destinataireId", "etablissementId", "lue", "priorite"] },
  rendezVous: { keyPath: "id", index: ["patientId", "etablissementId", "date", "statut"] },
  audit: { keyPath: "id", index: ["date", "utilisateurId", "entite", "action", "etablissementId"] },
  jeuxDonnees: { keyPath: "id", index: ["etablissementId", "nom"] },   // analyses statistiques
  analyses: { keyPath: "id", index: ["etablissementId", "jeuId", "date"] },
  corpus: { keyPath: "id", index: ["etablissementId", "nom"] },        // analyses qualitatives
  parametres: { keyPath: "cle", index: [] },
  fileAttente: { keyPath: "id", index: ["date"] },                     // synchronisation différée
};

/* ===================== Ouverture de la base ===================== */

let dbPromise = null;
const memoire = new Map(); // repli si IndexedDB est indisponible (mode privé, WebView)
let modeMemoire = false;

function ouvrir() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      modeMemoire = true;
      for (const m of Object.keys(MAGASINS)) memoire.set(m, new Map());
      resolve(null);
      return;
    }
    const req = indexedDB.open(DB_NOM, DB_VERSION);
    req.onupgradeneeded = (ev) => {
      const db = req.result;
      for (const [nom, def] of Object.entries(MAGASINS)) {
        if (db.objectStoreNames.contains(nom)) continue;
        const store = db.createObjectStore(nom, { keyPath: def.keyPath });
        for (const idx of def.index) {
          store.createIndex(idx, idx, { unique: false });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      // Mode navigation privée ou quota refusé : on bascule en mémoire plutôt
      // que d'empêcher l'utilisateur de travailler.
      console.warn("IndexedDB indisponible, bascule en mémoire volatile.");
      modeMemoire = true;
      for (const m of Object.keys(MAGASINS)) memoire.set(m, new Map());
      resolve(null);
    };
  });
  return dbPromise;
}

export function estEnMemoire() { return modeMemoire; }

function tx(db, magasin, mode = "readonly") {
  return db.transaction(magasin, mode).objectStore(magasin);
}

function promesse(requete) {
  return new Promise((resolve, reject) => {
    requete.onsuccess = () => resolve(requete.result);
    requete.onerror = () => reject(requete.error);
  });
}

/* ===================== Opérations élémentaires ===================== */

export async function lire(magasin, id) {
  const db = await ouvrir();
  if (!db) return memoire.get(magasin)?.get(id) ?? null;
  return promesse(tx(db, magasin).get(id));
}

export async function lireTout(magasin) {
  const db = await ouvrir();
  if (!db) return [...(memoire.get(magasin)?.values() ?? [])];
  return promesse(tx(db, magasin).getAll());
}

export async function ecrire(magasin, objet) {
  const db = await ouvrir();
  if (!db) { memoire.get(magasin).set(objet[MAGASINS[magasin].keyPath], objet); return objet; }
  await promesse(tx(db, magasin, "readwrite").put(objet));
  return objet;
}

export async function supprimer(magasin, id) {
  const db = await ouvrir();
  if (!db) { memoire.get(magasin)?.delete(id); return; }
  await promesse(tx(db, magasin, "readwrite").delete(id));
}

export async function vider(magasin) {
  const db = await ouvrir();
  if (!db) { memoire.get(magasin)?.clear(); return; }
  await promesse(tx(db, magasin, "readwrite").clear());
}

// Recherche par index — évite de charger tout le magasin en mémoire
export async function parIndex(magasin, index, valeur) {
  const db = await ouvrir();
  if (!db) {
    return [...(memoire.get(magasin)?.values() ?? [])].filter(o => o[index] === valeur);
  }
  const store = tx(db, magasin);
  if (!store.indexNames.contains(index)) {
    return (await promesse(store.getAll())).filter(o => o[index] === valeur);
  }
  return promesse(store.index(index).getAll(valeur));
}

/* ===================== Contexte de session ===================== */

// Le contexte porte l'utilisateur, son établissement et la clé de chiffrement
// des champs sensibles. Il est fixé à l'ouverture de session.
let contexte = {
  utilisateur: null,
  etablissementId: null,
  cleSession: null,
  ip: null,
  appareil: typeof navigator !== "undefined" ? navigator.userAgent?.slice(0, 120) : "serveur",
};

export function definirContexte(ctx) { contexte = { ...contexte, ...ctx }; }
export function obtenirContexte() { return { ...contexte }; }
export function reinitialiserContexte() {
  contexte = { utilisateur: null, etablissementId: null, cleSession: null,
    ip: null, appareil: contexte.appareil };
}

/* ===================== Journal d'audit (article 16) ===================== */

let derniereEmpreinte = null;

async function empreinteCourante() {
  if (derniereEmpreinte !== null) return derniereEmpreinte;
  const entrees = await lireTout("audit");
  entrees.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  derniereEmpreinte = entrees.length ? entrees[entrees.length - 1].empreinte : "GENESE";
  return derniereEmpreinte;
}

// Trace une action. Toute écriture de la Solution passe par ici.
export async function tracer(action, entite, entiteId, details = null, extra = {}) {
  const entree = {
    id: nouvelId("aud"),
    date: new Date().toISOString(),
    utilisateurId: contexte.utilisateur?.id ?? "anonyme",
    utilisateurNom: contexte.utilisateur
      ? `${contexte.utilisateur.prenom || ""} ${contexte.utilisateur.nom || ""}`.trim()
      : "Anonyme",
    role: contexte.utilisateur?.role ?? null,
    action, entite, entiteId,
    details,
    avant: extra.avant ?? null,
    apres: extra.apres ?? null,
    ip: contexte.ip,
    appareil: contexte.appareil,
    etablissementId: contexte.etablissementId,
  };
  const chainee = await chainerAudit(entree, await empreinteCourante());
  derniereEmpreinte = chainee.empreinte;
  await ecrire("audit", chainee);
  return chainee;
}

// Contrôle d'intégrité du journal — accessible au responsable qualité
export async function verifierAudit() {
  const entrees = await lireTout("audit");
  entrees.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return verifierChaineAudit(entrees);
}

/* ===================== Erreur de permission ===================== */

export class ErreurPermission extends Error {
  constructor(ressource, droit, role) {
    super(`Accès refusé : le rôle « ${role} » ne dispose pas du droit « ${droit} » sur « ${ressource} ».`);
    this.name = "ErreurPermission";
    this.ressource = ressource;
    this.droit = droit;
    this.role = role;
  }
}

// Garde de sécurité : vérifie le droit, trace tout refus, puis laisse passer
async function exiger(ressource, droit) {
  const u = contexte.utilisateur;
  if (!u) throw new ErreurPermission(ressource, droit, "non authentifié");
  if (!hasPermission(u.role, ressource, droit)) {
    await tracer("acces_refuse", ressource, null, `Droit « ${droit} » refusé`);
    throw new ErreurPermission(ressource, droit, u.role);
  }
  return true;
}

/* ===================== Dépôt générique (repository) ===================== */

// Fabrique un dépôt pour une entité : contrôle des droits, cloisonnement
// multi-établissement, chiffrement des champs sensibles et audit automatique.
export function depot(magasin, ressource, { chiffrer = false } = {}) {
  const cloisonner = liste => {
    // Séparation stricte des données entre établissements (article 4).
    // Seul l'administrateur système voit l'ensemble des tenants.
    if (!contexte.etablissementId) return liste;
    if (contexte.utilisateur?.role === "admin_systeme") return liste;
    return liste.filter(o => !o.etablissementId || o.etablissementId === contexte.etablissementId);
  };

  const dechiffrer = async o => (chiffrer && o ? dechiffrerChamps(o, contexte.cleSession) : o);

  return {
    magasin, ressource,

    async lister({ filtre = null, tri = null, limite = null } = {}) {
      await exiger(ressource, "lecture");
      let liste = cloisonner(await lireTout(magasin));
      if (filtre) liste = liste.filter(filtre);
      if (tri) liste.sort(tri);
      if (limite) liste = liste.slice(0, limite);
      return Promise.all(liste.map(dechiffrer));
    },

    async obtenir(id, { tracerConsultation = false } = {}) {
      await exiger(ressource, "lecture");
      const o = await lire(magasin, id);
      if (!o) return null;
      if (contexte.etablissementId && o.etablissementId &&
          o.etablissementId !== contexte.etablissementId &&
          contexte.utilisateur?.role !== "admin_systeme") {
        await tracer("acces_refuse", ressource, id, "Établissement non autorisé");
        throw new ErreurPermission(ressource, "lecture (autre établissement)", contexte.utilisateur.role);
      }
      // La consultation d'un dossier médical est elle-même un événement tracé
      if (tracerConsultation) await tracer("consultation", ressource, id);
      return dechiffrer(o);
    },

    async creer(donnees) {
      await exiger(ressource, "creation");
      const maintenant = new Date().toISOString();
      let objet = {
        ...donnees,
        id: donnees.id || nouvelId(ressource.slice(0, 3)),
        etablissementId: donnees.etablissementId || contexte.etablissementId,
        creePar: contexte.utilisateur?.id,
        dateCreation: maintenant,
        modifiePar: contexte.utilisateur?.id,
        dateModification: maintenant,
        _version: 1,
        _synchronise: false,
      };
      if (chiffrer) objet = await chiffrerChamps(ressource, objet, contexte.cleSession);
      await ecrire(magasin, objet);
      await tracer("creation", ressource, objet.id, null, { apres: resume(donnees, ressource) });
      await enfilerSync(magasin, "creation", objet);
      return dechiffrer(objet);
    },

    async modifier(id, modifications) {
      await exiger(ressource, "modification");
      const existant = await lire(magasin, id);
      if (!existant) throw new Error(`Enregistrement introuvable : ${id}`);
      const avant = await dechiffrer(existant);
      let objet = {
        ...avant, ...modifications,
        id,
        modifiePar: contexte.utilisateur?.id,
        dateModification: new Date().toISOString(),
        _version: (existant._version || 1) + 1,
        _synchronise: false,
      };
      if (chiffrer) objet = await chiffrerChamps(ressource, objet, contexte.cleSession);
      await ecrire(magasin, objet);
      await tracer("modification", ressource, id, champsModifies(avant, modifications),
        { avant: resume(avant, ressource), apres: resume(modifications, ressource) });
      await enfilerSync(magasin, "modification", objet);
      return dechiffrer(objet);
    },

    async supprimer(id, motif = null) {
      await exiger(ressource, "suppression");
      const existant = await lire(magasin, id);
      if (!existant) return false;
      // Suppression logique : en contexte médical, aucune donnée n'est
      // réellement effacée — elle est marquée supprimée et reste auditable.
      const objet = {
        ...existant,
        _supprime: true,
        _dateSuppression: new Date().toISOString(),
        _supprimePar: contexte.utilisateur?.id,
        _motifSuppression: motif,
        _synchronise: false,
      };
      await ecrire(magasin, objet);
      await tracer("suppression", ressource, id, motif, { avant: resume(existant, ressource) });
      await enfilerSync(magasin, "suppression", objet);
      return true;
    },

    async rechercher(texte, champs) {
      await exiger(ressource, "lecture");
      const q = String(texte || "").trim().toLowerCase();
      if (!q) return [];
      const liste = cloisonner(await lireTout(magasin));
      const resultats = liste.filter(o => !o._supprime && champs.some(c =>
        String(o[c] ?? "").toLowerCase().includes(q)));
      return Promise.all(resultats.map(dechiffrer));
    },

    async compter(filtre = null) {
      const liste = cloisonner(await lireTout(magasin));
      const actifs = liste.filter(o => !o._supprime);
      return filtre ? actifs.filter(filtre).length : actifs.length;
    },

    async parIndex(index, valeur) {
      await exiger(ressource, "lecture");
      const liste = cloisonner(await parIndex(magasin, index, valeur));
      return Promise.all(liste.filter(o => !o._supprime).map(dechiffrer));
    },
  };
}

// Ne conserve dans l'audit qu'un résumé. Le journal doit permettre de savoir
// QUI a modifié QUOI et QUAND, sans devenir un double de la base ni — surtout —
// une copie en clair des données de santé que l'on vient de chiffrer.
// Les champs sensibles sont donc remplacés par une mention de présence : on
// trace le fait qu'ils ont été renseignés ou modifiés, jamais leur contenu.
function resume(objet, ressource = null) {
  if (!objet || typeof objet !== "object") return null;
  const sensibles = new Set(CHAMPS_SENSIBLES[ressource] || []);
  const out = {};
  for (const [k, v] of Object.entries(objet)) {
    if (k.startsWith("_") || k === "contenu" || k === "signature") continue;
    if (k === "motDePasse" || k === "historiqueMotsDePasse" || k === "totpSecret") continue;
    if (v === null || v === undefined) continue;
    if (sensibles.has(k)) { out[k] = "[donnée de santé — non journalisée]"; continue; }
    const s = typeof v === "object" ? "[objet]" : String(v);
    out[k] = s.length > 60 ? s.slice(0, 60) + "…" : s;
  }
  return out;
}

function champsModifies(avant, modifications) {
  const changes = Object.keys(modifications).filter(k =>
    !k.startsWith("_") && String(avant[k] ?? "") !== String(modifications[k] ?? ""));
  return changes.length ? `Champs modifiés : ${changes.join(", ")}` : "Aucun changement effectif";
}

/* ===================== File de synchronisation ===================== */

// Les écritures réalisées hors ligne sont mises en file, puis rejouées vers le
// serveur dès le retour du réseau. C'est ce qui rend l'application utilisable
// dans un service sans connexion fiable.
async function enfilerSync(magasin, operation, objet) {
  await ecrire("fileAttente", {
    id: nouvelId("sync"),
    date: new Date().toISOString(),
    magasin, operation,
    objetId: objet.id,
    etablissementId: objet.etablissementId,
    charge: objet,
    tentatives: 0,
  });
}

export async function fileSync() {
  const f = await lireTout("fileAttente");
  return f.sort((a, b) => (a.date < b.date ? -1 : 1));
}

export async function purgerFileSync(ids) {
  for (const id of ids) await supprimer("fileAttente", id);
}

/* ===================== Dépôts de la Solution ===================== */

export const depots = {
  etablissements: depot("etablissements", "etablissement"),
  utilisateurs: depot("utilisateurs", "utilisateur"),
  patients: depot("patients", "patient", { chiffrer: true }),
  consultations: depot("consultations", "consultation", { chiffrer: true }),
  prescriptions: depot("prescriptions", "prescription"),
  testsCatalogue: depot("testsCatalogue", "testCatalogue"),
  demandes: depot("demandes", "demande"),
  echantillons: depot("echantillons", "echantillon"),
  resultats: depot("resultats", "resultat", { chiffrer: true }),
  documents: depot("documents", "document", { chiffrer: true }),
  factures: depot("factures", "facture"),
  notifications: depot("notifications", "notification"),
  rendezVous: depot("rendezVous", "rendezVous"),
};

/* ===================== Paramètres ===================== */

export async function parametre(cle, valeurParDefaut = null) {
  const p = await lire("parametres", cle);
  return p ? p.valeur : valeurParDefaut;
}

export async function definirParametre(cle, valeur) {
  await ecrire("parametres", { cle, valeur, date: new Date().toISOString() });
  await tracer("parametrage", "parametre", cle, `Paramètre « ${cle} » modifié`);
  return valeur;
}

/* ===================== Séquences ===================== */

// Compteurs persistants pour les numéros de dossier, de demande et d'échantillon
export async function prochaineSequence(nom) {
  const cle = `sequence_${nom}`;
  const courante = Number(await parametre(cle, 0));
  const suivante = courante + 1;
  await ecrire("parametres", { cle, valeur: suivante, date: new Date().toISOString() });
  return suivante;
}

/* ===================== Sauvegarde et restauration ===================== */

// Export complet de la base — procédure de sauvegarde de l'article 20
export async function exporterBase({ inclureAudit = true } = {}) {
  const magasins = Object.keys(MAGASINS)
    .filter(m => m !== "fileAttente" && (inclureAudit || m !== "audit"));
  const donnees = {};
  for (const m of magasins) donnees[m] = await lireTout(m);
  await tracer("export", "base", null, "Sauvegarde complète de la base");
  return {
    format: "medistat-sauvegarde",
    version: DB_VERSION,
    date: new Date().toISOString(),
    etablissementId: contexte.etablissementId,
    genereePar: contexte.utilisateur?.id,
    donnees,
    statistiques: Object.fromEntries(magasins.map(m => [m, donnees[m].length])),
  };
}

// Restauration — procédure de reprise de l'article 20
export async function restaurerBase(sauvegarde, { remplacer = false } = {}) {
  if (sauvegarde?.format !== "medistat-sauvegarde") {
    throw new Error("Fichier de sauvegarde non reconnu.");
  }
  const rapport = {};
  for (const [magasin, enregistrements] of Object.entries(sauvegarde.donnees || {})) {
    if (!MAGASINS[magasin]) continue;
    if (remplacer) await vider(magasin);
    let n = 0;
    for (const e of enregistrements) { await ecrire(magasin, e); n++; }
    rapport[magasin] = n;
  }
  derniereEmpreinte = null; // la chaîne d'audit doit être relue
  await tracer("parametrage", "base", null,
    `Restauration : ${Object.values(rapport).reduce((a, b) => a + b, 0)} enregistrements`);
  return rapport;
}

// Remet la base à zéro (utile aux démonstrations et aux formations)
export async function reinitialiserBase() {
  for (const m of Object.keys(MAGASINS)) await vider(m);
  derniereEmpreinte = null;
}

/* ===================== Diagnostic de stockage ===================== */

export async function diagnosticStockage() {
  const compteurs = {};
  for (const m of Object.keys(MAGASINS)) compteurs[m] = (await lireTout(m)).length;
  let quota = null;
  try {
    if (navigator?.storage?.estimate) {
      const e = await navigator.storage.estimate();
      quota = {
        utilise: e.usage,
        disponible: e.quota,
        pourcentage: e.quota ? (e.usage / e.quota) * 100 : null,
      };
    }
  } catch { /* estimation indisponible : information facultative */ }
  return {
    moteur: modeMemoire ? "mémoire volatile" : "IndexedDB",
    persistant: !modeMemoire,
    compteurs,
    total: Object.values(compteurs).reduce((a, b) => a + b, 0),
    quota,
    avertissement: modeMemoire
      ? "Les données ne sont PAS conservées : navigation privée ou stockage refusé. Exportez votre travail avant de fermer."
      : null,
  };
}
