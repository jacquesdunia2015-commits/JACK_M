// medistat/js/core/auth.js
// Authentification, session et contrôle d'accès — articles 9 et 10.
// Gère l'ouverture de session, le verrouillage automatique, la politique de
// mots de passe, le blocage après échecs répétés et la double authentification
// par code à usage unique (TOTP).

import {
  hashPassword, verifyPassword, evaluerMotDePasse, genererMotDePasseTemporaire,
  genererSecret, sha256,
  genererCleDonnees, envelopperCleDonnees, ouvrirCleDonnees, oublierClesImportees,
} from "./crypto.js";
import {
  lire, lireTout, ecrire, tracer, definirContexte, reinitialiserContexte,
} from "./store.js";
import { ROLES, hasPermission, nouvelId, VALIDATEURS } from "./model.js";

/* ===================== Politique de sécurité ===================== */

export const POLITIQUE = {
  tentativesMax: 5,              // échecs avant blocage temporaire
  dureeBlocageMinutes: 15,
  dureeSessionMinutes: 480,      // 8 heures
  verrouillageInactiviteMinutes: 15,
  expirationMotDePasseJours: 180,
  historiqueMotsDePasse: 5,      // interdit de réutiliser les 5 derniers
  longueurMinimale: 8,
};

/* ===================== État de session ===================== */

let session = null;
let minuteurInactivite = null;
const auditeurs = new Set(); // abonnés aux changements d'état de session

export function surChangementSession(fn) {
  auditeurs.add(fn);
  return () => auditeurs.delete(fn);
}

function notifier(evenement) {
  for (const fn of auditeurs) {
    try { fn(evenement, session); } catch (e) { console.error(e); }
  }
}

export function sessionCourante() { return session ? { ...session } : null; }
export function estConnecte() { return !!session && !session.verrouillee; }
export function utilisateurCourant() { return session?.utilisateur ?? null; }

/* ===================== Création du premier compte ===================== */

// À la première ouverture, la Solution ne contient aucun utilisateur.
// On crée alors l'établissement et son administrateur.
export async function besoinInitialisation() {
  const utilisateurs = await lireTout("utilisateurs");
  return utilisateurs.length === 0;
}

export async function initialiser({ etablissement, administrateur }) {
  if (!(await besoinInitialisation())) {
    throw new Error("La Solution est déjà initialisée.");
  }
  const force = evaluerMotDePasse(administrateur.motDePasse);
  if (!force.acceptable) throw new Error(force.conseil);

  const ets = {
    id: nouvelId("ets"),
    code: (etablissement.code || "ETS01").toUpperCase(),
    nom: etablissement.nom,
    type: etablissement.type || "hopital",
    adresse: etablissement.adresse || "",
    ville: etablissement.ville || "",
    pays: etablissement.pays || "",
    telephone: etablissement.telephone || "",
    email: etablissement.email || "",
    responsable: `${administrateur.prenom} ${administrateur.nom}`,
    modules: {
      laboratoire: true, consultations: true, pharmacie: true,
      facturation: etablissement.facturation ?? false,
      portailPatient: etablissement.portailPatient ?? true,
      analyses: true,
    },
    actif: true,
    dateCreation: new Date().toISOString(),
  };
  await ecrire("etablissements", ets);

  // Clé de chiffrement des champs sensibles, propre à l'établissement.
  // Tirée au hasard, jamais stockée en clair : elle est enveloppée avec une
  // clé dérivée du mot de passe de chaque utilisateur autorisé.
  const cleDonnees = genererCleDonnees();
  const empreinte = await hashPassword(administrateur.motDePasse);
  const admin = {
    id: nouvelId("usr"),
    identifiant: administrateur.identifiant.trim().toLowerCase(),
    nom: administrateur.nom,
    prenom: administrateur.prenom,
    email: administrateur.email || "",
    telephone: administrateur.telephone || "",
    role: "admin_etablissement",
    service: "Administration",
    etablissementId: ets.id,
    motDePasse: empreinte,
    historiqueMotsDePasse: [empreinte.hash],
    dateChangementMotDePasse: new Date().toISOString(),
    actif: true,
    tentativesEchouees: 0,
    dateCreation: new Date().toISOString(),
    cleEnveloppe: await envelopperCleDonnees(cleDonnees, administrateur.motDePasse, empreinte.salt),
  };
  await ecrire("utilisateurs", admin);

  // Secret d'anonymisation propre à l'établissement, pour les exports de recherche
  await ecrire("parametres", {
    cle: "selAnonymisation", valeur: genererSecret(32), date: new Date().toISOString(),
  });

  definirContexte({ utilisateur: admin, etablissementId: ets.id });
  await tracer("parametrage", "etablissement", ets.id,
    `Initialisation de la Solution pour « ${ets.nom} »`);
  reinitialiserContexte();
  return { etablissement: ets, administrateur: admin };
}


// Ouvre la clé de données de l'établissement à partir du mot de passe.
//
// Les bases créées avant l'introduction du chiffrement enveloppe ne portent
// pas d'enveloppe : leurs champs sensibles ont été chiffrés avec une clé
// propre à l'utilisateur. On la reconstitue à l'identique et on l'adopte
// comme clé de l'établissement, puis on l'enveloppe. Les dossiers déjà
// saisis restent lisibles, et les utilisateurs créés ensuite les liront
// aussi. Ce chemin ne sert qu'une fois par compte.
async function ouvrirCleDeSession(u, motDePasse) {
  if (u.cleEnveloppe) {
    return { cleSession: await ouvrirCleDonnees(u.cleEnveloppe, motDePasse, u.motDePasse.salt) };
  }
  const heritee = await sha256(`${motDePasse}|${u.id}|${u.motDePasse.salt}`);
  return {
    cleSession: heritee,
    enveloppeAMettreAJour: await envelopperCleDonnees(heritee, motDePasse, u.motDePasse.salt),
  };
}

/* ===================== Ouverture de session ===================== */

export async function connexion(identifiant, motDePasse, { codeTOTP = null } = {}) {
  const id = String(identifiant || "").trim().toLowerCase();
  const utilisateurs = await lireTout("utilisateurs");
  const u = utilisateurs.find(x => x.identifiant === id);

  // Message identique que le compte existe ou non : ne pas révéler quels
  // identifiants sont valides (énumération de comptes).
  const echec = async (motif) => {
    definirContexte({ utilisateur: { id: u?.id || "inconnu", nom: id, role: null } });
    await tracer("connexion_echec", "utilisateur", u?.id || null, motif);
    reinitialiserContexte();
    throw new Error("Identifiant ou mot de passe incorrect.");
  };

  if (!u) return echec("Identifiant inconnu");
  if (!u.actif) {
    definirContexte({ utilisateur: u, etablissementId: u.etablissementId });
    await tracer("connexion_echec", "utilisateur", u.id, "Compte désactivé");
    reinitialiserContexte();
    throw new Error("Ce compte est désactivé. Contactez l'administrateur de votre établissement.");
  }

  // Blocage temporaire après échecs répétés
  if (u.bloqueJusqua && new Date(u.bloqueJusqua) > new Date()) {
    const reste = Math.ceil((new Date(u.bloqueJusqua) - new Date()) / 60000);
    throw new Error(`Compte temporairement bloqué après plusieurs échecs. Réessayez dans ${reste} minute(s).`);
  }

  const valide = await verifyPassword(motDePasse, u.motDePasse);
  if (!valide) {
    const tentatives = (u.tentativesEchouees || 0) + 1;
    const maj = { ...u, tentativesEchouees: tentatives };
    if (tentatives >= POLITIQUE.tentativesMax) {
      maj.bloqueJusqua = new Date(Date.now() + POLITIQUE.dureeBlocageMinutes * 60000).toISOString();
      maj.tentativesEchouees = 0;
    }
    await ecrire("utilisateurs", maj);
    return echec(`Mot de passe incorrect (tentative ${tentatives}/${POLITIQUE.tentativesMax})`);
  }

  // Double authentification, si elle est activée pour ce compte
  if (u.totpSecret) {
    if (!codeTOTP) {
      const err = new Error("Code de vérification requis.");
      err.code = "TOTP_REQUIS";
      throw err;
    }
    if (!(await verifierTOTP(u.totpSecret, codeTOTP))) {
      return echec("Code de vérification incorrect");
    }
  }

  const etablissement = await lire("etablissements", u.etablissementId);

  // La clé de chiffrement des dossiers est celle de l'établissement : elle
  // est ouverte avec le mot de passe, jamais stockée en clair, et disparaît
  // à la fermeture de session. C'est ce qui permet à un biologiste de relire
  // le dossier saisi par un médecin.
  const { cleSession, enveloppeAMettreAJour } =
    await ouvrirCleDeSession(u, motDePasse);

  await ecrire("utilisateurs", {
    ...u, tentativesEchouees: 0, bloqueJusqua: null,
    derniereConnexion: new Date().toISOString(),
    ...(enveloppeAMettreAJour ? { cleEnveloppe: enveloppeAMettreAJour } : {}),
  });

  session = {
    utilisateur: {
      id: u.id, identifiant: u.identifiant, nom: u.nom, prenom: u.prenom,
      email: u.email, role: u.role, service: u.service,
      etablissementId: u.etablissementId,
    },
    etablissement,
    debut: new Date().toISOString(),
    expiration: new Date(Date.now() + POLITIQUE.dureeSessionMinutes * 60000).toISOString(),
    verrouillee: false,
    cleSession,
  };

  definirContexte({
    utilisateur: session.utilisateur,
    etablissementId: u.etablissementId,
    cleSession,
  });
  await tracer("connexion", "utilisateur", u.id,
    `Connexion de ${u.prenom} ${u.nom} (${ROLES[u.role]?.label || u.role})`);

  armerInactivite();
  notifier("connexion");

  // Avertissement d'expiration du mot de passe
  const avertissements = [];
  if (u.dateChangementMotDePasse) {
    const jours = (Date.now() - new Date(u.dateChangementMotDePasse)) / 86400000;
    if (jours > POLITIQUE.expirationMotDePasseJours) {
      avertissements.push("Votre mot de passe a expiré : il doit être changé.");
    } else if (jours > POLITIQUE.expirationMotDePasseJours - 15) {
      avertissements.push(
        `Votre mot de passe expire dans ${Math.ceil(POLITIQUE.expirationMotDePasseJours - jours)} jour(s).`);
    }
  }
  if (u.motDePasseTemporaire) {
    avertissements.push("Vous utilisez un mot de passe temporaire : changez-le sans délai.");
  }

  return { session: sessionCourante(), avertissements };
}

export async function deconnexion() {
  if (session) {
    await tracer("deconnexion", "utilisateur", session.utilisateur.id, "Fermeture de session");
  }
  session = null;
  reinitialiserContexte();
  if (minuteurInactivite) { clearTimeout(minuteurInactivite); minuteurInactivite = null; }
  notifier("deconnexion");
}

/* ===================== Verrouillage automatique ===================== */

// Verrouille l'écran après une période d'inactivité : indispensable sur un
// poste partagé en service, où l'écran reste souvent ouvert.
function armerInactivite() {
  if (minuteurInactivite) clearTimeout(minuteurInactivite);
  if (!session) return;
  minuteurInactivite = setTimeout(() => {
    verrouiller("Verrouillage automatique après inactivité");
  }, POLITIQUE.verrouillageInactiviteMinutes * 60000);
}

export function signalerActivite() {
  if (session && !session.verrouillee) armerInactivite();
}

export function verrouiller(motif = "Verrouillage manuel") {
  if (!session) return;
  session.verrouillee = true;
  session.motifVerrouillage = motif;
  // La clé de chiffrement est effacée de la mémoire pendant le verrouillage
  definirContexte({ cleSession: null });
  // La clé importée ne doit pas survivre à la session : on la retire de la
  // mémoire en même temps que le contexte.
  oublierClesImportees();
  notifier("verrouillage");
}

export async function deverrouiller(motDePasse) {
  if (!session) throw new Error("Aucune session à déverrouiller.");
  const u = await lire("utilisateurs", session.utilisateur.id);
  if (!(await verifyPassword(motDePasse, u.motDePasse))) {
    await tracer("connexion_echec", "utilisateur", u.id, "Déverrouillage refusé");
    throw new Error("Mot de passe incorrect.");
  }
  const { cleSession } = await ouvrirCleDeSession(u, motDePasse);
  session.verrouillee = false;
  session.cleSession = cleSession;
  definirContexte({ utilisateur: session.utilisateur, etablissementId: u.etablissementId, cleSession });
  armerInactivite();
  notifier("deverrouillage");
  return true;
}

/* ===================== Gestion des mots de passe ===================== */

export async function changerMotDePasse(ancien, nouveau) {
  if (!session) throw new Error("Aucune session ouverte.");
  const u = await lire("utilisateurs", session.utilisateur.id);
  if (!(await verifyPassword(ancien, u.motDePasse))) {
    await tracer("connexion_echec", "utilisateur", u.id, "Changement de mot de passe refusé");
    throw new Error("Le mot de passe actuel est incorrect.");
  }
  const force = evaluerMotDePasse(nouveau);
  if (!force.acceptable) throw new Error(force.conseil);
  if (nouveau === ancien) throw new Error("Le nouveau mot de passe doit différer de l'ancien.");

  // Interdiction de réutiliser un mot de passe récent
  for (const ancienHash of (u.historiqueMotsDePasse || [])) {
    if (await verifyPassword(nouveau, { hash: ancienHash, salt: u.motDePasse.salt })) {
      throw new Error(
        `Ce mot de passe a déjà été utilisé. Les ${POLITIQUE.historiqueMotsDePasse} derniers sont interdits.`);
    }
  }

  const empreinte = await hashPassword(nouveau);
  const historique = [empreinte.hash, ...(u.historiqueMotsDePasse || [])]
    .slice(0, POLITIQUE.historiqueMotsDePasse);

  // La clé de chiffrement des dossiers ne change PAS : seule son enveloppe
  // est refaite avec le nouveau mot de passe. Changer la clé rendrait
  // illisibles tous les dossiers déjà saisis — un changement de mot de passe
  // ne doit jamais faire disparaître une allergie d'un dossier.
  const cleSession = session.cleSession
    || (await ouvrirCleDeSession(u, ancien)).cleSession;

  await ecrire("utilisateurs", {
    ...u, motDePasse: empreinte, historiqueMotsDePasse: historique,
    dateChangementMotDePasse: new Date().toISOString(),
    motDePasseTemporaire: false,
    cleEnveloppe: await envelopperCleDonnees(cleSession, nouveau, empreinte.salt),
  });

  session.cleSession = cleSession;
  definirContexte({ cleSession });

  await tracer("parametrage", "utilisateur", u.id, "Changement de mot de passe");
  return true;
}

// Réinitialisation par un administrateur : produit un mot de passe temporaire
export async function reinitialiserMotDePasse(utilisateurId) {
  const moi = utilisateurCourant();
  if (!moi || !hasPermission(moi.role, "utilisateur", "administration")) {
    throw new Error("Seul un administrateur peut réinitialiser un mot de passe.");
  }
  const u = await lire("utilisateurs", utilisateurId);
  if (!u) throw new Error("Utilisateur introuvable.");
  const temporaire = genererMotDePasseTemporaire(12);
  const empreinte = await hashPassword(temporaire);
  // L'administrateur ré-enveloppe la clé de l'établissement — celle de sa
  // propre session — avec le mot de passe temporaire. L'utilisateur retrouve
  // donc l'accès aux dossiers après réinitialisation. Sans cela, oublier son
  // mot de passe reviendrait à perdre l'accès aux dossiers de l'équipe.
  if (!session?.cleSession) {
    throw new Error("Session administrateur incomplète : reconnectez-vous avant de réinitialiser un mot de passe.");
  }
  await ecrire("utilisateurs", {
    ...u, motDePasse: empreinte, motDePasseTemporaire: true,
    dateChangementMotDePasse: new Date().toISOString(),
    tentativesEchouees: 0, bloqueJusqua: null,
    cleEnveloppe: await envelopperCleDonnees(session.cleSession, temporaire, empreinte.salt),
  });
  await tracer("changement_droits", "utilisateur", utilisateurId,
    `Réinitialisation du mot de passe de ${u.prenom} ${u.nom}`);
  // Le mot de passe temporaire n'est affiché qu'une fois, à l'administrateur.
  return {
    motDePasseTemporaire: temporaire,
    avertissement: "Communiquez ce mot de passe à l'utilisateur par un canal sûr. " +
      "Il devra le changer à sa première connexion.",
  };
}

/* ===================== Gestion des utilisateurs ===================== */

export async function creerUtilisateur(donnees) {
  const moi = utilisateurCourant();
  if (!moi || !hasPermission(moi.role, "utilisateur", "creation")) {
    throw new Error("Vous n'êtes pas autorisé à créer un utilisateur.");
  }
  const erreurs = VALIDATEURS.utilisateur(donnees);
  if (erreurs.length) throw new Error(erreurs.join(" "));

  // Un administrateur d'établissement ne peut pas créer d'administrateur système
  if (donnees.role === "admin_systeme" && moi.role !== "admin_systeme") {
    throw new Error("Seul un administrateur système peut créer un compte de ce niveau.");
  }

  const utilisateurs = await lireTout("utilisateurs");
  const identifiant = donnees.identifiant.trim().toLowerCase();
  if (utilisateurs.some(u => u.identifiant === identifiant)) {
    throw new Error(`L'identifiant « ${identifiant} » est déjà utilisé.`);
  }

  const temporaire = donnees.motDePasse || genererMotDePasseTemporaire(12);
  const empreinte = await hashPassword(temporaire);
  // Le nouveau compte reçoit la clé de l'établissement, enveloppée avec son
  // mot de passe initial. C'est ce qui lui donne accès aux dossiers déjà
  // saisis par ses collègues — et sans quoi il ouvrirait des dossiers vides.
  if (!session?.cleSession) {
    throw new Error("Session incomplète : reconnectez-vous avant de créer un utilisateur.");
  }
  const u = {
    id: nouvelId("usr"),
    identifiant,
    nom: donnees.nom, prenom: donnees.prenom || "",
    email: donnees.email || "", telephone: donnees.telephone || "",
    role: donnees.role,
    service: donnees.service || "",
    etablissementId: donnees.etablissementId || moi.etablissementId,
    motDePasse: empreinte,
    motDePasseTemporaire: !donnees.motDePasse,
    historiqueMotsDePasse: [empreinte.hash],
    dateChangementMotDePasse: new Date().toISOString(),
    actif: true, tentativesEchouees: 0,
    dateCreation: new Date().toISOString(),
    creePar: moi.id,
    cleEnveloppe: await envelopperCleDonnees(session.cleSession, temporaire, empreinte.salt),
  };
  await ecrire("utilisateurs", u);
  await tracer("creation", "utilisateur", u.id,
    `Création du compte ${identifiant} (${ROLES[donnees.role]?.label})`);
  return { utilisateur: u, motDePasseTemporaire: donnees.motDePasse ? null : temporaire };
}

export async function modifierRole(utilisateurId, nouveauRole) {
  const moi = utilisateurCourant();
  if (!moi || !hasPermission(moi.role, "utilisateur", "administration")) {
    throw new Error("Vous n'êtes pas autorisé à modifier les droits d'un utilisateur.");
  }
  if (!ROLES[nouveauRole]) throw new Error("Rôle inconnu.");
  if (nouveauRole === "admin_systeme" && moi.role !== "admin_systeme") {
    throw new Error("Seul un administrateur système peut attribuer ce rôle.");
  }
  if (utilisateurId === moi.id) {
    throw new Error("Vous ne pouvez pas modifier votre propre rôle. " +
      "Demandez à un autre administrateur de le faire.");
  }
  const u = await lire("utilisateurs", utilisateurId);
  if (!u) throw new Error("Utilisateur introuvable.");
  const ancien = u.role;
  await ecrire("utilisateurs", { ...u, role: nouveauRole });
  // Le changement de droits est l'un des événements les plus sensibles :
  // il est tracé avec l'ancien et le nouveau rôle.
  await tracer("changement_droits", "utilisateur", utilisateurId,
    `Rôle modifié : ${ROLES[ancien]?.label || ancien} → ${ROLES[nouveauRole].label}`,
    { avant: { role: ancien }, apres: { role: nouveauRole } });
  return true;
}

export async function activerUtilisateur(utilisateurId, actif) {
  const moi = utilisateurCourant();
  if (!moi || !hasPermission(moi.role, "utilisateur", "administration")) {
    throw new Error("Vous n'êtes pas autorisé à effectuer cette opération.");
  }
  if (utilisateurId === moi.id && !actif) {
    throw new Error("Vous ne pouvez pas désactiver votre propre compte.");
  }
  const u = await lire("utilisateurs", utilisateurId);
  if (!u) throw new Error("Utilisateur introuvable.");
  // Le dernier administrateur actif ne doit jamais être désactivé :
  // l'établissement deviendrait inadministrable.
  if (!actif) {
    const tous = await lireTout("utilisateurs");
    const admins = tous.filter(x =>
      x.etablissementId === u.etablissementId && x.actif &&
      ["admin_etablissement", "admin_systeme"].includes(x.role) && x.id !== utilisateurId);
    if (!admins.length && ["admin_etablissement", "admin_systeme"].includes(u.role)) {
      throw new Error("Impossible : cet établissement n'aurait plus aucun administrateur actif.");
    }
  }
  await ecrire("utilisateurs", { ...u, actif });
  await tracer("changement_droits", "utilisateur", utilisateurId,
    actif ? "Compte réactivé" : "Compte désactivé");
  return true;
}

/* ===================== Double authentification (TOTP) ===================== */

// Implémentation de la RFC 6238 (codes à 6 chiffres, fenêtre de 30 secondes),
// compatible avec Google Authenticator, FreeOTP et Aegis.
export function genererSecretTOTP() {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return base32Encoder(bytes);
}

function base32Encoder(bytes) {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0, valeur = 0, sortie = "";
  for (const b of bytes) {
    valeur = (valeur << 8) | b; bits += 8;
    while (bits >= 5) { sortie += A[(valeur >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) sortie += A[(valeur << (5 - bits)) & 31];
  return sortie;
}

function base32Decodeur(s) {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0, valeur = 0;
  const out = [];
  for (const c of s.toUpperCase().replace(/=+$/, "")) {
    const idx = A.indexOf(c);
    if (idx === -1) continue;
    valeur = (valeur << 5) | idx; bits += 5;
    if (bits >= 8) { out.push((valeur >>> (bits - 8)) & 255); bits -= 8; }
  }
  return new Uint8Array(out);
}

export async function calculerTOTP(secretBase32, compteur = null) {
  const pas = compteur ?? Math.floor(Date.now() / 30000);
  const cle = base32Decodeur(secretBase32);
  const message = new Uint8Array(8);
  let n = pas;
  for (let i = 7; i >= 0; i--) { message[i] = n & 0xff; n = Math.floor(n / 256); }
  const k = await crypto.subtle.importKey(
    "raw", cle, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", k, message));
  const offset = sig[19] & 0xf;
  const code = ((sig[offset] & 0x7f) << 24 | sig[offset + 1] << 16 |
    sig[offset + 2] << 8 | sig[offset + 3]) % 1000000;
  return String(code).padStart(6, "0");
}

// Tolérance d'une fenêtre avant et après, pour absorber les décalages d'horloge
export async function verifierTOTP(secret, code) {
  const maintenant = Math.floor(Date.now() / 30000);
  for (const decalage of [-1, 0, 1]) {
    if (await calculerTOTP(secret, maintenant + decalage) === String(code).trim()) return true;
  }
  return false;
}

export async function activerTOTP(codeVerification, secret) {
  if (!session) throw new Error("Aucune session ouverte.");
  if (!(await verifierTOTP(secret, codeVerification))) {
    throw new Error("Code incorrect : vérifiez l'heure de votre appareil et réessayez.");
  }
  const u = await lire("utilisateurs", session.utilisateur.id);
  await ecrire("utilisateurs", { ...u, totpSecret: secret });
  await tracer("parametrage", "utilisateur", u.id, "Activation de la double authentification");
  return true;
}

export function urlTOTP(secret, identifiant, etablissement) {
  const label = encodeURIComponent(`MediStat:${identifiant}`);
  const issuer = encodeURIComponent(etablissement || "MediStat");
  return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}

/* ===================== Garde d'interface ===================== */

// Utilisé par l'interface pour masquer ou désactiver ce qui n'est pas permis
export function autorise(ressource, droit) {
  const u = utilisateurCourant();
  return !!u && hasPermission(u.role, ressource, droit);
}

// Vérifie la validité de la session à chaque action sensible
export function sessionValide() {
  if (!session) return { valide: false, motif: "Aucune session ouverte." };
  if (session.verrouillee) return { valide: false, motif: "Session verrouillée." };
  if (new Date(session.expiration) < new Date()) {
    return { valide: false, motif: "Session expirée : reconnectez-vous." };
  }
  return { valide: true };
}
