// faire-resultats.mjs — produit le chapitre 5 (Résultats) au format Word.
//
// Usage : node faire-resultats.mjs ../livrables
//
// Le texte vient de resultats.mjs ; tout ce qui est chiffré ou cité est
// CONTRÔLÉ (chapitre5.mjs, calculs.mjs) contre le projet QualiCode, et le
// document n'est pas produit si un contrôle échoue :
//   · chaque citation doit figurer mot pour mot dans un passage du participant
//     codé (codeur principal C1) avec l'un des codes annoncés ;
//   · un participant qui a refusé la citation ne peut pas être cité ;
//   · le code d'un centre dont un participant a demandé qu'il ne soit jamais
//     identifié ne peut apparaître nulle part dans le chapitre ;
//   · chaque {n:…} et {v:…} est remplacé par une valeur calculée.
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import {
  Document, Packer, Paragraph, TextRun, titre1, vide, saut, pageDeGarde, encadreRouge, stylesCommuns,
} from "./mise-en-page.mjs";
import { calculs } from "./calculs.mjs";
import { chapitre5 } from "./chapitre5.mjs";

const dossier = process.argv[2] || ".";
const calc = await calculs(dossier);
const { tous, obsTous, centresProteges } = calc;
const { enfants: corps, nbCitations } = chapitre5(calc);

/* ---------- Document ---------- */
const enfants = [
  ...pageDeGarde("Chapitre 5 — Résultats (rédaction d'exercice)",
    "Rédaction d'exercice du chapitre Résultats, à partir du projet QualiCode « Mémoire Ngoma — SIMULATION de formation ».\n\n" +
    "Le plan suit le mémo « Phase 6 » du projet. Chaque citation a été vérifiée automatiquement : elle figure mot pour mot dans un passage codé du participant, et aucun participant ayant refusé la citation n'est cité. Chaque effectif est calculé à partir du codage.\n\n" +
    "Ce texte est un MODÈLE de forme. Les résultats du mémoire réel devront être rédigés à partir des données réelles, et ne rien reprendre de celui-ci.",
    `${tous.filter(x => x.qualif === "infirmier").length} infirmiers ou infirmières et ${tous.filter(x => x.qualif === "sage-femme").length} sages-femmes, ${obsTous.length} centres de santé, en deux vagues`),
  saut(),
  ...corps,
];

// Pour l'exercice : comment refaire ce chapitre dans l'application.
enfants.push(saut(), titre1("Annexe d'exercice — refaire ce chapitre dans QualiCode"));
for (const [etape, geste] of [
  ["Plan", "Mémos ▸ « Phase 6 — Production du rapport » : le plan et les règles de citation."],
  ["Définitions", "Mémos ▸ « Phase 5 — Définition et dénomination des thèmes » : ce que chaque thème est, et ce qu'il n'est pas."],
  ["Extraits par thème", "Requêtes ▸ ouvrir la requête du thème (T1 à T7), puis Rapports ▸ Rapport Word (.docx) : tous les passages, avec leur participant."],
  ["Extraits citables", "Requêtes ▸ « Extraits citables » : elle exclut l'entretien dont l'auteur a refusé la citation."],
  ["Effectifs", "Analyse ▸ Matrice codes × documents : le nombre de participants par code, à reporter dans le texte."],
  ["Comparaisons", "Analyse ▸ Comparaison de groupes, variable « qualification » ou « vague » : les tableaux VI et VII."],
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
console.log(`  ${nbCitations} citations vérifiées · centres protégés : ${[...centresProteges].length}`);
