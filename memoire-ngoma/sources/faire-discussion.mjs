// faire-discussion.mjs — produit le chapitre 6 (Discussion) au format Word.
//
// Usage : node faire-discussion.mjs ../livrables
//
// Contrôles (le document n'est pas produit si l'un échoue) :
//   · une référence du protocole {p:n} n'est acceptée que si le protocole en
//     donne le contenu (liste PROTOCOLE_CONNUS) : on ne cite pas un numéro
//     dont on ignore ce qu'il désigne ;
//   · une référence complémentaire {c:clé} doit figurer dans COMPLEMENTAIRES ;
//     elles sont numérotées [C1], [C2]… dans l'ordre d'apparition ;
//   · un emplacement {r:2.2.x} doit désigner une section existante de la revue ;
//   · aucun code de participant ni de centre dans le texte : la discussion
//     porte sur les résultats, pas sur des personnes ou des lieux ;
//   · aucun champ {…} laissé non remplacé.
import { writeFileSync } from "node:fs";
import {
  Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell,
  WidthType, ShadingType, BorderStyle, LARGEUR,
  titre1, titre2, titre3, vide, saut, tableau, pageDeGarde, stylesCommuns,
} from "./mise-en-page.mjs";
import { calculs } from "./calculs.mjs";
import { TITRE_DISCUSSION, COMPLEMENTAIRES, blocsDiscussion, revisionsCadre, recommandations } from "./discussion.mjs";

const dossier = process.argv[2] || ".";
const { tous, obsTous, remplir } = await calculs(dossier);

// Numéros du protocole dont le contenu est connu (introduction, § 1.1, § 4.2).
const PROTOCOLE_CONNUS = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 23, 44, 45, 51, 60]);
// Sections de la revue de littérature (§ 2.2 du protocole).
const SECTIONS_REVUE = {
  "2.2.1": "Le dépistage au regard des valeurs de la promotion de la santé",
  "2.2.2": "Les orientations internationales relatives au dépistage en soins primaires",
  "2.2.3": "Les connaissances disponibles en Afrique subsaharienne",
  "2.2.4": "Déterminants sociaux du recours et équité dans l'accès au dépistage",
  "2.2.5": "Les interventions de promotion de la santé au Rwanda",
  "2.2.6": "Les connaissances disponibles au Rwanda et le point de vue absent",
  "2.2.7": "Synthèse critique et positionnement",
};

const ordreComplementaires = [];
const emplacements = new Map();

/** Texte → runs Word : références numérotées, emplacements surlignés. */
function runs(texte, taille = 22) {
  const t = remplir(texte).replace(/\s+(\{[pcr]:)/g, "$1");   // l'espace est ajouté avec la référence
  const morceaux = t.split(/(\{[pcr]:[^}]+\})/).filter(Boolean);
  return morceaux.map(m => {
    const r = m.match(/^\{([pcr]):([^}]+)\}$/);
    if (!r) {
      if (/[{}]/.test(m)) throw new Error(`champ non remplacé : « ${m.slice(0, 60)} »`);
      return new TextRun({ text: m, size: taille });
    }
    const [, type, val] = r;
    if (type === "p") {
      const nums = val.split(",").map(Number);
      const inconnu = nums.find(n => !PROTOCOLE_CONNUS.has(n));
      if (inconnu !== undefined) throw new Error(`référence [${inconnu}] du protocole : contenu inconnu, ne pas la citer`);
      return new TextRun({ text: ` [${nums.join(",")}]`, size: taille });
    }
    if (type === "c") {
      if (!COMPLEMENTAIRES[val]) throw new Error(`référence complémentaire inconnue : ${val}`);
      if (!ordreComplementaires.includes(val)) ordreComplementaires.push(val);
      return new TextRun({ text: ` [C${ordreComplementaires.indexOf(val) + 1}]`, size: taille });
    }
    if (!SECTIONS_REVUE[val]) throw new Error(`section de revue inconnue : ${val}`);
    emplacements.set(val, (emplacements.get(val) || 0) + 1);
    return new TextRun({ text: ` [réf. revue § ${val}]`, size: taille, highlight: "yellow" });
  });
}

const paragraphe = t => new Paragraph({ spacing: { after: 140 }, alignment: AlignmentType.JUSTIFIED, children: runs(t) });
const legende = t => new Paragraph({ spacing: { before: 200, after: 80 }, keepNext: true, children: [new TextRun({ text: t, bold: true, size: 20 })] });
const source = t => new Paragraph({ spacing: { before: 60, after: 200 }, children: [new TextRun({ text: `Source : ${t}.`, italics: true, size: 18, color: "555555" })] });
const encadre = (titre, texte) => [new Table({
  width: { size: LARGEUR, type: WidthType.DXA }, columnWidths: [LARGEUR],
  borders: Object.fromEntries(["top", "bottom", "left", "right"].map(k => [k, { style: BorderStyle.SINGLE, size: 6, color: "7F8C8D" }])),
  rows: [new TableRow({ children: [new TableCell({
    width: { size: LARGEUR, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: "F4F6F8", color: "auto" },
    margins: { top: 100, bottom: 100, left: 160, right: 160 },
    children: [new Paragraph({ children: [new TextRun({ text: titre, bold: true, size: 20 })] }), new Paragraph({ children: runs(texte, 19) })] })] })],
}), vide()];

const tableaux = {
  cadre: () => [legende("Tableau XIII. Révisions du cadre conceptuel suggérées par les codes inductifs"),
    tableau([["Niveau du cadre", "Révision suggérée", "Résultats qui l'appellent"], ...revisionsCadre], [2300, 2900, 3826]),
    source("mémo « Piste d'audit 3 — révision du cadre conceptuel » du projet QualiCode")],
  recommandations: () => [legende("Tableau XIV. Recommandations par destinataire"),
    tableau([["Destinataire", "Recommandations", "Résultats d'appui"], ...recommandations], [2200, 5126, 1700]),
    source("chapitre 5 (thèmes 1 à 7 et transformations proposées par les participants)")],
};

const enfants = [
  ...pageDeGarde("Chapitre 6 — Discussion (rédaction d'exercice)",
    "Rédaction d'exercice du chapitre Discussion, à partir des résultats du chapitre 5.\n\n" +
    "Les références du protocole sont citées par leur numéro, uniquement lorsque le protocole en donne le contenu. Les références complémentaires [C1], [C2]… sont proposées et doivent être vérifiées dans leur source avant usage. Les mentions surlignées en jaune marquent les endroits où insérer une référence de votre revue de littérature.\n\n" +
    "Ce texte est un MODÈLE de forme. La discussion du mémoire réel portera sur les résultats réels et ne reprendra rien de celle-ci.",
    `${tous.filter(x => x.qualif === "infirmier").length} infirmiers ou infirmières et ${tous.filter(x => x.qualif === "sage-femme").length} sages-femmes, ${obsTous.length} centres de santé, en deux vagues`),
  saut(),
  titre1(TITRE_DISCUSSION),
];
for (const b of blocsDiscussion) {
  if (b.h2) enfants.push(titre2(b.h2));
  else if (b.h3) enfants.push(titre3(b.h3));
  else if (b.p) enfants.push(paragraphe(b.p));
  else if (b.encadre) enfants.push(...encadre(b.encadre, b.t));
  else if (b.tableau) enfants.push(...tableaux[b.tableau]());
  else throw new Error(`bloc inconnu : ${JSON.stringify(b).slice(0, 80)}`);
}

// Références complémentaires, dans l'ordre d'apparition.
enfants.push(titre2("Références complémentaires proposées (à vérifier, puis à intégrer à la bibliographie)"));
ordreComplementaires.forEach((cle, i) => enfants.push(new Paragraph({ spacing: { after: 80 }, indent: { left: 567, hanging: 567 },
  children: [new TextRun({ text: `[C${i + 1}]\t${COMPLEMENTAIRES[cle]}`, size: 20 })] })));
const inutilisees = Object.keys(COMPLEMENTAIRES).filter(k => !ordreComplementaires.includes(k));
if (inutilisees.length) throw new Error(`références complémentaires listées mais jamais citées : ${inutilisees.join(", ")}`);

// Pour l'exercice : ce qu'il reste à faire.
enfants.push(saut(), titre1("Annexe d'exercice — compléter et vérifier cette discussion"));
enfants.push(paragraphe("Les emplacements surlignés appellent une référence de votre revue de littérature. Pour chacun, retrouvez dans la section indiquée l'étude qui soutient, nuance ou contredit le résultat discuté, et écrivez explicitement ce que vos résultats confirment, précisent ou remettent en cause."));
enfants.push(tableau([["Section de la revue (§ 2.2)", "Intitulé", "Emplacements"],
  ...[...emplacements.entries()].sort().map(([s, n]) => [s, SECTIONS_REVUE[s], String(n)])], [1800, 5726, 1500]));
enfants.push(vide(), paragraphe("Vérifiez ensuite chaque référence complémentaire dans sa source (auteurs, année, revue, pages) et assurez-vous qu'elle dit bien ce que le texte lui fait dire. Une référence qu'on n'a pas lue ne se cite pas."));

const tampon = await Packer.toBuffer(new Document({ styles: stylesCommuns(), sections: [{ children: enfants }] }));

// Dernier contrôle, sur le document produit : ni participant ni centre.
const { createRequire } = await import("node:module");
const JSZip = createRequire(import.meta.url)("jszip");
const xml = await (await JSZip.loadAsync(tampon)).file("word/document.xml").async("string");
const texte = xml.replace(/<[^>]+>/g, "");
const identifiants = texte.match(/\b(P\d{2}|CS\d{2})\b/g);
if (identifiants) throw new Error(`la discussion désigne des participants ou des centres : ${[...new Set(identifiants)].join(", ")}`);

const fichier = `${dossier}/6_Chapitre_Discussion_SIMULATION.docx`;
writeFileSync(fichier, tampon);
console.log("écrit :", fichier);
console.log(`  ${ordreComplementaires.length} références complémentaires · ${[...emplacements.values()].reduce((a, b) => a + b, 0)} emplacements de revue à compléter (${emplacements.size} sections)`);
