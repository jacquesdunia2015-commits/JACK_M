#!/usr/bin/env node
// tests/fusion.test.mjs — travail à deux codeurs.
//
// La fusion et le kappa servent à défendre le codage devant un jury. Un kappa
// faux — trop bon, surtout — est une faute méthodologique qu'on ne rattrape
// pas après la soutenance. Les valeurs de référence sont ici calculées à la
// main sur des tableaux de quatre cases.

import { installerTout } from "./faux-navigateur.mjs";
installerTout();

import { verifier, egal, memeContenu, proche, titre, bilan } from "./aide.mjs";
const { emptyProject, normalizeProject } = await import("../js/state.js");
const { mergeProjects, coderLabels, interCoderAgreement, kappaInterpretation } =
  await import("../js/merge.js");

/* ---------- Deux projets à fusionner ---------- */
function projetDeBase(nom) {
  const p = normalizeProject(emptyProject(nom));
  p.documentGroups = [{ id: "g1", name: "Directeurs" }];
  p.documents = [
    { id: "d1", name: "Entretien 01", groupId: "g1", text: "Alpha bravo charlie delta.", variables: { sexe: "F" }, created: "2026-01-01" },
    { id: "d2", name: "Entretien 02", groupId: null, text: "Echo foxtrot golf hotel.", variables: {}, created: "2026-01-01" },
  ];
  p.codes = [
    { id: "c1", name: "Travail", parentId: null, color: "#111111" },
    { id: "c2", name: "Horaires", parentId: "c1", color: "#222222" },
  ];
  p.variables = ["sexe"];
  return p;
}

titre("Fusion de deux codages du même corpus");
const cible = projetDeBase("Codage de Marie");
cible.segments = [{ id: "s1", docId: "d1", codeId: "c1", start: 0, end: 5, text: "Alpha", weight: 1, comment: "" }];

const entrant = projetDeBase("Codage de Jean");
entrant.segments = [
  { id: "x1", docId: "d1", codeId: "c1", start: 0, end: 5, text: "Alpha", weight: 1, comment: "" }, // même passage
  { id: "x2", docId: "d1", codeId: "c2", start: 6, end: 11, text: "bravo", weight: 1, comment: "" }, // passage propre
];
entrant.memos = [{ id: "m1", targetType: "document", targetId: "d1", title: "Note", text: "Entretien difficile.", created: "2026-01-02" }];

const stats = mergeProjects(cible, entrant, "C2");
egal("les documents identiques sont appariés, pas dupliqués", stats.docsMatched, 2);
egal("aucun document n'est ajouté", stats.docsAdded, 0);
egal("les codes de même chemin sont appariés", stats.codesMatched, 2);
egal("aucun code n'est créé", stats.codesAdded, 0);
egal("les deux codages entrants sont repris", stats.segmentsAdded, 2);
egal("la cible contient bien trois segments", cible.segments.length, 3);
egal("le groupe est apparié, pas dupliqué", cible.documentGroups.length, 1);
egal("le mémo est repris", stats.memosAdded, 1);
egal("le mémo est rattaché au bon document", cible.memos[0].targetId, "d1");

memeContenu("deux codeurs sont désormais identifiables", coderLabels(cible), ["C1", "C2"]);
egal("le codage local reste non étiqueté", cible.segments[0].coder, undefined);
egal("les codages importés portent l'étiquette du second codeur", cible.segments[1].coder, "C2");

// Refuser le doublon est essentiel : fusionner deux fois le même fichier — ce
// qui arrive — ne doit pas gonfler artificiellement l'accord entre codeurs.
const bis = mergeProjects(cible, entrant, "C2");
egal("une seconde fusion du même fichier n'ajoute rien", bis.segmentsAdded, 0);
egal("tout est ignoré comme doublon", bis.segmentsSkipped, 2);
egal("le nombre de segments n'a pas bougé", cible.segments.length, 3);
egal("le mémo n'est pas dupliqué non plus", cible.memos.length, 1);

titre("Fusion d'un corpus différent");
const cible2 = projetDeBase("Base");
const autre = normalizeProject(emptyProject("Autre terrain"));
autre.documents = [
  { id: "a1", name: "Entretien 01", groupId: null, text: "Un texte tout à fait différent.", variables: {}, created: "" },
  { id: "a2", name: "Entretien 09", groupId: null, text: "Encore un autre.", variables: {}, created: "" },
];
autre.codes = [
  { id: "k1", name: "Travail", parentId: null, color: "#333" },
  { id: "k2", name: "Pénibilité", parentId: "k1", color: "#444" },
  { id: "k3", name: "Horaires", parentId: null, color: "#555" }, // même nom, autre niveau
];
autre.variables = ["âge"];
autre.segments = [{ id: "y1", docId: "a1", codeId: "k2", start: 0, end: 2, text: "Un", weight: 1, comment: "" }];

const s2 = mergeProjects(cible2, autre, "C2");
egal("un document de même nom mais de texte différent est ajouté", s2.docsAdded, 2);
verifier("il est renommé pour éviter la confusion",
  cible2.documents.some(d => d.name === "Entretien 01 (fusion)"));
egal("l'original n'est pas touché", cible2.documents[0].text, "Alpha bravo charlie delta.");
egal("le code de même chemin est apparié", s2.codesMatched, 1);
egal("les deux autres sont créés", s2.codesAdded, 2);
verifier("« Horaires » racine ne se confond pas avec « Travail ▸ Horaires »",
  cible2.codes.filter(c => c.name === "Horaires").length === 2);
memeContenu("les variables sont réunies", cible2.variables, ["sexe", "âge"]);
egal("le codage suit son code nouvellement créé", cible2.segments.length, 1);
verifier("et pointe bien un code existant",
  cible2.codes.some(c => c.id === cible2.segments[0].codeId));

/* ================== Accord inter-codeurs ================== */
titre("Kappa de Cohen — tableaux calculés à la main");
function projetDeuxCodeurs(passagesA, passagesB, texte = "P1\nP2\nP3\nP4") {
  const p = normalizeProject(emptyProject("Accord"));
  p.documents = [{ id: "d", name: "Doc", groupId: null, text: texte, variables: {}, created: "" }];
  p.codes = [{ id: "X", name: "X", parentId: null, color: "#000" }];
  const seg = (i, coder) => ({ id: coder + i, docId: "d", codeId: "X", start: i * 3, end: i * 3 + 2, text: "", weight: 1, comment: "", coder });
  p.segments = [...passagesA.map(i => seg(i, "A")), ...passagesB.map(i => seg(i, "B"))];
  return p;
}

// A code les paragraphes 1 et 2, B les paragraphes 2 et 3.
// a = 1 (accord positif), b = 1, c = 1, d = 1 → po = 0,50 ; pe = 0,50 ; κ = 0.
const nul = interCoderAgreement(projetDeuxCodeurs([0, 1], [1, 2]), "A", "B");
egal("quatre paragraphes servent d'unités", nul.units, 4);
egal("un document est codé par les deux", nul.sharedDocs, 1);
memeContenu("le tableau 2 × 2 est exact",
  [nul.overall.a, nul.overall.b, nul.overall.c, nul.overall.d], [1, 1, 1, 1]);
proche("l'accord observé vaut 0,50", nul.overall.po, 0.5, 1e-12);
proche("le kappa vaut 0 : l'accord n'excède pas le hasard", nul.overall.kappa, 0, 1e-12);

// Accord parfait : a = 2, d = 2 → κ = 1.
const parfait = interCoderAgreement(projetDeuxCodeurs([0, 1], [0, 1]), "A", "B");
proche("un codage identique donne un accord observé de 1", parfait.overall.po, 1, 1e-12);
proche("et un kappa de 1", parfait.overall.kappa, 1, 1e-12);

// Désaccord total : A code 1 et 2, B code 3 et 4 → a = 0, b = 2, c = 2, d = 0.
// po = 0 ; pe = (2·2 + 2·2)/16 = 0,5 ; κ = −1.
const oppose = interCoderAgreement(projetDeuxCodeurs([0, 1], [2, 3]), "A", "B");
proche("un désaccord complet donne un kappa de −1", oppose.overall.kappa, -1, 1e-12);

// Un même code appliqué à des passages qui se chevauchent partiellement compte
// comme un accord sur le paragraphe : c'est l'unité d'analyse retenue.
const detail = interCoderAgreement(projetDeuxCodeurs([0], [0]), "A", "B");
egal("le détail est donné code par code", detail.perCode.length, 1);
egal("le code concerné est identifié", detail.perCode[0].code.name, "X");
egal("un code que personne n'a utilisé n'apparaît pas",
  interCoderAgreement(projetDeuxCodeurs([], []), "A", "B").perCode.length, 0);

// Les documents codés par un seul des deux ne peuvent pas servir de mesure
// d'accord : les compter ferait chuter le kappa sans raison.
const partiel = projetDeuxCodeurs([0], [0]);
partiel.documents.push({ id: "seul", name: "Doc seul", groupId: null, text: "Q1\nQ2", variables: {}, created: "" });
partiel.segments.push({ id: "z", docId: "seul", codeId: "X", start: 0, end: 2, text: "", weight: 1, comment: "", coder: "A" });
const res = interCoderAgreement(partiel, "A", "B");
egal("un document codé par un seul codeur est écarté", res.sharedDocs, 1);
egal("ses paragraphes ne comptent pas dans les unités", res.units, 4);

titre("Interprétation du kappa (Landis & Koch, 1977)");
egal("kappa négatif", kappaInterpretation(-0.1), "kappa_poor");
egal("kappa 0,15", kappaInterpretation(0.15), "kappa_slight");
egal("kappa 0,35", kappaInterpretation(0.35), "kappa_fair");
egal("kappa 0,55", kappaInterpretation(0.55), "kappa_moderate");
egal("kappa 0,75", kappaInterpretation(0.75), "kappa_substantial");
egal("kappa 0,90", kappaInterpretation(0.90), "kappa_almost");
egal("la borne 0,20 reste dans la catégorie basse", kappaInterpretation(0.20), "kappa_slight");
egal("la borne 0,80 reste dans « fort »", kappaInterpretation(0.80), "kappa_substantial");

bilan("Fusion et accord inter-codeurs");
