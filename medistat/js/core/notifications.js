// medistat/js/core/notifications.js
// Notification automatique du patient (article 13) : dès que le laboratoire
// valide et signe des résultats, le patient est prévenu qu'ils sont prêts.
//
// ── Trois règles, non négociables ─────────────────────────────────────────
//
//  1. Le message n'annonce QUE la disponibilité. Aucune valeur, aucun nom
//     d'analyse, aucune interprétation. Un SMS transite en clair, s'affiche
//     sur un écran verrouillé et reste dans le téléphone. Écrire « HIV
//     positif » dans un SMS, c'est publier un diagnostic. Les modèles du
//     catalogue sont contrôlés par les tests sur ce point précis.
//
//  2. Aucun envoi sans consentement explicite du patient. Le champ
//     `consentementSMS` vaut « oui » ou rien ; l'absence de réponse n'est
//     pas un accord.
//
//  3. Le navigateur ne détient jamais les identifiants de la passerelle.
//     Ils vivent côté serveur, dans une table qui n'est jamais renvoyée en
//     clair. Le poste de travail dépose un message dans la file ; c'est le
//     serveur qui appelle l'opérateur. Un poste volé ne donne donc pas accès
//     au compte SMS de l'établissement.
//
// Le fonctionnement reste correct hors ligne : le message est mis en file et
// part à la reconnexion. Une valeur critique, elle, ne se délègue pas à un
// SMS — elle déclenche en plus une alerte interne au prescripteur, qui est
// le seul chemin réglementaire acceptable.

import * as store from "./store.js";
import { t } from "./i18n.js";
import { langueSure } from "./langues.js";

/* ═══════════════════════ Passerelles reconnues ══════════════════════════ */

// Métadonnées seulement : le client affiche le formulaire de configuration,
// il ne construit jamais la requête vers l'opérateur.
export const PASSERELLES = {
  aucune: {
    label: "Aucune (file d'attente seule)",
    description: "Les messages sont préparés et horodatés, mais aucun envoi n'a lieu. "
      + "Le secrétariat peut les relever depuis l'écran Messages patients. "
      + "C'est le mode par défaut : rien ne part sans configuration explicite.",
    champs: [],
  },
  webhook: {
    label: "Webhook générique",
    description: "Envoie un POST JSON à l'URL de votre choix. Convient aux passerelles "
      + "internes et aux opérateurs locaux non listés ici.",
    champs: [
      { cle: "url", libelle: "URL du webhook", obligatoire: true, placeholder: "https://passerelle.exemple.org/sms" },
      { cle: "jeton", libelle: "Jeton d'authentification", secret: true },
      { cle: "expediteur", libelle: "Nom d'expéditeur affiché", placeholder: "CHU-LAB" },
    ],
  },
  twilio: {
    label: "Twilio",
    description: "Couverture mondiale. Renseignez l'identifiant de compte et le jeton.",
    champs: [
      { cle: "compte", libelle: "Account SID", obligatoire: true },
      { cle: "jeton", libelle: "Auth Token", obligatoire: true, secret: true },
      { cle: "expediteur", libelle: "Numéro émetteur", obligatoire: true, placeholder: "+15551234567" },
    ],
  },
  africastalking: {
    label: "Africa's Talking",
    description: "Opérateur privilégié en Afrique de l'Est, de l'Ouest et centrale.",
    champs: [
      { cle: "compte", libelle: "Nom d'utilisateur", obligatoire: true },
      { cle: "jeton", libelle: "Clé d'API", obligatoire: true, secret: true },
      { cle: "expediteur", libelle: "Identifiant d'expéditeur", placeholder: "CHU-LAB" },
    ],
  },
  infobip: {
    label: "Infobip",
    description: "Couverture internationale, portail unique SMS et courriel.",
    champs: [
      { cle: "url", libelle: "URL de base", obligatoire: true, placeholder: "https://xxxxx.api.infobip.com" },
      { cle: "jeton", libelle: "Clé d'API", obligatoire: true, secret: true },
      { cle: "expediteur", libelle: "Identifiant d'expéditeur", placeholder: "CHU-LAB" },
    ],
  },
  vonage: {
    label: "Vonage (Nexmo)",
    description: "Couverture internationale.",
    champs: [
      { cle: "compte", libelle: "API key", obligatoire: true },
      { cle: "jeton", libelle: "API secret", obligatoire: true, secret: true },
      { cle: "expediteur", libelle: "Nom d'expéditeur", placeholder: "CHU-LAB" },
    ],
  },
};

export const TYPES_MESSAGE = {
  resultats_prets: { cle: "sms_resultats", label: "Résultats disponibles", priorite: "normale" },
  valeur_critique: { cle: "sms_critique", label: "Rappel urgent", priorite: "critique" },
  rappel_prelevement: { cle: "sms_prelevement", label: "Rappel de prélèvement", priorite: "normale" },
};

// Un message est réessayé cinq fois, en espaçant les tentatives. Au-delà, il
// passe en « abandonné » et reste visible : un échec définitif doit être vu
// par un humain, pas disparaître de la file.
export const TENTATIVES_MAX = 5;
const ATTENTE_MS = [0, 60_000, 300_000, 1_800_000, 7_200_000];

/* ═══════════════════════ Composition du message ═════════════════════════ */

// Normalise un numéro en format international. Une passerelle refuse presque
// toujours un numéro national ; mieux vaut le détecter ici que compter cinq
// échecs de remise avant de comprendre.
export function normaliserTelephone(brut, indicatifPays = "") {
  if (!brut) return null;
  let n = String(brut).replace(/[\s.\-() ]/g, "");
  if (n.startsWith("00")) n = "+" + n.slice(2);
  if (!n.startsWith("+")) {
    const indicatif = String(indicatifPays || "").replace(/[^\d]/g, "");
    if (!indicatif) return null;              // impossible de deviner le pays
    n = "+" + indicatif + n.replace(/^0+/, "");
  }
  return /^\+\d{7,15}$/.test(n) ? n : null;
}

// Construit le texte dans la langue du patient. `date` est formatée dans la
// locale de cette même langue : envoyer « 07/30 » à un patient au Caire n'a
// aucun sens s'il lit « 30/07 ».
export function composerTexte(type, { etablissement, numero, date, langue }) {
  const modele = TYPES_MESSAGE[type];
  if (!modele) throw new Error(`Type de message inconnu : ${type}`);
  return t(modele.cle, {
    etablissement: etablissement || "MediStat",
    numero: numero || "",
    date: date || "",
  }, { langue });
}

/* ═══════════════════════ Mise en file ═══════════════════════════════════ */

// Décrit pourquoi un patient ne sera pas prévenu. Renvoyer une raison plutôt
// qu'un simple `false` permet à l'écran de validation de dire au biologiste
// « ce patient n'a pas de numéro » au lieu de rester muet.
export function raisonNonEnvoi(patient, reglages) {
  if (!reglages || reglages.active === false) return "notifications désactivées pour l'établissement";
  if (!patient) return "patient inconnu";
  if (patient.consentementSMS !== "oui") return "le patient n'a pas consenti aux notifications";
  if (!normaliserTelephone(patient.telephone, reglages.indicatifPays)) {
    return patient.telephone
      ? "numéro de téléphone inexploitable (format international attendu)"
      : "aucun numéro de téléphone au dossier";
  }
  return null;
}

// Prépare et met en file un message. Ne lève pas : une notification ratée ne
// doit jamais empêcher la validation d'un résultat, qui est l'acte médical.
export async function mettreEnFile(type, { patient, etablissement, demande, langueEtablissement = "fr" }) {
  const reglages = (etablissement && etablissement.notifications) || {};
  const empechement = raisonNonEnvoi(patient, reglages);
  if (empechement) return { envoye: false, raison: empechement };

  const langue = langueSure(patient.langue, langueEtablissement);
  const destinataire = normaliserTelephone(patient.telephone, reglages.indicatifPays);
  const modele = TYPES_MESSAGE[type];

  const message = {
    type,
    patientId: patient.id,
    demandeId: demande?.id || null,
    canal: reglages.canal === "email" && patient.email ? "email" : "sms",
    destinataire: reglages.canal === "email" && patient.email ? patient.email : destinataire,
    langue,
    texte: composerTexte(type, {
      etablissement: etablissement?.nom,
      numero: demande?.numero,
      date: new Date().toLocaleDateString(langue),
      langue,
    }),
    priorite: modele.priorite,
    statut: "en_attente",
    tentatives: 0,
    dateProchaineTentative: new Date().toISOString(),
    date: new Date().toISOString(),
    erreur: null,
  };

  const cree = await store.depots.messagesPatients.creer(message);
  // La trace d'audit dit qu'un message est parti, à qui et pourquoi. Elle ne
  // reprend pas le texte : le contenu est déjà dans la file, le dupliquer
  // dans un journal consultable par l'administration n'apporte rien.
  await store.tracer("notification", "notification", cree.id,
    `Message « ${modele.label} » mis en file pour le patient ${patient.ipp} (${langue}, ${message.canal})`);
  return { envoye: true, message: cree };
}

/* ═══════════════════════ Remise ═════════════════════════════════════════ */

// Tente la remise des messages en attente. Le serveur détient la passerelle ;
// hors ligne ou sans serveur, les messages restent en file et rien n'est
// perdu. Renvoie un bilan pour l'écran de supervision.
export async function viderFile({ base = "/api", limite = 50 } = {}) {
  const maintenant = Date.now();
  const enAttente = (await store.depots.messagesPatients.lister({
    filtre: m => m.statut === "en_attente"
      && new Date(m.dateProchaineTentative || 0).getTime() <= maintenant,
  })).slice(0, limite);

  const bilan = { tentes: 0, remis: 0, differes: 0, abandonnes: 0 };
  if (!enAttente.length) return bilan;

  for (const m of enAttente) {
    bilan.tentes++;
    let reponse = null;
    try {
      const r = await fetch(`${base}/messages/envoyer`, {
        method: "POST",
        headers: { "content-type": "application/json", ...enTetesAuth() },
        body: JSON.stringify({
          id: m.id, canal: m.canal, destinataire: m.destinataire,
          texte: m.texte, priorite: m.priorite,
        }),
      });
      reponse = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(reponse.erreur || `HTTP ${r.status}`);
    } catch (e) {
      const tentatives = (m.tentatives || 0) + 1;
      // Le dernier échec ne se rejoue pas indéfiniment : au-delà du plafond
      // le message est marqué abandonné et attend une reprise manuelle.
      const abandonne = tentatives >= TENTATIVES_MAX;
      await store.depots.messagesPatients.modifier(m.id, {
        tentatives,
        statut: abandonne ? "abandonne" : "en_attente",
        erreur: String(e.message).slice(0, 200),
        dateProchaineTentative: new Date(
          maintenant + (ATTENTE_MS[Math.min(tentatives, ATTENTE_MS.length - 1)])).toISOString(),
      });
      if (abandonne) bilan.abandonnes++; else bilan.differes++;
      continue;
    }
    await store.depots.messagesPatients.modifier(m.id, {
      statut: "remis", erreur: null,
      dateRemise: new Date().toISOString(),
      referenceOperateur: reponse.reference || null,
    });
    bilan.remis++;
  }
  return bilan;
}

function enTetesAuth() {
  try {
    const jeton = localStorage.getItem("medistat.jeton");
    return jeton ? { authorization: `Bearer ${jeton}` } : {};
  } catch { return {}; }
}

// Remet en file un message abandonné, après correction du numéro par exemple.
export async function reprendre(id) {
  return store.depots.messagesPatients.modifier(id, {
    statut: "en_attente", tentatives: 0, erreur: null,
    dateProchaineTentative: new Date().toISOString(),
  });
}

/* ═══════════════ Déclencheur : validation des résultats ═════════════════ */

// Appelé par le laboratoire juste après la signature. Prévient le patient que
// ses résultats sont prêts, et — séparément — alerte le prescripteur en
// interne si une valeur critique figure au compte rendu.
//
// Le résultat renvoyé sert à informer le biologiste : il doit savoir si le
// patient a été prévenu ou non, et pourquoi. Un silence serait pire qu'un
// échec annoncé.
export async function notifierResultatsPrets({ patient, demande, etablissement, resultats = [] }) {
  const rapport = { patient: null, prescripteur: null };

  try {
    rapport.patient = await mettreEnFile("resultats_prets", { patient, etablissement, demande });
  } catch (e) {
    rapport.patient = { envoye: false, raison: e.message };
  }

  // Valeur critique : le canal réglementaire est le prescripteur, pas le
  // patient. On ne lui annonce jamais une urgence par SMS sans médecin en
  // face ; on accélère au contraire la remontée interne.
  const critiques = resultats.filter(r => r.critique);
  if (critiques.length && demande?.prescripteurId) {
    try {
      await store.depots.notifications.creer({
        destinataireType: "utilisateur", destinataireId: demande.prescripteurId,
        canal: "in_app",
        sujet: `Valeur critique — demande ${demande.numero}`,
        message: `${critiques.length} valeur(s) critique(s) validée(s). `
          + "Prenez connaissance du dossier sans délai.",
        priorite: "critique",
        entite: "demande", entiteId: demande.id,
        date: new Date().toISOString(), lue: false, envoyee: true,
      });
      rapport.prescripteur = { envoye: true, nombre: critiques.length };
    } catch (e) {
      rapport.prescripteur = { envoye: false, raison: e.message };
    }
  }

  // La remise est tentée immédiatement, sans bloquer l'écran : le biologiste
  // n'a pas à attendre l'opérateur télécom pour enchaîner sur la demande
  // suivante.
  viderFile().catch(() => { /* la file sera reprise au prochain passage */ });
  return rapport;
}

/* ═══════════════════════ Supervision ════════════════════════════════════ */

export async function bilanFile() {
  const tous = await store.depots.messagesPatients.lister();
  const par = s => tous.filter(m => m.statut === s).length;
  return {
    total: tous.length,
    enAttente: par("en_attente"),
    remis: par("remis"),
    abandonnes: par("abandonne"),
    messages: tous.sort((a, b) => new Date(b.date) - new Date(a.date)),
  };
}

// Démarre une reprise périodique de la file. Un message mis en file hors
// ligne part ainsi tout seul dès le retour du réseau, sans que personne ait
// à penser à rouvrir un écran.
export function demarrerReprise({ intervalleMs = 120_000 } = {}) {
  if (typeof window === "undefined") return () => {};
  const tenter = () => { if (navigator.onLine !== false) viderFile().catch(() => {}); };
  const minuterie = setInterval(tenter, intervalleMs);
  window.addEventListener("online", tenter);
  return () => { clearInterval(minuterie); window.removeEventListener("online", tenter); };
}
