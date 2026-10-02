// faire-discussion.mjs — produit le chapitre 6 (Discussion) au format Word.
//
// Usage : node faire-discussion.mjs ../livrables
//
// Contrôles (le document n'est pas produit si l'un échoue) :
//   · une référence du protocole {p:n} doit exister dans sa bibliographie
//     (71 références) ; une référence ajoutée {c:clé} doit figurer dans
//     references.mjs, où elle est numérotée à la suite (72, 73…) ;
//   · aucun code de participant ni de centre dans le texte : la discussion
//     porte sur les résultats, pas sur des personnes ou des lieux ;
//   · aucun champ {…} laissé non remplacé.
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { Document, Packer, Paragraph, TextRun, titre1, titre2, saut, tableau, pageDeGarde, stylesCommuns, vide } from "./mise-en-page.mjs";
import { calculs } from "./calculs.mjs";
import { numeroteur } from "./references.mjs";
import { chapitre6 } from "./chapitre6.mjs";

const dossier = process.argv[2] || ".";
const calc = await calculs(dossier);
const refs = numeroteur();
const { enfants: corps } = chapitre6(calc, { refs });

const enfants = [
  ...pageDeGarde("Chapitre 6 — Discussion (rédaction d'exercice)",
    "Rédaction d'exercice du chapitre Discussion, à partir des résultats du chapitre 5 et du protocole corrigé.\n\n" +
    "Les numéros 1 à 71 renvoient à la bibliographie du protocole. Les références ajoutées pendant la rédaction sont numérotées à la suite et listées en fin de chapitre : chacune doit être vérifiée dans sa source avant le dépôt.\n\n" +
    "Ce texte est un MODÈLE de forme. La discussion du mémoire réel portera sur les résultats réels et ne reprendra rien de celle-ci.",
    `${calc.tous.filter(x => x.qualif === "infirmier").length} infirmiers ou infirmières et ${calc.tous.filter(x => x.qualif === "sage-femme").length} sages-femmes, ${calc.obsTous.length} centres de santé, en deux vagues`),
  saut(),
  ...corps,
  titre2("Références ajoutées pendant la rédaction (à vérifier, puis à intégrer à la bibliographie)"),
  ...refs.ajoutees().map(r => new Paragraph({ spacing: { after: 80 }, indent: { left: 567, hanging: 567 },
    children: [new TextRun({ text: `${r.numero}.\t${r.texte}`, size: 20 })] })),
];
const inutilisees = refs.nonCitees();
if (inutilisees.length) throw new Error(`références ajoutées mais jamais citées : ${inutilisees.join(", ")}`);

const tampon = await Packer.toBuffer(new Document({ styles: stylesCommuns(), sections: [{ children: enfants }] }));
const JSZip = createRequire(import.meta.url)("jszip");
const xml = await (await JSZip.loadAsync(tampon)).file("word/document.xml").async("string");
const identifiants = xml.replace(/<[^>]+>/g, "").match(/\b(P\d{2}|CS\d{2})\b/g);
if (identifiants) throw new Error(`la discussion désigne des participants ou des centres : ${[...new Set(identifiants)].join(", ")}`);

const fichier = `${dossier}/6_Chapitre_Discussion_SIMULATION.docx`;
writeFileSync(fichier, tampon);
console.log("écrit :", fichier);
console.log(`  ${refs.ajoutees().length} références ajoutées (numéros ${refs.ajoutees().map(r => r.numero).join(", ")})`);
