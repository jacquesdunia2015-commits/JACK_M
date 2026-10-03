// faire-resultats-validation.mjs — le chapitre 5 (Résultats) seul, tel qu'il
// figure dans le mémoire, à soumettre à la directrice de mémoire.
//
// Usage : node faire-resultats-validation.mjs ../livrables
//
// Même texte et mêmes contrôles que le chapitre 5 du mémoire complet (citations
// vérifiées mot pour mot, effectifs calculés, centres protégés absents), même
// mise en forme (Times New Roman 14, interligne 1,5) et même numérotation des
// tableaux (IV à VI). Une page de garde simple précède le chapitre.
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import {
  Document, Packer, Paragraph, TextRun, AlignmentType, vide,
} from "./mise-en-page.mjs";
import { ETUDE, MENTION } from "./echantillon.mjs";
import { calculs } from "./calculs.mjs";
import { numeroteur } from "./references.mjs";
import { chapitre5 } from "./chapitre5.mjs";
import * as T from "./memoire-textes.mjs";
import { stylesAcademiques, pageAcademique, appliquerGabarit } from "./gabarit-academique.mjs";
const require = createRequire(import.meta.url);
const JSZip = require("jszip");
const { Footer, PageNumber, SectionType } = require("docx");

const dossier = process.argv[2] || ".";
const calc = await calculs(dossier);
const { enfants: chapitre, nbCitations } = chapitre5(calc, { refs: numeroteur() });

const centre = (t, o = {}) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: o.after ?? 60, before: o.before ?? 0 },
  children: [new TextRun({ text: t, bold: o.gras, italics: o.italique, size: o.taille ?? 22 })] });
const date = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

const pageDeGarde = [
  ...["UNIVERSITÉ DE PARAKOU", "ÉCOLE NATIONALE DE FORMATION DES TECHNICIENS SUPÉRIEURS EN SANTÉ PUBLIQUE ET EN SURVEILLANCE ÉPIDÉMIOLOGIQUE (ENATSE)"]
    .map(t => centre(t, { gras: true })),
  centre("Programme de Master en Santé publique", {}), centre(T.PAGE_DE_GARDE.specialite, {}), centre(T.PAGE_DE_GARDE.annee, { after: 600 }),
  centre(T.PAGE_DE_GARDE.type, { gras: true, taille: 24 }),
  centre("THÈME", { gras: true, before: 240 }),
  centre(ETUDE.titre, { gras: true, taille: 26, after: 600 }),
  centre("CHAPITRE 5 — RÉSULTATS", { gras: true, taille: 32, after: 120 }),
  centre("Document soumis à la validation de la directrice de mémoire", { italique: true, taille: 24, after: 600 }),
  centre(T.PAGE_DE_GARDE.soutenu.replace("Présenté et soutenu par", "Présenté par")),
  centre("Directrice de mémoire : Professeure N. Fanny M. HOUNKPONOU AHOUINGNAN", { after: 240 }),
  centre(`Version du ${date}`, { italique: true, taille: 20 }),
  vide(),
  centre(MENTION, { italique: true, taille: 18 }),
];

// Repères pour la lecture hors du mémoire complet.
const note = new Paragraph({ spacing: { after: 240 }, children: [new TextRun({ italics: true,
  text: "Ce chapitre est repris tel quel du mémoire complet. Les tableaux gardent leur numéro (IV à VI) : les tableaux I à III " +
    "figurent au chapitre 4 (Cadre et méthodes). Les annexes citées sont celles du mémoire." })] });

const piedDePage = new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
  new TextRun({ text: "MÉMOIRE NGOMA — MUKAKI DUNIA Jacques · chapitre 5 · version d'entraînement · ", size: 16, color: "888888" }),
  new TextRun({ children: [PageNumber.CURRENT], size: 18 }),
] })] });

const document = new Document({
  features: { updateFields: false },
  styles: stylesAcademiques(),
  sections: [
    { properties: { page: pageAcademique }, children: pageDeGarde },
    { properties: { type: SectionType.NEXT_PAGE, page: { ...pageAcademique, pageNumbers: { start: 1 } } },
      footers: { default: piedDePage }, children: [note, ...chapitre] },
  ],
});
const tampon = await appliquerGabarit(await Packer.toBuffer(document), { preserverPremiereSection: true });

// Contrôles sur le document produit (les mêmes que pour le mémoire).
const xml = await (await JSZip.loadAsync(tampon)).file("word/document.xml").async("string");
for (const cs of calc.centresProteges) {
  if (xml.includes(cs)) throw new Error(`le code ${cs} apparaît dans le chapitre alors que son identification est exclue`);
}
for (const p of xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || []) {
  const t = p.replace(/<[^>]+>/g, "");
  if (/\bP\d{2}\b/.test(t) && /\bCS\d{2}\b/.test(t)) throw new Error(`participant et centre associés : « ${t.slice(0, 80)} »`);
}
const libres = xml.replace(/<[^>]+>/g, "").match(/\{[A-Za-z]+:[^}]*\}|\{N\}/g);
if (libres) throw new Error(`champs non remplacés : ${[...new Set(libres)].join(", ")}`);

const fichier = `${dossier}/Chapitre_5_Resultats_pour_validation.docx`;
writeFileSync(fichier, tampon);
console.log("écrit :", fichier);
console.log(`  ${nbCitations} citations vérifiées · centres protégés : ${[...calc.centresProteges].length}`);
