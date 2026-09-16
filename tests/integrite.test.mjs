#!/usr/bin/env node
// tests/integrite.test.mjs — l'application peut-elle seulement démarrer ?
//
// Rien de tout ce que vérifient les autres suites n'a d'importance si un
// fichier manque, si une traduction renvoie une clé brute à l'écran, ou si le
// mode hors ligne oublie un module — un entretien codé dans un train, sans
// réseau, ne se rattrape pas.

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { verifier, egal, memeContenu, titre, bilan } from "./aide.mjs";

const racine = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const lire = f => readFileSync(join(racine, f), "utf8");
const modules = readdirSync(join(racine, "js")).filter(f => f.endsWith(".js")).sort();

/* ================== Syntaxe ================== */
titre("Tous les modules sont syntaxiquement valides");
let invalides = [];
for (const m of modules) {
  try { execFileSync(process.execPath, ["--check", "--input-type=module"], { input: lire("js/" + m), stdio: ["pipe", "ignore", "pipe"] }); }
  catch (e) { invalides.push(m + " : " + String(e.stderr).split("\n").find(l => l.includes("Error")) ); }
}
verifier(`les ${modules.length} modules se compilent`, invalides.length === 0, invalides.join("\n      "));

titre("Les imports internes pointent vers des fichiers existants");
const importsCasses = [];
for (const m of modules) {
  const code = lire("js/" + m);
  for (const [, chemin] of code.matchAll(/(?:^|\n)\s*(?:import|export)[^;\n]*?from\s+["'](\.[^"']+)["']/g)) {
    const cible = join(racine, "js", chemin);
    if (!existsSync(cible)) importsCasses.push(`${m} → ${chemin}`);
  }
}
verifier("aucun import ne pointe dans le vide", importsCasses.length === 0, importsCasses.join(", "));

/* ================== Fonctionnement hors ligne ================== */
titre("Mode hors ligne : le service worker doit tout connaître");
const sw = lire("sw.js");
// On ne lit QUE le tableau SHELL : ailleurs dans le fichier, « ./index.html »
// réapparaît comme page de repli, et ce n'est pas un doublon de cache.
const bloc = sw.match(/const SHELL = \[([\s\S]*?)\];/)?.[1] ?? "";
verifier("la liste des fichiers à mettre en cache est repérable", bloc.length > 0);
const shell = [...bloc.matchAll(/"\.\/([^"]*)"/g)].map(m => m[1]).filter(x => x !== "");
const manquants = shell.filter(f => !existsSync(join(racine, f)));
verifier("chaque fichier mis en cache existe réellement", manquants.length === 0, manquants.join(", "));

const modulesEnCache = new Set(shell.filter(f => f.startsWith("js/")).map(f => f.slice(3)));
const oublies = modules.filter(m => !modulesEnCache.has(m));
verifier("aucun module n'est oublié du cache hors ligne", oublies.length === 0,
  "absents de sw.js : " + oublies.join(", "));
memeContenu("aucun fichier n'est listé deux fois",
  shell.filter((f, i) => shell.indexOf(f) !== i), []);
verifier("la feuille de style est mise en cache", shell.includes("css/style.css"));
verifier("la page elle-même est mise en cache", shell.includes("index.html"));

/* ================== Page principale et manifeste ================== */
titre("Page principale et manifeste d'installation");
const html = lire("index.html");
const refs = [...html.matchAll(/(?:src|href)="((?!https?:|data:|#|mailto:)[^"]+)"/g)].map(m => m[1]);
const refsManquantes = refs.filter(r => !existsSync(join(racine, r.split("?")[0])));
verifier("tous les fichiers appelés par index.html existent", refsManquantes.length === 0,
  refsManquantes.join(", "));
verifier("le script principal est chargé comme module",
  /<script type="module" src="js\/app\.js">/.test(html));

verifier("une page 404 est fournie (adresse fausse → retour à l'application)",
  existsSync(join(racine, "404.html")));
verifier("l'empreinte de version est présente dans la page",
  /<meta name="qc-version" content="[^"]*">/.test(html));
verifier("la barre d'état réserve une place à l'empreinte de version",
  html.includes('id="statusVersion"'));

// Le lien de téléchargement a longtemps pointé vers la branche `main`, restée
// deux mois en arrière : il livrait une version périmée de l'application.
const versMain = ["README.md", "INSTALLATION.md", "GUIDE_UTILISATION.md", "MANUEL_DEBUTANT.md"]
  .filter(f => lire(f).includes("/raw/main/"));
verifier("aucun lien de téléchargement ne pointe vers la branche main",
  versMain.length === 0, versMain.join(", "));

titre("Publication : ce que l'action vérifie avant de déployer");
const action = lire(".github/workflows/deploy-pages.yml");
for (const f of ["index.html", "manifest.webmanifest", "sw.js", "404.html", "css/style.css", "js/app.js"]) {
  verifier(`l'action refuse de publier sans ${f}`, action.includes(f));
}
verifier("l'action refuse de publier medistat/", /medistat/.test(action));
verifier("l'action retire les outils réservés au vendeur",
  action.includes("generer_cle.py") && action.includes("gestion_clients.py"));
verifier("l'action inscrit l'empreinte de version", action.includes("qc-version"));
verifier("l'action exécute les vérifications", action.includes("tests/tous.mjs"));

const manifeste = JSON.parse(lire("manifest.webmanifest"));
verifier("le manifeste est un JSON valide", !!manifeste.name);
const iconesManquantes = manifeste.icons.filter(i => !existsSync(join(racine, i.src)));
verifier("toutes les icônes déclarées existent", iconesManquantes.length === 0,
  iconesManquantes.map(i => i.src).join(", "));
verifier("une icône masquable est fournie (Android)",
  manifeste.icons.some(i => String(i.purpose).includes("maskable")));
verifier("l'application s'ouvre en mode autonome", manifeste.display === "standalone");
const racourcisManquants = (manifeste.shortcuts || [])
  .flatMap(s => s.icons || []).filter(i => !existsSync(join(racine, i.src)));
verifier("les icônes des raccourcis existent aussi", racourcisManquants.length === 0);

/* ================== Traductions ================== */
titre("Traductions : aucune clé ne doit s'afficher telle quelle");
const { translations, LANGS } = await import("../js/i18n.js");
const clesFr = new Set(Object.keys(translations.fr));
verifier("le français sert de langue de référence", clesFr.size > 200);

// Toute clé demandée par le code doit exister en français : sinon t() renvoie
// la clé elle-même et l'utilisateur lit « lic_free_badge » à l'écran.
const utilisees = new Set();
for (const m of modules) {
  for (const [, cle] of lire("js/" + m).matchAll(/\bt\(\s*"([a-z0-9_]+)"\s*\)/g)) utilisees.add(cle);
}
for (const [, cle] of html.matchAll(/data-i18n(?:-ph|-title)?="([a-z0-9_]+)"/g)) utilisees.add(cle);
const absentes = [...utilisees].filter(c => !clesFr.has(c));
verifier(`les ${utilisees.size} clés employées sont toutes traduites en français`,
  absentes.length === 0, "manquantes : " + absentes.join(", "));

const clesEn = new Set(Object.keys(translations.en));
const sansAnglais = [...clesFr].filter(c => !clesEn.has(c));
verifier("l'anglais couvre toutes les clés du français", sansAnglais.length === 0,
  `${sansAnglais.length} clés retombent sur le français : ` + sansAnglais.slice(0, 12).join(", "));

verifier("chaque langue annoncée possède bien un dictionnaire",
  LANGS.every(l => translations[l.code]), LANGS.filter(l => !translations[l.code]).map(l => l.code).join(", "));
verifier("les langues écrites de droite à gauche sont signalées",
  LANGS.find(l => l.code === "ar")?.rtl === true);

/* ================== Licence ================== */
titre("Cohérence de la licence");
const licence = lire("js/license.js");
const generateur = lire("tools/generer_cle.py");
const secretJs = licence.match(/LICENSE_SECRET = "([^"]*)"/)?.[1];
const secretPy = generateur.match(/LICENSE_SECRET = "([^"]*)"/)?.[1];
verifier("le secret est défini des deux côtés", !!secretJs && !!secretPy);
// Si les deux secrets divergent, chaque clé vendue est refusée par
// l'application : la panne se découvre chez le premier client.
egal("l'application et le générateur de clés partagent le même secret", secretJs, secretPy);

const { ACCES_LIBRE_JUSQU_AU, accesLibreActif } = await import("../js/license.js");
verifier("la date de fin d'accès libre est une date valide",
  /^\d{4}-\d{2}-\d{2}$/.test(ACCES_LIBRE_JUSQU_AU) && !isNaN(Date.parse(ACCES_LIBRE_JUSQU_AU)));
verifier(`l'accès libre est effectif aujourd'hui (jusqu'au ${ACCES_LIBRE_JUSQU_AU})`, accesLibreActif());

/* ================== Documentation ================== */
titre("Documentation livrée avec l'application");
for (const f of ["README.md", "GUIDE_UTILISATION.md", "MANUEL_DEBUTANT.md", "INSTALLATION.md"]) {
  verifier(`${f} est présent et non vide`, existsSync(join(racine, f)) && statSync(join(racine, f)).size > 500);
}

bilan("Intégrité");
