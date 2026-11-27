// tests/aide.mjs — socle de vérification, sans aucune dépendance.
//
// QualiCode n'installe rien : ni npm, ni bibliothèque de test. Un chercheur
// doit pouvoir vérifier son outil avec le seul Node déjà présent sur sa
// machine. Cinquante lignes suffisent — et elles ne vieilliront pas.

let reussis = 0;
const echecs = [];

/** Vérifie une condition. `detail` n'est affiché qu'en cas d'échec. */
export function verifier(nom, condition, detail = "") {
  if (condition) { reussis++; console.log(`  \x1b[32m✓\x1b[0m ${nom}`); }
  else { echecs.push(nom); console.log(`  \x1b[31m✗ ${nom}\x1b[0m${detail ? "\n      " + detail : ""}`); }
  return !!condition;
}

/** Égalité stricte, avec affichage de l'écart en cas d'échec. */
export function egal(nom, obtenu, attendu) {
  return verifier(nom, Object.is(obtenu, attendu),
    `attendu : ${JSON.stringify(attendu)}\n      obtenu  : ${JSON.stringify(obtenu)}`);
}

/** Égalité profonde (tableaux, objets simples). */
export function memeContenu(nom, obtenu, attendu) {
  const a = JSON.stringify(obtenu), b = JSON.stringify(attendu);
  return verifier(nom, a === b, `attendu : ${b}\n      obtenu  : ${a}`);
}

/** Comparaison numérique tolérante — indispensable pour les statistiques. */
export function proche(nom, obtenu, attendu, tolerance = 1e-6) {
  const ok = Number.isFinite(obtenu) && Math.abs(obtenu - attendu) <= tolerance;
  return verifier(nom, ok, `attendu : ${attendu} (± ${tolerance})\n      obtenu  : ${obtenu}`);
}

/** Vérifie qu'un appel lève bien une erreur (et non qu'il échoue en silence). */
export async function leve(nom, fn) {
  try { await fn(); } catch { return verifier(nom, true); }
  return verifier(nom, false, "aucune erreur levée");
}

export function titre(texte) {
  console.log(`\n\x1b[1m${texte}\x1b[0m`);
}

/** Affiche le bilan et termine le processus avec le bon code de sortie. */
export function bilan(nom) {
  console.log(`\n${"─".repeat(58)}`);
  if (echecs.length === 0) {
    console.log(`\x1b[32m\x1b[1m${nom} : ${reussis} vérifications, aucun échec.\x1b[0m`);
  } else {
    console.log(`\x1b[31m\x1b[1m${nom} : ${reussis} réussies, ${echecs.length} en échec\x1b[0m`);
    for (const e of echecs) console.log(`  \x1b[31m✗\x1b[0m ${e}`);
  }
  // Une sauvegarde différée (scheduleSave, 800 ms) peut encore être en attente :
  // sortir explicitement évite d'attendre un minuteur sans objet pour le test.
  process.exit(echecs.length === 0 ? 0 : 1);
}
