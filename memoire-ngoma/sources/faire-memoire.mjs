// faire-memoire.mjs — produit le MÉMOIRE COMPLET (exercice) au format Word,
// selon le plan type de l'ENATSE :
//   pages liminaires (personnel de l'école, dédicace, remerciements, hommages,
//   sigles, listes des tableaux et figures, sommaire), executive summary,
//   introduction, chapitres 1 à 6, conclusion et suggestions, références
//   (Vancouver), annexes, table des matières, résumé et abstract.
//
// Usage : node faire-memoire.mjs ../livrables
//
// Sources : protocole.json (texte du protocole corrigé, chapitres 1 à 4.2.4,
// annexes, bibliographie), memoire-textes.mjs (parties propres au mémoire),
// chapitre5.mjs et chapitre6.mjs (résultats et discussion, contrôlés).
// Contrôles : toute référence citée existe dans la bibliographie ; aucune
// référence ajoutée n'est listée sans être citée ; aucun champ {…} non
// remplacé ; le centre protégé par un consentement n'apparaît nulle part.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import {
  Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, Table, TableRow, TableCell, WidthType,
  ShadingType, BorderStyle, LARGEUR, titre1, titre2, titre3, vide, saut, tableau, stylesCommuns, encadreRouge,
} from "./mise-en-page.mjs";
import { ETUDE, MENTION } from "./echantillon.mjs";
import { arbre } from "./codes.mjs";
import { consentementDe } from "./consentements.mjs";
import { calculs } from "./calculs.mjs";
import { numeroteur, PROTOCOLE } from "./references.mjs";
import { chapitre5 } from "./chapitre5.mjs";
import { chapitre6 } from "./chapitre6.mjs";
import { legende, rendu } from "./rendu.mjs";
import * as T from "./memoire-textes.mjs";
import { stylesAcademiques, pageAcademique, appliquerGabarit } from "./gabarit-academique.mjs";
import { renumeroter } from "./vancouver.mjs";

const require = createRequire(import.meta.url);
const { ImageRun, TableOfContents, Footer, PageNumber, NumberFormat, SectionType } = require("docx");
const JSZip = require("jszip");

const dossier = process.argv[2] || ".";
const calc = await calculs(dossier);
const refs = numeroteur();
const proto = JSON.parse(readFileSync(new URL("./protocole.json", import.meta.url), "utf8"));

/* ---------- Valeurs propres au mémoire ---------- */
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const enDate = jjmmaaaa => { const [j, m, a] = jjmmaaaa.split("/").map(Number); return `${j === 1 ? "1er" : j} ${MOIS[m - 1]} ${a}`; };
const triDates = l => [...l].sort((x, y) => x.split("/").reverse().join("").localeCompare(y.split("/").reverse().join("")));
const datesE = triDates(calc.tous.map(x => x.date)), datesO = triDates(calc.obsTous.map(o => o.date));
const consent = calc.tous.map(x => consentementDe(x.code));
const enfantsArbre = arbre.flatMap(f => f.enfants);
Object.assign(calc.valeurs, {
  debutEntretiens: enDate(datesE[0]), finEntretiens: enDate(datesE.at(-1)),
  debutObservations: enDate(datesO[0]), finObservations: enDate(datesO.at(-1)),
  dureeMoyenne: Math.round(calc.tous.reduce((s, x) => s + parseInt(x.duree, 10), 0) / calc.tous.length),
  nbEntretiens: calc.tous.length,
  nbKinyarwanda: calc.tous.filter(x => x.langue === "kinyarwanda").length,
  nbFrancais: calc.tous.filter(x => x.langue === "français").length,
  nbEnregistrement: consent.filter(c => c.enregistrement === "oui").length,
  nbCitationRefus: consent.filter(c => c.citation === "non").length,
  nbCitationCondition: consent.filter(c => /sans élément/.test(c.citation)).length,
  nbRecontact: consent.filter(c => c.recontact === "oui").length,
  codesDeductifs: enfantsArbre.filter(e => !/inductif/.test(e.nom)).length,
  familles: arbre.length,
});
const { runs, paragraphe } = rendu({ remplir: calc.remplir, refs });

/* ---------- Légendes : relevées pour les listes des tableaux et des figures ---------- */
const legendes = { tableaux: [], figures: [] };
function noter(t) {
  if (/^Tableau [IVXL]+\./.test(t)) legendes.tableaux.push(t);
  if (/^Figure \d+\./.test(t)) legendes.figures.push(t);
}
// Les chapitres 5 et 6 produisent leurs légendes eux-mêmes : on les relève dans le XML.
function noterDepuis(elements) {
  for (const el of elements) {
    const txt = JSON.stringify(el).match(/"((?:Tableau [IVXL]+|Figure \d+)\.[^"]*)"/);
    if (txt) noter(txt[1]);
  }
}

/* ---------- Images ---------- */
function dimensions(buf, type) {
  if (type === "png") return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  for (let i = 2; i < buf.length;) {
    if (buf[i] !== 0xff) { i++; continue; }
    const m = buf[i + 1], L = buf.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xc2) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    i += 2 + L;
  }
  throw new Error("dimensions JPEG introuvables");
}
function image(fichier, largeurMax, { alignement = AlignmentType.CENTER } = {}) {
  const data = readFileSync(new URL(`./figures/${fichier}`, import.meta.url));
  const type = fichier.endsWith(".png") ? "png" : "jpg";
  const { w, h } = dimensions(data, type);
  const largeur = Math.min(largeurMax, w);
  return new Paragraph({ alignment: alignement, spacing: { before: 120, after: 60 },
    children: [new ImageRun({ type, data, transformation: { width: largeur, height: Math.round(h * largeur / w) } })] });
}

// Figure 2 : la carte administrative officielle du district (profil du district
// au recensement de 2022, NISR) remplace celle du protocole dès que son image
// est déposée dans figures/ (hors dépôt, comme les autres figures).
const CARTE_NISR = ["carte_ngoma_nisr.png", "carte_ngoma_nisr.jpg", "carte_ngoma_nisr.jpeg"]
  .find(f => existsSync(new URL(`./figures/${f}`, import.meta.url))) || null;

/* ---------- Texte du protocole ---------- */
const indice = (titre, depuis = 0) => {
  const i = proto.findIndex((b, k) => k >= depuis && /^h[123]$/.test(b.type) && b.texte.startsWith(titre));
  if (i < 0) throw new Error(`section introuvable dans le protocole : ${titre}`);
  return i;
};
// Toute référence littérale du protocole doit exister dans sa bibliographie.
function verifierRefsLitterales(t) {
  for (const [, contenu] of t.matchAll(/\[(\d+(?:\s*[-,]\s*\d+)*)\]/g)) {
    for (const n of contenu.split(/[-,]/).map(Number)) refs.protocole(n);
  }
}
const corps = (t, style) => new Paragraph({ style, spacing: { after: style ? 80 : 140 }, alignment: AlignmentType.JUSTIFIED, children: [new TextRun({ text: t, size: 22 })] });
// Paragraphes compacts (12 pt, interligne simple) : annexes, sigles, listes.
const compact = (t, o = {}) => new Paragraph({ style: "Compact", spacing: { after: o.after ?? 40 }, children: [new TextRun({ text: t, bold: o.gras })] });
const sousTitreAnnexe = t => new Paragraph({ style: "CompactTitre", children: [new TextRun({ text: t })] });
const tableauProtocole = lignes => {
  const n = Math.max(...lignes.map(l => l.length));
  const l2 = lignes.map(l => [...l, ...Array(n - l.length).fill("")]);
  return tableau(l2, Array(n).fill(Math.floor(LARGEUR / n)));
};
// Condensation des chapitres 1 à 3 pour respecter la limite de 70 pages : les
// paragraphes du protocole qui suivent ne sont pas repris dans le mémoire. Ce
// sont des passages qui recoupent un autre endroit du texte (revue de la
// littérature, cadre conceptuel, chapitre 4) ; aucune phrase gardée n'est
// réécrite. Liste à relire avec la direction de mémoire.
const CONDENSATION = [
  "Consultation prénatale : Ensemble des contacts planifiés", "La dernière dimension s’appuie sur les indicateurs de pauvreté sectoriels", "Positionnement : Quatre constats fondent cette recherche.", "Le gradient social du recours :", "Ces déterminants ne sont pas abstraits pour Ngoma.", "Les obstacles normatifs :",
  "Une campagne communautaire conduite dans le district de Kirehe", "Le contenu du suivi prénatal a lui-même été mesuré.",
  "Les données de routine ne suffisent pas à documenter ce contenu", "Une particularité organisationnelle :",
  "Or cette dimension demeure peu documentée.",
  "Justice sociale :", "Déterminants sociaux de la santé et gradient social :", "Participation :", "Prestataire de soins :",
  "Trois valeurs en découlent", "La justice sociale fournit l’horizon normatif", "L’équité en constitue le critère observable",
  "La capacitation désigne le résultat attendu", "La Charte d’Ottawa est un texte de référence politique",
  "Précision de lecture :", "Stratégies mobilisées :", "Composantes écartées :",
  "Les qualificatifs « politique » et « communautaire »", "Quatre précisions délimitent la portée du cadre.",
  "La valeur de cette plateforme ne se mesure toutefois pas", "Cet écart a ici une signification théorique précise.",
  "Hypertension artérielle et diabète pendant la grossesse :", "Trois éléments en fondent la pertinence :",
  "Cette approche privilégie l’expression des participants", "La clôture ne repose pas sur une règle numérique",
];
const condenses = new Set();
function protocole(de, a, { transformer = t => t, sauterTitre = false, annexe = false, sansSaut = false } = {}) {
  const out = [];
  for (let i = de; i < a; i++) {
    const b = proto[i];
    if (sauterTitre && i === de) continue;
    const retire = b.type === "p" && !annexe && CONDENSATION.find(d => b.texte.replace(/[\u00a0\u202f]/g, " ").startsWith(d));
    if (retire) { condenses.add(retire); continue; }
    if (b.type === "h1") out.push(sansSaut && i === de ? titre1(b.texte) : titre1Page(b.texte));
    // Dans les annexes, les intertitres ne sont pas des titres : ils n'entrent pas dans la table des matières.
    else if (b.type === "h2") out.push(annexe ? sousTitreAnnexe(b.texte) : titre2(b.texte));
    else if (b.type === "h3") out.push(annexe ? sousTitreAnnexe(b.texte.replace(/\.$/, "")) : titre3(b.texte.replace(/\.$/, "")));
    else if (b.type === "table") out.push(tableauProtocole(b.lignes), vide());
    else if (b.type === "image") out.push(image(b.fichier === "carte_ngoma.jpeg" && CARTE_NISR ? CARTE_NISR : b.fichier, 560));
    else {
      const t = transformer(b.texte).replace("information capacitances", "information capacitante");   // coquille du protocole
      verifierRefsLitterales(t);
      if (/^(Tableau [IVXL]+|Figure \d+)\./.test(t)) {
        noter(t);
        out.push(legende(t));
        if (/^Figure 2\./.test(t)) out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 },
          children: [CARTE_NISR
            ? new TextRun({ text: "Source : National Institute of Statistics of Rwanda (NISR), cinquième recensement général de la population et de l'habitat 2022, profil du district de Ngoma [20].", italics: true, size: 18 })
            : new TextRun({ text: "Source : [à préciser — origine de la carte].", italics: true, size: 18, highlight: "yellow" })] }));
      } else out.push(corps(t, annexe ? "Compact" : undefined));
    }
  }
  return out;
}
// § 4.2.1 à 4.2.4 : le protocole était écrit au futur ou au présent de projet.
const auPasse = t => t
  .replace("Un échantillonnage raisonné à variation maximale est mis en œuvre. L’étude se fera dans un seul type de structure, la diversification porte sur les dimensions suivantes.",
    "Un échantillonnage raisonné à variation maximale a été mis en œuvre. L’étude s’est déroulée dans un seul type de structure ; la diversification a porté sur les dimensions suivantes.")
  .replace("Le recrutement vise chacune des modalités et couvre les seize centres, à raison d’un à deux participants par structure.",
    "Le recrutement a visé chacune des modalités et a couvert quinze des seize centres, à raison d’un à deux participants par structure ; le seizième a accueilli le pré-test et n’a pas été retenu.")
  .replace("4.2.2.2. La population source : Les seize centres de santé du district de Ngoma.",
    "4.2.2.2. La population source : Les centres de santé du district de Ngoma, au nombre de seize ; quinze ont été retenus, le seizième ayant servi au pré-test.")
  .replace("Un effectif de seize à vingt-quatre participants est retenu,", "Un effectif de seize à vingt-quatre participants avait été retenu,");

/* ---------- Pages liminaires ---------- */
const centre = (t, o = {}) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: o.after ?? 60, before: o.before ?? 0 },
  children: [new TextRun({ text: t, bold: o.gras, italics: o.italique, size: o.taille ?? 22, color: o.couleur })] });
// Titres des pages liminaires et finales : hors des styles de titre, pour ne pas
// figurer dans le sommaire ni dans la table des matières.
// Titre de chapitre ouvrant une page : le saut est porté par le titre lui-même
// (un paragraphe de saut distinct laisserait une page blanche quand la page
// précédente est pleine).
const titre1Page = t => new Paragraph({ text: t, heading: HeadingLevel.HEADING_1, pageBreakBefore: true, spacing: { before: 280, after: 160 } });
// `nouvellePage` : saut de page porté par le titre lui-même, qui ne laisse jamais de page blanche
// (un paragraphe de saut isolé peut tomber seul en haut d'une page).
const titrePage = (t, { nouvellePage = false } = {}) => new Paragraph({ alignment: AlignmentType.CENTER, pageBreakBefore: nouvellePage, spacing: { before: 240, after: 240 },
  children: [new TextRun({ text: t, bold: true, size: 30, color: "17334F" })] });
const aCompleter = t => new Paragraph({ spacing: { after: 140 }, children: [new TextRun({ text: t, italics: true, size: 22, highlight: "yellow" })] });

const pageDeGarde = [
  new Table({ width: { size: LARGEUR, type: WidthType.DXA }, columnWidths: [LARGEUR / 2, LARGEUR / 2],
    borders: Object.fromEntries(["top", "bottom", "left", "right", "insideHorizontal", "insideVertical"].map(k => [k, { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }])),
    rows: [new TableRow({ children: [
      new TableCell({ width: { size: LARGEUR / 2, type: WidthType.DXA }, children: [image("logo1.png", 90, { alignement: AlignmentType.LEFT })] }),
      new TableCell({ width: { size: LARGEUR / 2, type: WidthType.DXA }, children: [image("logo2.png", 100, { alignement: AlignmentType.RIGHT })] }),
    ] })] }),
  ...["RÉPUBLIQUE DU BÉNIN", "MINISTÈRE DE L’ENSEIGNEMENT SUPÉRIEUR", "ET DE LA RECHERCHE SCIENTIFIQUE", "UNIVERSITÉ DE PARAKOU"].map(t => centre(t, { gras: true })),
  image("logo3.png", 300),
  centre("ÉCOLE NATIONALE DE FORMATION DES TECHNICIENS SUPÉRIEURS EN SANTÉ PUBLIQUE ET EN SURVEILLANCE ÉPIDÉMIOLOGIQUE (ENATSE)", { gras: true, taille: 20 }),
  centre("Programme de Master en Santé publique", {}), centre(T.PAGE_DE_GARDE.specialite, {}), centre(T.PAGE_DE_GARDE.annee, { after: 240 }),
  centre(T.PAGE_DE_GARDE.type, { gras: true, taille: 26 }), centre(T.PAGE_DE_GARDE.diplome, { after: 240 }),
  centre("THÈME", { gras: true, taille: 22 }),
  centre(ETUDE.titre, { gras: true, taille: 26, after: 300 }),
  centre(T.PAGE_DE_GARDE.soutenu, { taille: 22 }),
  vide(),
  tableau([["DIRECTRICE DE MÉMOIRE\nProfesseure N. Fanny M. HOUNKPONOU AHOUINGNAN\nProfesseur titulaire du CAMES\nEnseignante de gynécologie-obstétrique\nFaculté de médecine, Université de Parakou\nDirectrice de l’ENATSE-UP"]], [LARGEUR], { entete: false }),
  vide(),
  centre(T.PAGE_DE_GARDE.jury, { italique: true, taille: 20 }),
  vide(),
  centre(MENTION, { italique: true, taille: 18 }),
];

const sigles = (() => {
  const i = proto.findIndex(b => b.type === "p" && b.texte === "SIGLES ET ABRÉVIATIONS");
  const lignes = [];
  for (let k = i + 1; k < proto.length && proto[k].type === "p" && !/^LISTE DES/.test(proto[k].texte); k++) {
    lignes.push(...proto[k].texte.split(/\s(?=WHO PEN)/));
  }
  return [...new Set([...lignes, ...T.SIGLES_AJOUTES])]
    .sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));
})();

/* ---------- Corps ---------- */
const corpsMemoire = [];
// Introduction : texte du protocole, suivi de l'annonce du plan.
corpsMemoire.push(titre1("INTRODUCTION"), ...protocole(indice("INTRODUCTION"), indice("1. PROBLÉMATIQUE"), { sauterTitre: true }));
corpsMemoire.push(paragraphe("Ce mémoire rend compte de cette étude en six chapitres. Les trois premiers posent la problématique, les généralités et le cadre conceptuel ; le quatrième décrit le cadre et les méthodes, tels qu'ils ont été mis en œuvre ; le cinquième présente les résultats et le sixième les discute. Une conclusion formule les suggestions qui en découlent."));
// Chapitres 1 à 3, puis 4.1 à 4.2.4 : texte du protocole.
corpsMemoire.push(...protocole(indice("1. PROBLÉMATIQUE"), indice("4.2.5. Collecte des données"), { transformer: auPasse }));
// 4.2.3 : échantillon obtenu (inséré après le tableau II, avant 4.2.4).
const i424 = corpsMemoire.findIndex(el => JSON.stringify(el).includes("4.2.4. Variables à l’étude"));
corpsMemoire.splice(i424, 0, paragraphe("Échantillon obtenu. {N} participants ont été inclus dans {v:nbCentres} des seize centres de santé du district, le seizième ayant accueilli le pré-test : {v:nbInf} infirmiers ou infirmières et {v:nbSf} sages-femmes, dont {v:nbTitulaires} titulaires. Chacune des modalités des sept dimensions du tableau II a été couverte ; la répartition est présentée au chapitre 5 (tableau IV)."));
// 4.2.5 à 4.2.7 : tels que conduits.
for (const b of T.METHODES_CONDUITES) corpsMemoire.push(b.h3 ? titre3(b.h3) : paragraphe(b.p));
// Chapitres 5 et 6.
const ch5 = chapitre5(calc, { refs }).enfants; noterDepuis(ch5);
const ch6 = chapitre6(calc, { refs }).enfants; noterDepuis(ch6);
corpsMemoire.push(saut(), ...ch5, saut(), ...ch6);
// Conclusion et suggestions.
corpsMemoire.push(titre1Page("CONCLUSION ET SUGGESTIONS"));
for (const b of T.CONCLUSION) corpsMemoire.push(paragraphe(b.p));
corpsMemoire.push(titre2("Suggestions"));
for (const [dest, items] of T.SUGGESTIONS) {
  corpsMemoire.push(new Paragraph({ spacing: { before: 120, after: 60 }, children: [new TextRun({ text: dest, bold: true, size: 22 })] }));
  for (const it of items) corpsMemoire.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: 60 }, children: runs(it) }));
}
// Références (Vancouver).
corpsMemoire.push(titre1Page("RÉFÉRENCES"));
const listeRefs = [...PROTOCOLE.map((t, i) => ({ numero: i + 1, texte: t })), ...refs.ajoutees()];
for (const r of listeRefs) corpsMemoire.push(new Paragraph({ style: "Bibliographie",
  children: [new TextRun({ text: `${r.numero}.\t${r.texte}` })] }));
const nonTrouves = CONDENSATION.filter(d => !condenses.has(d));
if (nonTrouves.length) throw new Error(`paragraphes à condenser introuvables : ${nonTrouves.join(" | ")}`);
if (refs.nonCitees().length) throw new Error(`références ajoutées jamais citées : ${refs.nonCitees().join(", ")}`);
// Annexes.
corpsMemoire.push(titre1Page("ANNEXES"));
const annexes = [["ANNEXE 1.", "ANNEXE 2."], ["ANNEXE 2.", "ANNEXE 3."], ["ANNEXE 3.", "ANNEXE 4."], ["ANNEXE 4.", "ANNEXE 5."]];
// Les annexes se suivent sans saut de page : l'annexe 1 suit le titre « ANNEXES », chacune suit la précédente.
// Le tableau de cohérence (annexe 8 du protocole) n'est pas repris : le renvoi du guide d'entretien pointe vers le protocole.
const versProtocole = t => t.replace("La correspondance entre objectifs, concepts et questions figure en annexe 8.",
  "La correspondance entre objectifs, concepts et questions figure dans le tableau de cohérence du protocole.");
annexes.forEach(([de, a]) => corpsMemoire.push(...protocole(indice(de), indice(a), { annexe: true, sansSaut: true, transformer: versProtocole })));
corpsMemoire.push(titre1("ANNEXE 5. VERSIONS TRADUITES DES OUTILS"), aCompleter("[Insérer les versions kinyarwanda et anglaise des outils, issues de la traduction et de la rétro-traduction indépendantes.]"));
corpsMemoire.push(titre1("ANNEXE 6. AUTORISATIONS ADMINISTRATIVES ET ÉTHIQUES"), aCompleter("[Insérer les copies de l'approbation du comité d'éthique et de l'autorisation du district.]"));
corpsMemoire.push(...protocole(indice("ANNEXE 7."), indice("ANNEXE 8."), { annexe: true, sansSaut: true }));
/* ---------- Fin du document : table des matières, résumé, abstract ---------- */
const fin = [
  titrePage("TABLE DES MATIÈRES", { nouvellePage: true }),
  new TableOfContents("Table des matières", { hyperlink: true, headingStyleRange: "1-2" }),
  titrePage(T.RESUME.titre, { nouvellePage: true }),
  ...T.RESUME.blocs.map(([t, x]) => new Paragraph({ spacing: { after: 120 }, alignment: AlignmentType.JUSTIFIED,
    children: [new TextRun({ text: `${t}. `, bold: true, size: 22 }), ...runs(x)] })),
  titrePage(T.ABSTRACT.titre, { nouvellePage: true }),
  ...T.ABSTRACT.blocs.map(([t, x]) => new Paragraph({ spacing: { after: 120 }, alignment: AlignmentType.JUSTIFIED,
    children: [new TextRun({ text: `${t}. `, bold: true, size: 22 }), ...runs(x)] })),
];

// Sigles sur deux colonnes, sans bordure : la liste tient sur une page.
function tableauSigles() {
  const moitie = Math.ceil(sigles.length / 2), sans = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const cellule = t => new TableCell({ width: { size: LARGEUR / 2, type: WidthType.DXA }, margins: { top: 20, bottom: 20, left: 60, right: 60 },
    children: [new Paragraph({ children: [new TextRun({ text: t || "" })] })] });
  return new Table({ width: { size: LARGEUR, type: WidthType.DXA }, columnWidths: [LARGEUR / 2, LARGEUR / 2],
    borders: Object.fromEntries(["top", "bottom", "left", "right", "insideHorizontal", "insideVertical"].map(k => [k, sans])),
    rows: Array.from({ length: moitie }, (_, i) => new TableRow({ children: [cellule(sigles[i]), cellule(sigles[i + moitie])] })) });
}

/* ---------- Pages liminaires (après le corps, pour disposer des légendes) ---------- */
const liminaires = [
  titrePage("LISTE DU PERSONNEL DE L’ÉCOLE"), aCompleter(T.LISTE_PERSONNEL),
  saut(), titrePage("DÉDICACE"), aCompleter(T.DEDICACE),
  saut(), titrePage("REMERCIEMENTS"),
  ...T.REMERCIEMENTS.map(t => /^\[/.test(t) ? aCompleter(t) : corps(t)),
  saut(), titrePage("HOMMAGES"),
  ...T.HOMMAGES.flatMap(([a, t]) => [new Paragraph({ spacing: { before: 160, after: 60 }, children: [new TextRun({ text: a, bold: true, size: 22 })] }),
    /\[/.test(t) ? aCompleter(t) : corps(t)]),
  saut(), titrePage("SIGLES ET ABRÉVIATIONS"),
  tableauSigles(),
  saut(), titrePage("LISTE DES TABLEAUX"),
  ...legendes.tableaux.map(t => compact(t)),
  titrePage("LISTE DES FIGURES"),
  ...legendes.figures.map(t => compact(t)),
  saut(), titrePage("SOMMAIRE"),
  new TableOfContents("Sommaire", { hyperlink: true, headingStyleRange: "1-1" }),
  saut(), titrePage("EXECUTIVE SUMMARY"),
  ...T.EXECUTIVE_SUMMARY.map(b => b.h
    ? new Paragraph({ spacing: { before: 140, after: 60 }, children: [new TextRun({ text: b.h, bold: true, size: 22 })] })
    : new Paragraph({ spacing: { after: 100 }, alignment: AlignmentType.JUSTIFIED, children: runs(b.p) })),
];

/* ---------- Assemblage ---------- */
const piedDePage = romain => new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
  new TextRun({ text: "MÉMOIRE NGOMA — MUKAKI DUNIA Jacques · version d'entraînement · ", size: 16, color: "888888" }),
  new TextRun({ children: [PageNumber.CURRENT], size: 18 }),
] })] });
const document = new Document({
  // Pas de mise à jour des champs à l'ouverture : finaliser-docx.py remplit les index avant livraison.
  features: { updateFields: false },
  styles: stylesAcademiques(),
  sections: [
    { properties: { page: pageAcademique }, children: pageDeGarde },
    { properties: { type: SectionType.NEXT_PAGE, page: { ...pageAcademique, pageNumbers: { start: 1, formatType: NumberFormat.LOWER_ROMAN } } },
      footers: { default: piedDePage(true) }, children: liminaires },
    { properties: { type: SectionType.NEXT_PAGE, page: { ...pageAcademique, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } } },
      footers: { default: piedDePage(false) }, children: [...corpsMemoire, ...fin] },
  ],
});
// Gabarit académique (Times New Roman 14, interligne 1,5…) ; la page de garde garde sa composition.
const zipMemoire = await JSZip.loadAsync(await appliquerGabarit(await Packer.toBuffer(document), { preserverPremiereSection: true }));
// Vancouver : numéros dans l'ordre de première citation, liste limitée aux références citées.
const { xml, nbCitees } = renumeroter(await zipMemoire.file("word/document.xml").async("string"));
zipMemoire.file("word/document.xml", xml);
const tampon = await zipMemoire.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

// Contrôles sur le document produit.
const texte = xml.replace(/<[^>]+>/g, "");
// Aucun paragraphe n'associe un code de participant à un code de centre (§ 4.2.7).
for (const p of xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || []) {
  const t = p.replace(/<[^>]+>/g, "");
  if (/\bP\d{2}\b/.test(t) && /\bCS\d{2}\b/.test(t)) throw new Error(`participant et centre associés : « ${t.slice(0, 80)} »`);
}
// Les transformations du texte du protocole doivent toutes avoir porté.
for (const attendu of ["tableau de cohérence du protocole", "a couvert quinze des seize centres", "quinze ont été retenus, le seizième ayant servi au pré-test", "information capacitante"]) {
  if (!texte.includes(attendu)) throw new Error(`transformation du protocole sans effet : « ${attendu} »`);
}
const libres = texte.match(/\{[A-Za-z]+:[^}]*\}|\{N\}/g);
if (libres) throw new Error(`champs non remplacés : ${[...new Set(libres)].join(", ")}`);

const fichier = `${dossier}/Memoire_complet.docx`;
writeFileSync(fichier, tampon);
console.log("écrit :", fichier);
console.log(`  ${legendes.tableaux.length} tableaux, ${legendes.figures.length} figures · ${nbCitees} références citées · ${Math.round(texte.length / 1000)} k caractères`);
