#!/usr/bin/env node
// tests/tous.mjs — exécute toutes les suites de QualiCode.
//
//   node tests/tous.mjs
//
// Aucune installation, aucune dépendance : le Node déjà présent sur la machine
// suffit. Les vérifications qui exigent un vrai navigateur (IndexedDB réelle,
// import REFI-QDA, interface) sont dans tests/navigateur.html, à ouvrir dans
// un navigateur — le bilan s'y affiche dans la page.

import { spawnSync } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const racine = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const suites = [
  ["Intégrité de l'application", "tests/integrite.test.mjs"],
  ["Persistance des projets", "tests/persistance.test.mjs"],
  ["Codage", "tests/codage.test.mjs"],
  ["Analyse", "tests/analyse.test.mjs"],
  ["Statistiques", "tests/statistiques.test.mjs"],
  ["Exports et interopérabilité", "tests/echange.test.mjs"],
  ["Fusion et accord inter-codeurs", "tests/fusion.test.mjs"],
  ["Licence et accès libre", "tests/licence.test.mjs"],
];

const seule = process.argv[2];
const aExecuter = seule
  ? suites.filter(([nom, f]) => f.includes(seule) || nom.toLowerCase().includes(seule.toLowerCase()))
  : suites;

if (!aExecuter.length) {
  console.error(`Aucune suite ne correspond à « ${seule} ».`);
  console.error("Suites disponibles : " + suites.map(s => s[1].replace(/^tests\/|\.test\.mjs$/g, "")).join(", "));
  process.exit(2);
}

let echecs = 0;
const bilan = [];
for (const [nom, fichier] of aExecuter) {
  console.log(`\n\x1b[1m\x1b[44m  ${nom}  \x1b[0m`);
  const r = spawnSync(process.execPath, [join(racine, fichier)], { cwd: racine, stdio: "inherit" });
  const ok = r.status === 0;
  if (!ok) echecs++;
  bilan.push({ nom, ok });
}

console.log(`\n${"═".repeat(62)}`);
console.log("\x1b[1mBILAN\x1b[0m");
for (const b of bilan) console.log(`  ${b.ok ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"}  ${b.nom}`);
console.log(echecs === 0
  ? "\n\x1b[32m\x1b[1mToutes les suites sont au vert.\x1b[0m"
  : `\n\x1b[31m\x1b[1m${echecs} suite(s) en échec.\x1b[0m`);
console.log(`\nVérifications en navigateur réel : ouvrez tests/navigateur.html`);
console.log(`${"═".repeat(62)}\n`);
process.exit(echecs === 0 ? 0 : 1);
