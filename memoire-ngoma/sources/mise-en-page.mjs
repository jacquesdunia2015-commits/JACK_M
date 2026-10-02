// mise-en-page.mjs — éléments de mise en page Word communs aux livrables
// (annexes, transcriptions, note de positionnalité, chapitre Résultats).
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { ETUDE } from "./echantillon.mjs";
const require = createRequire(import.meta.url);
const docx = require("docx");
export const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle, PageBreak,
} = docx;

export const LARGEUR = 9026; // A4 moins les marges, en DXA
export const p = (text, opts = {}) => new Paragraph({ children: [new TextRun({ text, ...opts.run })], ...opts });
export const titre1 = t => new Paragraph({ text: t, heading: HeadingLevel.HEADING_1, spacing: { before: 280, after: 160 } });
export const titre2 = t => new Paragraph({ text: t, heading: HeadingLevel.HEADING_2, spacing: { before: 220, after: 120 } });
export const titre3 = t => new Paragraph({ text: t, heading: HeadingLevel.HEADING_3, spacing: { before: 180, after: 100 } });
export const vide = () => new Paragraph({ text: "" });
export const saut = () => new Paragraph({ children: [new PageBreak()] });

export const cellule = (texte, { gras = false, fond = null, largeur, italique = false } = {}) => new TableCell({
  width: { size: largeur, type: WidthType.DXA },
  shading: fond ? { type: ShadingType.CLEAR, fill: fond, color: "auto" } : undefined,
  margins: { top: 60, bottom: 60, left: 100, right: 100 },
  children: String(texte).split("\n").map(l =>
    new Paragraph({ children: [new TextRun({ text: l, bold: gras, italics: italique, size: 19 })] })),
});

export const tableau = (lignes, largeurs, { entete = true } = {}) => new Table({
  width: { size: LARGEUR, type: WidthType.DXA },
  columnWidths: largeurs,
  rows: lignes.map((ligne, i) => new TableRow({
    tableHeader: entete && i === 0,
    children: ligne.map((c, j) => cellule(c, {
      gras: entete && i === 0, fond: entete && i === 0 ? "E8EDF2" : null, largeur: largeurs[j],
    })),
  })),
});

export const bandeau = () => new Table({
  width: { size: LARGEUR, type: WidthType.DXA },
  columnWidths: [LARGEUR],
  borders: {
    top: { style: BorderStyle.SINGLE, size: 12, color: "C0392B" },
    bottom: { style: BorderStyle.SINGLE, size: 12, color: "C0392B" },
    left: { style: BorderStyle.SINGLE, size: 12, color: "C0392B" },
    right: { style: BorderStyle.SINGLE, size: 12, color: "C0392B" },
  },
  rows: [new TableRow({ children: [new TableCell({
    width: { size: LARGEUR, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill: "FDEDEC", color: "auto" },
    margins: { top: 140, bottom: 140, left: 160, right: 160 },
    children: [
      new Paragraph({ children: [new TextRun({ text: "⚠ DONNÉES ENTIÈREMENT SIMULÉES — EXERCICE DE FORMATION", bold: true, color: "C0392B", size: 22 })] }),
      new Paragraph({ children: [new TextRun({ text: "Aucun entretien n'a été conduit. Aucun centre de santé n'a été visité. Aucune des personnes décrites n'existe. Ce document sert exclusivement à apprendre à manipuler l'outil d'analyse avant la collecte réelle.", size: 19 })] }),
      new Paragraph({ children: [new TextRun({ text: "Il ne peut être cité, ni figurer dans le mémoire, ni servir de résultat, ni être présenté à un comité d'éthique ou à un jury comme une donnée de terrain.", bold: true, size: 19 })] }),
    ],
  })] })],
});

export const pageDeGarde = (sousTitre, description, echantillon) => [
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 400, after: 100 },
    children: [new TextRun({ text: "UNIVERSITÉ DE PARAKOU — ENATSE", bold: true, size: 22 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 300 },
    children: [new TextRun({ text: "Master en Santé publique — Promotion de la santé", size: 20 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 },
    children: [new TextRun({ text: ETUDE.titre, italics: true, size: 22 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200, after: 200 },
    children: [new TextRun({ text: sousTitre, bold: true, size: 32 })] }),
  vide(), bandeau(), vide(),
  ...description.split("\n").map(l => p(l, { run: { size: 20 }, spacing: { after: 80 } })),
  vide(),
  ...tableauInfos(echantillon),
];

export const tableauInfos = (echantillon) => [tableau([
  ["Chercheur", ETUDE.chercheur],
  ["Institution", ETUDE.institution],
  ["Direction", ETUDE.directrice],
  ["Période simulée", ETUDE.periodeSimulee],
  ["Échantillon simulé", echantillon],
], [2400, 6626], { entete: false })];

export const encadreRouge = (titre, texte) => new Table({
  width: { size: LARGEUR, type: WidthType.DXA }, columnWidths: [LARGEUR],
  borders: {
    top: { style: BorderStyle.SINGLE, size: 10, color: "C0392B" }, bottom: { style: BorderStyle.SINGLE, size: 10, color: "C0392B" },
    left: { style: BorderStyle.SINGLE, size: 10, color: "C0392B" }, right: { style: BorderStyle.SINGLE, size: 10, color: "C0392B" },
  },
  rows: [new TableRow({ children: [new TableCell({
    width: { size: LARGEUR, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill: "FDEDEC", color: "auto" },
    margins: { top: 120, bottom: 120, left: 160, right: 160 },
    children: [
      new Paragraph({ children: [new TextRun({ text: titre, bold: true, color: "C0392B", size: 20 })] }),
      new Paragraph({ children: [new TextRun({ text: texte, size: 19 })] }),
    ],
  })] })],
});

export function stylesCommuns() {
  return {
    default: { document: { run: { font: "Calibri", size: 21 }, paragraph: { spacing: { line: 276 } } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 30, bold: true, color: "17334F" }, paragraph: { spacing: { before: 320, after: 160 } } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 25, bold: true, color: "26567D" }, paragraph: { spacing: { before: 260, after: 120 } } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 22, bold: true, color: "2E6DA4" }, paragraph: { spacing: { before: 200, after: 100 } } },
    ],
  };
}


export const ecrire = async (doc, nom) => {
  writeFileSync(nom, await Packer.toBuffer(doc));
  console.log("écrit :", nom);
};
