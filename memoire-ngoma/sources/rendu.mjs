// rendu.mjs — mise en forme commune aux chapitres rédigés (5, 6, mémoire).
//
// Le texte d'un paragraphe peut contenir :
//   · {N}, {n:CODE}, {v:clé}  valeurs calculées (calculs.mjs, remplir) ;
//   · {p:23}, {p:52-55}       références du protocole ;
//   · {c:cle}                 références ajoutées (references.mjs).
import {
  Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle, LARGEUR, vide,
} from "./mise-en-page.mjs";

export function legende(t) {
  return new Paragraph({ spacing: { before: 200, after: 80 }, keepNext: true,
    children: [new TextRun({ text: t, bold: true, size: 20 })] });
}
export function source(t) {
  return new Paragraph({ spacing: { before: 60, after: 200 },
    children: [new TextRun({ text: `Source : ${t}.`, italics: true, size: 18, color: "555555" })] });
}
// Tableau dont les lignes sans chiffres sont des intertitres grisés.
export function tableauSections(lignes, largeurs) {
  return new Table({
    width: { size: LARGEUR, type: WidthType.DXA }, columnWidths: largeurs,
    rows: lignes.map((ligne, i) => {
      const section = i > 0 && ligne.slice(1).every(c => c === "");
      return new TableRow({
        tableHeader: i === 0,
        children: section
          ? [new TableCell({ columnSpan: ligne.length, width: { size: LARGEUR, type: WidthType.DXA },
              shading: { type: ShadingType.CLEAR, fill: "F4F6F8", color: "auto" }, margins: { top: 60, bottom: 60, left: 100, right: 100 },
              // Intertitre lié à la ligne suivante : il ne reste jamais seul en bas de page.
              children: [new Paragraph({ keepNext: true, children: [new TextRun({ text: ligne[0], italics: true, bold: true, size: 19 })] })] })]
          : ligne.map((c, j) => new TableCell({ width: { size: largeurs[j], type: WidthType.DXA },
              shading: i === 0 ? { type: ShadingType.CLEAR, fill: "E8EDF2", color: "auto" } : undefined,
              margins: { top: 60, bottom: 60, left: 100, right: 100 },
              children: [new Paragraph({ keepNext: i === 0, alignment: j > 0 && i > 0 ? AlignmentType.CENTER : AlignmentType.LEFT,
                children: [new TextRun({ text: c, bold: i === 0, size: 19 })] })] })),
      });
    }),
  });
}

/** Fabrique de rendu liée à un jeu de valeurs et à une numérotation des références. */
export function rendu({ remplir, refs = null, etiquette = null }) {
  function runs(texte, taille = 22, italique = false) {
    const t = remplir(texte).replace(/\s+(\{[pc]:)/g, "$1");   // l'espace est ajouté avec la référence
    // Des appels contigus ({p:10}{c:cle}) forment un seul appel : [10,72].
    const morceaux = [];
    for (const m of t.split(/(\{[pc]:[^}]+\})/).filter(Boolean)) {
      const r = m.match(/^\{([pc]):([^}]+)\}$/);
      if (!r) {
        if (/[{}]/.test(m)) throw new Error(`champ non remplacé : « ${m.slice(0, 60)} »`);
        morceaux.push(new TextRun({ text: m, size: taille, italics: italique }));
        continue;
      }
      if (!refs) throw new Error(`référence ${m} dans un texte rendu sans bibliographie`);
      let numeros;
      if (r[1] === "c") numeros = String(refs.numero(r[2]));
      else {
        // {p:6,7,35-37} : chaque numéro est vérifié contre la bibliographie du protocole.
        for (const morceau of r[2].split(",")) for (const n of morceau.split("-")) refs.protocole(Number(n));
        numeros = r[2];
      }
      const precedent = morceaux[morceaux.length - 1];
      if (precedent?.appel) precedent.appel.push(numeros);
      else morceaux.push({ appel: [numeros] });
    }
    return morceaux.map(m => m.appel ? new TextRun({ text: ` [${m.appel.join(",")}]`, size: taille }) : m);
  }
  const paragraphe = t => new Paragraph({ spacing: { after: 80 }, alignment: AlignmentType.JUSTIFIED, children: runs(t) });
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
        new Paragraph({ children: runs(texte, 19) }),
      ] })] })],
  }), vide()];
  return { runs, paragraphe, citation, encadre };
}
