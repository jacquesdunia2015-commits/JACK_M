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

titre("Le projet courant ne se remplace que par remplacerProjet()");
// Toute affectation directe contournerait la remise à zéro de l'historique
// d'annulation — c'est ainsi qu'un Ctrl+Z pouvait vider un projet ouvert.
const affectations = modules.filter(m => m !== "state.js")
  .flatMap(m => [...lire("js/" + m).matchAll(/\bstate\.project\s*=(?!=)/g)].map(() => m));
verifier("aucun module n'affecte state.project directement", affectations.length === 0,
  "affectations directes dans : " + [...new Set(affectations)].join(", "));

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
/* ================== Dossier d'exercice (présent sur la branche de travail) ================== */
// Ce dossier ne suit pas l'application : il n'existe pas sur la branche
// déployée. Les contrôles ne s'exécutent donc que s'il est là.
if (existsSync(join(racine, "memoire-ngoma"))) {
  titre("Dossier d'exercice memoire-ngoma/");
  const lisezMoi = lire("memoire-ngoma/LISEZ-MOI.md");
  verifier("l'avertissement « données simulées » ouvre le LISEZ-MOI",
    /^#\s*⚠️\s*DONNÉES ENTIÈREMENT SIMULÉES/m.test(lisezMoi));
  verifier("le déploiement refuse explicitement ce dossier",
    lire(".github/workflows/deploy-pages.yml").includes("memoire-ngoma"));

  // UN SEUL projet : il porte le nom et l'identifiant de celui qui est déjà
  // dans l'application, pour le remplacer au lieu de créer un doublon.
  const chemin = "memoire-ngoma/livrables/Memoire_Ngoma_SIMULATION.projx";
  if (verifier("le projet d'exercice est présent", existsSync(join(racine, chemin)))) {
    const projx = JSON.parse(lire(chemin));
    egal("format QualiCode", projx.format, "qualicode-projx");
    egal("même identifiant que le projet déjà présent dans l'application", projx.id, "memoire-ngoma-simulation");
    egal("même nom que le projet déjà présent dans l'application", projx.name, "Mémoire Ngoma — SIMULATION de formation");

    const codes = new Set(projx.codes.map(c => c.id));
    const docs = new Map(projx.documents.map(d => [d.id, d]));
    const orphelins = projx.segments.filter(s => !codes.has(s.codeId) || !docs.has(s.docId));
    verifier("aucun codage ne pointe dans le vide", orphelins.length === 0, String(orphelins.length));
    const decales = projx.segments.filter(s => {
      const d = docs.get(s.docId);
      return !d || s.start < 0 || s.end > d.text.length || s.end <= s.start || s.text !== d.text.slice(s.start, s.end);
    });
    verifier("chaque extrait correspond exactement à son passage", decales.length === 0, String(decales.length));
    verifier("tous les documents portent l'avertissement de simulation",
      projx.documents.every(d => d.text.includes("DONNÉES SIMULÉES")));
    verifier("le mémo de projet avertit que rien ne peut être cité", /ne peut être cité/i.test(projx.memo));

    // Composition visée par le protocole
    const ent = projx.documents.filter(d => d.variables?.type_document === "entretien");
    egal("21 participants", ent.length, 21);
    egal("11 sages-femmes", ent.filter(d => d.variables.qualification === "sage-femme").length, 11);
    egal("10 infirmiers ou infirmières", ent.filter(d => d.variables.qualification === "infirmier").length, 10);
    egal("les 16 centres du district", new Set(projx.documents.map(d => d.variables?.code_structure)).size, 16);
    memeContenu("les deux vagues sont identifiées (10 + 11)",
      ["1", "2"].map(v => ent.filter(d => d.variables.vague === v).length), [10, 11]);
    const relus = new Set(projx.segments.filter(s => s.coder === "C2").map(s => s.docId));
    verifier("un tiers des entretiens est double-codé (§ 4.2.6)", relus.size * 3 >= ent.length, `${relus.size} sur ${ent.length}`);
    verifier("la stabilité intra-codeur est documentée (C1b)", projx.segments.some(s => s.coder === "C1b"));

    // Consentements : un refus de citation doit être respecté par la requête
    const p05 = ent.find(d => /P05/.test(d.name));
    egal("le refus de citation de P05 est enregistré", p05?.variables.citation_autorisee, "non");
    const citables = projx.savedQueries.find(q => /citables/i.test(q.name));
    verifier("la requête « Extraits citables » existe", !!citables);
    verifier("elle exclut l'entretien dont l'auteur a refusé la citation", citables && !citables.activatedDocs.includes(p05?.id));

    // Les six phases de l'analyse thématique, et la note de positionnalité
    const titres = projx.memos.filter(m => m.targetType === "project").map(m => m.title);
    for (const n of [1, 2, 3, 4, 5, 6]) {
      verifier(`la phase ${n} de l'analyse thématique est documentée`, titres.some(t => t.startsWith(`Phase ${n} `)));
    }
    // La note de positionnalité est un modèle d'exercice : les faits
    // biographiques que rien ne donne restent des hypothèses à remplacer.
    const posit = projx.memos.find(m => m.targetType === "project" && /positionnalité/i.test(m.title));
    verifier("la note de positionnalité est présentée comme un modèle d'exercice",
      !!posit && /MODÈLE D'EXERCICE/.test(posit.title) && /HYPOTHÈSES D'EXERCICE/.test(posit.text));
    verifier("ses faits biographiques restent des hypothèses entre crochets",
      !!posit && /\[Profession :/.test(posit.text) && /\[Lien avec le district/.test(posit.text) && /\[Sexe et âge : à préciser/.test(posit.text));

    // Les chiffres du LISEZ-MOI sont écrits à la main : ils doivent suivre le projet
    const fr = n => n.toLocaleString("fr-FR").replace(/\u202f|\u00a0/g, " ");
    verifier("le LISEZ-MOI annonce le bon nombre de segments",
      lisezMoi.includes(`| Segments codés | ${fr(projx.segments.length)} |`), `attendu : ${fr(projx.segments.length)}`);
    verifier("le LISEZ-MOI annonce le bon nombre de documents",
      lisezMoi.includes(`| Documents | ${projx.documents.length} `), `attendu : ${projx.documents.length}`);

    const parCible = t => projx.memos.filter(m => m.targetType === t).length;
    verifier("le LISEZ-MOI annonce le bon nombre de mémos",
      lisezMoi.includes(`| Mémos | ${parCible("project")} mémos d'analyse, ${parCible("document")} journaux de bord, ${parCible("code")} définitions de familles |`),
      `attendu : ${parCible("project")} / ${parCible("document")} / ${parCible("code")}`);

    // Les chiffres écrits dans les mémos doivent suivre le codage
    const memo = debut => projx.memos.find(m => m.title.startsWith(debut))?.text || "";
    const enLettres = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix"];
    const codeMaint = projx.codes.find(c => c.name.startsWith("Absence de maintenance"));
    const nMaint = new Set(projx.segments.filter(s => s.coder === "C1" && s.codeId === codeMaint?.id).map(s => s.docId)).size;
    verifier("le mémo de suffisance compte bien les participants qui évoquent la maintenance",
      memo("Suffisance").includes(`évoquée que par ${enLettres[nMaint]} participants`), `attendu : ${enLettres[nMaint]}`);
    const triang = memo("Triangulation");
    const nEcarts = (triang.match(/^CS\d+ — (?!CONCORDANCE)/gm) || []).length;
    verifier("le mémo de triangulation annonce un total cohérent avec ses constats",
      /(\d+) écarts et (\d+) concordances/.test(triang) &&
      Number(triang.match(/(\d+) écarts et (\d+) concordances/)[1]) + Number(triang.match(/(\d+) écarts et (\d+) concordances/)[2]) === (triang.match(/^CS\d+ — /gm) || []).length,
      `${nEcarts} constats sans la mention CONCORDANCE`);
  }

  // Les anciens fichiers par vague ne doivent pas revenir : ils ont causé la
  // confusion que le projet unique corrige.
  for (const f of ["Memoire_Ngoma_SIMULATION_vague2.projx", "Memoire_Ngoma_SIMULATION_complet.projx",
                   "4_Annexes_remplies_SIMULATION_vague2.docx", "5_Transcriptions_verbatim_SIMULATION_vague2.docx"]) {
    verifier(`l'ancien fichier ${f} n'existe plus`, !existsSync(join(racine, "memoire-ngoma/livrables", f)));
  }
}

titre("Documentation livrée avec l'application");
for (const f of ["README.md", "GUIDE_UTILISATION.md", "MANUEL_DEBUTANT.md", "INSTALLATION.md"]) {
  verifier(`${f} est présent et non vide`, existsSync(join(racine, f)) && statSync(join(racine, f)).size > 500);
}

bilan("Intégrité");
