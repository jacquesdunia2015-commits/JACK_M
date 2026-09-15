#!/usr/bin/env node
// medistat/tests/notifications.test.mjs
// Contrôles de la notification automatique du patient (article 13).
//
// L'enjeu de ces contrôles n'est pas qu'un SMS parte : c'est qu'il ne parte
// PAS quand il ne doit pas, et qu'il ne dise jamais ce qu'il ne doit pas
// dire. Un message envoyé sans consentement est une faute ; un message
// annonçant « glycémie 3,2 g/L » à un tiers qui regarde l'écran verrouillé
// du téléphone en est une plus grave encore.
//
// Lancement :  node tests/notifications.test.mjs

import * as store from "../js/core/store.js";
import * as auth from "../js/core/auth.js";
import * as notifications from "../js/core/notifications.js";
import { CATALOGUE } from "../js/i18n/catalogue.js";

let passed = 0, failed = 0;
const failures = [];
const t = (nom, condition, detail = "") => {
  if (condition) passed++;
  else { failed++; failures.push(nom + (detail ? `\n     ${detail}` : "")); }
};
const check = (nom, got, exp) => t(nom, got === exp, `obtenu ${JSON.stringify(got)}, attendu ${JSON.stringify(exp)}`);
const section = titre => console.log(`\n\x1b[1m── ${titre}\x1b[0m`);

/* ===================================================================== */
section("Normalisation des numéros");

check("numéro déjà international", notifications.normaliserTelephone("+243812345678"), "+243812345678");
check("préfixe 00 converti", notifications.normaliserTelephone("00243812345678"), "+243812345678");
check("espaces et tirets retirés",
  notifications.normaliserTelephone("+33 6 12-34.56 78"), "+33612345678");
check("numéro national complété par l'indicatif",
  notifications.normaliserTelephone("0812345678", "243"), "+243812345678");
check("le zéro initial est retiré à la conversion",
  notifications.normaliserTelephone("0612345678", "33"), "+33612345678");
// Sans indicatif on ne devine pas : envoyer à un numéro tronqué coûte de
// l'argent et n'atteint personne.
check("numéro national sans indicatif refusé",
  notifications.normaliserTelephone("0812345678"), null);
check("chaîne vide refusée", notifications.normaliserTelephone(""), null);
check("texte non numérique refusé", notifications.normaliserTelephone("appelez-moi"), null);
check("numéro trop court refusé", notifications.normaliserTelephone("+3312"), null);
check("numéro trop long refusé", notifications.normaliserTelephone("+3312345678901234567"), null);

/* ===================================================================== */
section("Consentement et empêchements");

const reglagesActifs = { active: true, canal: "sms", indicatifPays: "243" };
const patientOk = { id: "p1", ipp: "IPP-1", telephone: "0812345678", consentementSMS: "oui", langue: "sw" };

check("un patient consentant et joignable ne présente aucun empêchement",
  notifications.raisonNonEnvoi(patientOk, reglagesActifs), null);

t("sans consentement, aucun envoi",
  /consenti/.test(notifications.raisonNonEnvoi({ ...patientOk, consentementSMS: "non" }, reglagesActifs)));
// L'absence de réponse n'est pas un accord : le champ vide doit bloquer.
t("un consentement non renseigné bloque l'envoi",
  /consenti/.test(notifications.raisonNonEnvoi({ ...patientOk, consentementSMS: undefined }, reglagesActifs)));
t("sans numéro, aucun envoi",
  /numéro/.test(notifications.raisonNonEnvoi({ ...patientOk, telephone: "" }, reglagesActifs)));
t("un numéro inexploitable est signalé comme tel",
  /inexploitable/.test(notifications.raisonNonEnvoi(
    { ...patientOk, telephone: "0812345678" }, { active: true })));
t("notifications désactivées : aucun envoi",
  /désactivées/.test(notifications.raisonNonEnvoi(patientOk, { active: false })));
t("établissement non configuré : aucun envoi",
  notifications.raisonNonEnvoi(patientOk, null) !== null);
// L'envoi est opt-in des deux côtés. Un établissement qui n'a rien décidé ne
// doit pas se mettre à écrire à ses patients à la faveur d'une mise à jour.
t("paramétrage absent : aucun envoi",
  /désactivées/.test(notifications.raisonNonEnvoi(patientOk, {})));
t("un indicatif de pays seul ne suffit pas à activer",
  /désactivées/.test(notifications.raisonNonEnvoi(patientOk, { indicatifPays: "243" })));

/* ===================================================================== */
section("Composition du message");

const texteFr = notifications.composerTexte("resultats_prets", {
  etablissement: "CHU de Kinshasa", numero: "DEM-2026-0001", date: "30/07/2026", langue: "fr",
});
t("le message nomme l'établissement", texteFr.includes("CHU de Kinshasa"));
t("aucune variable non substituée ne subsiste", !/\{\w+\}/.test(texteFr), texteFr);

const texteSw = notifications.composerTexte("resultats_prets", {
  etablissement: "CHU", numero: "D-1", date: "30/07/2026", langue: "sw",
});
t("le message suit la langue demandée", texteSw !== texteFr && texteSw.includes("CHU"));

// Le contrôle central : le message ne doit rien dire du contenu médical.
const MOTS_INTERDITS = /(glyc|h[ée]moglob|leucocyt|positif|n[ée]gatif|mg\/d[lL]|mmol)/i;
let messagesSurs = 0, messagesFuyants = [];
for (const type of Object.keys(notifications.TYPES_MESSAGE)) {
  for (const code of Object.keys(CATALOGUE[notifications.TYPES_MESSAGE[type].cle])) {
    const texte = notifications.composerTexte(type, {
      etablissement: "CHU", numero: "D-1", date: "30/07/2026", langue: code,
    });
    if (MOTS_INTERDITS.test(texte)) messagesFuyants.push(`${type}/${code}`);
    else messagesSurs++;
  }
}
t("aucun message composé ne divulgue d'information médicale",
  messagesFuyants.length === 0, messagesFuyants.join(", "));
t("le contrôle a bien porté sur les 150 combinaisons type × langue",
  messagesSurs === 150, `${messagesSurs} messages contrôlés`);

let leve = false;
try { notifications.composerTexte("type_inexistant", { langue: "fr" }); }
catch { leve = true; }
t("un type de message inconnu lève plutôt que d'envoyer du vide", leve);

/* ===================================================================== */
section("Mise en file");

await store.reinitialiser?.();
await auth.initialiser({
  etablissement: { nom: "CHU de contrôle", code: "CTL", type: "hopital" },
  administrateur: { identifiant: "bio", nom: "Nkosi", prenom: "Awa", motDePasse: "BioFort2026!" },
});
await auth.connexion("bio", "BioFort2026!");

const etablissement = (await store.lireTout("etablissements"))[0];
etablissement.notifications = { active: true, canal: "sms", indicatifPays: "243" };
await store.ecrire("etablissements", etablissement);

const patient = await store.depots.patients.creer({
  ipp: "IPP-0001", nom: "Tshibangu", prenom: "Alice", dateNaissance: "1990-05-12",
  sexe: "F", telephone: "0812345678", consentementSMS: "oui", langue: "sw",
});
const demande = await store.depots.demandes.creer({
  numero: "DEM-0001", patientId: patient.id, statut: "validee", date: new Date().toISOString(),
});

const r1 = await notifications.mettreEnFile("resultats_prets", { patient, etablissement, demande });
t("le message est mis en file", r1.envoye === true, r1.raison || "");
check("le canal retenu est le SMS", r1.message?.canal, "sms");
check("le numéro est normalisé à la mise en file", r1.message?.destinataire, "+243812345678");
check("la langue du patient est retenue", r1.message?.langue, "sw");
check("le message part en attente", r1.message?.statut, "en_attente");
t("le texte est celui de la langue du patient",
  r1.message?.texte === CATALOGUE.sms_resultats.sw
    .replace("{etablissement}", etablissement.nom)
    .replace("{numero}", demande.numero)
    .replace("{date}", new Date().toLocaleDateString("sw")),
  r1.message?.texte);

// Un patient sans consentement ne doit rien laisser dans la file : c'est le
// point où une régression coûterait le plus cher.
const patientSansAccord = await store.depots.patients.creer({
  ipp: "IPP-0002", nom: "Kabila", prenom: "Jean", dateNaissance: "1980-01-01",
  sexe: "M", telephone: "0899999999", consentementSMS: "non",
});
const r2 = await notifications.mettreEnFile("resultats_prets",
  { patient: patientSansAccord, etablissement, demande });
check("aucun message pour un patient non consentant", r2.envoye, false);
const file = await store.depots.messagesPatients.lister();
check("la file ne contient que le message autorisé", file.length, 1);
check("la file ne vise que le patient consentant", file[0].patientId, patient.id);

// La langue de repli est celle de l'établissement quand le patient n'en a pas.
const patientSansLangue = await store.depots.patients.creer({
  ipp: "IPP-0003", nom: "Sow", prenom: "Fatou", dateNaissance: "1975-03-03",
  sexe: "F", telephone: "+221771234567", consentementSMS: "oui",
});
const r3 = await notifications.mettreEnFile("resultats_prets",
  { patient: patientSansLangue, etablissement, demande, langueEtablissement: "fr" });
check("repli sur la langue de l'établissement", r3.message?.langue, "fr");

/* ===================================================================== */
section("Journal d'audit");

const audit = await store.lireTout("audit");
const traces = audit.filter(a => a.action === "notification");
t("chaque mise en file laisse une trace d'audit", traces.length >= 2, `${traces.length} trace(s)`);
// La trace dit qu'un message est parti ; elle ne recopie pas son texte, qui
// est déjà dans la file. Moins d'endroits où une donnée fuit, mieux c'est.
t("la trace ne recopie pas le texte du message",
  traces.every(a => !String(a.details || "").includes(CATALOGUE.sms_resultats.sw.slice(0, 20))));
t("la trace identifie le patient par son IPP",
  traces.some(a => String(a.details || "").includes("IPP-0001")));

/* ===================================================================== */
section("Remise et reprise");

// Sans serveur enregistré, aucune requête n'est émise et rien n'est marqué
// en échec : un poste en local pur n'a pas à voir des « abandonnés » alors
// qu'aucun envoi n'a jamais été configuré.
globalThis.fetch = async () => { throw new Error("aucune requête ne devait partir"); };
const bilanLocal = await notifications.viderFile();
check("sans serveur, aucune tentative", bilanLocal.tentes, 0);
t("la raison est explicite", /serveur/.test(bilanLocal.raison || ""), bilanLocal.raison);
check("aucun message n'est marqué en échec",
  (await store.depots.messagesPatients.lister()).every(m => m.statut === "en_attente"), true);

// À partir d'ici, un serveur est enregistré : les tentatives ont lieu.
notifications.definirServeur({ base: "http://serveur-de-controle/api", jeton: "jeton-de-controle" });
check("le serveur est retenu", notifications.serveurConfigure()?.base, "http://serveur-de-controle/api");
check("le jeton alimente l'en-tête d'autorisation",
  notifications.enTetesAuth().authorization, "Bearer jeton-de-controle");

// Sans serveur joignable, la remise échoue : le message doit rester en file
// et être reprogrammé, jamais être perdu ni marqué remis.
globalThis.fetch = async () => { throw new Error("réseau indisponible"); };
const bilan1 = await notifications.viderFile();
t("toutes les tentatives ont échoué", bilan1.remis === 0 && bilan1.tentes > 0);
check("les messages sont différés, pas abandonnés", bilan1.differes, bilan1.tentes);

const apresEchec = (await store.depots.messagesPatients.lister())
  .find(m => m.patientId === patient.id);
check("le message reste en attente", apresEchec.statut, "en_attente");
check("le compteur de tentatives progresse", apresEchec.tentatives, 1);
t("l'erreur est conservée pour diagnostic", /réseau/.test(apresEchec.erreur || ""));
t("la prochaine tentative est repoussée dans le temps",
  new Date(apresEchec.dateProchaineTentative).getTime() > Date.now());

// Au-delà du plafond, le message passe en abandonné : il reste visible pour
// qu'un humain corrige le numéro, plutôt que de tourner indéfiniment.
await store.depots.messagesPatients.modifier(apresEchec.id, {
  tentatives: notifications.TENTATIVES_MAX - 1,
  dateProchaineTentative: new Date(0).toISOString(),
});
const bilan2 = await notifications.viderFile();
check("le message est abandonné au plafond de tentatives", bilan2.abandonnes, 1);
const abandonne = await store.depots.messagesPatients.obtenir(apresEchec.id);
check("son statut le dit", abandonne.statut, "abandonne");

await notifications.reprendre(abandonne.id);
const repris = await store.depots.messagesPatients.obtenir(abandonne.id);
check("la reprise remet le message en attente", repris.statut, "en_attente");
check("la reprise remet le compteur à zéro", repris.tentatives, 0);

// Remise réussie : le message est marqué remis et n'est plus retenté.
globalThis.fetch = async () => ({
  ok: true, status: 200, json: async () => ({ reference: "REF-123" }),
});
const bilan3 = await notifications.viderFile();
t("les messages sont remis quand la passerelle répond", bilan3.remis > 0);
const remis = await store.depots.messagesPatients.obtenir(abandonne.id);
check("le statut passe à remis", remis.statut, "remis");
check("la référence de l'opérateur est conservée", remis.referenceOperateur, "REF-123");
t("la date de remise est horodatée", Boolean(remis.dateRemise));
check("un second passage ne renvoie rien", (await notifications.viderFile()).tentes, 0);

/* ===================================================================== */
section("Déclenchement à la validation");

const patient2 = await store.depots.patients.creer({
  ipp: "IPP-0004", nom: "Mwamba", prenom: "Paul", dateNaissance: "1968-09-09",
  sexe: "M", telephone: "0821111111", consentementSMS: "oui", langue: "ln",
});
const demande2 = await store.depots.demandes.creer({
  numero: "DEM-0002", patientId: patient2.id, statut: "validee",
  date: new Date().toISOString(), prescripteurId: auth.utilisateurCourant().id,
});
const rapport = await notifications.notifierResultatsPrets({
  patient: patient2, demande: demande2, etablissement,
  resultats: [{ id: "r1", critique: true, testCode: "GLU" }],
});
t("le patient est mis en file à la validation", rapport.patient?.envoye === true);
check("le message part en lingala", rapport.patient?.message?.langue, "ln");

// Une valeur critique ne se délègue pas au patient : c'est le prescripteur
// qui est alerté, en interne, sur un canal tracé.
t("une valeur critique alerte le prescripteur", rapport.prescripteur?.envoye === true);
const alertes = (await store.lireTout("notifications"))
  .filter(n => n.priorite === "critique");
t("l'alerte critique est enregistrée", alertes.length >= 1);
t("l'alerte critique vise le prescripteur",
  alertes.some(a => a.destinataireId === auth.utilisateurCourant().id));
t("le SMS du patient n'annonce pas l'urgence",
  !MOTS_INTERDITS.test(rapport.patient.message.texte)
  && rapport.patient.message.priorite === "normale");

const bilanFinal = await notifications.bilanFile();
t("le bilan recense l'ensemble des messages", bilanFinal.total >= 3);
check("les compteurs se recomposent",
  bilanFinal.enAttente + bilanFinal.remis + bilanFinal.abandonnes, bilanFinal.total);

/* ===================================================================== */
console.log(`\n${"─".repeat(62)}`);
if (failed === 0) {
  console.log(`\x1b[32m\x1b[1m✓ ${passed} contrôles au vert.\x1b[0m`);
} else {
  console.log(`\x1b[31m\x1b[1m✗ ${failed} échec(s) sur ${passed + failed} contrôles :\x1b[0m`);
  for (const f of failures) console.log(`   • ${f}`);
}
process.exit(failed === 0 ? 0 : 1);
