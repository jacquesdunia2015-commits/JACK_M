#!/usr/bin/env node
// medistat/outils/construire-autonome.mjs
// Produit une version autonome de MediStat : un seul fichier HTML, sans
// aucune ressource externe, exécutable en double-cliquant dessus ou en le
// déposant sur n'importe quel hébergement statique.
//
// Pourquoi un assembleur écrit à la main plutôt qu'un outil du commerce.
// Le projet n'a aucune dépendance, à la construction comme à l'exécution :
// c'est un choix assumé dans un contexte médical, où chaque dépendance est
// une surface d'attaque et une mise à jour à suivre. Introduire un
// empaqueteur de 300 Mo pour concaténer trente fichiers reviendrait à
// abandonner ce choix au dernier moment.
//
// Ce que fait l'assembleur : il lit le graphe des modules à partir de
// js/app.js, réécrit la syntaxe des modules ES en un petit registre, puis
// insère le tout — script et feuille de style — dans index.html.
//
// Ce qu'il ne fait pas : il ne minifie pas et ne transpile pas. Le code
// livré est le code écrit, lisible tel quel dans l'inspecteur du
// navigateur. Pour un logiciel qui manipule des données de santé, pouvoir
// lire ce qui s'exécute vaut mieux que gagner quelques kilo-octets.
//
// Lancement :  node outils/construire-autonome.mjs [chemin/de/sortie.html]

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve, relative, join } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// Deux sorties possibles :
//   — par défaut, un document HTML complet, à ouvrir ou à héberger tel quel ;
//   — avec --fragment, le seul contenu du corps, pour les hôtes qui
//     fournissent eux-mêmes l'ossature <html>/<head>/<body> (visionneuse
//     d'artefact, intégration dans un portail existant).
const arguments_ = process.argv.slice(2);
const FRAGMENT = arguments_.includes("--fragment");
const chemin = arguments_.find(a => !a.startsWith("--"));
const SORTIE = chemin
  ? resolve(chemin)
  : join(RACINE, "dist", FRAGMENT ? "medistat-fragment.html" : "medistat-autonome.html");

/* ═════════════════════ Lecture du graphe de modules ═════════════════════ */

const modules = new Map();   // chemin relatif → code source réécrit
const ordre = [];            // ordre de découverte, pour le rapport

function normaliser(chemin) {
  return relative(RACINE, chemin).split("\\").join("/");
}

function charger(chemin) {
  const cle = normaliser(chemin);
  if (modules.has(cle)) return cle;
  modules.set(cle, null);          // réservation : coupe les cycles
  const source = readFileSync(chemin, "utf8");
  const { code, dependances } = reecrire(source, chemin);
  for (const d of dependances) charger(d);
  modules.set(cle, code);
  ordre.push(cle);
  return cle;
}

/* ═══════════════════ Réécriture d'un module ES ══════════════════════════ */

// Les exports sont exposés par accesseurs plutôt que par copie. Une copie
// prise à la fin du module figerait la valeur : un `let` réaffecté plus tard
// ne serait jamais vu par les autres modules, et un cycle lirait `undefined`.
// L'accesseur reproduit la liaison vivante des modules ES.
function reecrire(source, chemin) {
  const dossier = dirname(chemin);
  const dependances = [];
  const exportes = new Map();      // nom exporté → nom local

  const resoudre = spec => {
    const abs = resolve(dossier, spec);
    dependances.push(abs);
    return normaliser(abs);
  };

  let code = source;

  // import * as X from "…"
  code = code.replace(
    /^import\s+\*\s+as\s+(\w+)\s+from\s+["']([^"']+)["'];?/gm,
    (_, nom, spec) => `const ${nom} = __req(${JSON.stringify(resoudre(spec))});`);

  // import { a, b as c } from "…"  — y compris sur plusieurs lignes
  code = code.replace(
    /^import\s*\{([\s\S]*?)\}\s*from\s*["']([^"']+)["'];?/gm,
    (_, liste, spec) => {
      const liaisons = liste.split(",").map(s => s.trim()).filter(Boolean)
        .map(s => {
          const m = s.match(/^([\w$]+)\s+as\s+([\w$]+)$/);
          return m ? `${m[1]}: ${m[2]}` : s;
        });
      return `const { ${liaisons.join(", ")} } = __req(${JSON.stringify(resoudre(spec))});`;
    });

  // import "…"  (effet de bord seul)
  code = code.replace(/^import\s+["']([^"']+)["'];?/gm,
    (_, spec) => `__req(${JSON.stringify(resoudre(spec))});`);

  // export { a, b as c }
  code = code.replace(/^export\s*\{([^}]*)\};?/gm, (_, liste) => {
    for (const brut of liste.split(",").map(s => s.trim()).filter(Boolean)) {
      const m = brut.match(/^([\w$]+)\s+as\s+([\w$]+)$/);
      if (m) exportes.set(m[2], m[1]); else exportes.set(brut, brut);
    }
    return "";
  });

  // export function / async function / const / let / class
  code = code.replace(
    /^export\s+(async\s+function|function|const|let|var|class)\s+([\w$]+)/gm,
    (_, mot, nom) => { exportes.set(nom, nom); return `${mot} ${nom}`; });

  // import("…") dynamique : le module est déjà présent, on rend une promesse
  // tenue. Le chargement à la demande n'a plus de sens dans un fichier
  // unique, mais le code appelant n'a pas à le savoir.
  code = code.replace(/\bimport\(\s*["']([^"']+)["']\s*\)/g,
    (_, spec) => `Promise.resolve(__req(${JSON.stringify(resoudre(spec))}))`);

  const restes = code.match(/^\s*(import|export)\s/gm);
  if (restes) {
    throw new Error(`${normaliser(chemin)} : forme de module non prise en charge — `
      + `${restes.length} occurrence(s) de « import » ou « export » subsistent. `
      + `L'assembleur reconnaît les imports nommés, les imports d'espace de noms `
      + `et les exports nommés ; il ne gère ni « export default » ni les réexports.`);
  }

  const accesseurs = [...exportes.entries()]
    .map(([nom, local]) =>
      `  Object.defineProperty(__x, ${JSON.stringify(nom)}, `
      + `{ get: () => ${local}, enumerable: true });`)
    .join("\n");

  return { code: `${accesseurs}\n${code}`, dependances };
}

/* ═════════════════════════ Assemblage ═══════════════════════════════════ */

charger(join(RACINE, "js", "app.js"));

const registre = `
// Marque la version en fichier unique : l'application y renonce au service
// worker, faute de fichier voisin à mettre en cache.
globalThis.MEDISTAT_AUTONOME = true;

// ── Registre de modules ──────────────────────────────────────────────────
// Reproduit le strict nécessaire de la sémantique des modules ES : une seule
// évaluation par module, et des liaisons vivantes entre eux. Les accesseurs
// sont posés avant l'exécution du corps, ce qui permet aux cycles éventuels
// de se résoudre comme ils le feraient nativement.
const __definitions = {};
const __evalues = {};
function __def(nom, fabrique) { __definitions[nom] = fabrique; }
function __req(nom) {
  if (nom in __evalues) return __evalues[nom];
  const fabrique = __definitions[nom];
  if (!fabrique) throw new Error("Module absent de l'assemblage : " + nom);
  const __x = {};
  __evalues[nom] = __x;
  fabrique(__x, __req);
  return __x;
}
`;

const corps = ordre.map(cle => `
__def(${JSON.stringify(cle)}, function (__x, __req) {
"use strict";
${modules.get(cle)}
});`).join("\n");

const script = `${registre}\n${corps}\n\n__req("js/app.js");`;

/* ── Insertion dans le gabarit HTML ─────────────────────────────────────── */

let html = readFileSync(join(RACINE, "index.html"), "utf8");
const css = readFileSync(join(RACINE, "css", "style.css"), "utf8");

// Attention : `String.replace` interprète `$$`, `$&` et `$1` dans une chaîne
// de remplacement. Le code de la Solution contient `$` et `$$` — ce sont les
// noms des sélecteurs de ui.js — et une feuille de style peut contenir `$`.
// On passe donc systématiquement par une fonction de remplacement, qui elle
// est prise au pied de la lettre.
html = html.replace(/<link[^>]+rel="stylesheet"[^>]*>/g,
  () => `<style>\n${css}\n</style>`);

// Le manifeste et le service worker supposent des fichiers voisins servis en
// HTTP. Dans un fichier unique ils n'ont pas de sens : on les retire plutôt
// que de laisser le navigateur émettre des requêtes vouées à l'échec.
html = html.replace(/<link[^>]+rel="manifest"[^>]*>\s*/g, "");
// Les icônes sont des fichiers voisins. Plutôt que de les laisser produire
// des requêtes en erreur, l'icône vectorielle est intégrée à la page sous
// forme de données : l'onglet garde sa marque, sans fichier annexe.
const icone = readFileSync(join(RACINE, "assets", "icone.svg"), "utf8");
const iconeEnLigne = `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,`
  + `${Buffer.from(icone, "utf8").toString("base64")}">`;
html = html.replace(/<link[^>]+rel="apple-touch-icon"[^>]*>\s*/g, "");
html = html.replace(/<link[^>]+rel="icon"[^>]*>/, () => iconeEnLigne);
html = html.replace(/<script[^>]+src="[^"]*app\.js"[^>]*><\/script>/g, "");

// `</script>` dans une chaîne de caractères fermerait la balise : c'est la
// seule échappée nécessaire, le reste du code étant du JavaScript inerte.
const scriptSur = script.replace(/<\/script>/g, "<\\/script>");

html = html.replace("</body>",
  () => `<script type="module">\n${scriptSur}\n</script>\n</body>`);

if (!html.includes("<script type=\"module\">")) {
  throw new Error("Le gabarit index.html n'a pas de balise </body> : insertion impossible.");
}

if (FRAGMENT) {
  // On ne conserve que ce qui vit dans le corps, plus le titre, le style et
  // le script. L'hôte fournit le reste de l'ossature ; laisser un second
  // <html> ou un second <head> produirait un document invalide.
  const titre = (html.match(/<title>([\s\S]*?)<\/title>/) || [, "MediStat"])[1];
  const styles = [...html.matchAll(/<style>[\s\S]*?<\/style>/g)].map(m => m[0]).join("\n");
  const corpsSeul = (html.match(/<body[^>]*>([\s\S]*)<\/body>/) || [, ""])[1];
  html = `<title>${titre}</title>\n${styles}\n${corpsSeul}`;
}

mkdirSync(dirname(SORTIE), { recursive: true });
writeFileSync(SORTIE, html, "utf8");

const ko = n => `${(n / 1024).toFixed(0)} Ko`;
console.log(`MediStat autonome assemblé.`);
console.log(`  modules      : ${ordre.length}`);
console.log(`  script       : ${ko(script.length)}`);
console.log(`  feuille      : ${ko(css.length)}`);
console.log(`  fichier      : ${SORTIE} (${ko(html.length)})`);
