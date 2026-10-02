// faire-resultats.mjs — produit le chapitre 5 (Résultats) au format Word.
//
// Usage : node faire-resultats.mjs ../livrables
//
// Le texte vient de resultats.mjs ; tout ce qui est chiffré ou cité est
// CONTRÔLÉ ici contre le projet QualiCode, et le document n'est pas produit si
// un contrôle échoue :
//   · chaque citation doit figurer mot pour mot dans un passage du participant
//     codé (codeur principal C1) avec l'un des codes annoncés ;
//   · un participant qui a refusé la citation ne peut pas être cité ;
//   · le code d'un centre dont un participant a demandé qu'il ne soit jamais
//     identifié ne peut apparaître nulle part dans le chapitre ;
//   · chaque {n:…} et {v:…} est remplacé par une valeur calculée.
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  titre1, titre2, titre3, vide, saut, tableau, pageDeGarde, encadreRouge, stylesCommuns,
  Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle, LARGEUR,
} from "./mise-en-page.mjs";
import { ETUDE, participants } from "./echantillon.mjs";
import { participantsV2 } from "./echantillon-vague2.mjs";
import { observations } from "./observations.mjs";
import { observationsV2 } from "./observations-vague2.mjs";
import { arbre, ecarts, ecartsV2 } from "./codes.mjs";
import { consentementDe } from "./consentements.mjs";
import { parCentre, SOURCE as SOURCE_ROUTINE, RESERVE } from "./donnees-routine.mjs";
import { TITRE_CHAPITRE, blocs, constatsChapitre } from "./resultats.mjs";
import * as e12 from "./entretiens-01-02.mjs";
import * as e34 from "./entretiens-03-04.mjs";
import * as e56 from "./entretiens-05-06.mjs";
import * as e78 from "./entretiens-07-08.mjs";
import * as e910 from "./entretiens-09-10.mjs";
import * as e1113 from "./entretiens-11-13.mjs";
import * as e1416 from "./entretiens-14-16.mjs";
import * as e1719 from "./entretiens-17-19.mjs";
import * as e2021 from "./entretiens-20-21.mjs";
const entretiens = { ...e12, ...e34, ...e56, ...e78, ...e910, ...e1113, ...e1416, ...e1719, ...e2021 };

const dossier = process.argv[2] || ".";
const projet = JSON.parse(readFileSync(`${dossier}/Memoire_Ngoma_SIMULATION.projx`, "utf8"));
const tous = [...participants, ...participantsV2];
const obsTous = [...observations, ...observationsV2].sort((x, y) => x.cs.localeCompare(y.cs));
const constats = [...ecarts, ...ecartsV2];

/* ---------- Correspondance codes du projet ↔ identifiants courts ---------- */
const familleParNom = new Map(arbre.map(f => [f.nom, f]));
const court = new Map();
for (const c of projet.codes) {
  if (!c.parentId) continue;
  const parent = projet.codes.find(x => x.id === c.parentId);
  const e = familleParNom.get(parent?.name)?.enfants.find(e => e.nom === c.name);
  if (e) court.set(c.id, e.id);
}
const docEntretien = new Map(projet.documents
  .filter(d => d.variables.type_document === "entretien")
  .map(d => [d.name.match(/P\d+/)[0], d]));
const segmentsC1 = projet.segments.filter(s => s.coder === "C1");

/** Participants ayant au moins un passage C1 codé avec l'un des codes. */
function participantsAvec(codes) {
  const ids = new Set(codes);
  return [...docEntretien.entries()]
    .filter(([, d]) => segmentsC1.some(s => s.docId === d.id && ids.has(court.get(s.codeId))))
    .map(([code]) => code);
}

/* ---------- Valeurs calculées ---------- */
const minutes = tous.map(x => parseInt(x.duree, 10));
const etatGluco = o => {
  const g = o.B.find(i => i.item === "Glucomètre");
  const b = o.B.find(i => i.item === "Bandelettes de glycémie");
  const glucoOk = g.present === "oui" && /fonctionnel/i.test(g.etat) && !/non fonctionnel|panne/i.test(g.etat);
  const bandOk = b.present === "oui" && !/périm/i.test(b.etat);
  if (g.present !== "oui") return "absent";
  return glucoOk && bandOk ? "réalisable" : "inutilisable";
};
// Centres qu'aucun élément du chapitre ne doit permettre d'identifier.
const centresProteges = new Set(tous.filter(x => /sans élément identifiant le centre/.test(consentementDe(x.code).citation)).map(x => x.cs));
const equiteSpontane = Object.values(entretiens).filter(e =>
  Object.values(e.reponses).some(tours => tours.some(([qui, t]) => qui === "P" && /équit/i.test(t)))).length;

const valeurs = {
  nbCentres: obsTous.length,
  nbInf: tous.filter(x => x.qualif === "infirmier").length,
  nbSf: tous.filter(x => x.qualif === "sage-femme").length,
  nbTitulaires: tous.filter(x => x.titulaire).length,
  dureeMin: Math.min(...minutes), dureeMax: Math.max(...minutes),
  glycPossible: obsTous.filter(o => etatGluco(o) === "réalisable").length,
  glucoInutilisable: obsTous.filter(o => etatGluco(o) === "inutilisable").length,
  glucoAbsent: obsTous.filter(o => etatGluco(o) === "absent").length,
  nbConstats: constats.length,
  nbEcarts: constats.filter(x => x.nature === "écart").length,
  nbConcordances: constats.filter(x => x.nature === "concordance").length,
  sourceRoutine: SOURCE_ROUTINE,
  reserveRoutine: RESERVE,
  equiteSpontane,
};

const LETTRES = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze",
  "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf", "vingt", "vingt et un", "vingt-deux"];
function remplir(texte) {
  // Une phrase ne commence pas par un chiffre : le nombre y est écrit en lettres.
  const enTete = /(^|[.!?]\s+)(\{(?:N|n:[A-Z0-9+]+|v:\w+)\})/g;
  texte = texte.replace(enTete, (_, avant, ph) => {
    const valeur = remplacer(ph);
    if (!/^\d+$/.test(valeur)) return avant + valeur;   // une valeur textuelle reste telle quelle
    const n = Number(valeur);
    if (!LETTRES[n]) throw new Error(`nombre en début de phrase non écrivable en lettres : ${ph}`);
    return avant + LETTRES[n][0].toUpperCase() + LETTRES[n].slice(1);
  });
  return remplacer(texte);
}
function remplacer(texte) {
  return texte
    .replace(/\{N\}/g, String(docEntretien.size))
    .replace(/\{n:([A-Z0-9+]+)\}/g, (_, codes) => String(participantsAvec(codes.split("+")).length))
    .replace(/\{v:(\w+)\}/g, (_, cle) => {
      if (!(cle in valeurs)) throw new Error(`valeur inconnue : {v:${cle}}`);
      return String(valeurs[cle]);
    });
}

/* ---------- Contrôle des citations ---------- */
const normaliser = t => t.replace(/\s+/g, " ").trim();
function verifierCitation(b) {
  const doc = docEntretien.get(b.cite);
  if (!doc) throw new Error(`citation : participant inconnu ${b.cite}`);
  const consentement = consentementDe(b.cite);
  if (consentement.citation === "non") throw new Error(`citation refusée par ${b.cite} : ses propos ne peuvent pas être cités`);
  const cible = normaliser(b.t);
  const ok = segmentsC1.some(s => s.docId === doc.id && b.codes.includes(court.get(s.codeId)) && normaliser(s.text).includes(cible));
  if (!ok) throw new Error(`citation introuvable dans un passage de ${b.cite} codé ${b.codes.join("/")} : « ${b.t.slice(0, 70)}… »`);
}
for (const b of blocs) if (b.cite) verifierCitation(b);

function etiquette(code) {
  const x = tous.find(y => y.code === code);
  const c = consentementDe(code);
  const qualif = x.qualif === "infirmier" ? (x.sexe === "féminin" ? "infirmière" : "infirmier") : "sage-femme";
  // Citation sous condition : ni centre ni caractéristique.
  const carac = /sans élément identifiant/.test(c.citation) ? "" : `, ${qualif}`;
  const langue = x.langue === "kinyarwanda" ? " — traduit du kinyarwanda" : "";
  return `(${code}${carac}${langue})`;
}

/* ---------- Tableaux calculés ---------- */
const effectifs = (liste, cle, ordre) => {
  const m = new Map();
  for (const x of liste) m.set(x[cle], (m.get(x[cle]) || 0) + 1);
  return (ordre || [...m.keys()]).filter(k => m.has(k)).map(k => [k, m.get(k)]);
};
const libelleQualif = x => x.qualif === "infirmier" ? (x.sexe === "féminin" ? "infirmière" : "infirmier") : "sage-femme";
const vague1 = new Set(participants.map(x => x.code));

function tableauParticipants() {
  const lignes = [["Caractéristique", "Modalité", "Effectif"]];
  const ajouter = (titre, paires) => paires.forEach(([k, n], i) => lignes.push([i === 0 ? titre : "", k, String(n)]));
  ajouter("Qualification", effectifs(tous.map(x => ({ q: libelleQualif(x) })), "q", ["infirmier", "infirmière", "sage-femme"]));
  ajouter("Sexe", effectifs(tous, "sexe", ["féminin", "masculin"]));
  ajouter("Tranche d'âge", effectifs(tous, "age", ["20-29", "30-39", "40-49", "50 et plus"]));
  ajouter("Ancienneté totale", effectifs(tous, "ancTotale", ["< 5 ans", "5-10 ans", "> 10 ans"]));
  ajouter("Ancienneté en CPN", effectifs(tous, "ancCpn", ["6 mois-2 ans", "> 2 ans"]));
  ajouter("Fonction", [["titulaire", tous.filter(x => x.titulaire).length], ["prestataire", tous.filter(x => !x.titulaire).length]]);
  ajouter("Formation MNT reçue", effectifs(tous, "formationMnt", ["oui", "non", "ne sait pas"]));
  ajouter("Langue de l'entretien", effectifs(tous, "langue", ["kinyarwanda", "français", "anglais"]));
  ajouter("Vague de collecte", [["vague 1", tous.filter(x => vague1.has(x.code)).length], ["vague 2", tous.filter(x => !vague1.has(x.code)).length]]);
  return [legende(`Tableau VI. Caractéristiques des participants (n = ${tous.length})`), tableau(lignes, [2800, 4226, 2000]), source("fiches sociodémographiques (annexe 3)")];
}

function tableauCentres() {
  const parCs = new Map(tous.map(x => [x.cs, x]));
  const centres = obsTous.map(o => ({ ...o, distance: parCs.get(o.cs)?.distanceHopital, volume: parCs.get(o.cs)?.volume, pauvrete: parCentre.find(r => r.cs === o.cs)?.pauvrete }));
  const lignes = [["Caractéristique", "Modalité", "Centres"]];
  const ajouter = (titre, paires) => paires.forEach(([k, n], i) => lignes.push([i === 0 ? titre : "", k, String(n)]));
  ajouter("Secteur d'implantation", effectifs(centres, "secteur", ["urbain", "rural périphérique"]));
  ajouter("Distance à l'hôpital", effectifs(centres, "distance", ["proche", "éloignée"]));
  ajouter("Volume d'activité prénatale", effectifs(centres, "volume", ["élevé", "modéré"]));
  ajouter("Profil de pauvreté du secteur", effectifs(centres, "pauvrete", ["plus faible", "plus élevée"]));
  ajouter("Glycémie le jour de l'observation", [
    ["réalisable (appareil et bandelettes utilisables)", valeurs.glycPossible],
    ["glucomètre présent, inutilisable", valeurs.glucoInutilisable],
    ["pas de glucomètre", valeurs.glucoAbsent]]);
  const femmes = obsTous.map(o => o.A.femmesRecues);
  lignes.push(["Femmes reçues pendant la demi-journée observée", "étendue", `${Math.min(...femmes)} à ${Math.max(...femmes)}`]);
  return [legende(`Tableau VII. Caractéristiques des centres de santé (n = ${obsTous.length})`), tableau(lignes, [2800, 4226, 2000]), source("grilles d'observation (annexe 2), données de routine (annexe 9)")];
}

const nomCode = id => arbre.flatMap(f => f.enfants).find(e => e.id === id).nom.replace(/\s*\[inductif[^\]]*\]/, "");
const infirmiers = new Set(tous.filter(x => x.qualif === "infirmier").map(x => x.code));
function ligneCodes(id, libelle) {
  const qui = participantsAvec([id]);
  return [libelle || nomCode(id), String(qui.filter(c => infirmiers.has(c)).length), String(qui.filter(c => !infirmiers.has(c)).length), String(qui.length)];
}
const enteteQualif = titre => [titre, `Infirmiers (n = ${infirmiers.size})`, `Sages-femmes (n = ${tous.length - infirmiers.size})`, `Total (n = ${tous.length})`];

function tableauEquite() {
  const lignes = [enteteQualif("Catégorie (codes de la famille 8)")];
  lignes.push(["Jugement porté sur les différences décrites", "", "", ""]);
  for (const id of ["H2", "H3", "H6"]) lignes.push(ligneCodes(id));
  lignes.push(["Attribution de la responsabilité", "", "", ""]);
  for (const id of ["H4", "H5"]) lignes.push(ligneCodes(id));
  lignes.push(["Facteurs d'inégalité nés du codage inductif", "", "", ""]);
  for (const id of ["H7", "H8", "H9"]) lignes.push(ligneCodes(id));
  return [legende("Tableau VIII. Portée reconnue en équité : jugements et attributions"), tableauSections(lignes, [4626, 1500, 1500, 1400]),
    source("codage des entretiens (Q19 et recoupements Q11 à Q14) ; un participant peut relever de plusieurs lignes")];
}

function tableauTransformations() {
  const lignes = [enteteQualif("Transformation proposée")];
  for (const id of ["I1", "I2", "I3", "I4", "I5", "I6"]) lignes.push(ligneCodes(id));
  lignes.push(ligneCodes("I8", "Initiative locale déjà mise en œuvre"));
  return [legende("Tableau IX. Transformations proposées par les participants"), tableau(lignes, [4626, 1500, 1500, 1400]),
    source("codage des réponses aux questions 17 et 18 ; un participant peut relever de plusieurs lignes")];
}

function tableauTriangulation() {
  const lignes = [["N°", "Nature", "Constat"]];
  const ordonnes = [...constats.filter(x => x.nature === "écart"), ...constats.filter(x => x.nature === "concordance")];
  ordonnes.forEach((x, i) => {
    if (!constatsChapitre[x.cs]) throw new Error(`constat ${x.cs} sans formulation pour le chapitre (resultats.mjs, constatsChapitre)`);
    lignes.push([String(i + 1), x.nature, constatsChapitre[x.cs]]);
  });
  return [legende("Tableau X. Confrontation des propos et de l'observation"), tableau(lignes, [700, 1400, 6926]),
    source("mémo « Triangulation — ensemble des deux vagues » du projet QualiCode, reformulé sans code de centre (§ 4.2.7)")];
}

function tableauRoutine() {
  const lignes = [["Profil de pauvreté du secteur", "Centres", "Nouvelles inscrites (CPN1)", "CPN4 / CPN1", "1er contact au 1er trimestre (médiane)", "Références pour HTA pour 100 inscrites"]];
  const mediane = v => { const t = [...v].sort((a, b) => a - b); const m = Math.floor(t.length / 2); return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2; };
  const fr = n => n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
  for (const cat of ["plus faible", "plus élevée"]) {
    const r = parCentre.filter(x => x.pauvrete === cat);
    const cpn1 = r.reduce((a, x) => a + x.cpn1, 0), cpn4 = r.reduce((a, x) => a + x.cpn4, 0), ref = r.reduce((a, x) => a + x.refHta, 0);
    lignes.push([cat, String(r.length), fr(cpn1), `${fr(100 * cpn4 / cpn1)} %`, `${fr(mediane(r.map(x => x.t1)))} %`, fr(100 * ref / cpn1)]);
  }
  return [legende("Tableau XI. Données de routine du district selon le profil de pauvreté du secteur"), tableau(lignes, [1900, 900, 1500, 1300, 1800, 1626]),
    source(`${SOURCE_ROUTINE} ; valeurs agrégées, aucune donnée par centre n'est rapportée ici`)];
}

function tableauThemes() {
  const themes = [
    ["T1. Un dépistage coupé en deux", "OS1", "La tension est intégrée ; la glycémie dépend des moyens du centre et cesse d'être pensée là où elle est impossible."],
    ["T2. Expliquer moins à celles qui savent le moins", "OS1", "L'explication varie avec l'heure, la charge et l'idée que l'on se fait de la femme, à l'inverse des besoins."],
    ["T3. Trouver sans pouvoir suivre", "OS2", "La détection ne devient prise en charge que si la référence aboutit et si l'information revient."],
    ["T4. Ce qui est compté existe", "OS2", "Intrants, maintenance et attention suivent les indicateurs ; le dépistage n'en fait pas partie."],
    ["T5. Ce que change la dotation, et ce qu'elle ne change pas", "OS2", "L'équipement supprime l'inégalité du test, pas celle de l'explication."],
    ["T6. Le registre comme écran", "OS2, équité", "Un contrôle de complétude produit de la complétude et peut masquer l'inégalité."],
    ["T7. Le dépistage hors des murs", "OS2, transformations", "Relais communautaires et initiatives locales prolongent le dépistage ; ils reposent sur une personne."],
  ];
  return [legende("Tableau XII. Synthèse des thèmes"), tableau([["Thème", "Objectif", "Énoncé"], ...themes], [3200, 1500, 4326]),
    source("mémo « Phase 5 — Définition et dénomination des thèmes » du projet QualiCode")];
}

const tableaux = {
  participants: tableauParticipants, centres: tableauCentres, equite: tableauEquite,
  transformations: tableauTransformations, triangulation: tableauTriangulation, routine: tableauRoutine, themes: tableauThemes,
};

/* ---------- Mise en forme ---------- */
function legende(t) {
  return new Paragraph({ spacing: { before: 200, after: 80 }, keepNext: true,
    children: [new TextRun({ text: t, bold: true, size: 20 })] });
}
function source(t) {
  return new Paragraph({ spacing: { before: 60, after: 200 },
    children: [new TextRun({ text: `Source : ${t}.`, italics: true, size: 18, color: "555555" })] });
}
// Tableau dont les lignes sans chiffres sont des intertitres grisés.
function tableauSections(lignes, largeurs) {
  return new Table({
    width: { size: LARGEUR, type: WidthType.DXA }, columnWidths: largeurs,
    rows: lignes.map((ligne, i) => {
      const section = i > 0 && ligne.slice(1).every(c => c === "");
      return new TableRow({
        tableHeader: i === 0,
        children: section
          ? [new TableCell({ columnSpan: ligne.length, width: { size: LARGEUR, type: WidthType.DXA },
              shading: { type: ShadingType.CLEAR, fill: "F4F6F8", color: "auto" }, margins: { top: 60, bottom: 60, left: 100, right: 100 },
              children: [new Paragraph({ children: [new TextRun({ text: ligne[0], italics: true, bold: true, size: 19 })] })] })]
          : ligne.map((c, j) => new TableCell({ width: { size: largeurs[j], type: WidthType.DXA },
              shading: i === 0 ? { type: ShadingType.CLEAR, fill: "E8EDF2", color: "auto" } : undefined,
              margins: { top: 60, bottom: 60, left: 100, right: 100 },
              children: [new Paragraph({ alignment: j > 0 && i > 0 ? AlignmentType.CENTER : AlignmentType.LEFT,
                children: [new TextRun({ text: c, bold: i === 0, size: 19 })] })] })),
      });
    }),
  });
}
const paragraphe = t => new Paragraph({ spacing: { after: 140 }, alignment: AlignmentType.JUSTIFIED,
  children: [new TextRun({ text: remplir(t), size: 22 })] });
const citation = b => [
  new Paragraph({ spacing: { before: 60, after: 40 }, indent: { left: 567, right: 567 }, alignment: AlignmentType.JUSTIFIED,
    children: [new TextRun({ text: `« ${b.t} »`, italics: true, size: 21 })] }),
  new Paragraph({ spacing: { after: 160 }, indent: { left: 567, right: 567 }, alignment: AlignmentType.RIGHT,
    children: [new TextRun({ text: etiquette(b.cite), size: 19, color: "444444" })] }),
];
const encadre = (titre, texte) => [new Table({
  width: { size: LARGEUR, type: WidthType.DXA }, columnWidths: [LARGEUR],
  borders: Object.fromEntries(["top", "bottom", "left", "right"].map(k => [k, { style: BorderStyle.SINGLE, size: 6, color: "7F8C8D" }])),
  rows: [new TableRow({ children: [new TableCell({
    width: { size: LARGEUR, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: "F4F6F8", color: "auto" },
    margins: { top: 100, bottom: 100, left: 160, right: 160 },
    children: [
      new Paragraph({ children: [new TextRun({ text: titre, bold: true, size: 20 })] }),
      new Paragraph({ children: [new TextRun({ text: remplir(texte), size: 19 })] }),
    ] })] })],
}), vide()];

/* ---------- Document ---------- */
const enfants = [
  ...pageDeGarde("Chapitre 5 — Résultats (rédaction d'exercice)",
    "Rédaction d'exercice du chapitre Résultats, à partir du projet QualiCode « Mémoire Ngoma — SIMULATION de formation ».\n\n" +
    "Le plan suit le mémo « Phase 6 » du projet. Chaque citation a été vérifiée automatiquement : elle figure mot pour mot dans un passage codé du participant, et aucun participant ayant refusé la citation n'est cité. Chaque effectif est calculé à partir du codage.\n\n" +
    "Ce texte est un MODÈLE de forme. Les résultats du mémoire réel devront être rédigés à partir des données réelles, et ne rien reprendre de celui-ci.",
    `${tous.filter(x => x.qualif === "infirmier").length} infirmiers ou infirmières et ${tous.filter(x => x.qualif === "sage-femme").length} sages-femmes, ${obsTous.length} centres de santé, en deux vagues`),
  saut(),
  titre1(TITRE_CHAPITRE),
];
for (const b of blocs) {
  if (b.h2) enfants.push(titre2(b.h2));
  else if (b.h3) enfants.push(titre3(b.h3));
  else if (b.p) enfants.push(paragraphe(b.p));
  else if (b.cite) enfants.push(...citation(b));
  else if (b.encadre) enfants.push(...encadre(b.encadre, b.t));
  else if (b.tableau) enfants.push(...tableaux[b.tableau]());
  else throw new Error(`bloc inconnu : ${JSON.stringify(b).slice(0, 80)}`);
}

// Pour l'exercice : comment refaire ce chapitre dans l'application.
enfants.push(saut(), titre1("Annexe d'exercice — refaire ce chapitre dans QualiCode"));
for (const [etape, geste] of [
  ["Plan", "Mémos ▸ « Phase 6 — Production du rapport » : le plan et les règles de citation."],
  ["Définitions", "Mémos ▸ « Phase 5 — Définition et dénomination des thèmes » : ce que chaque thème est, et ce qu'il n'est pas."],
  ["Extraits par thème", "Requêtes ▸ ouvrir la requête du thème (T1 à T7), puis Rapports ▸ Rapport Word (.docx) : tous les passages, avec leur participant."],
  ["Extraits citables", "Requêtes ▸ « Extraits citables » : elle exclut l'entretien dont l'auteur a refusé la citation."],
  ["Effectifs", "Analyse ▸ Matrice codes × documents : le nombre de participants par code, à reporter dans le texte."],
  ["Comparaisons", "Analyse ▸ Comparaison de groupes, variable « qualification » ou « vague » : les tableaux VIII et IX."],
  ["Triangulation", "Mémos ▸ « Triangulation — ensemble des deux vagues », et les comptes rendus d'observation (code « ÉCART déclaré / constaté »)."],
]) enfants.push(new Paragraph({ spacing: { after: 100 }, children: [
  new TextRun({ text: `${etape} — `, bold: true, size: 21 }), new TextRun({ text: geste, size: 21 })] }));
enfants.push(vide(), encadreRouge("Règle à ne jamais oublier",
  "Un extrait n'est cité que si son auteur l'a accepté ; il n'est jamais associé au code de son centre ni à plus d'une caractéristique (§ 4.2.7). Les propos sur les femmes sont des représentations professionnelles : on les rapporte, on ne les présente pas comme des faits."));

const fichier = `${dossier}/5_Chapitre_Resultats_SIMULATION.docx`;
const tampon = await Packer.toBuffer(new Document({ styles: stylesCommuns(), sections: [{ children: enfants }] }));

// Dernier contrôle, sur le document réellement produit : aucun code de centre
// protégé n'y figure. Le fichier n'est écrit qu'après ce contrôle.
const JSZip = createRequire(import.meta.url)("jszip");
const xml = await (await JSZip.loadAsync(tampon)).file("word/document.xml").async("string");
for (const cs of centresProteges) {
  if (xml.includes(cs)) throw new Error(`le code ${cs} apparaît dans le chapitre alors que son identification est exclue`);
}
writeFileSync(fichier, tampon);
console.log("écrit :", fichier);
console.log(`  ${blocs.filter(b => b.cite).length} citations vérifiées · ${Object.keys(tableaux).length} tableaux calculés · centres protégés : ${[...centresProteges].length}`);
