// medistat/js/core/model.js
// Modèle de données de la Solution — entités de l'article 17 du cahier des
// charges, rôles et permissions des articles 5 et 10.
// Ce fichier est la référence unique du schéma : il est partagé par le client
// hors ligne (IndexedDB) et par le serveur (SQLite), afin qu'aucune divergence
// ne puisse s'installer entre les deux.

/* ===================== Entités (article 17) ===================== */

export const ENTITIES = {
  etablissement: {
    label: "Établissement", plural: "Établissements", icon: "🏥",
    description: "Structure de santé exploitant la Solution (tenant)",
    fields: ["code", "nom", "type", "adresse", "ville", "pays", "telephone",
      "email", "responsable", "modules", "actif"],
  },
  utilisateur: {
    label: "Utilisateur", plural: "Utilisateurs", icon: "👤",
    description: "Compte d'accès à la Solution",
    fields: ["identifiant", "nom", "prenom", "email", "telephone", "role",
      "service", "etablissementId", "actif", "derniereConnexion"],
  },
  patient: {
    label: "Patient", plural: "Patients", icon: "🧑‍⚕️",
    description: "Identité et informations administratives et cliniques",
    fields: ["ipp", "nom", "prenom", "dateNaissance", "sexe", "telephone",
      "email", "adresse", "ville", "groupeSanguin", "antecedents", "allergies",
      "contactUrgence", "assurance", "archive"],
  },
  consultation: {
    label: "Consultation", plural: "Consultations", icon: "🩺",
    description: "Épisode de soins rattaché à un patient",
    fields: ["patientId", "date", "medecinId", "service", "motif", "symptomes",
      "constantes", "examenClinique", "diagnostic", "cim10", "conduite", "statut"],
  },
  prescription: {
    label: "Prescription", plural: "Prescriptions", icon: "💊",
    description: "Actes, médicaments ou examens prescrits",
    fields: ["consultationId", "patientId", "date", "prescripteurId", "type",
      "libelle", "posologie", "duree", "statut", "delivrePar", "dateDelivrance"],
  },
  testCatalogue: {
    label: "Test de laboratoire", plural: "Catalogue des tests", icon: "🧪",
    description: "Type d'examen référencé au catalogue",
    fields: ["code", "loinc", "nom", "categorie", "unite", "type", "valeurRefMin",
      "valeurRefMax", "seuilCritiqueMin", "seuilCritiqueMax", "delaiRenduHeures",
      "prix", "methode", "actif"],
  },
  demande: {
    label: "Demande d'examen", plural: "Demandes de laboratoire", icon: "📋",
    description: "Demande d'analyse adressée au laboratoire",
    fields: ["numero", "patientId", "consultationId", "prescripteurId", "date",
      "urgence", "tests", "statut", "laboratoireId", "technicienId", "commentaire"],
  },
  echantillon: {
    label: "Échantillon", plural: "Échantillons", icon: "🩸",
    description: "Prélèvement biologique associé à une demande",
    fields: ["codeBarre", "demandeId", "patientId", "type", "datePrelevement",
      "preleveurId", "dateReception", "receptionnisteId", "statut",
      "conformite", "motifNonConformite", "volume", "conservation"],
  },
  resultat: {
    label: "Résultat", plural: "Résultats", icon: "📊",
    description: "Donnée produite et validée pour un test",
    fields: ["demandeId", "echantillonId", "patientId", "testCode", "valeur",
      "valeurTexte", "unite", "interpretation", "horsNorme", "critique",
      "saisiPar", "dateSaisie", "validePar", "dateValidation", "signature",
      "statut", "commentaireBiologiste", "anterieur", "delta", "version"],
  },
  document: {
    label: "Document", plural: "Documents", icon: "📎",
    description: "Fichier joint (PDF, image, scan) rattaché à une entité",
    fields: ["nom", "type", "mime", "taille", "entite", "entiteId", "patientId",
      "deposePar", "dateDepot", "contenu", "chiffre", "empreinte", "archive"],
  },
  facture: {
    label: "Facture", plural: "Facturation", icon: "💶",
    description: "Document financier (si le module de facturation est activé)",
    fields: ["numero", "patientId", "date", "lignes", "montantHT", "montantTTC",
      "remise", "assurance", "partPatient", "statut", "datePaiement", "modePaiement"],
  },
  notification: {
    label: "Notification", plural: "Notifications", icon: "🔔",
    description: "Message émis vers un utilisateur ou un patient",
    fields: ["destinataireType", "destinataireId", "canal", "sujet", "message",
      "priorite", "entite", "entiteId", "date", "lue", "dateLecture", "envoyee"],
  },
  audit: {
    label: "Audit", plural: "Journal d'audit", icon: "🛡️",
    description: "Enregistrement horodaté d'une action tracée",
    fields: ["date", "utilisateurId", "utilisateurNom", "role", "action",
      "entite", "entiteId", "details", "avant", "apres", "ip", "appareil",
      "etablissementId", "empreinte", "empreintePrecedente"],
  },
  rendezVous: {
    label: "Rendez-vous", plural: "Rendez-vous", icon: "📅",
    description: "Rendez-vous de consultation ou de prélèvement",
    fields: ["patientId", "date", "heure", "duree", "type", "praticienId",
      "service", "motif", "statut", "rappelEnvoye"],
  },
};

/* ===================== Rôles (article 5) ===================== */

// Chaque rôle porte un périmètre fonctionnel et un ensemble de permissions.
// Les permissions suivent la nomenclature de l'article 10 :
// lecture, creation, modification, validation, suppression, export,
// administration, signature, resultatsSensibles.
export const ROLES = {
  admin_systeme: {
    label: "Administrateur système",
    description: "Configuration technique globale de la plateforme et paramètres SaaS communs.",
    niveau: 100,
    permissions: ["*"], // tous droits, sur tous les établissements
    multiEtablissement: true,
  },
  admin_etablissement: {
    label: "Administrateur d'établissement",
    description: "Paramétrage et gestion des utilisateurs au niveau d'un établissement.",
    niveau: 90,
    permissions: [
      "patient:*", "consultation:*", "prescription:*", "demande:*",
      "echantillon:*", "resultat:lecture", "resultat:export",
      "document:*", "utilisateur:*", "testCatalogue:*", "facture:*",
      "rendezVous:*", "notification:*", "audit:lecture", "audit:export",
      "etablissement:lecture", "etablissement:modification",
      "statistiques:*", "analyse:*",
    ],
  },
  medecin: {
    label: "Médecin",
    description: "Consultation des dossiers, prescription d'examens et consultation des résultats.",
    niveau: 70,
    permissions: [
      "patient:lecture", "patient:creation", "patient:modification",
      "consultation:*", "prescription:*",
      "demande:lecture", "demande:creation", "demande:modification",
      "resultat:lecture", "resultat:export", "resultat:resultatsSensibles",
      "document:lecture", "document:creation",
      "rendezVous:lecture", "rendezVous:creation",
      "statistiques:lecture", "analyse:*", "notification:lecture",
    ],
  },
  infirmier: {
    label: "Infirmier",
    description: "Appui aux consultations, saisie de constantes et suivi des prélèvements.",
    niveau: 50,
    permissions: [
      "patient:lecture", "patient:creation", "patient:modification",
      "consultation:lecture", "consultation:modification",
      "prescription:lecture",
      "demande:lecture", "demande:creation",
      "echantillon:lecture", "echantillon:creation", "echantillon:modification",
      "resultat:lecture",
      "document:lecture", "document:creation",
      "rendezVous:*", "notification:lecture",
    ],
  },
  laborantin: {
    label: "Laborantin",
    description: "Saisie et soumission des résultats de laboratoire.",
    niveau: 55,
    permissions: [
      "patient:lecture",
      "demande:lecture", "demande:modification",
      "echantillon:*",
      "resultat:lecture", "resultat:creation", "resultat:modification",
      "testCatalogue:lecture",
      "document:lecture", "document:creation",
      "statistiques:lecture", "notification:lecture",
    ],
  },
  biologiste: {
    label: "Biologiste",
    description: "Validation et signature des résultats de laboratoire.",
    niveau: 80,
    permissions: [
      "patient:lecture",
      "demande:*", "echantillon:*",
      "resultat:*", "resultat:validation", "resultat:signature",
      "resultat:resultatsSensibles",
      "testCatalogue:*",
      "document:lecture", "document:creation", "document:export",
      "statistiques:*", "analyse:*", "audit:lecture", "notification:*",
    ],
  },
  receptionniste: {
    label: "Réceptionniste",
    description: "Gestion administrative des patients et des rendez-vous.",
    niveau: 30,
    permissions: [
      "patient:lecture", "patient:creation", "patient:modification",
      "consultation:lecture", "consultation:creation",
      "demande:lecture", "demande:creation",
      "rendezVous:*", "facture:lecture", "facture:creation",
      "document:lecture", "notification:lecture",
    ],
  },
  pharmacien: {
    label: "Pharmacien",
    description: "Consultation des prescriptions et gestion des délivrances.",
    niveau: 50,
    permissions: [
      "patient:lecture",
      "prescription:lecture", "prescription:modification", "prescription:validation",
      "document:lecture", "statistiques:lecture", "notification:lecture",
    ],
  },
  qualite: {
    label: "Responsable qualité",
    description: "Supervision de l'audit trail et des indicateurs de conformité.",
    niveau: 75,
    permissions: [
      "patient:lecture", "consultation:lecture", "demande:lecture",
      "echantillon:lecture", "resultat:lecture",
      "audit:lecture", "audit:export",
      "statistiques:*", "analyse:*",
      "document:lecture", "testCatalogue:lecture", "notification:lecture",
    ],
  },
  comptable: {
    label: "Comptable / facturation",
    description: "Gestion des aspects financiers, si le module de facturation est activé.",
    niveau: 40,
    permissions: [
      "patient:lecture",
      "facture:*", "statistiques:lecture", "analyse:lecture",
      "document:lecture", "notification:lecture",
    ],
  },
  patient: {
    label: "Patient",
    description: "Consultation de ses propres données via le portail patient.",
    niveau: 10,
    permissions: ["portail:lecture", "portail:export"],
    portailSeulement: true,
  },
};

// Droits élémentaires de l'article 10
export const DROITS = [
  { code: "lecture", label: "Lecture" },
  { code: "creation", label: "Création" },
  { code: "modification", label: "Modification" },
  { code: "validation", label: "Validation" },
  { code: "suppression", label: "Suppression" },
  { code: "export", label: "Export" },
  { code: "administration", label: "Administration" },
  { code: "signature", label: "Signature" },
  { code: "resultatsSensibles", label: "Accès aux résultats sensibles" },
];

/* ===================== Contrôle des permissions ===================== */

// Vérifie qu'un rôle dispose d'un droit donné sur une ressource.
// Format des permissions : "ressource:droit", avec « * » comme joker.
export function hasPermission(role, resource, action) {
  const def = ROLES[role];
  if (!def) return false;
  const perms = def.permissions;
  if (perms.includes("*")) return true;
  if (perms.includes(`${resource}:*`)) return true;
  if (perms.includes(`${resource}:${action}`)) return true;
  if (perms.includes(`*:${action}`)) return true;
  return false;
}

// Liste lisible des permissions d'un rôle, pour l'écran d'administration
export function describePermissions(role) {
  const def = ROLES[role];
  if (!def) return [];
  if (def.permissions.includes("*")) {
    return Object.keys(ENTITIES).map(e => ({
      resource: e, label: ENTITIES[e].label, droits: DROITS.map(d => d.code),
    }));
  }
  const map = new Map();
  for (const p of def.permissions) {
    const [res, act] = p.split(":");
    if (!map.has(res)) map.set(res, new Set());
    if (act === "*") DROITS.forEach(d => map.get(res).add(d.code));
    else map.get(res).add(act);
  }
  return [...map.entries()].map(([resource, set]) => ({
    resource,
    label: ENTITIES[resource]?.label || resource,
    droits: [...set],
  }));
}

/* ===================== Cycle de vie (article 7.2) ===================== */

// Séquence imposée par le cahier des charges pour un examen de laboratoire
export const STATUTS_DEMANDE = {
  brouillon: { label: "Brouillon", couleur: "#94a3b8", ordre: 0 },
  enregistree: { label: "Enregistrée", couleur: "#3b82f6", ordre: 1 },
  prelevee: { label: "Prélevée", couleur: "#8b5cf6", ordre: 2 },
  receptionnee: { label: "Réceptionnée au laboratoire", couleur: "#6366f1", ordre: 3 },
  en_analyse: { label: "En cours d'analyse", couleur: "#f59e0b", ordre: 4 },
  saisie: { label: "Résultats saisis", couleur: "#eab308", ordre: 5 },
  validee: { label: "Validée", couleur: "#22c55e", ordre: 6 },
  rendue: { label: "Rendue au dossier patient", couleur: "#16a34a", ordre: 7 },
  annulee: { label: "Annulée", couleur: "#ef4444", ordre: -1 },
};

// Transitions autorisées : toute autre transition est refusée et tracée
export const TRANSITIONS = {
  brouillon: ["enregistree", "annulee"],
  enregistree: ["prelevee", "annulee"],
  prelevee: ["receptionnee", "annulee"],
  receptionnee: ["en_analyse", "annulee"],
  en_analyse: ["saisie", "annulee"],
  saisie: ["validee", "en_analyse", "annulee"],
  validee: ["rendue", "en_analyse"], // retour possible : correction sous audit
  rendue: ["en_analyse"],            // correction d'un résultat déjà rendu
  annulee: [],
};

export function transitionAutorisee(de, vers) {
  return (TRANSITIONS[de] || []).includes(vers);
}

// Droit requis pour opérer une transition donnée
export const DROIT_TRANSITION = {
  enregistree: "demande:creation",
  prelevee: "echantillon:creation",
  receptionnee: "echantillon:modification",
  en_analyse: "resultat:creation",
  saisie: "resultat:creation",
  validee: "resultat:validation",
  rendue: "resultat:validation",
  annulee: "demande:modification",
};

/* ===================== Statuts des résultats ===================== */

export const STATUTS_RESULTAT = {
  en_attente: { label: "En attente de saisie", couleur: "#94a3b8" },
  saisi: { label: "Saisi, en attente de validation", couleur: "#f59e0b" },
  valide: { label: "Validé", couleur: "#22c55e" },
  rendu: { label: "Rendu au patient", couleur: "#16a34a" },
  corrige: { label: "Corrigé (version antérieure remplacée)", couleur: "#f97316" },
  annule: { label: "Annulé", couleur: "#ef4444" },
};

/* ===================== Actions auditées (article 16) ===================== */

export const ACTIONS_AUDITEES = {
  connexion: "Connexion à la Solution",
  deconnexion: "Déconnexion",
  connexion_echec: "Tentative de connexion échouée",
  creation: "Création d'un enregistrement",
  modification: "Modification d'un enregistrement",
  suppression: "Suppression d'un enregistrement",
  consultation: "Consultation d'un dossier",
  validation: "Validation d'un résultat",
  signature: "Signature électronique d'un résultat",
  correction: "Correction d'un résultat validé",
  export: "Export de données",
  impression: "Impression d'un document",
  changement_droits: "Modification des droits d'un utilisateur",
  parametrage: "Modification d'un paramètre de la Solution",
  acces_refuse: "Tentative d'accès refusée",
  alerte_critique: "Émission d'une alerte sur valeur critique",
};

/* ===================== Types et référentiels ===================== */

export const TYPES_ECHANTILLON = [
  { code: "SANG", label: "Sang total", couleur: "#dc2626" },
  { code: "SERUM", label: "Sérum", couleur: "#f59e0b" },
  { code: "PLASMA", label: "Plasma", couleur: "#eab308" },
  { code: "URINE", label: "Urine", couleur: "#facc15" },
  { code: "SELLES", label: "Selles", couleur: "#a16207" },
  { code: "LCR", label: "Liquide céphalo-rachidien", couleur: "#06b6d4" },
  { code: "EXPECTO", label: "Expectoration", couleur: "#84cc16" },
  { code: "PRELEV", label: "Prélèvement local", couleur: "#8b5cf6" },
  { code: "AUTRE", label: "Autre", couleur: "#64748b" },
];

export const CATEGORIES_TESTS = [
  { code: "HEMATO", label: "Hématologie", icon: "🩸" },
  { code: "BIOCHIM", label: "Biochimie", icon: "⚗️" },
  { code: "MICROBIO", label: "Microbiologie", icon: "🦠" },
  { code: "SEROLOGIE", label: "Sérologie / Immunologie", icon: "🛡️" },
  { code: "PARASITO", label: "Parasitologie", icon: "🔬" },
  { code: "HORMONO", label: "Hormonologie", icon: "🧬" },
  { code: "COAG", label: "Hémostase / Coagulation", icon: "💧" },
  { code: "URINE", label: "Analyse d'urines", icon: "🧫" },
];

export const NIVEAUX_URGENCE = [
  { code: "routine", label: "Routine", delai: 24, couleur: "#22c55e" },
  { code: "urgent", label: "Urgent", delai: 4, couleur: "#f59e0b" },
  { code: "vital", label: "Urgence vitale", delai: 1, couleur: "#dc2626" },
];

/* ===================== Validation des données ===================== */

// Contrôles de cohérence appliqués avant tout enregistrement
export const VALIDATEURS = {
  patient(p) {
    const erreurs = [];
    if (!p.nom || !p.nom.trim()) erreurs.push("Le nom est obligatoire.");
    if (!p.prenom || !p.prenom.trim()) erreurs.push("Le prénom est obligatoire.");
    if (!p.dateNaissance) erreurs.push("La date de naissance est obligatoire.");
    else if (new Date(p.dateNaissance) > new Date())
      erreurs.push("La date de naissance ne peut être postérieure à aujourd'hui.");
    if (!["M", "F", "A"].includes(p.sexe)) erreurs.push("Le sexe doit être renseigné.");
    if (p.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.email))
      erreurs.push("L'adresse électronique est mal formée.");
    return erreurs;
  },
  testCatalogue(t) {
    const erreurs = [];
    if (!t.code || !t.code.trim()) erreurs.push("Le code du test est obligatoire.");
    if (!t.nom || !t.nom.trim()) erreurs.push("Le libellé du test est obligatoire.");
    if (!t.categorie) erreurs.push("La catégorie est obligatoire.");
    const min = Number(t.valeurRefMin), max = Number(t.valeurRefMax);
    if (Number.isFinite(min) && Number.isFinite(max) && min >= max)
      erreurs.push("La valeur de référence minimale doit être inférieure à la maximale.");
    const cMin = Number(t.seuilCritiqueMin), cMax = Number(t.seuilCritiqueMax);
    if (Number.isFinite(cMin) && Number.isFinite(min) && cMin > min)
      erreurs.push("Le seuil critique bas doit être inférieur à la valeur de référence basse.");
    if (Number.isFinite(cMax) && Number.isFinite(max) && cMax < max)
      erreurs.push("Le seuil critique haut doit être supérieur à la valeur de référence haute.");
    return erreurs;
  },
  resultat(r, test) {
    const erreurs = [];
    if (!r.testCode) erreurs.push("Le test est obligatoire.");
    const num = Number(String(r.valeur).replace(",", "."));
    if (test && test.type === "numerique") {
      if (r.valeur === "" || r.valeur === null || !Number.isFinite(num))
        erreurs.push("Une valeur numérique est attendue pour ce test.");
      else if (num < 0 && Number(test.valeurRefMin) >= 0)
        erreurs.push("Une valeur négative est improbable pour ce paramètre : vérifier la saisie.");
    }
    return erreurs;
  },
  utilisateur(u) {
    const erreurs = [];
    if (!u.identifiant || u.identifiant.trim().length < 3)
      erreurs.push("L'identifiant doit comporter au moins 3 caractères.");
    if (!u.nom || !u.nom.trim()) erreurs.push("Le nom est obligatoire.");
    if (!ROLES[u.role]) erreurs.push("Le rôle est invalide.");
    if (u.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(u.email))
      erreurs.push("L'adresse électronique est mal formée.");
    return erreurs;
  },
};

/* ===================== Interprétation biologique ===================== */

// Positionne une valeur par rapport aux normes et aux seuils d'alerte.
// C'est la fonction qui déclenche l'alerte sur valeur critique (article 7.3).
export function interpreterResultat(valeur, test) {
  const v = Number(String(valeur).replace(",", "."));
  if (!Number.isFinite(v) || !test) {
    return { statut: "non_evaluable", horsNorme: false, critique: false, label: "—" };
  }
  const min = Number(test.valeurRefMin), max = Number(test.valeurRefMax);
  const cMin = Number(test.seuilCritiqueMin), cMax = Number(test.seuilCritiqueMax);

  if (Number.isFinite(cMin) && v <= cMin) {
    return {
      statut: "critique_bas", horsNorme: true, critique: true,
      label: "Critique bas", symbole: "⚠︎↓", couleur: "#dc2626",
      message: `Valeur critique basse (${v} ≤ ${cMin} ${test.unite || ""}). Alerte immédiate au prescripteur requise.`,
    };
  }
  if (Number.isFinite(cMax) && v >= cMax) {
    return {
      statut: "critique_haut", horsNorme: true, critique: true,
      label: "Critique haut", symbole: "⚠︎↑", couleur: "#dc2626",
      message: `Valeur critique haute (${v} ≥ ${cMax} ${test.unite || ""}). Alerte immédiate au prescripteur requise.`,
    };
  }
  if (Number.isFinite(min) && v < min) {
    return {
      statut: "bas", horsNorme: true, critique: false,
      label: "Bas", symbole: "↓", couleur: "#f59e0b",
      message: `Inférieur à la valeur de référence (< ${min} ${test.unite || ""}).`,
      ecart: min ? ((v - min) / min) * 100 : null,
    };
  }
  if (Number.isFinite(max) && v > max) {
    return {
      statut: "haut", horsNorme: true, critique: false,
      label: "Élevé", symbole: "↑", couleur: "#f59e0b",
      message: `Supérieur à la valeur de référence (> ${max} ${test.unite || ""}).`,
      ecart: max ? ((v - max) / max) * 100 : null,
    };
  }
  return {
    statut: "normal", horsNorme: false, critique: false,
    label: "Normal", symbole: "✓", couleur: "#22c55e",
    message: "Valeur dans les limites de référence.",
  };
}

// Variation par rapport au dosage précédent (contrôle de vraisemblance)
export function calculerDelta(valeurActuelle, valeurAnterieure) {
  const a = Number(valeurActuelle), b = Number(valeurAnterieure);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return null;
  const variation = ((a - b) / Math.abs(b)) * 100;
  return {
    absolu: a - b,
    pourcentage: variation,
    sens: variation > 0 ? "hausse" : variation < 0 ? "baisse" : "stable",
    // Un écart supérieur à 50 % justifie une vérification avant validation
    aVerifier: Math.abs(variation) > 50,
  };
}

/* ===================== Identifiants ===================== */

// Identifiant unique : horodatage en base 36 + entropie cryptographique.
// Trié chronologiquement, ce qui simplifie la fusion des bases hors ligne.
export function nouvelId(prefixe = "") {
  const t = Date.now().toString(36);
  const bytes = new Uint8Array(8);
  (globalThis.crypto || {}).getRandomValues?.(bytes);
  const r = Array.from(bytes, b => b.toString(36).padStart(2, "0")).join("").slice(0, 10);
  return `${prefixe}${prefixe ? "_" : ""}${t}${r}`;
}

// Identifiant permanent du patient (IPP) : préfixe établissement + séquence
export function genererIPP(codeEtablissement, sequence) {
  const annee = new Date().getFullYear().toString().slice(-2);
  return `${(codeEtablissement || "ETS").toUpperCase().slice(0, 4)}${annee}${String(sequence).padStart(6, "0")}`;
}

// Numéro de demande : préfixe D + année + séquence
export function genererNumeroDemande(sequence, date = new Date()) {
  return `D${date.getFullYear()}${String(sequence).padStart(6, "0")}`;
}

// Code-barres d'échantillon avec clé de contrôle (modulo 10 de Luhn)
export function genererCodeBarre(sequence, date = new Date()) {
  const base = `${date.getFullYear().toString().slice(-2)}${String(
    Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000)
  ).padStart(3, "0")}${String(sequence).padStart(6, "0")}`;
  return base + cleLuhn(base);
}

function cleLuhn(numero) {
  let somme = 0, doubler = true;
  for (let i = numero.length - 1; i >= 0; i--) {
    let d = Number(numero[i]);
    if (doubler) { d *= 2; if (d > 9) d -= 9; }
    somme += d; doubler = !doubler;
  }
  return String((10 - (somme % 10)) % 10);
}

export function verifierCodeBarre(code) {
  if (!/^\d{12}$/.test(code)) return false;
  return cleLuhn(code.slice(0, 11)) === code[11];
}

/* ===================== Utilitaires métier ===================== */

export function calculerAge(dateNaissance, reference = new Date()) {
  const d = new Date(dateNaissance);
  if (Number.isNaN(d.getTime())) return null;
  let age = reference.getFullYear() - d.getFullYear();
  const m = reference.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && reference.getDate() < d.getDate())) age--;
  if (age < 2) {
    const mois = Math.max(0, (reference.getFullYear() - d.getFullYear()) * 12 + m);
    return { annees: age, mois, label: mois < 24 ? `${mois} mois` : `${age} ans` };
  }
  return { annees: age, mois: age * 12 + m, label: `${age} ans` };
}

// Délai de rendu en heures entre deux instants
export function delaiHeures(debut, fin = new Date()) {
  const a = new Date(debut), b = new Date(fin);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return (b - a) / 3600000;
}

// Contrôle du respect du délai contractuel de rendu
export function respectDelai(demande, test) {
  const attendu = Number(test?.delaiRenduHeures) ||
    NIVEAUX_URGENCE.find(u => u.code === demande.urgence)?.delai || 24;
  const ecoule = delaiHeures(demande.date);
  if (ecoule === null) return null;
  return {
    attendu, ecoule,
    respecte: ecoule <= attendu,
    retard: Math.max(0, ecoule - attendu),
    pourcentage: attendu ? (ecoule / attendu) * 100 : null,
  };
}
