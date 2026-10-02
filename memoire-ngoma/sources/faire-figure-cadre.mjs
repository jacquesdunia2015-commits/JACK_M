// faire-figure-cadre.mjs — Figure 3 : cadre conceptuel révisé à la lumière des
// résultats (exercice). Reprend la structure de la figure 1 du protocole et y
// marque, en orange pointillé, les révisions que les résultats appellent
// (tableau VIII) : la cascade d'accès à la glycémie au niveau organisationnel,
// le dispositif de contrôle au niveau systémique, l'articulation
// communautaire, et l'équité d'accès décomposée en trois dimensions.
//
// Usage : node faire-figure-cadre.mjs ../livrables
// Produit figures/cadre_conceptuel_revise.svg et .png (hors dépôt, comme les
// autres figures : elles prolongent le cadre du protocole, non publié).
// Tous les nombres sont calculés à partir des observations.
import { writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { calculs } from "./calculs.mjs";

const dossier = process.argv[2] || ".";
const calc = await calculs(dossier);
const v = calc.valeurs;
const n = id => calc.participantsAvec([id]).length;

// Cascade d'accès à la glycémie, centre par centre (observations).
const glucometre = o => o.B.find(i => i.item === "Glucomètre");
const cascade = {
  present: calc.obsTous.filter(o => glucometre(o).present === "oui").length,
  utilisable: calc.obsTous.filter(o => ["laboratoire", "réservée MNT"].includes(o.glycemieCpn)).length,
  accessible: v.glycPossible,
  sansFrais: v.glycPossible - v.glycPayante,
};
const dispense = calc.obsTous.filter(o => o.glycemieCpn === "laboratoire" && /dispense/.test(glucometre(o).obs)).length;
if (!(cascade.present >= cascade.utilisable && cascade.utilisable >= cascade.accessible && cascade.accessible >= cascade.sansFrais)) {
  throw new Error(`cascade incohérente : ${JSON.stringify(cascade)}`);
}

/* ---------- Primitives SVG ---------- */
// Largeur de 1 200 unités : imprimée sur 15,5 cm, un corps de 21 unités donne
// environ 8 points, la taille minimale lisible d'une figure.
const L = 1200;
const POLICE = "'Times New Roman', 'Liberation Serif', serif";
const C = {
  encre: "#1a1a1a", gris: "#555555", ottawa: "#1f3864", ottawaFond: "#eef2f9",
  bleu: "#2e6db4", bleuFond: "#eaf1fb", orange: "#c55a11", orangeFond: "#fdf0e6",
  equite: "#a0401c", equiteFond: "#fae5d8",
};
const esc = t => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
// Typographie française : espace insécable avant « ; » et « : », pour qu'une ligne n'en commence jamais par un.
const fr = t => t.replace(/ ([;:])/g, " $1");
function lignes(t, max) {
  const out = []; let l = "";
  for (const mot of fr(t).split(" ")) {
    if ((l + " " + mot).trim().length > max) { out.push(l.trim()); l = mot; } else l += " " + mot;
  }
  if (l.trim()) out.push(l.trim());
  return out;
}
const texte = (x, y, t, { taille = 21, gras = false, italique = false, ancre = "middle", couleur = C.encre } = {}) =>
  `<text x="${x}" y="${y}" font-family="${POLICE}" font-size="${taille}" font-weight="${gras ? 700 : 400}"` +
  `${italique ? ' font-style="italic"' : ""} fill="${couleur}" text-anchor="${ancre}">${esc(fr(t))}</text>`;
const LARGEUR_CAR = 0.47;   // largeur moyenne d'un caractère, en fraction du corps (Times)
function bloc(x, y, t, { largeur, taille = 21, interligne = 1.28, ...o }) {
  const ls = lignes(t, Math.floor(largeur / (taille * LARGEUR_CAR)));
  return [ls.map((l, i) => texte(x, y + i * taille * interligne, l, { taille, ...o })).join(""), ls.length * taille * interligne];
}
const rect = (x, y, w, h, { trait = C.bleu, fond = C.bleuFond, pointille = false, rayon = 14, epaisseur = 2.5 } = {}) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rayon}" fill="${fond}" stroke="${trait}" stroke-width="${epaisseur}"${pointille ? ' stroke-dasharray="10 6"' : ""}/>`;
const ellipse = (cx, cy, rx, ry, trait, fond) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fond}" stroke="${trait}" stroke-width="3"/>`;
const fleche = (x1, y1, x2, y2, { pointille = false, double = false } = {}) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${C.gris}" stroke-width="2.5"${pointille ? ' stroke-dasharray="8 6"' : ""} marker-end="url(#pointe)"${double ? ' marker-start="url(#pointe-debut)"' : ""}/>`;
// Étiquette posée à cheval sur le bord supérieur droit d'un cadre.
function etiquette(xDroite, yBord, t) {
  const w = t.length * 9.6 + 18;
  return rect(xDroite - w - 14, yBord - 13, w, 26, { trait: C.orange, fond: C.orange, rayon: 6, epaisseur: 1 }) +
    texte(xDroite - 14 - w / 2, yBord + 6, t, { taille: 17, gras: true, couleur: "#ffffff" });
}

/* ---------- Composition ---------- */
const parts = [];
parts.push(ellipse(L / 2, 100, 430, 82, C.ottawa, C.ottawaFond),
  texte(L / 2, 80, "Charte d'Ottawa — cadre de valeurs", { taille: 28, gras: true }),
  texte(L / 2, 116, "Justice sociale et équité (conditions préalables)", { taille: 21 }),
  texte(L / 2, 146, "Réorienter les services · aptitudes · conférer les moyens", { taille: 21 }),
  fleche(L / 2, 184, L / 2, 226, { pointille: true }));
parts.push(ellipse(L / 2, 300, 400, 70, C.bleu, C.bleuFond),
  texte(L / 2, 290, "Perceptions et pratiques déclarées", { taille: 26, gras: true }),
  texte(L / 2, 324, `Infirmiers et sages-femmes de CPN, Ngoma (${v.nbCentres} centres)`, { taille: 21 }),
  fleche(L / 2 - 160, 366, 300, 424), fleche(L / 2 + 160, 366, 900, 424));

const G = { x: 20, y: 430, w: 555 }, D = { x: 625, y: 430, w: 555 };
const ESPACE = 26, ENTETE = 64;
// Un sous-cadre : titre, texte, éventuelle étiquette. `place` fixe sa hauteur.
function sousCadre(col, titre, corps, { revision = null, place = null } = {}) {
  const largeur = col.w - 28 - 30;
  const [, hTexte] = bloc(0, 0, corps, { largeur });
  const naturel = 64 + hTexte;
  return {
    hauteur: naturel,
    dessiner(y, haut) {
      const decal = (haut - naturel) / 2;
      const [svg] = bloc(col.x + col.w / 2, y + decal + 60, corps, { largeur });
      const style = revision ? { trait: C.orange, fond: C.orangeFond, pointille: true } : { trait: C.bleu, fond: "#ffffff" };
      return rect(col.x + 14, y, col.w - 28, haut, { ...style, rayon: 10, epaisseur: 2 }) +
        texte(col.x + col.w / 2, y + decal + 32, titre, { taille: 21, gras: true }) + svg +
        (revision ? etiquette(col.x + col.w - 14, y, revision) : "");
    },
  };
}
// Le niveau organisationnel révisé : cascade d'accès à la glycémie.
function cascadeCadre(col) {
  const x = col.x + 14, w = col.w - 28;
  return {
    hauteur: 186,
    dessiner(y, haut) {
      const decal = (haut - 186) / 2;
      let out = rect(x, y, w, haut, { trait: C.orange, fond: C.orangeFond, pointille: true, rayon: 10, epaisseur: 2 }) +
        texte(col.x + col.w / 2, y + decal + 32, "Organisationnel — accès à la glycémie", { taille: 21, gras: true }) +
        etiquette(col.x + col.w - 14, y, "révision");
      const etapes = [["présent", "", cascade.present], ["utilisable", "", cascade.utilisable],
        ["accessible", "à la CPN", cascade.accessible], ["sans frais", "pour la femme", cascade.sansFrais]];
      const lw = 110, gap = (w - 24 - 4 * lw) / 3;
      etapes.forEach(([lib, sous, val], i) => {
        const bx = x + 12 + i * (lw + gap), by = y + decal + 48;
        out += rect(bx, by, lw, 92, { trait: C.orange, fond: "#ffffff", rayon: 8, epaisseur: 1.5 }) +
          texte(bx + lw / 2, by + 34, `${val}/${v.nbCentres}`, { taille: 27, gras: true, couleur: C.orange }) +
          texte(bx + lw / 2, by + 60, lib, { taille: 19 }) + (sous ? texte(bx + lw / 2, by + 81, sous, { taille: 16, italique: true }) : "");
        if (i < 3) out += fleche(bx + lw + 3, by + 46, bx + lw + gap - 3, by + 46);
      });
      out += texte(col.x + col.w / 2, y + decal + 168, `centres où le glucomètre est… ; dispense informelle dans ${dispense} centre`, { taille: 17, italique: true });
      return out;
    },
  };
}
const gauche = [
  sousCadre(G, "Sens attribué au dépistage", `Mandat reconnu par tous (${n("A2")}) ; ce qui est impossible cesse d'être pensé.`),
  sousCadre(G, "Un dépistage coupé en deux", "Tension intégrée aux constantes ; glycémie au laboratoire ou à la consultation des maladies chroniques."),
  sousCadre(G, "Double sélection à l'accès au test glycémique", `Sur des signes d'appel, faute de critères écrits ; puis sur la capacité de payer : test hors du paquet de soins de la CPN (${n("B9")}).`, { revision: "révision" }),
  sousCadre(G, "Pratique informative et capacitante", `Modulée à l'inverse des besoins (${n("C4")}) ; contre-pratiques : faire reformuler, image commune.`),
];
const droite = [
  sousCadre(D, "Individuel et professionnel", `Formation ponctuelle et nominative ; compétence désapprise (${n("D5")}).`),
  cascadeCadre(D),
  sousCadre(D, "Systémique — le dispositif de contrôle", "Ce qui est compté existe ; le registre comme écran ; référence sans retour, rupture à l'accouchement.", { revision: "révision" }),
  sousCadre(D, "Articulation communautaire", "Agents de santé communautaire : suivi des femmes référées.", { revision: "ajout" }),
  sousCadre(D, "Social perçu", "Distance, coût, décision du ménage ; le service comme cause du non-retour."),
  sousCadre(D, "Portée en équité et transformations", `Inégalités jugées inacceptables (${n("H2")}) ; part reconnue : l'explication (${n("H5")}).`),
];
// Les deux colonnes ont la même hauteur : l'espace en trop de la plus courte est réparti entre ses cadres.
const hauteurCol = cadres => cadres.reduce((s, c) => s + c.hauteur, 0) + ESPACE * (cadres.length - 1);
const hCol = Math.max(hauteurCol(gauche), hauteurCol(droite));
function colonne(col, cadres) {
  const extra = (hCol - hauteurCol(cadres)) / cadres.length;
  let y = col.y + ENTETE, out = "";
  for (const c of cadres) { out += c.dessiner(y, c.hauteur + extra); y += c.hauteur + extra + ESPACE; }
  return out;
}
const basCol = G.y + ENTETE + hCol + 18;
parts.push(rect(G.x, G.y, G.w, basCol - G.y, { trait: C.bleu, fond: C.bleuFond, rayon: 20, epaisseur: 3 }),
  rect(D.x, D.y, D.w, basCol - D.y, { trait: C.bleu, fond: C.bleuFond, rayon: 20, epaisseur: 3 }),
  texte(G.x + G.w / 2, G.y + 40, "Objectif 1 — sens et pratiques", { taille: 25, gras: true }),
  texte(D.x + D.w / 2, D.y + 40, "Objectif 2 — conditions perçues", { taille: 25, gras: true }),
  colonne(G, gauche), colonne(D, droite),
  fleche(G.x + G.w + 6, G.y + 34, D.x - 6, D.y + 34, { double: true }));

// Équité d'accès, en trois dimensions.
const E = { x: 30, y: basCol + 64, w: L - 60, h: 236 };
parts.push(fleche(305, basCol + 4, 470, E.y - 6), fleche(895, basCol + 4, 730, E.y - 6),
  rect(E.x, E.y, E.w, E.h, { trait: C.equite, fond: C.equiteFond, rayon: 16, epaisseur: 3 }),
  texte(L / 2, E.y + 40, "ÉQUITÉ D'ACCÈS AU DÉPISTAGE CAPACITANT", { taille: 26, gras: true }),
  etiquette(E.x + E.w, E.y, "révision : trois dimensions"));
const dims = [
  ["Accès au test", `Tension intégrée ; glycémie dans ${v.glycPossible} centres sur ${v.nbCentres}, sur signes d'appel, aux frais de la femme.`],
  ["Accès à l'explication", "La capacité d'agir de la femme, distribuée à l'inverse des besoins."],
  ["Continuité", "Référence aboutie, retour d'information, suivi après l'accouchement."],
];
const dw = (E.w - 80) / 3;
dims.forEach(([t, c], i) => {
  const dx = E.x + 20 + i * (dw + 20);
  const [svgC] = bloc(dx + dw / 2, E.y + 122, c, { largeur: dw - 30, taille: 20 });
  parts.push(rect(dx, E.y + 60, dw, 158, { trait: C.equite, fond: "#ffffff", rayon: 10, epaisseur: 1.5 }),
    texte(dx + dw / 2, E.y + 92, t, { taille: 22, gras: true }), svgC);
});

const ly = E.y + E.h + 44;
parts.push(rect(30, ly - 19, 38, 24, { trait: C.bleu, fond: C.bleuFond, rayon: 5, epaisseur: 2 }),
  texte(78, ly, "Composante du cadre initial (§ 3.2)", { taille: 19, ancre: "start" }),
  rect(470, ly - 19, 38, 24, { trait: C.orange, fond: C.orangeFond, pointille: true, rayon: 5, epaisseur: 2 }),
  texte(518, ly, "Révision ou ajout issu des résultats (tableau VIII)", { taille: 19, ancre: "start" }),
  texte(L - 30, ly + 34, "Exercice de formation — données simulées", { taille: 15, italique: true, ancre: "end", couleur: "#888888" }));
const H = Math.ceil(ly + 50);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${L}" height="${H}" viewBox="0 0 ${L} ${H}">
<defs>
  <marker id="pointe" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="${C.gris}"/></marker>
  <marker id="pointe-debut" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M10,0 L0,5 L10,10 z" fill="${C.gris}"/></marker>
</defs>
<rect width="${L}" height="${H}" fill="#ffffff"/>
${parts.join("\n")}
</svg>`;

mkdirSync(new URL("./figures/", import.meta.url), { recursive: true });
const cheminSvg = new URL("./figures/cadre_conceptuel_revise.svg", import.meta.url).pathname;
const cheminPng = new URL("./figures/cadre_conceptuel_revise.png", import.meta.url).pathname;
writeFileSync(cheminSvg, svg);

// Rendu PNG par Chromium (Playwright), à deux fois la résolution.
const require = createRequire(import.meta.url);
const racineGlobale = execSync("npm root -g").toString().trim();
const { chromium } = require(`${racineGlobale}/playwright`);
const navigateur = await chromium.launch();
const page = await navigateur.newPage({ viewport: { width: L, height: H }, deviceScaleFactor: 2 });
await page.setContent(`<!doctype html><html><body style="margin:0">${svg}</body></html>`);
await page.screenshot({ path: cheminPng, clip: { x: 0, y: 0, width: L, height: H } });
await navigateur.close();
console.log("écrit :", cheminSvg, "et", cheminPng);
console.log(`  cascade : présent ${cascade.present} → utilisable ${cascade.utilisable} → accessible à la CPN ${cascade.accessible} → sans frais ${cascade.sansFrais} (sur ${v.nbCentres})`);
