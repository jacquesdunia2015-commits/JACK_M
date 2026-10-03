// chapitre6.mjs — le chapitre 6 (Discussion) sous forme d'éléments Word,
// utilisé par le document séparé (faire-discussion.mjs) et par le mémoire
// complet (faire-memoire.mjs). Les références sont vérifiées et numérotées par
// le numéroteur passé en argument (references.mjs).
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { titre1, titre2, titre3, tableau, Paragraph, AlignmentType } from "./mise-en-page.mjs";
const { ImageRun } = createRequire(import.meta.url)("docx");
import { TITRE_DISCUSSION, blocsDiscussion, revisionsCadre, recommandations } from "./discussion.mjs";
import { legende, source, rendu } from "./rendu.mjs";

// Figure produite par faire-figure-cadre.mjs (figures/, hors dépôt), insérée sur 13,8 cm de large, en
// tête de page : à cette hauteur (environ 21 cm), elle ne peut pas partager une page avec du texte.
function figure(fichier) {
  const data = readFileSync(new URL(`./figures/${fichier}`, import.meta.url));
  const largeur = 520, hauteur = Math.round(largeur * data.readUInt32BE(20) / data.readUInt32BE(16));
  return new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, pageBreakBefore: true, spacing: { before: 0, after: 60, line: 240, lineRule: "auto" },
    children: [new ImageRun({ type: "png", data, transformation: { width: largeur, height: hauteur } })] });
}

export function chapitre6(calc, { refs }) {
  const { paragraphe, encadre } = rendu({ remplir: calc.remplir, refs });
  const tableaux = {
    cadre: () => [legende("Tableau VII. Révisions du cadre conceptuel suggérées par les codes inductifs"),
      tableau([["Niveau du cadre", "Révision suggérée", "Résultats qui l'appellent"], ...revisionsCadre], [2300, 2900, 3826]),
      source("mémo « Piste d'audit 3 — révision du cadre conceptuel » du projet NVivo")],
    recommandations: () => [legende("Tableau IX. Recommandations par destinataire"),
      tableau([["Destinataire", "Recommandations", "Résultats d'appui"], ...recommandations], [2200, 5126, 1700]),
      source("chapitre 5 (thèmes 1 à 7 et transformations proposées par les participants)")],
  };
  const enfants = [titre1(TITRE_DISCUSSION)];
  for (const b of blocsDiscussion) {
    if (b.h2) enfants.push(titre2(b.h2));
    else if (b.h3) enfants.push(titre3(b.h3));
    else if (b.p) enfants.push(paragraphe(b.p));
    else if (b.encadre) enfants.push(...encadre(b.encadre, b.t));
    else if (b.tableau) enfants.push(...tableaux[b.tableau]());
    else if (b.figure) enfants.push(figure(b.figure), legende(b.legende), source(b.source));
    else throw new Error(`bloc inconnu : ${JSON.stringify(b).slice(0, 80)}`);
  }
  return { enfants };
}
