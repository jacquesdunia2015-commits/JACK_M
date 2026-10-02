// gabarit-academique.mjs — mise en forme du mémoire et du rapport selon les
// usages académiques courants, avec la police demandée (Times New Roman 14) :
//
//   · tout le texte courant hérite du style « Normal » : Times New Roman 14,
//     interligne 1,5, justifié, 6 pt après le paragraphe — modifiable d'un
//     seul geste dans Word (Accueil ▸ Styles ▸ Normal ▸ Modifier) ;
//   · titres : styles Titre 1 à 3 (Times New Roman 14, gras, noir ; le
//     niveau 3 en gras italique), qui alimentent le sommaire et la table des
//     matières automatiques ;
//   · tableaux : texte à interligne simple, 11 pt (10 pt au-delà de cinq
//     colonnes), titre au-dessus (« Tableau N. ») et source en dessous ;
//   · citations longues en retrait et références : 12 pt, interligne simple ;
//   · marges : 2,5 cm en haut, en bas et à droite, 3 cm à gauche (reliure) ;
//     pagination en bas, au centre (chiffres romains pour les pages
//     liminaires, arabes pour le corps).
//
// Le document est produit par la bibliothèque docx avec des tailles écrites
// en dur dans les paragraphes ; appliquerGabarit() les retire du texte
// courant pour qu'il dépende des styles seulement, ce qui le rend éditable
// comme un document Word ordinaire.
import { createRequire } from "node:module";
import { AlignmentType, LARGEUR } from "./mise-en-page.mjs";
const require = createRequire(import.meta.url);
const JSZip = require("jszip");

const cm = x => Math.round(x * 567);
export const MARGES = { top: cm(2.5), bottom: cm(2.5), left: cm(3), right: cm(2.5), header: cm(1.25), footer: cm(1.25) };
const LARGEUR_TEXTE = 11906 - MARGES.left - MARGES.right;   // A4 : 21 cm = 11 906 DXA

const POLICE = "Times New Roman";
export function stylesAcademiques() {
  const titre = (id, nom, italique = false, avant = 240) => ({
    id, name: nom, basedOn: "Normal", next: "Normal", quickFormat: true,
    run: { font: POLICE, size: 28, bold: true, italics: italique, color: "000000" },
    paragraph: { spacing: { before: avant, after: 120, line: 360 }, keepNext: true, keepLines: true, alignment: AlignmentType.LEFT },
  });
  return {
    default: {
      document: {
        run: { font: POLICE, size: 28 },
        paragraph: { spacing: { line: 360, after: 120 }, alignment: AlignmentType.JUSTIFIED },
      },
    },
    paragraphStyles: [
      titre("Heading1", "Heading 1", false, 360),
      titre("Heading2", "Heading 2"),
      titre("Heading3", "Heading 3", true, 180),
    ],
  };
}

/** Propriétés de section : A4, marges académiques. */
export const pageAcademique = { size: { width: 11906, height: 16838 }, margin: MARGES };

const TAILLE = /<w:sz w:val="\d+"\/>|<w:szCs w:val="\d+"\/>/g;
const COULEUR = /<w:color w:val="(?!C0392B)[0-9A-Fa-f]{6}"\/>/g;   // le rouge de l'avertissement est conservé
const texteDe = p => p.replace(/<[^>]+>/g, "");

// Word exige l'ordre des éléments fixé par le schéma OOXML : chaque insertion se
// fait donc avant le premier élément qui doit suivre l'élément inséré.
const APRES_SPACING = ["ind", "contextualSpacing", "mirrorIndents", "suppressOverlap", "jc", "textDirection",
  "textAlignment", "textboxTightWrap", "outlineLvl", "divId", "cnfStyle", "rPr", "sectPr", "pPrChange"];
const APRES_RPR_DE_PARAGRAPHE = ["sectPr", "pPrChange"];
const APRES_SZ = ["highlight", "u", "effect", "bdr", "shd", "fitText", "vertAlign", "rtl", "cs", "em", "lang",
  "eastAsianLayout", "specVanish", "oMath"];
function inserer(contenu, element, suivants) {
  const re = new RegExp(`<w:(?:${suivants.join("|")})[ />]`);
  const m = contenu.match(re);
  return m ? contenu.slice(0, m.index) + element + contenu.slice(m.index) : contenu + element;
}
// Applique `f` au contenu du pPr (créé s'il n'existe pas, en tête du paragraphe).
function avecPPr(p, f) {
  const m = p.match(/^(<w:p(?: [^>]*)?>)(<w:pPr>([\s\S]*?)<\/w:pPr>)?/);
  const contenu = f(m[3] || "");
  return m[1] + `<w:pPr>${contenu}</w:pPr>` + p.slice(m[0].length);
}

function fixerTaille(p, demi) {
  p = p.replace(TAILLE, "");
  const sz = `<w:sz w:val="${demi}"/><w:szCs w:val="${demi}"/>`;
  // Taille de la marque de paragraphe, qui règle la hauteur d'une cellule vide.
  p = avecPPr(p, c => /<w:rPr>/.test(c)
    ? c.replace(/<w:rPr>([\s\S]*?)<\/w:rPr>/, (x, r) => `<w:rPr>${inserer(r, sz, APRES_SZ)}</w:rPr>`)
    : inserer(c, `<w:rPr>${sz}</w:rPr>`, APRES_RPR_DE_PARAGRAPHE));
  return p.replace(/<w:r>(?:<w:rPr>([\s\S]*?)<\/w:rPr>)?/g, (x, r) => `<w:r><w:rPr>${inserer(r || "", sz, APRES_SZ)}</w:rPr>`);
}
// Interligne simple ; `serre` ramène aussi les espacements avant/après à 2 pt (cellules de tableau).
function interligneSimple(p, { serre = false } = {}) {
  const attributs = serre ? `w:before="40" w:after="40" w:line="240" w:lineRule="auto"` : `w:line="240" w:lineRule="auto"`;
  const retirer = serre ? /\s*w:(?:line|lineRule|before|after)="\w+"/g : /\s*w:(?:line|lineRule)="\w+"/g;
  return avecPPr(p, c => /<w:spacing [^>]*\/>/.test(c.replace(/<w:rPr>[\s\S]*?<\/w:rPr>/g, ""))
    ? c.replace(/<w:spacing ([^>]*?)\/>/, (x, a) => `<w:spacing ${a.replace(retirer, "").trim()} ${attributs}/>`.replace(/\s+/g, " "))
    : inserer(c, `<w:spacing ${attributs}/>`, APRES_SPACING));
}

// Alignement à gauche (cellules de tableau, références) quand aucun n'est fixé :
// le texte justifié hérité du style Normal y étirerait les espaces.
const APRES_JC = ["textDirection", "textAlignment", "textboxTightWrap", "outlineLvl", "divId", "cnfStyle", "rPr", "sectPr", "pPrChange"];
const aGauche = p => avecPPr(p, c => /<w:jc /.test(c) ? c : inserer(c, `<w:jc w:val="left"/>`, APRES_JC));

function traiterParagraphe(p, { dansTableau, colonnes }) {
  if (dansTableau) return aGauche(interligneSimple(fixerTaille(p.replace(COULEUR, ""), colonnes > 5 ? 20 : 22), { serre: true }));
  const t = texteDe(p);
  p = p.replace(COULEUR, "");
  if (/^(Tableau [IVXL\d]+|Figure \d+)\./.test(t)) return fixerTaille(p, 24);
  if (/^Source :/.test(t)) return fixerTaille(p, 22);
  const pPr = (p.match(/<w:pPr>[\s\S]*?<\/w:pPr>/) || [""])[0];
  if (/w:left="567"/.test(pPr) && /w:right="567"/.test(pPr)) return interligneSimple(fixerTaille(p, 24));   // citation longue
  if (/w:hanging="567"/.test(pPr)) return aGauche(interligneSimple(fixerTaille(p, 24)));                              // référence
  if (/<w:sectPr/.test(p) || /<w:fldChar/.test(p) && !t.trim()) return p;
  return p.replace(TAILLE, "");   // texte courant : la taille vient du style Normal
}

/**
 * Applique le gabarit au document produit. `preserverPremiereSection` laisse
 * intacte la page de garde quand elle forme une section à part.
 */
export async function appliquerGabarit(tampon, { preserverPremiereSection = false } = {}) {
  const zip = await JSZip.loadAsync(tampon);
  let xml = await zip.file("word/document.xml").async("string");
  // Largeurs : les tableaux ont été dessinés pour 9 026 DXA de texte.
  const f = LARGEUR_TEXTE / LARGEUR;
  xml = xml.replace(/(<w:(?:tblW|tcW) w:type="dxa" w:w=")(\d+)"|(<w:(?:tblW|tcW) w:w=")(\d+)(" w:type="dxa")/g,
    (m, a1, n1, a2, n2, b2) => a1 ? `${a1}${Math.round(n1 * f)}"` : `${a2}${Math.round(n2 * f)}${b2}`);
  xml = xml.replace(/<w:gridCol w:w="(\d+)"\/>/g, (m, n) => `<w:gridCol w:w="${Math.round(n * f)}"/>`);

  const debutCorps = xml.indexOf("<w:body>") + "<w:body>".length;
  let debut = debutCorps;
  if (preserverPremiereSection) {
    const i = xml.indexOf("<w:sectPr", debutCorps);
    debut = xml.indexOf("</w:p>", i) + "</w:p>".length;
  }
  // La page de garde garde ses tailles, mais à interligne simple pour tenir sur une page.
  const tete = xml.slice(0, debutCorps) + xml.slice(debutCorps, debut).replace(/<w:p[ >][\s\S]*?<\/w:p>/g, p => interligneSimple(p));
  const corps = xml.slice(debut);
  // Découpe en tableaux (non imbriqués) et paragraphes hors tableaux.
  const morceaux = corps.split(/(<w:tbl>[\s\S]*?<\/w:tbl>)/);
  const traite = morceaux.map(m => {
    if (m.startsWith("<w:tbl>")) {
      const colonnes = (m.match(/<w:gridCol /g) || []).length;
      return m.replace(/<w:p[ >][\s\S]*?<\/w:p>/g, p => traiterParagraphe(p, { dansTableau: true, colonnes }));
    }
    return m.replace(/<w:p[ >][\s\S]*?<\/w:p>/g, p => traiterParagraphe(p, { dansTableau: false }));
  }).join("");
  zip.file("word/document.xml", tete + traite);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
