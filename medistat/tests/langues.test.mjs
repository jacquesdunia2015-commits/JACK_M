#!/usr/bin/env node
// medistat/tests/langues.test.mjs
// Contrôles du registre des langues, du catalogue et du moteur de traduction.
//
// Ces contrôles ne vérifient pas la justesse linguistique — aucun test
// automatique ne le peut. Ils vérifient ce qui casse silencieusement :
// une clé oubliée dans une langue, un code en double, un modèle de SMS qui
// perd sa variable {etablissement} dans une traduction, ou pire, un message
// destiné au patient qui laisserait filtrer une valeur biologique.
//
// Lancement :  node tests/langues.test.mjs

import { LANGUES, CODES_LANGUES, langue, estRTL, parContinent,
  detecterLangue, langueSure } from "../js/core/langues.js";
import { CATALOGUE, CLES } from "../js/i18n/catalogue.js";
import * as i18n from "../js/core/i18n.js";

let passed = 0, failed = 0;
const failures = [];
const t = (nom, condition, detail = "") => {
  if (condition) passed++;
  else { failed++; failures.push(nom + (detail ? `\n     ${detail}` : "")); }
};
const check = (nom, got, exp) => t(nom, got === exp, `obtenu ${JSON.stringify(got)}, attendu ${JSON.stringify(exp)}`);
const section = titre => console.log(`\n\x1b[1m── ${titre}\x1b[0m`);

/* ===================================================================== */
section("Registre des langues");

check("le registre compte exactement 50 langues", LANGUES.length, 50);
check("aucun code en double", new Set(CODES_LANGUES).size, 50);
t("tout code est une étiquette BCP 47 plausible",
  LANGUES.every(l => /^[a-z]{2,3}$/.test(l.code)),
  LANGUES.filter(l => !/^[a-z]{2,3}$/.test(l.code)).map(l => l.code).join(", "));

t("chaque langue porte les six métadonnées attendues",
  LANGUES.every(l => l.nom && l.nomFr && l.sens && l.locale &&
    Array.isArray(l.continents) && l.continents.length && l.script));

t("le sens de lecture vaut ltr ou rtl",
  LANGUES.every(l => l.sens === "ltr" || l.sens === "rtl"));

// Une locale invalide fait lever Intl : le formatage des nombres et des
// dates tomberait alors sur le repli pour toute une langue, sans bruit.
const localesInvalides = LANGUES.filter(l => {
  try { new Intl.NumberFormat(l.locale).format(1.5); return false; }
  catch { return true; }
});
t("toutes les locales sont acceptées par Intl",
  localesInvalides.length === 0, localesInvalides.map(l => `${l.code}→${l.locale}`).join(", "));

const CONTINENTS = ["Europe", "Asie", "Afrique", "Amériques", "Océanie"];
const groupes = parContinent();
for (const c of CONTINENTS) {
  t(`le continent « ${c} » est représenté`, (groupes.get(c) || []).length > 0,
    `${(groupes.get(c) || []).length} langue(s)`);
}
t("chaque continent déclaré existe dans la liste de référence",
  LANGUES.every(l => l.continents.every(c => CONTINENTS.includes(c))));

check("les quatre langues à écriture droite-à-gauche sont marquées",
  LANGUES.filter(l => l.sens === "rtl").map(l => l.code).sort().join(","),
  "ar,fa,he,ur");
t("estRTL suit le registre", estRTL("ar") && estRTL("he") && !estRTL("fr") && !estRTL("zh"));

t("le registre couvre plus de dix écritures",
  new Set(LANGUES.map(l => l.script)).size >= 10,
  `${new Set(LANGUES.map(l => l.script)).size} écritures`);

// L'endonyme est ce que lit l'utilisateur dans le sélecteur : s'il est
// identique au nom français pour une langue non latine, c'est un oubli.
const nonLatines = LANGUES.filter(l => l.script !== "latin");
t("les langues non latines portent un endonyme dans leur écriture",
  nonLatines.every(l => l.nom !== l.nomFr),
  nonLatines.filter(l => l.nom === l.nomFr).map(l => l.code).join(", "));

check("langue() retrouve une entrée", langue("sw").nomFr, "Swahili");
check("langue() sur un code inconnu renvoie null", langue("xx"), null);

section("Résolution d'une langue");

check("un choix explicite valide est retenu", detecterLangue("zu"), "zu");
// Un choix inconnu n'impose pas le français : il redescend d'abord sur les
// préférences du poste. C'est ce qu'attend un utilisateur dont le réglage
// mémorisé a été perdu ou importé depuis un autre système.
t("un choix inconnu redescend sur une langue du registre",
  CODES_LANGUES.includes(detecterLangue("xx")), detecterLangue("xx"));
check("langueSure accepte une variante régionale", langueSure("pt-BR"), "pt");
check("langueSure accepte un souligné", langueSure("zh_CN"), "zh");
check("langueSure accepte un endonyme", langueSure("Kiswahili"), "sw");
check("langueSure accepte un nom français", langueSure("Amharique"), "am");
check("langueSure retombe sur le défaut fourni", langueSure("klingon", "en"), "en");
check("langueSure sur une valeur vide", langueSure("", "fr"), "fr");

/* ===================================================================== */
section("Catalogue");

t("le catalogue expose au moins trente clés", CLES.length >= 30, `${CLES.length} clés`);

// Le point critique : une clé absente dans une langue ferait retomber le
// libellé sur l'anglais. C'est acceptable ponctuellement, inacceptable en
// masse. On exige une couverture complète.
const manques = [];
for (const cle of CLES) {
  for (const l of LANGUES) {
    if (!CATALOGUE[cle][l.code]) manques.push(`${cle}/${l.code}`);
  }
}
t("chaque clé est traduite dans les 50 langues", manques.length === 0,
  `${manques.length} manque(s) : ${manques.slice(0, 12).join(", ")}`);

// Une langue parasite dans une clé signale une faute de frappe de code.
const codes = new Set(CODES_LANGUES);
const parasites = [];
for (const cle of CLES) {
  for (const code of Object.keys(CATALOGUE[cle])) {
    if (!codes.has(code)) parasites.push(`${cle}/${code}`);
  }
}
t("aucun code de langue inconnu dans le catalogue", parasites.length === 0,
  parasites.join(", "));

t("aucune traduction vide ou réduite à des espaces",
  CLES.every(cle => Object.values(CATALOGUE[cle]).every(v => String(v).trim().length > 0)));

/* ===================================================================== */
section("Messages destinés aux patients");

const CLES_SMS = CLES.filter(c => c.startsWith("sms_"));
t("le catalogue comporte des modèles de message patient", CLES_SMS.length >= 3);

// Chaque modèle doit conserver la variable {etablissement} : un SMS anonyme
// est un SMS que le patient ne peut pas rattacher, et donc ignore.
const sansEtablissement = [];
for (const cle of CLES_SMS) {
  for (const [code, texte] of Object.entries(CATALOGUE[cle])) {
    if (!texte.includes("{etablissement}")) sansEtablissement.push(`${cle}/${code}`);
  }
}
t("tout modèle de message nomme l'établissement", sansEtablissement.length === 0,
  sansEtablissement.slice(0, 10).join(", "));

// Aucune variable inventée : une variable non fournie à l'envoi s'afficherait
// telle quelle dans le SMS reçu par le patient.
const VARIABLES_ADMISES = new Set(["etablissement", "numero", "date"]);
const variablesInconnues = [];
for (const cle of CLES_SMS) {
  for (const [code, texte] of Object.entries(CATALOGUE[cle])) {
    for (const m of texte.matchAll(/\{(\w+)\}/g)) {
      if (!VARIABLES_ADMISES.has(m[1])) variablesInconnues.push(`${cle}/${code}:{${m[1]}}`);
    }
  }
}
t("aucune variable hors du jeu autorisé", variablesInconnues.length === 0,
  variablesInconnues.slice(0, 10).join(", "));

// Le contrôle le plus important de ce fichier. Un SMS n'est pas un canal
// confidentiel : il transite en clair et s'affiche sur un écran verrouillé.
// Aucun modèle ne doit donc contenir de valeur biologique ni de nom
// d'analyse. On cherche les motifs qui trahiraient une telle fuite.
const MOTIFS_INTERDITS = [
  /\{(valeur|resultat|résultat|analyse|test|taux|mesure|diagnostic)\}/i,
  /\bmg\/d[lL]\b/, /\bmmol\/[lL]\b/, /\bg\/d[lL]\b/, /\bUI\/[lL]\b/,
  /\d+[.,]\d+\s*(mg|mmol|g|µg|UI)\b/,
];
const fuites = [];
for (const cle of CLES_SMS) {
  for (const [code, texte] of Object.entries(CATALOGUE[cle])) {
    if (MOTIFS_INTERDITS.some(r => r.test(texte))) fuites.push(`${cle}/${code}`);
  }
}
t("aucun modèle ne divulgue de valeur biologique", fuites.length === 0, fuites.join(", "));

// Un SMS au-delà de 320 caractères part en trois segments et coûte trois
// fois le prix ; au-delà de 480, certaines passerelles le tronquent.
const troplongs = [];
for (const cle of CLES_SMS) {
  for (const [code, texte] of Object.entries(CATALOGUE[cle])) {
    if (texte.length > 320) troplongs.push(`${cle}/${code} (${texte.length})`);
  }
}
t("aucun modèle ne dépasse 320 caractères", troplongs.length === 0,
  troplongs.slice(0, 8).join(", "));

/* ===================================================================== */
section("Moteur de traduction");

i18n.definirLangue("fr", { memoriser: false });
check("langue courante après définition", i18n.langueCourante(), "fr");
check("traduction en français", i18n.t("nav_patients"), "Patients");

i18n.definirLangue("sw", { memoriser: false });
check("bascule vers le swahili", i18n.t("nav_patients"), CATALOGUE.nav_patients.sw);

// Le repli est la garantie qu'aucun écran ne se vide : on force une langue
// pour laquelle la clé n'existe pas et on vérifie la descente.
const cleFictive = "__cle_de_controle__";
CATALOGUE[cleFictive] = { en: "English only", fr: "Français seulement" };
check("repli vers l'anglais quand la langue manque",
  i18n.t(cleFictive, null, { langue: "km" }), "English only");
delete CATALOGUE[cleFictive].en;
check("repli vers le français quand l'anglais manque aussi",
  i18n.t(cleFictive, null, { langue: "km" }), "Français seulement");
delete CATALOGUE[cleFictive];

check("une clé absente renvoie la clé, jamais une chaîne vide",
  i18n.t("cle_qui_n_existe_pas"), "cle_qui_n_existe_pas");

check("interpolation d'une variable",
  i18n.t("sms_resultats", { etablissement: "CHU", numero: "D-1", date: "01/08" },
    { langue: "en" }).includes("CHU"), true);

// Une variable oubliée doit rester visible plutôt que d'écrire « undefined »
// dans un message envoyé à un patient.
t("une variable non fournie reste littérale",
  i18n.t("sms_resultats", { etablissement: "CHU" }, { langue: "en" })
    .includes("{date}") ||
  !CATALOGUE.sms_resultats.en.includes("{date}"));

t("forcer une langue ne change pas la langue courante",
  (() => { i18n.definirLangue("fr", { memoriser: false });
    i18n.t("nav_patients", null, { langue: "ja" });
    return i18n.langueCourante() === "fr"; })());

check("une langue inconnue retombe sur le français",
  i18n.definirLangue("xx", { memoriser: false }), "fr");

check("traduite() distingue une vraie traduction d'un repli",
  i18n.traduite("nav_patients", "zu"), true);
check("traduite() est fausse pour une clé absente",
  i18n.traduite("cle_absente", "fr"), false);

section("Formatage local");

i18n.definirLangue("fr", { memoriser: false });
check("nombre en français", i18n.nombre(1234.5, 1), "1 234,5".replace(/ /g, " "));
check("nombre en allemand", i18n.nombre(1234.5, 1, "de"), "1.234,5");
check("nombre en anglais", i18n.nombre(1234.5, 1, "en"), "1,234.5");
check("valeur absente rendue par un tiret", i18n.nombre(null), "—");
check("valeur non numérique rendue par un tiret", i18n.nombre(NaN), "—");
check("date absente rendue par un tiret", i18n.date(null), "—");
t("une date invalide ne lève pas", i18n.date("pas une date") === "—");
t("la date suit la locale",
  i18n.date("2026-07-30", false, "en") !== i18n.date("2026-07-30", false, "de"));

section("Couverture");

const rapport = i18n.couverture();
check("le rapport couvre les 50 langues", Object.keys(rapport).length, 50);
t("aucune langue sous 100 % de couverture",
  Object.values(rapport).every(r => r.taux === 1),
  Object.entries(rapport).filter(([, r]) => r.taux < 1)
    .map(([c, r]) => `${c}:${Math.round(r.taux * 100)}%`).join(", "));

/* ===================================================================== */
console.log(`\n${"─".repeat(62)}`);
if (failed === 0) {
  console.log(`\x1b[32m\x1b[1m✓ ${passed} contrôles au vert.\x1b[0m`);
} else {
  console.log(`\x1b[31m\x1b[1m✗ ${failed} échec(s) sur ${passed + failed} contrôles :\x1b[0m`);
  for (const f of failures) console.log(`   • ${f}`);
}
process.exit(failed === 0 ? 0 : 1);
