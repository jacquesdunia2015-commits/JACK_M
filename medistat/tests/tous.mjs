#!/usr/bin/env node
// medistat/tests/tous.mjs — exécute l'ensemble des contrôles.
//   node tests/tous.mjs
import { spawnSync } from "node:child_process";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const racine = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const suites = [
  ["Moteur statistique", "tests/stats.test.mjs"],
  ["Socle applicatif", "tests/app.test.mjs"],
  ["Exports et interopérabilité", "tests/export.test.mjs"],
  ["Intégrité des modules", "tests/modules.test.mjs"],
  ["Serveur d'API", "tests/serveur.test.mjs"],
];

let echecs = 0;
const bilan = [];
for (const [nom, fichier] of suites) {
  console.log(`\n\x1b[1m\x1b[44m  ${nom}  \x1b[0m`);
  const r = spawnSync(process.execPath, [join(racine, fichier)],
    { cwd: racine, stdio: "inherit" });
  const ok = r.status === 0;
  if (!ok) echecs++;
  bilan.push({ nom, ok });
}

console.log(`\n${"═".repeat(62)}`);
console.log("\x1b[1mBILAN\x1b[0m");
for (const b of bilan) {
  console.log(`  ${b.ok ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"}  ${b.nom}`);
}
console.log(echecs === 0
  ? "\n\x1b[32m\x1b[1mToutes les suites sont au vert.\x1b[0m"
  : `\n\x1b[31m\x1b[1m${echecs} suite(s) en échec.\x1b[0m`);
console.log(`${"═".repeat(62)}\n`);
process.exit(echecs === 0 ? 0 : 1);
