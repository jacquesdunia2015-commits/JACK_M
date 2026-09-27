#!/usr/bin/env node
// tests/licence.test.mjs — accès libre, essai et clés d'abonnement.
//
// Le piège qui a motivé cette suite : le compteur d'essai ne doit PAS tourner
// pendant la période gratuite. S'il tournait, les cinq jours d'essai de chaque
// utilisateur seraient consommés par la promotion, et tout le monde se
// retrouverait bloqué le même jour — à l'heure précise où la vente commence.
//
// Les dates sont dérivées de l'échéance déclarée, jamais écrites en dur :
// déplacer ACCES_LIBRE_JUSQU_AU ne doit pas casser ce contrôle.

const boutique = new Map();
globalThis.localStorage = {
  get length() { return boutique.size; },
  key: i => [...boutique.keys()][i] ?? null,
  getItem: k => (boutique.has(k) ? boutique.get(k) : null),
  setItem: (k, v) => boutique.set(k, String(v)),
  removeItem: k => boutique.delete(k),
  clear: () => boutique.clear(),
};
// `crypto` est déjà exposé par Node en lecture seule : inutile de le remplacer.
globalThis.document = { documentElement: { lang: "fr" } };

import { verifier, egal, titre, bilan } from "./aide.mjs";
const lic = await import("../js/license.js");

const FIN_LIBRE = lic.ACCES_LIBRE_JUSQU_AU;
const jour = iso => new Date(iso + "T12:00:00").getTime();
const JOUR_MS = 86400000;
const decale = (iso, n) => new Date(jour(iso) + n * JOUR_MS).toISOString().slice(0, 10);
const vraiNow = Date.now;
const figer = ms => { Date.now = () => ms; };
const PENDANT = decale(FIN_LIBRE, -40);

console.log(`\nPériode d'accès libre déclarée : jusqu'au ${FIN_LIBRE}`);

/* ================== Période d'accès libre ================== */
titre("Pendant la période d'accès libre");
figer(jour(PENDANT));
boutique.clear();
let st = await lic.licenseStatus();
egal("l'application est en accès libre", st.state, "libre");
verifier("le nombre de jours restants est cohérent",
  st.daysLeft >= 39 && st.daysLeft <= 41, st.daysLeft + " j");
verifier("la date de fin est annoncée", st.fin === FIN_LIBRE);
verifier("le badge affiche la gratuité", /🎁/.test(lic.licenseBadge(st)));

const enregistre = JSON.parse(boutique.get("qualicode.license") || "{}");
egal("le compteur d'essai n'est PAS entamé", enregistre.trialStart, undefined);

// Usage quotidien étalé sur toute la période : le compteur ne doit démarrer
// à aucun de ces passages.
for (const n of [-35, -25, -10, -1]) { figer(jour(decale(FIN_LIBRE, n))); await lic.licenseStatus(); }
verifier("après des semaines d'usage, l'essai est toujours intact",
  JSON.parse(boutique.get("qualicode.license")).trialStart === undefined);

figer(jour(FIN_LIBRE));
egal("le dernier jour est encore libre", (await lic.licenseStatus()).state, "libre");

titre("Après la période");
figer(jour(decale(FIN_LIBRE, 1)));
st = await lic.licenseStatus();
egal("l'essai démarre — personne n'est bloqué du jour au lendemain", st.state, "trial");
egal("les cinq jours d'essai sont entiers", st.daysLeft, 5);

figer(jour(decale(FIN_LIBRE, 7)));
st = await lic.licenseStatus();
egal("l'essai épuisé bascule sur l'abonnement", st.state, "expired");

verifier("accesLibreActif() est faux après la date", !lic.accesLibreActif(jour(decale(FIN_LIBRE, 1))));
verifier("accesLibreActif() est vrai avant la date", lic.accesLibreActif(jour(decale(FIN_LIBRE, -1))));
egal("plus aucun jour libre après l'échéance", lic.joursAccesLibre(jour(decale(FIN_LIBRE, 1))), 0);
verifier("la date de fin est formatée pour l'utilisateur",
  /\d{4}/.test(lic.finAccesLibreTexte()) && !/^\d{4}-/.test(lic.finAccesLibreTexte()),
  lic.finAccesLibreTexte());

/* ================== Clés d'abonnement ================== */
titre("Clés d'abonnement : signature et validité");
boutique.clear();
figer(jour(PENDANT));
const expiration = decale(FIN_LIBRE, 60);
const cle = await lic.makeKey("month", expiration, "Client Test", "");
verifier("la clé a la forme attendue", /^QC1-[A-Za-z0-9_-]+-[0-9a-f]{20}$/.test(cle), cle);

const v = await lic.verifyKey(cle);
verifier("la clé est reconnue valide", v.ok);
egal("le plan est restitué", v.plan, "month");
egal("l'échéance est restituée", v.exp, expiration);
egal("le titulaire est restitué", v.licensee, "Client Test");

// Une clé modifiée d'un seul caractère doit être refusée : sans cela, un
// utilisateur pourrait s'attribuer une échéance lointaine en éditant le texte.
const [, charge, signature] = cle.split("-");
const falsifiee = await lic.verifyKey(`QC1-${charge}-${signature.replace(/.$/, c => (c === "0" ? "1" : "0"))}`);
verifier("une signature retouchée est refusée", !falsifiee.ok);
const chargeFalsifiee = await lic.makeKey("life", "2099-12-31", "Pirate", "");
const recollee = `QC1-${chargeFalsifiee.split("-")[1]}-${signature}`;
verifier("une charge utile recollée sur une autre signature est refusée",
  !(await lic.verifyKey(recollee)).ok);
verifier("une clé inventée est refusée", !(await lic.verifyKey("QC1-nimportequoi-0123456789abcdef0123")).ok);
verifier("un texte quelconque est refusé", !(await lic.verifyKey("bonjour")).ok);
verifier("une clé vide est refusée", !(await lic.verifyKey("")).ok);

titre("Verrouillage sur un appareil");
const monAppareil = lic.deviceCode();
verifier("l'appareil possède un code lisible", /^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(monAppareil), monAppareil);
egal("le code est stable d'un appel à l'autre", lic.deviceCode(), monAppareil);

const cleVerrouillee = await lic.makeKey("year", expiration, "Client", monAppareil);
verifier("la clé verrouillée fonctionne sur le bon appareil", (await lic.verifyKey(cleVerrouillee)).ok);
boutique.set("qualicode.device", "AAAA-BBBB"); // on change d'appareil
verifier("elle est refusée sur un autre appareil", !(await lic.verifyKey(cleVerrouillee)).ok);
boutique.set("qualicode.device", monAppareil);
verifier("elle refonctionne sur l'appareil d'origine", (await lic.verifyKey(cleVerrouillee)).ok);
verifier("une clé sans verrou fonctionne partout", (await lic.verifyKey(cle)).ok);

titre("Activation et expiration");
boutique.clear();
figer(jour(decale(FIN_LIBRE, 10))); // hors période libre : la licence seule compte
const cleCourte = await lic.makeKey("week", decale(FIN_LIBRE, 20), "Abonné", "");
await lic.activateKey(cleCourte);
st = await lic.licenseStatus();
egal("l'abonnement actif est reconnu", st.state, "active");
egal("son plan est affiché", st.plan, "week");
verifier("le badge mentionne le titulaire ou le plan", lic.licenseBadge(st).length > 0);

figer(jour(decale(FIN_LIBRE, 21)));
st = await lic.licenseStatus();
verifier("une fois l'échéance passée, l'abonnement n'est plus actif", st.state !== "active", st.state);

titre("Recul de l'horloge de l'appareil");
// Reculer la date du système est la façon la plus simple de prolonger un
// abonnement. Un écart de plus d'un jour et demi vers le passé doit invalider
// la session en cours.
boutique.clear();
figer(jour(decale(FIN_LIBRE, 10)));
await lic.activateKey(await lic.makeKey("year", decale(FIN_LIBRE, 300), "Abonné", ""));
egal("l'abonnement est actif à la date normale", (await lic.licenseStatus()).state, "active");
figer(jour(decale(FIN_LIBRE, 5))); // cinq jours en arrière
st = await lic.licenseStatus();
verifier("une horloge reculée n'ouvre pas l'abonnement", st.state !== "active", st.state);

Date.now = vraiNow;
bilan("Licence et accès libre");
