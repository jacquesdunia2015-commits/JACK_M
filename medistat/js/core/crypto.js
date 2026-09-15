// medistat/js/core/crypto.js
// Sécurité cryptographique — article 9 du cahier des charges.
// Chiffrement des données sensibles au repos, empreintes d'intégrité pour le
// journal d'audit, signature électronique des résultats, dérivation de clés.
// Repose exclusivement sur WebCrypto (API native des navigateurs et de Node).

const subtle = globalThis.crypto?.subtle;
const enc = new TextEncoder();
const dec = new TextDecoder();

function requireCrypto() {
  if (!subtle) {
    throw new Error(
      "L'API WebCrypto n'est pas disponible. Le chiffrement exige une origine " +
      "sécurisée (https:// ou http://localhost)."
    );
  }
}

/* ===================== Encodage ===================== */

export function bytesToBase64(bytes) {
  let s = "";
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const CHUNK = 0x8000; // évite un dépassement de pile sur les gros volumes
  for (let i = 0; i < arr.length; i += CHUNK) {
    s += String.fromCharCode.apply(null, arr.subarray(i, i + CHUNK));
  }
  return btoa(s);
}

export function base64ToBytes(b64) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export function bytesToHex(bytes) {
  return Array.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes),
    b => b.toString(16).padStart(2, "0")).join("");
}

/* ===================== Empreintes ===================== */

// SHA-256 d'une chaîne — sert aux empreintes de documents et à l'audit
export async function sha256(text) {
  requireCrypto();
  const digest = await subtle.digest("SHA-256", enc.encode(String(text)));
  return bytesToHex(digest);
}

export async function sha256Bytes(bytes) {
  requireCrypto();
  return bytesToHex(await subtle.digest("SHA-256", bytes));
}

/* ===================== Dérivation de clé ===================== */

// PBKDF2-SHA256, 250 000 itérations : coût volontairement élevé pour rendre
// une attaque par force brute hors de portée sur du matériel courant.
export const PBKDF2_ITERATIONS = 250000;

export async function deriveKey(password, salt, iterations = PBKDF2_ITERATIONS) {
  requireCrypto();
  const material = await subtle.importKey(
    "raw", enc.encode(password), "PBKDF2", false, ["deriveKey", "deriveBits"]);
  return subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// Empreinte d'un mot de passe, destinée au stockage (jamais le mot de passe)
export async function hashPassword(password, saltB64 = null) {
  requireCrypto();
  const salt = saltB64 ? base64ToBytes(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const material = await subtle.importKey(
    "raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    material, 256);
  return {
    hash: bytesToBase64(bits),
    salt: bytesToBase64(salt),
    iterations: PBKDF2_ITERATIONS,
    algorithme: "PBKDF2-SHA256",
  };
}

// Comparaison à temps constant : ne divulgue pas d'information par la durée
export function constantTimeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyPassword(password, stored) {
  if (!stored?.hash || !stored?.salt) return false;
  const again = await hashPassword(password, stored.salt);
  return constantTimeEqual(again.hash, stored.hash);
}

/* ===================== Chiffrement symétrique ===================== */

// AES-GCM 256 bits : confidentialité et authenticité en une seule opération.
// Le vecteur d'initialisation est tiré au hasard à chaque chiffrement et
// stocké en clair aux côtés du cryptogramme, comme le veut la pratique.
export async function encrypt(plaintext, password) {
  requireCrypto();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const data = typeof plaintext === "string" ? enc.encode(plaintext) : plaintext;
  const cipher = await subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  return {
    v: 1,
    algorithme: "AES-GCM-256",
    kdf: "PBKDF2-SHA256",
    iterations: PBKDF2_ITERATIONS,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    donnees: bytesToBase64(cipher),
  };
}

export async function decrypt(envelope, password) {
  requireCrypto();
  if (!envelope?.donnees || !envelope?.salt || !envelope?.iv) {
    throw new Error("Enveloppe chiffrée invalide ou incomplète.");
  }
  const key = await deriveKey(password, base64ToBytes(envelope.salt),
    envelope.iterations || PBKDF2_ITERATIONS);
  try {
    const plain = await subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBytes(envelope.iv) },
      key, base64ToBytes(envelope.donnees));
    return dec.decode(plain);
  } catch {
    // AES-GCM échoue aussi bien sur un mauvais mot de passe que sur une
    // altération des données : les deux cas sont indiscernables, par construction.
    throw new Error("Déchiffrement impossible : mot de passe incorrect ou données altérées.");
  }
}

/* ============ Clé de données de l'établissement (chiffrement enveloppe) ==== */

// Pourquoi une clé d'établissement plutôt qu'une clé par utilisateur.
//
// Dériver la clé de chiffrement du mot de passe de chaque utilisateur paraît
// séduisant : rien à stocker, la clé disparaît à la déconnexion. Mais un
// dossier médical est écrit par un médecin et relu par un biologiste, un
// infirmier, un secrétaire. Avec une clé par personne, chacun ne relit que
// ce qu'il a lui-même saisi ; les champs des autres apparaissent vides.
// C'est un défaut silencieux — aucune erreur, juste des données manquantes —
// et donc le pire qui soit dans un dossier de soins : une allergie qui ne
// s'affiche pas est une allergie qui n'existe pas pour le soignant.
//
// La Solution utilise donc une clé de données unique par établissement,
// tirée au hasard, et enveloppée séparément pour chaque utilisateur avec une
// clé dérivée de son mot de passe. Conséquences :
//   — tous les soignants d'un établissement lisent les mêmes dossiers ;
//   — la clé n'est jamais stockée en clair, nulle part ;
//   — un changement de mot de passe ré-enveloppe la clé, sans toucher aux
//     données ;
//   — deux établissements restent cryptographiquement cloisonnés.

export function genererCleDonnees() {
  requireCrypto();
  return bytesToBase64(crypto.getRandomValues(new Uint8Array(32)));
}

// Clé d'enveloppe dérivée du mot de passe. Le sel est celui de l'empreinte
// du mot de passe : il est déjà unique par utilisateur et déjà stocké.
export async function cleEnveloppe(motDePasse, sel) {
  return sha256(`enveloppe|${motDePasse}|${sel}`);
}

export async function envelopperCleDonnees(cleDonnees, motDePasse, sel) {
  return encrypt(cleDonnees, await cleEnveloppe(motDePasse, sel));
}

export async function ouvrirCleDonnees(enveloppe, motDePasse, sel) {
  return decrypt(enveloppe, await cleEnveloppe(motDePasse, sel));
}

export async function encryptObject(obj, password) {
  return encrypt(JSON.stringify(obj), password);
}

export async function decryptObject(envelope, password) {
  return JSON.parse(await decrypt(envelope, password));
}

/* ===================== Chiffrement de champs ===================== */

// Chiffre sélectivement les champs sensibles d'un enregistrement, en
// conservant en clair les champs nécessaires à la recherche et aux index.
// C'est le compromis retenu pour concilier confidentialité et exploitabilité.
export const CHAMPS_SENSIBLES = {
  patient: ["telephone", "email", "adresse", "antecedents", "allergies",
    "contactUrgence", "assurance"],
  consultation: ["symptomes", "examenClinique", "diagnostic", "conduite"],
  resultat: ["commentaireBiologiste"],
  document: ["contenu"],
};

/* ═══════════ Chiffrement des champs : clé importée, pas dérivée ═════════ */

// PBKDF2 existe pour compenser la faiblesse d'un mot de passe humain : 250 000
// itérations rendent une attaque par dictionnaire coûteuse. Appliqué à la clé
// de données de l'établissement, ce raisonnement ne tient plus — cette clé
// fait 256 bits tirés au hasard, il n'y a pas de dictionnaire à parcourir.
// L'étirer n'ajoute donc aucune sécurité, mais coûte environ 38 ms par champ.
//
// Ce coût était payé à chaque écriture ET à chaque lecture : afficher une
// liste de 120 patients demandait plus de 700 dérivations, soit une demi-
// minute d'attente pour ouvrir un écran. La clé est désormais importée une
// fois, telle quelle, et conservée en mémoire pour la session.
const clesImportees = new Map();

async function cleAESDepuis(cleDonnees) {
  let cle = clesImportees.get(cleDonnees);
  if (cle) return cle;
  requireCrypto();
  // Une clé de données vaut 32 octets en base64. Les bases antérieures
  // portent une empreinte hexadécimale de 64 caractères : on la convertit
  // pour obtenir dans les deux cas exactement 256 bits.
  let octets;
  if (/^[0-9a-f]{64}$/i.test(cleDonnees)) {
    octets = new Uint8Array(32);
    for (let i = 0; i < 32; i++) octets[i] = parseInt(cleDonnees.substr(i * 2, 2), 16);
  } else {
    octets = base64ToBytes(cleDonnees);
    if (octets.length !== 32) octets = await sha256Bytes(enc.encode(cleDonnees));
  }
  cle = await subtle.importKey("raw", octets, { name: "AES-GCM", length: 256 },
    false, ["encrypt", "decrypt"]);
  clesImportees.set(cleDonnees, cle);
  return cle;
}

// Efface les clés importées : appelé à la déconnexion pour ne rien laisser
// en mémoire une fois la session close.
export function oublierClesImportees() {
  clesImportees.clear();
}

async function chiffrerValeur(clair, cleDonnees) {
  const cle = await cleAESDepuis(cleDonnees);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await subtle.encrypt({ name: "AES-GCM", iv }, cle, enc.encode(clair));
  return { v: 2, algorithme: "AES-GCM-256", iv: bytesToBase64(iv), donnees: bytesToBase64(cipher) };
}

async function dechiffrerValeur(enveloppe, cleDonnees) {
  // Les enveloppes de version 1 étaient dérivées par PBKDF2 : elles restent
  // lisibles, sans quoi une mise à jour rendrait illisibles les dossiers déjà
  // saisis. Elles sont réécrites en version 2 à la première modification.
  if (enveloppe.v !== 2) return decrypt(enveloppe, cleDonnees);
  const cle = await cleAESDepuis(cleDonnees);
  try {
    const clair = await subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBytes(enveloppe.iv) }, cle, base64ToBytes(enveloppe.donnees));
    return dec.decode(clair);
  } catch {
    throw new Error("Déchiffrement impossible : clé incorrecte ou données altérées.");
  }
}

/* ═══════════════ Témoin de clé : détecter une clé qui n'ouvre rien ═══════ */

// Une clé erronée ne provoque pas d'erreur visible : `dechiffrerChamps`
// remplace chaque champ illisible par `null` et pose un drapeau que rien ne
// lisait. L'utilisateur entrait donc dans l'application, ouvrait un dossier,
// et voyait un champ « Allergies » vide — indiscernable d'un patient sans
// allergie connue. En dossier de soins, c'est le pire mode de défaillance
// possible : silencieux, et du côté dangereux.
//
// Le témoin est un texte connu, chiffré une fois avec la clé de
// l'établissement. Si la clé ouverte à la connexion ne le rouvre pas, la
// session est refusée avant que le moindre dossier ne s'affiche.

const TEMOIN_CLAIR = "MediStat — témoin de clé de chiffrement v1";

export async function creerTemoinCle(cleDonnees) {
  return chiffrerValeur(TEMOIN_CLAIR, cleDonnees);
}

export async function verifierTemoinCle(temoin, cleDonnees) {
  if (!temoin) return true;   // base antérieure au témoin : rien à vérifier
  try {
    return (await dechiffrerValeur(temoin, cleDonnees)) === TEMOIN_CLAIR;
  } catch {
    return false;
  }
}

export async function chiffrerChamps(entite, enregistrement, cleSession) {
  const champs = CHAMPS_SENSIBLES[entite];
  if (!champs || !cleSession) return enregistrement;
  const copie = { ...enregistrement };
  const chiffres = {};
  for (const champ of champs) {
    const v = copie[champ];
    if (v === undefined || v === null || v === "") continue;
    chiffres[champ] = await chiffrerValeur(typeof v === "string" ? v : JSON.stringify(v), cleSession);
    delete copie[champ];
  }
  if (Object.keys(chiffres).length) {
    copie._chiffre = chiffres;
    copie._champsChiffres = Object.keys(chiffres);
  }
  return copie;
}

export async function dechiffrerChamps(enregistrement, cleSession) {
  if (!enregistrement?._chiffre || !cleSession) return enregistrement;
  const copie = { ...enregistrement };
  for (const [champ, enveloppe] of Object.entries(enregistrement._chiffre)) {
    try {
      const clair = await dechiffrerValeur(enveloppe, cleSession);
      try { copie[champ] = JSON.parse(clair); } catch { copie[champ] = clair; }
    } catch {
      copie[champ] = null;
      copie._erreurDechiffrement = true;
    }
  }
  delete copie._chiffre;
  return copie;
}

/* ===================== Jetons de session (HMAC) ===================== */

// Jeton signé de type JWT (HS256) — utilisé entre le client et le serveur REST
export async function signerJeton(charge, secret, dureeSecondes = 43200) {
  requireCrypto();
  const key = await subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const now = Math.floor(Date.now() / 1000);
  const corps = { ...charge, iat: now, exp: now + dureeSecondes };
  const b64url = o => bytesToBase64(enc.encode(JSON.stringify(o)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const entete = b64url({ alg: "HS256", typ: "JWT" });
  const payload = b64url(corps);
  const signature = await subtle.sign("HMAC", key, enc.encode(`${entete}.${payload}`));
  const sig = bytesToBase64(signature).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${entete}.${payload}.${sig}`;
}

export async function verifierJeton(jeton, secret) {
  requireCrypto();
  const parts = String(jeton || "").split(".");
  if (parts.length !== 3) return null;
  const [entete, payload, sig] = parts;
  const key = await subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const pad = s => s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - s.length % 4) % 4);
  const ok = await subtle.verify("HMAC", key, base64ToBytes(pad(sig)),
    enc.encode(`${entete}.${payload}`));
  if (!ok) return null;
  try {
    const corps = JSON.parse(dec.decode(base64ToBytes(pad(payload))));
    if (corps.exp && corps.exp < Math.floor(Date.now() / 1000)) return null; // expiré
    return corps;
  } catch { return null; }
}

/* ===================== Signature électronique (article 6.3) ===================== */

// Signature d'un résultat de laboratoire par le biologiste validateur.
// L'empreinte porte sur le contenu exact du résultat : toute modification
// ultérieure invalide la signature, ce qui rend la fraude détectable.
export async function signerResultat(resultat, utilisateur, motDePasse) {
  const contenu = canonique({
    demandeId: resultat.demandeId,
    patientId: resultat.patientId,
    testCode: resultat.testCode,
    valeur: resultat.valeur,
    valeurTexte: resultat.valeurTexte ?? null,
    unite: resultat.unite ?? null,
    commentaireBiologiste: resultat.commentaireBiologiste ?? null,
  });
  const empreinteContenu = await sha256(contenu);
  const preuve = await sha256(`${empreinteContenu}|${utilisateur.id}|${motDePasse}`);
  return {
    signataireId: utilisateur.id,
    signataireNom: `${utilisateur.prenom || ""} ${utilisateur.nom || ""}`.trim(),
    signataireRole: utilisateur.role,
    date: new Date().toISOString(),
    empreinteContenu,
    preuve,
    algorithme: "SHA-256",
  };
}

// Vérifie qu'un résultat signé n'a pas été modifié depuis sa signature
export async function verifierSignature(resultat) {
  if (!resultat?.signature?.empreinteContenu) {
    return { valide: false, motif: "Le résultat ne porte aucune signature." };
  }
  const contenu = canonique({
    demandeId: resultat.demandeId,
    patientId: resultat.patientId,
    testCode: resultat.testCode,
    valeur: resultat.valeur,
    valeurTexte: resultat.valeurTexte ?? null,
    unite: resultat.unite ?? null,
    commentaireBiologiste: resultat.commentaireBiologiste ?? null,
  });
  const empreinte = await sha256(contenu);
  const valide = constantTimeEqual(empreinte, resultat.signature.empreinteContenu);
  return {
    valide,
    motif: valide
      ? "Signature valide : le résultat est conforme à celui qui a été signé."
      : "SIGNATURE INVALIDE : le contenu du résultat a été modifié après signature.",
    signataire: resultat.signature.signataireNom,
    date: resultat.signature.date,
  };
}

// Sérialisation canonique : clés triées, afin que la même donnée produise
// toujours exactement la même empreinte, quel que soit l'ordre d'insertion.
export function canonique(obj) {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return "[" + obj.map(canonique).join(",") + "]";
  const cles = Object.keys(obj).sort();
  return "{" + cles.map(k => JSON.stringify(k) + ":" + canonique(obj[k])).join(",") + "}";
}

/* ===================== Chaîne d'audit inviolable (article 16) ===================== */

// Chaque entrée du journal contient l'empreinte de la précédente : toute
// suppression ou modification rompt la chaîne et devient immédiatement
// détectable, y compris par un administrateur. C'est ce qui rend l'audit
// « non modifiable par l'utilisateur standard » au sens du cahier des charges.
export async function chainerAudit(entree, empreintePrecedente) {
  const corps = canonique({
    date: entree.date,
    utilisateurId: entree.utilisateurId,
    action: entree.action,
    entite: entree.entite,
    entiteId: entree.entiteId,
    details: entree.details ?? null,
    etablissementId: entree.etablissementId ?? null,
  });
  const empreinte = await sha256(`${empreintePrecedente || "GENESE"}|${corps}`);
  return { ...entree, empreintePrecedente: empreintePrecedente || "GENESE", empreinte };
}

// Contrôle d'intégrité de l'ensemble du journal
export async function verifierChaineAudit(entrees) {
  const ruptures = [];
  let precedente = "GENESE";
  for (let i = 0; i < entrees.length; i++) {
    const e = entrees[i];
    const recalcul = await chainerAudit(e, precedente);
    if (recalcul.empreinte !== e.empreinte) {
      ruptures.push({
        index: i, date: e.date, action: e.action,
        motif: e.empreintePrecedente !== precedente
          ? "Une entrée a été supprimée ou insérée avant celle-ci."
          : "Le contenu de cette entrée a été modifié après enregistrement.",
      });
    }
    precedente = e.empreinte;
  }
  return {
    valide: ruptures.length === 0,
    entrees: entrees.length,
    ruptures,
    message: ruptures.length === 0
      ? `Chaîne d'audit intègre : les ${entrees.length} entrées sont authentiques.`
      : `INTÉGRITÉ COMPROMISE : ${ruptures.length} rupture(s) détectée(s) dans le journal d'audit.`,
  };
}

/* ===================== Anonymisation (recherche et statistiques) ===================== */

// Produit un identifiant pseudonyme stable : le même patient donne toujours le
// même code, sans qu'on puisse remonter à son identité sans le sel secret.
// Indispensable pour exporter des données à des fins d'analyse statistique.
export async function pseudonymiser(identifiant, selSecret) {
  const h = await sha256(`${selSecret}|${identifiant}`);
  return "ANON-" + h.slice(0, 12).toUpperCase();
}

// Retire ou brouille les données directement identifiantes d'un enregistrement
export async function anonymiser(patient, selSecret, { conserverAge = true } = {}) {
  const code = await pseudonymiser(patient.id || patient.ipp, selSecret);
  const naissance = patient.dateNaissance ? new Date(patient.dateNaissance) : null;
  return {
    id: code,
    ipp: code,
    sexe: patient.sexe,
    // La date exacte est remplacée par l'année seule : suffisant pour l'analyse,
    // insuffisant pour réidentifier.
    anneeNaissance: naissance ? naissance.getFullYear() : null,
    age: conserverAge && naissance
      ? new Date().getFullYear() - naissance.getFullYear() : null,
    ville: patient.ville || null,
    groupeSanguin: patient.groupeSanguin || null,
    _anonymise: true,
  };
}

/* ===================== Génération de secrets ===================== */

export function genererSecret(octets = 32) {
  const bytes = crypto.getRandomValues(new Uint8Array(octets));
  return bytesToBase64(bytes);
}

// Mot de passe temporaire lisible, à communiquer à un nouvel utilisateur
export function genererMotDePasseTemporaire(longueur = 12) {
  // Alphabet sans caractères ambigus (0/O, 1/l/I) pour éviter les erreurs de saisie
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(longueur));
  return Array.from(bytes, b => alphabet[b % alphabet.length]).join("");
}

/* ===================== Robustesse d'un mot de passe ===================== */

// Mots de passe notoirement faibles. On compare le « noyau » du mot de passe
// (lettres seules, sans accents ni casse) : « Password2026! » est aussi faible
// que « password ». En revanche « AdminFort2026! » reste accepté — la présence
// d'un mot courant ne suffit pas à disqualifier un mot de passe long et varié.
const MOTS_DE_PASSE_COURANTS = new Set([
  "motdepasse", "password", "passe", "azerty", "qwerty", "admin",
  "administrateur", "medical", "medecin", "hopital", "laboratoire",
  "bonjour", "soleil", "iloveyou", "welcome", "secret", "test", "abc",
  "qwertyuiop", "azertyuiop", "letmein", "monkey", "dragon", "root", "user",
]);

export function evaluerMotDePasse(mdp) {
  const s = String(mdp || "");
  const noyau = s.normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z]/g, "").toLowerCase();
  const criteres = {
    longueur: s.length >= 12,
    longueurMinimale: s.length >= 8,
    majuscule: /[A-ZÀ-Þ]/.test(s),
    minuscule: /[a-zà-ÿ]/.test(s),
    chiffre: /\d/.test(s),
    special: /[^\w\s]/.test(s),
    // Faible si le noyau alphabétique EST un mot courant, si le mot de passe
    // n'est qu'une suite de chiffres, une séquence évidente, ou s'il manque de
    // diversité : « aaaaaaaaA1 » satisfait tous les autres critères tout en
    // étant trivial à deviner.
    pasCourant: !MOTS_DE_PASSE_COURANTS.has(noyau) &&
      !/^\d+$/.test(s) &&
      !/(.)\1{3,}/.test(s) &&                       // 4 caractères identiques d'affilée
      new Set(s).size >= Math.min(6, s.length) &&   // au moins 6 caractères distincts
      !/^(012345|123456|234567|abcdef|azerty|qwerty)/.test(s.toLowerCase()),
  };
  const score = Object.values(criteres).filter(Boolean).length;
  // Entropie approchée : log2(taille de l'alphabet) × longueur
  let alphabet = 0;
  if (/[a-z]/.test(s)) alphabet += 26;
  if (/[A-Z]/.test(s)) alphabet += 26;
  if (/\d/.test(s)) alphabet += 10;
  if (/[^\w\s]/.test(s)) alphabet += 32;
  const entropie = s.length * Math.log2(alphabet || 1);
  return {
    criteres, score, entropie,
    niveau: entropie < 40 ? "très faible" : entropie < 60 ? "faible"
      : entropie < 80 ? "correct" : entropie < 100 ? "fort" : "très fort",
    acceptable: criteres.longueurMinimale && criteres.majuscule &&
      criteres.minuscule && criteres.chiffre && criteres.pasCourant,
    conseil: !criteres.longueurMinimale ? "Utilisez au moins 8 caractères (12 recommandés)."
      : !criteres.majuscule ? "Ajoutez au moins une majuscule."
      : !criteres.minuscule ? "Ajoutez au moins une minuscule."
      : !criteres.chiffre ? "Ajoutez au moins un chiffre."
      : !criteres.pasCourant ? "Ce mot de passe est trop courant."
      : !criteres.special ? "Un caractère spécial renforcerait encore la sécurité."
      : "Ce mot de passe est robuste.",
  };
}
