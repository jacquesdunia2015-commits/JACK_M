#!/usr/bin/env node
// medistat/tests/modules.test.mjs
// Contrôles d'intégrité du code applicatif, exécutables sans navigateur :
//   — chaque fichier est syntaxiquement valide ;
//   — chaque import nommé correspond à un export réellement présent ;
//   — chaque vue déclarée au routeur existe dans son module ;
//   — chaque entrée de navigation pointe vers une vue connue ;
//   — le service worker référence des fichiers qui existent.
//
// Ces contrôles attrapent la classe d'erreurs la plus fréquente dans une
// application à modules : un renommage propagé à moitié.
// Lancement :  node tests/modules.test.mjs

import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, resolve, relative, join } from "node:path";
import { fileURLToPath } from "node:url";

const racine = resolve(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(racine);

let passed = 0, failed = 0;
const failures = [];
const t = (nom, condition, detail = "") => {
  if (condition) passed++;
  else { failed++; failures.push(nom + (detail ? `\n     ${detail}` : "")); }
};
const section = titre => console.log(`\n\x1b[1m── ${titre}\x1b[0m`);

const fichiers = execSync('find js -name "*.js"').toString().trim().split("\n").sort();

/* ===================================================================== */
section("Validité syntaxique");

for (const f of fichiers) {
  let ok = true, message = "";
  try { execSync(`node --check "${f}"`, { stdio: "pipe" }); }
  catch (e) { ok = false; message = String(e.stderr || e.message).split("\n").slice(0, 3).join(" "); }
  t(`syntaxe — ${f}`, ok, message);
}
t("nombre de modules", fichiers.length >= 25, `${fichiers.length} fichiers`);

/* ===================================================================== */
section("Résolution des imports nommés");

// Le caractère « $ » est un identifiant valide en JavaScript : il doit être
// accepté par les expressions rationnelles de collecte, sans quoi les
// utilitaires $ et $$ passent pour absents.
const IDENT = "[\\w$]+";

const exportsPar = new Map();
for (const f of fichiers) {
  const src = readFileSync(f, "utf8");
  const noms = new Set();
  for (const m of src.matchAll(new RegExp(`export\\s+(?:async\\s+)?function\\s+(${IDENT})`, "g"))) noms.add(m[1]);
  for (const m of src.matchAll(new RegExp(`export\\s+(?:const|let|var|class)\\s+(${IDENT})`, "g"))) noms.add(m[1]);
  for (const m of src.matchAll(/export\s*\{([^}]+)\}/g)) {
    for (const p of m[1].split(",")) {
      const cible = p.trim().split(/\s+as\s+/).pop().trim();
      if (cible) noms.add(cible);
    }
  }
  exportsPar.set(f, noms);
}

let importsVerifies = 0, importsCasses = 0;
for (const f of fichiers) {
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(/import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/g)) {
    const chemin = m[2];
    if (!chemin.startsWith(".")) continue;
    const cible = relative(racine, resolve(dirname(f), chemin));
    const dispo = exportsPar.get(cible);
    if (!dispo) {
      importsCasses++;
      t(`module cible existe — ${f} → ${chemin}`, false, `${cible} introuvable`);
      continue;
    }
    for (const p of m[1].split(",")) {
      const nom = p.trim().split(/\s+as\s+/)[0].trim();
      if (!nom) continue;
      importsVerifies++;
      if (!dispo.has(nom)) {
        importsCasses++;
        failed++;
        failures.push(`import non résolu — ${f}\n     « ${nom} » est absent de ${cible}`);
      }
    }
  }
}
t(`imports nommés résolus (${importsVerifies} vérifiés)`, importsCasses === 0,
  `${importsCasses} import(s) cassé(s)`);

// Les imports d'espace de noms (import * as x) doivent aussi cibler un module réel
for (const f of fichiers) {
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(/import\s+\*\s+as\s+[\w$]+\s+from\s*["'](\.[^"']+)["']/g)) {
    const cible = relative(racine, resolve(dirname(f), m[1]));
    t(`espace de noms — ${f} → ${m[1]}`, existsSync(cible), `${cible} introuvable`);
  }
}
// Et les imports dynamiques, utilisés pour le chargement à la demande
for (const f of fichiers) {
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(/import\(\s*["'](\.[^"']+)["']\s*\)/g)) {
    const cible = relative(racine, resolve(dirname(f), m[1]));
    t(`import dynamique — ${f} → ${m[1]}`, existsSync(cible), `${cible} introuvable`);
  }
}

/* ===================================================================== */
section("Contrat du routeur");

const app = readFileSync("js/app.js", "utf8");
const debutVues = app.indexOf("const VUES = {");
const bloc = app.slice(debutVues, app.indexOf("};", debutVues));
const routes = [...bloc.matchAll(/"([\w-]+)":\s*\(\)\s*=>\s*import\("([^"]+)"\)/g)]
  .map(m => ({ vue: m[1], module: m[2].replace("./", "js/") }));

t("routes déclarées", routes.length >= 15, `${routes.length} routes`);
for (const r of routes) {
  const attendu = "vue_" + r.vue.replace(/-/g, "_");
  const src = existsSync(r.module) ? readFileSync(r.module, "utf8") : "";
  t(`vue « ${r.vue} » → ${attendu}`,
    src.includes(`export async function ${attendu}`) || src.includes(`export function ${attendu}`),
    `attendue dans ${r.module}`);
}

// Chaque lien de navigation de l'interface doit correspondre à une route
const html = readFileSync("index.html", "utf8");
const vuesNav = [...html.matchAll(/data-vue="([\w-]+)"/g)].map(m => m[1]);
const connues = new Set(routes.map(r => r.vue));
for (const v of [...new Set(vuesNav)]) {
  t(`lien de navigation « ${v} » routé`, connues.has(v));
}

// Les droits déclarés sur les liens doivent employer la nomenclature du modèle
const modeleSrc = readFileSync("js/core/model.js", "utf8");
const droitsValides = new Set([...modeleSrc.matchAll(/\{ code: "(\w+)", label:/g)].map(m => m[1]));
for (const m of html.matchAll(/data-droit="(\w+):(\w+)"/g)) {
  t(`droit « ${m[1]}:${m[2]} » valide`, droitsValides.has(m[2]),
    `« ${m[2]} » ne fait pas partie des droits de l'article 10`);
}

/* ===================================================================== */
section("Coquille et ressources");

for (const [nom, chemin] of [
  ["page d'accueil", "index.html"],
  ["feuille de style", "css/style.css"],
  ["manifeste", "manifest.webmanifest"],
  ["service worker", "sw.js"],
]) {
  t(`${nom} présent`, existsSync(chemin));
}

// Les identifiants manipulés par app.js doivent exister dans la page
const idsUtilises = [...app.matchAll(/\$\("#([\w-]+)"\)/g)].map(m => m[1]);
for (const id of [...new Set(idsUtilises)]) {
  t(`élément #${id} présent dans la page`, html.includes(`id="${id}"`));
}

if (existsSync("sw.js")) {
  const sw = readFileSync("sw.js", "utf8");
  const listes = [...sw.matchAll(/"\.\/([^"]+)"/g)].map(m => m[1]).filter(x => x && !x.startsWith("http"));
  let manquants = 0;
  for (const ressource of [...new Set(listes)]) {
    if (ressource.endsWith("/")) continue;
    if (!existsSync(ressource)) { manquants++; failures.push(`service worker : ${ressource} introuvable`); failed++; }
  }
  t(`ressources du service worker présentes (${listes.length} référencées)`, manquants === 0,
    `${manquants} manquante(s)`);
}

if (existsSync("manifest.webmanifest")) {
  let manifeste = null;
  try { manifeste = JSON.parse(readFileSync("manifest.webmanifest", "utf8")); } catch { /* signalé ci-dessous */ }
  t("manifeste au format JSON valide", manifeste !== null);
  if (manifeste) {
    t("manifeste : nom", !!manifeste.name);
    t("manifeste : nom court", !!manifeste.short_name && manifeste.short_name.length <= 12);
    t("manifeste : point d'entrée", !!manifeste.start_url);
    t("manifeste : mode d'affichage", manifeste.display === "standalone");
    t("manifeste : icônes 192 et 512", (manifeste.icons || []).length >= 2);
    t("manifeste : icône adaptative",
      (manifeste.icons || []).some(i => String(i.purpose || "").includes("maskable")));
    for (const icone of manifeste.icons || []) {
      t(`icône ${icone.sizes} présente`, existsSync(icone.src.replace(/^\.\//, "")));
    }
  }
}

/* ===================================================================== */
section("Cohérence du modèle métier");

{
  const src = readFileSync("js/core/model.js", "utf8");
  // Les dix profils de l'article 5 doivent tous être présents
  for (const role of ["admin_systeme", "admin_etablissement", "medecin", "infirmier",
    "laborantin", "biologiste", "receptionniste", "pharmacien", "qualite", "comptable", "patient"]) {
    t(`rôle « ${role} » défini`, src.includes(`${role}: {`));
  }
  // Les neuf droits de l'article 10
  for (const droit of ["lecture", "creation", "modification", "validation",
    "suppression", "export", "administration", "signature", "resultatsSensibles"]) {
    t(`droit « ${droit} » défini`, droitsValides.has(droit));
  }
  // Les quatorze entités de l'article 17
  for (const entite of ["etablissement", "utilisateur", "patient", "consultation",
    "prescription", "testCatalogue", "demande", "echantillon", "resultat",
    "document", "facture", "notification", "audit"]) {
    t(`entité « ${entite} » modélisée`, src.includes(`  ${entite}: {`));
  }
}

/* ===================================================================== */
console.log(`\n${"═".repeat(62)}`);
if (failed === 0) {
  console.log(`\x1b[32m✓ ${passed} contrôles réussis, aucun échec.\x1b[0m`);
} else {
  console.log(`\x1b[31m✗ ${failed} échec(s) sur ${passed + failed} contrôles :\x1b[0m`);
  failures.slice(0, 40).forEach((f, i) => console.log(`\n  ${i + 1}. ${f}`));
  if (failures.length > 40) console.log(`\n  … et ${failures.length - 40} autre(s).`);
}
console.log(`${"═".repeat(62)}\n`);
process.exit(failed === 0 ? 0 : 1);
