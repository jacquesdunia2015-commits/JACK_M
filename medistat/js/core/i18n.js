// medistat/js/core/i18n.js
// Moteur de traduction : il relie le registre des langues au catalogue des
// chaînes et applique la langue choisie à toute la page.
//
// Trois principes ont guidé l'écriture :
//
//  1. Une chaîne manquante ne doit JAMAIS faire disparaître un libellé.
//     La chaîne de repli descend langue demandée → anglais → français → clé.
//     Un bouton mal traduit reste cliquable ; un bouton vide ne l'est pas.
//
//  2. La traduction ne passe jamais par innerHTML. Les libellés viennent d'un
//     catalogue statique, mais les variables interpolées viennent, elles, de
//     la base : nom d'établissement, numéro de demande. On écrit donc toujours
//     dans textContent.
//
//  3. Les nombres et les dates suivent la locale de la langue, pas celle du
//     navigateur : un utilisateur qui bascule l'interface en allemand attend
//     « 12,5 » et « 30.07.2026 », quel que soit le réglage de son système.

import { LANGUES, langue, estRTL, detecterLangue, parContinent } from "./langues.js";
import { CATALOGUE } from "../i18n/catalogue.js";

const CLE_STOCKAGE = "medistat.langue";

// Repli : l'anglais avant le français, car un francophone comprendra un
// libellé anglais plus souvent que l'inverse pour les langues non couvertes.
const REPLIS = ["en", "fr"];

let courante = "fr";
const abonnes = new Set();

/* ══════════════════════════ Lecture des chaînes ══════════════════════════ */

// Interpolation de la forme « Bonjour {nom} ». Une variable absente est
// laissée telle quelle plutôt que remplacée par « undefined » : le défaut
// reste ainsi lisible et repérable en relecture.
function interpoler(modele, variables) {
  if (!variables) return modele;
  return modele.replace(/\{(\w+)\}/g, (brut, nom) =>
    Object.prototype.hasOwnProperty.call(variables, nom) ? String(variables[nom]) : brut);
}

// Traduit une clé dans la langue courante, ou dans la langue demandée.
// `variables` alimente l'interpolation, `options.langue` force une langue —
// indispensable pour composer un SMS dans la langue du patient alors que
// l'interface du laborantin est dans une autre.
export function t(cle, variables = null, options = {}) {
  const entree = CATALOGUE[cle];
  if (!entree) return cle;
  const demandee = options.langue || courante;
  for (const code of [demandee, ...REPLIS]) {
    const texte = entree[code];
    if (texte) return interpoler(texte, variables);
  }
  return cle;
}

// Vrai si la clé possède une traduction propre à cette langue, sans repli.
// Sert aux contrôles de couverture et à l'écran d'administration.
export function traduite(cle, code = courante) {
  return Boolean(CATALOGUE[cle] && CATALOGUE[cle][code]);
}

export function langueCourante() {
  return courante;
}

export function infoLangueCourante() {
  return langue(courante) || langue("fr");
}

/* ═══════════════════════ Nombres, dates et pluriels ══════════════════════ */

function localeDe(code) {
  const l = langue(code || courante);
  return l ? l.locale : "fr-FR";
}

export function nombre(valeur, decimales = null, code = null) {
  if (valeur === null || valeur === undefined || Number.isNaN(valeur)) return "—";
  const opts = decimales === null
    ? { maximumFractionDigits: 3 }
    : { minimumFractionDigits: decimales, maximumFractionDigits: decimales };
  try {
    return new Intl.NumberFormat(localeDe(code), opts).format(valeur);
  } catch {
    return String(valeur);
  }
}

export function date(valeur, avecHeure = false, code = null) {
  if (!valeur) return "—";
  const d = valeur instanceof Date ? valeur : new Date(valeur);
  if (Number.isNaN(d.getTime())) return "—";
  const opts = avecHeure
    ? { dateStyle: "short", timeStyle: "short" }
    : { dateStyle: "short" };
  try {
    return new Intl.DateTimeFormat(localeDe(code), opts).format(d);
  } catch {
    return d.toISOString().slice(0, avecHeure ? 16 : 10).replace("T", " ");
  }
}

/* ══════════════════════ Application à la page ═══════════════════════════ */

// Traduit un sous-arbre du document. Quatre attributs sont reconnus :
//   data-i18n           → textContent
//   data-i18n-placeholder, data-i18n-titre, data-i18n-aria → attributs
// Les variables communes ({etablissement}) sont fournies par l'appelant.
export function appliquer(racine = null, variables = null) {
  if (typeof document === "undefined") return 0;
  const hote = racine || document.body;
  if (!hote) return 0;
  let compte = 0;
  const champs = [
    ["data-i18n", null],
    ["data-i18n-placeholder", "placeholder"],
    ["data-i18n-titre", "title"],
    ["data-i18n-aria", "aria-label"],
  ];
  for (const [attribut, cible] of champs) {
    for (const el of hote.querySelectorAll(`[${attribut}]`)) {
      const texte = t(el.getAttribute(attribut), variables);
      if (cible) el.setAttribute(cible, texte);
      else el.textContent = texte;
      compte++;
    }
  }
  return compte;
}

// Change la langue de toute l'application. Renvoie le code réellement retenu :
// un code inconnu ne provoque pas d'erreur, il retombe sur le français.
export function definirLangue(code, { memoriser = true } = {}) {
  const info = langue(code);
  courante = info ? info.code : "fr";

  if (typeof document !== "undefined" && document.documentElement) {
    const html = document.documentElement;
    html.lang = courante;
    // La direction conditionne toute la mise en page : elle est posée sur
    // <html> pour que les marges logiques du CSS s'inversent d'elles-mêmes.
    html.dir = estRTL(courante) ? "rtl" : "ltr";
    html.setAttribute("data-script", info ? info.script : "latin");
  }

  if (memoriser) {
    try { localStorage.setItem(CLE_STOCKAGE, courante); } catch { /* mode privé */ }
  }

  appliquer();
  for (const f of abonnes) {
    try { f(courante); } catch (e) { console.error("i18n : abonné en échec", e); }
  }
  return courante;
}

// Les modules déjà rendus se réabonnent pour se redessiner au changement.
export function surChangementLangue(fonction) {
  abonnes.add(fonction);
  return () => abonnes.delete(fonction);
}

export function langueMemorisee() {
  try { return localStorage.getItem(CLE_STOCKAGE); } catch { return null; }
}

// Démarrage : choix mémorisé, sinon préférence du navigateur, sinon français.
export function initialiserLangue(prefere = null) {
  const memorise = prefere || langueMemorisee();
  return definirLangue(detecterLangue(memorise), { memoriser: false });
}

/* ═══════════════════════════ Sélecteur de langue ═════════════════════════ */

// Construit un <select> groupé par continent. Les options portent l'endonyme
// (« Kiswahili », « हिन्दी ») afin qu'un locuteur reconnaisse sa langue sans
// passer par le français, et le nom français en second pour l'administration.
export function construireSelecteur(document_, { id = "selecteurLangue" } = {}) {
  const doc = document_ || (typeof document !== "undefined" ? document : null);
  if (!doc) return null;
  const select = doc.createElement("select");
  select.id = id;
  select.className = "champ champ--compact selecteur-langue";
  select.setAttribute("aria-label", t("ui_langue"));

  for (const [continent, liste] of parContinent()) {
    if (!liste.length) continue;
    const groupe = doc.createElement("optgroup");
    groupe.label = continent;
    for (const l of liste) {
      const option = doc.createElement("option");
      option.value = l.code;
      option.textContent = l.nom === l.nomFr ? l.nom : `${l.nom} — ${l.nomFr}`;
      if (l.code === courante) option.selected = true;
      groupe.appendChild(option);
    }
    select.appendChild(groupe);
  }
  select.addEventListener("change", () => definirLangue(select.value));
  return select;
}

/* ═══════════════════════════ Contrôle de couverture ══════════════════════ */

// Taux de traduction par langue. Alimente l'écran d'administration et le jeu
// de tests : une régression de couverture doit se voir tout de suite.
export function couverture() {
  const cles = Object.keys(CATALOGUE);
  const total = cles.length;
  const rapport = {};
  for (const l of LANGUES) {
    let n = 0;
    for (const cle of cles) if (CATALOGUE[cle][l.code]) n++;
    rapport[l.code] = { traduites: n, total, taux: total ? n / total : 0 };
  }
  return rapport;
}

export { LANGUES, langue, estRTL, parContinent };
