#!/usr/bin/env node
// tests/analyse.test.mjs — recherche, lexique et matrices.
//
// Ce sont les chiffres qui finiront dans le mémoire. Une matrice fausse ne
// plante pas : elle produit un tableau plausible et un résultat faux. C'est
// précisément pour cela qu'elle se vérifie à la main, sur des cas dont on
// connaît la réponse.

import { installerTout } from "./faux-navigateur.mjs";
installerTout();

import { verifier, egal, memeContenu, titre, bilan } from "./aide.mjs";
const { state, emptyProject, addDocument, addCode, addSegment, clearUndoHistory } =
  await import("../js/state.js");
const {
  parseQuery, searchDocuments, tokenize, wordFrequencies, kwic,
  codeMatrix, coocMatrix, groupComparison, variableStats, flatCodes,
  STOPWORDS_FR,
} = await import("../js/analysis.js");

/* ================== Recherche ================== */
titre("Analyse de la requête");
memeContenu("les termes séparés par une espace sont liés par ET",
  parseQuery("travail pénible"), [["travail", "pénible"]]);
memeContenu("« OU » sépare deux alternatives",
  parseQuery("travail OU repos"), [["travail"], ["repos"]]);
memeContenu("« OR » est accepté aussi", parseQuery("a OR b"), [["a"], ["b"]]);
memeContenu("les guillemets forment une expression exacte",
  parseQuery('"conditions de travail" horaires'), [["conditions de travail", "horaires"]]);
memeContenu("le mot ET n'est pas cherché comme un terme",
  parseQuery("nuit ET fatigue"), [["nuit", "fatigue"]]);
memeContenu("la casse est ignorée", parseQuery("NUIT"), [["nuit"]]);
memeContenu("une requête vide ne produit aucune clause", parseQuery("   "), []);

titre("Recherche dans les documents");
state.project = emptyProject("Recherche");
clearUndoHistory();
const dA = addDocument("A", "Le travail de nuit est pénible.\nMais l'équipe est solidaire.");
const dB = addDocument("B", "Le repos est rare.\nLe travail continue.");

egal("une requête vide ne renvoie rien", searchDocuments("").length, 0);
egal("un terme absent ne renvoie rien", searchDocuments("hélicoptère").length, 0);

const etDeuxTermes = searchDocuments("travail nuit");
egal("le ET exige les deux termes dans le même document", etDeuxTermes.length, 1);
egal("et pointe le bon document", etDeuxTermes[0].docId, dA.id);
egal("le paragraphe trouvé est le bon", etDeuxTermes[0].paraIndex, 0);
egal("la position du paragraphe est exacte", etDeuxTermes[0].paraStart, 0);

const ou = searchDocuments("nuit OU repos");
memeContenu("le OU réunit les deux documents",
  [...new Set(ou.map(r => r.docId))].sort(), [dA.id, dB.id].sort());

const secondPara = searchDocuments("solidaire");
egal("un terme du second paragraphe est trouvé", secondPara.length, 1);
egal("son index de paragraphe est 1", secondPara[0].paraIndex, 1);
egal("son décalage tient compte du saut de ligne",
  secondPara[0].paraStart, "Le travail de nuit est pénible.".length + 1);
egal("le texte du paragraphe est restitué entier",
  dA.text.slice(secondPara[0].paraStart, secondPara[0].paraStart + secondPara[0].text.length),
  secondPara[0].text);

/* ================== Lexique ================== */
titre("Découpage en mots");
memeContenu("l'apostrophe élidée est retirée",
  tokenize("l'équipe d'accueil"), ["équipe", "accueil"]);
memeContenu("les accents sont conservés", tokenize("pénibilité"), ["pénibilité"]);
memeContenu("la ponctuation sépare les mots", tokenize("nuit, repos ; travail."), ["nuit", "repos", "travail"]);
memeContenu("les traits d'union tiennent le mot ensemble", tokenize("peut-être"), ["peut-être"]);
memeContenu("les chiffres sont des mots", tokenize("12 heures"), ["12", "heures"]);
memeContenu("aujourd'hui n'est pas amputé", tokenize("aujourd'hui"), ["aujourd'hui"]);
egal("un texte vide ne produit aucun mot", tokenize("").length, 0);

titre("Fréquences lexicales");
const corpus = [{ text: "Le travail de nuit. Le travail de nuit encore. Un repos." }];
const freq = wordFrequencies(corpus);
const carte = new Map(freq);
egal("le mot le plus fréquent est en tête", freq[0][0], "travail");
egal("il est compté deux fois", freq[0][1], 2);
verifier("les mots-outils sont écartés", !carte.has("le") && !carte.has("de") && !carte.has("un"));
verifier("« nuit » est bien compté", carte.get("nuit") === 2);
verifier("le classement est décroissant", freq.every((e, i) => i === 0 || freq[i - 1][1] >= e[1]));

const avecOutils = new Map(wordFrequencies(corpus, { useStopwords: false, minLength: 1 }));
verifier("on peut désactiver la liste des mots-outils", avecOutils.get("le") === 2);
memeContenu("la longueur minimale écarte les mots trop courts",
  wordFrequencies([{ text: "oui bof gris" }], { minLength: 4 }).map(e => e[0]), ["gris"]);
verifier("la liste française contient bien les mots-outils usuels",
  STOPWORDS_FR.has("le") && STOPWORDS_FR.has("dans") && STOPWORDS_FR.has("avec"));

titre("Concordancier (mot dans son contexte)");
const docsKwic = [{ id: "k1", name: "K", text: "Le travail. Encore le travail, toujours le travail." }];
const occurrences = kwic(docsKwic, "travail", 5);
egal("les trois occurrences sont trouvées", occurrences.length, 3);
egal("la position de la première est exacte", occurrences[0].pos, 3);
egal("le mot trouvé est restitué dans sa casse d'origine", occurrences[0].match, "travail");
egal("le contexte gauche est borné", occurrences[0].left, "Le ");
egal("le contexte droit est borné", occurrences[1].right.length <= 5, true);
egal("une recherche vide ne boucle pas", kwic(docsKwic, "").length, 0);
egal("la recherche est insensible à la casse", kwic(docsKwic, "TRAVAIL").length, 3);

/* ================== Matrices ================== */
titre("Matrice codes × documents");
state.project = emptyProject("Matrices");
clearUndoHistory();
const doc1 = addDocument("Entretien 1", "aaaaaaaaaabbbbbbbbbbcccccccccc");
const doc2 = addDocument("Entretien 2", "aaaaaaaaaabbbbbbbbbbcccccccccc");
const cX = addCode("X");
const cY = addCode("Y", cX.id);
const cZ = addCode("Z");

addSegment(doc1.id, cX.id, 0, 10, "a".repeat(10));
addSegment(doc1.id, cX.id, 20, 30, "c".repeat(10));
addSegment(doc1.id, cY.id, 5, 15, "-");
addSegment(doc2.id, cZ.id, 0, 10, "a".repeat(10));

const { matrix } = codeMatrix(state.project.documents, [cX, cY, cZ]);
memeContenu("les effectifs par code et par document sont exacts",
  matrix, [[2, 0], [1, 0], [0, 1]]);

titre("Co-occurrences");
const coo = coocMatrix([cX, cY, cZ]);
egal("X et Y se chevauchent une fois", coo.matrix[0][1], 1);
egal("la matrice est symétrique", coo.matrix[1][0], 1);
egal("la diagonale reste nulle", coo.matrix[0][0], 0);
egal("deux codes dans des documents différents ne co-occurrent pas", coo.matrix[0][2], 0);

// Deux segments qui se touchent sans se recouvrir (fin = début) ne sont pas
// une co-occurrence : sinon deux passages simplement consécutifs seraient
// comptés comme simultanés.
state.project.segments = [];
addSegment(doc1.id, cX.id, 0, 10, "-");
addSegment(doc1.id, cZ.id, 10, 20, "-");
egal("deux segments jointifs ne co-occurrent pas", coocMatrix([cX, cY, cZ]).matrix[0][2], 0);
addSegment(doc1.id, cZ.id, 9, 20, "-");
egal("un seul caractère de recouvrement suffit", coocMatrix([cX, cY, cZ]).matrix[0][2], 1);

titre("Comparaison de groupes et variables");
state.project = emptyProject("Variables");
clearUndoHistory();
state.project.variables.push("sexe", "milieu");
const h1 = addDocument("H1", "texte");
const h2 = addDocument("H2", "texte");
const f1 = addDocument("F1", "texte");
const sans = addDocument("S1", "texte");
h1.variables = { sexe: "Homme", milieu: "Urbain" };
h2.variables = { sexe: "Homme", milieu: "Rural" };
f1.variables = { sexe: "Femme", milieu: "Urbain" };
sans.variables = { sexe: "" };
const cP = addCode("Pénibilité");
addSegment(h1.id, cP.id, 0, 2, "te");
addSegment(h2.id, cP.id, 0, 2, "te");
addSegment(f1.id, cP.id, 0, 2, "te");
addSegment(f1.id, cP.id, 2, 4, "xt");

const comp = groupComparison("sexe", [cP]);
memeContenu("les modalités sont triées et les valeurs vides écartées", comp.values, ["Femme", "Homme"]);
memeContenu("les effectifs par modalité sont exacts", comp.matrix, [[2, 2]]);

const stats = variableStats();
egal("chaque variable déclarée est décrite", stats.length, 2);
egal("les documents sans valeur ne sont pas comptés", stats[0].n, 3);
memeContenu("les modalités sont classées par effectif",
  stats[0].values, [["Homme", 2], ["Femme", 1]]);

titre("Aplatissement de l'arbre des codes");
state.project = emptyProject("Arbre");
clearUndoHistory();
const r1 = addCode("A");
const r1a = addCode("A1", r1.id);
addCode("A1a", r1a.id);
addCode("B");
const plat = flatCodes();
memeContenu("l'ordre suit la hiérarchie", plat.map(c => c.name), ["A", "A1", "A1a", "B"]);
memeContenu("la profondeur est correcte", plat.map(c => c.depth), [0, 1, 2, 0]);

bilan("Analyse");
