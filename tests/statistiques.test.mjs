#!/usr/bin/env node
// tests/statistiques.test.mjs — les chiffres publiables.
//
// Un test statistique ne tombe jamais en panne : il renvoie un nombre. S'il est
// faux, il part dans le mémoire et personne ne s'en aperçoit. Les valeurs de
// référence utilisées ici viennent donc de l'extérieur du logiciel — valeurs
// critiques des tables du χ² et formules fermées — et jamais de QualiCode
// lui-même.

import { installerTout } from "./faux-navigateur.mjs";
installerTout();

import { verifier, egal, memeContenu, proche, titre, bilan } from "./aide.mjs";
const { state, emptyProject, addDocument, addCode, addSegment, clearUndoHistory } =
  await import("../js/state.js");
const { flatCodes } = await import("../js/analysis.js");
const {
  chiSquarePValue, chiSquareTest, pearson, spearman,
  docCodeMatrix, codeByVariableTable, buildRExport,
} = await import("../js/stats.js");

/* ================== Valeur p du χ² ================== */
titre("Valeur p du χ² — valeurs critiques des tables");
// Seuils lus dans n'importe quelle table du χ² : à ces valeurs, p vaut 0,05.
proche("χ² = 3,841 à 1 ddl → p = 0,05", chiSquarePValue(3.841459, 1), 0.05, 1e-5);
proche("χ² = 5,991 à 2 ddl → p = 0,05", chiSquarePValue(5.991465, 2), 0.05, 1e-5);
proche("χ² = 7,815 à 3 ddl → p = 0,05", chiSquarePValue(7.814728, 3), 0.05, 1e-5);
proche("χ² = 9,488 à 4 ddl → p = 0,05", chiSquarePValue(9.487729, 4), 0.05, 1e-5);
proche("χ² = 6,635 à 1 ddl → p = 0,01", chiSquarePValue(6.634897, 1), 0.01, 1e-5);
proche("χ² = 10,828 à 1 ddl → p = 0,001", chiSquarePValue(10.827566, 1), 0.001, 1e-5);
proche("χ² = 18,307 à 10 ddl → p = 0,05", chiSquarePValue(18.307038, 10), 0.05, 1e-5);

// Formule fermée, indépendante du code testé : à 2 ddl, p = exp(−χ²/2).
for (const x of [0.5, 2, 5, 12]) {
  proche(`formule fermée à 2 ddl (χ² = ${x})`, chiSquarePValue(x, 2), Math.exp(-x / 2), 1e-9);
}
// À 4 ddl, p = exp(−χ²/2)·(1 + χ²/2).
for (const x of [1, 6]) {
  proche(`formule fermée à 4 ddl (χ² = ${x})`, chiSquarePValue(x, 4),
    Math.exp(-x / 2) * (1 + x / 2), 1e-9);
}
egal("un χ² nul donne p = 1", chiSquarePValue(0, 1), 1);
egal("un ddl nul donne p = 1", chiSquarePValue(5, 0), 1);
verifier("p reste dans [0 ; 1] même pour un χ² énorme",
  chiSquarePValue(500, 1) >= 0 && chiSquarePValue(500, 1) <= 1);

/* ================== Test du χ² d'indépendance ================== */
titre("Test du χ² d'indépendance");
const t1 = chiSquareTest([[20, 30], [30, 20]]);
proche("le χ² calculé à la main est retrouvé", t1.chi2, 4, 1e-12);
egal("le nombre de degrés de liberté est correct", t1.df, 1);
egal("l'effectif total est correct", t1.n, 100);
proche("la valeur p correspond", t1.p, 0.0455003, 1e-6);
proche("le V de Cramér vaut 0,2", t1.v, 0.2, 1e-12);
egal("aucun effectif théorique n'est faible ici", t1.lowExpectedShare, 0);

const t2 = chiSquareTest([[10, 20], [30, 40]]);
proche("second tableau : χ² exact", t2.chi2, 4 / 12 + 4 / 18 + 4 / 28 + 4 / 42, 1e-12);

// Indépendance parfaite : le χ² doit être exactement nul, pas « presque ».
proche("des effectifs proportionnels donnent un χ² nul",
  chiSquareTest([[10, 20], [20, 40]]).chi2, 0, 1e-12);

const t3 = chiSquareTest([[1, 2], [2, 1]]);
verifier("les faibles effectifs théoriques sont signalés", t3.lowExpectedShare === 1);

egal("un tableau à une seule ligne n'est pas testable", chiSquareTest([[1, 2, 3]]), null);
egal("un tableau vide n'est pas testable", chiSquareTest([[0, 0], [0, 0]]), null);

const t4 = chiSquareTest([[12, 5, 8], [7, 14, 9], [6, 6, 15]]);
egal("un tableau 3 × 3 a 4 degrés de liberté", t4.df, 4);
verifier("son χ² est positif", t4.chi2 > 0);

/* ================== Corrélations ================== */
titre("Corrélation de Pearson");
proche("valeur calculée à la main", pearson([1, 2, 3, 4, 5], [2, 4, 5, 4, 5]).r, 6 / Math.sqrt(60), 1e-12);
proche("relation linéaire croissante parfaite", pearson([1, 2, 3], [2, 4, 6]).r, 1, 1e-12);
proche("relation linéaire décroissante parfaite", pearson([1, 2, 3], [6, 4, 2]).r, -1, 1e-12);
egal("une série constante n'a pas de corrélation", pearson([1, 1, 1], [1, 2, 3]), null);
egal("moins de trois points : pas de corrélation", pearson([1, 2], [3, 4]), null);
egal("l'effectif est remonté", pearson([1, 2, 3, 4, 5], [2, 4, 5, 4, 5]).n, 5);
verifier("une corrélation parfaite est hautement significative",
  pearson([1, 2, 3, 4, 5, 6, 7, 8], [1, 2, 3, 4, 5, 6, 7, 8]).p < 0.001);
verifier("une corrélation nulle ne l'est pas",
  pearson([1, 2, 3, 4, 5], [3, 1, 4, 1, 5]).p > 0.05);

titre("Corrélation de Spearman");
proche("ex æquo traités par rangs moyens",
  spearman([1, 2, 3, 4], [1, 2, 2, 3]).r, 4.5 / Math.sqrt(22.5), 1e-12);
proche("une relation monotone non linéaire est parfaite pour Spearman",
  spearman([1, 2, 3, 4], [1, 4, 9, 16]).r, 1, 1e-12);
verifier("là où Pearson ne l'est pas",
  pearson([1, 2, 3, 4], [1, 4, 9, 16]).r < 0.99);
proche("une relation monotone décroissante donne −1",
  spearman([1, 2, 3, 4], [10, 7, 3, 1]).r, -1, 1e-12);

/* ================== Données issues du projet ================== */
titre("Matrice documents × codes");
state.project = emptyProject("Stats");
clearUndoHistory();
state.project.variables.push("sexe");
const dH = addDocument("Entretien H", "texte d'entretien assez long");
const dF = addDocument("Entretien F", "texte d'entretien assez long");
const dN = addDocument("Entretien N", "texte d'entretien assez long");
dH.variables = { sexe: "Homme" };
dF.variables = { sexe: "Femme" };
dN.variables = { sexe: "Femme" };
const cPen = addCode("Pénibilité, physique");
const cRem = addCode('Rémunération "nette"');
addSegment(dH.id, cPen.id, 0, 5, "texte");
addSegment(dH.id, cPen.id, 6, 10, "d'en");
addSegment(dF.id, cRem.id, 0, 5, "texte");

const codes = flatCodes();
const { rows } = docCodeMatrix(state.project, codes);
egal("une ligne par document", rows.length, 3);
egal("l'entretien H porte deux fois le premier code", rows[0].counts[cPen.id], 2);
egal("et zéro fois le second", rows[0].counts[cRem.id], 0);
egal("l'entretien F porte une fois le second", rows[1].counts[cRem.id], 1);
egal("l'entretien N n'est codé nulle part", rows[2].counts[cPen.id], 0);

titre("Tableau croisé code × variable");
const croise = codeByVariableTable(state.project, [cPen.id], "sexe");
memeContenu("les modalités sont triées", croise.cats, ["Femme", "Homme"]);
memeContenu("présence puis absence du code, par modalité",
  croise.table, [[0, 1], [2, 0]]);
egal("une variable à une seule modalité n'est pas croisable",
  codeByVariableTable(state.project, [cPen.id], "inexistante"), null);

titre("Export vers R, SPSS et jamovi");
const { csv, script } = buildRExport(state.project, codes);
const lignes = csv.split("\n");
egal("une ligne d'en-tête et trois documents", lignes.length, 4);
egal("l'en-tête est assainie pour R",
  lignes[0], "document,sexe,code_Pénibilité__physique,code_Rémunération__nette_");
verifier("les noms de colonnes ne contiennent ni espace ni ponctuation",
  lignes[0].split(",").every(c => /^[\p{L}\p{N}_]+$/u.test(c)));
egal("la première ligne de données est exacte", lignes[1], "Entretien H,Homme,2,0");
egal("la troisième est exacte", lignes[3], "Entretien N,Femme,0,0");
verifier("le script R nomme une variable réellement présente", script.includes("donnees$sexe"));
verifier("le script R nomme une colonne de code réellement présente",
  script.includes("donnees$code_Pénibilité__physique"));
verifier("le script rappelle que le CSV s'ouvre aussi dans SPSS", /SPSS/.test(script));

// Un nom de document contenant une virgule casserait le CSV s'il n'était pas
// protégé : R lirait une colonne de trop et décalerait toute la ligne.
dH.name = 'Entretien "H", 1er passage';
const csv2 = buildRExport(state.project, codes).csv.split("\n")[1];
egal("un nom contenant virgule et guillemets est protégé",
  csv2, '"Entretien ""H"", 1er passage",Homme,2,0');
egal("la ligne compte toujours le bon nombre de colonnes",
  csv2.match(/(?:^|,)(?:"(?:[^"]|"")*"|[^,]*)/g).length, 4);

bilan("Statistiques");
