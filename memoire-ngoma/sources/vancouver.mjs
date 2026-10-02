// vancouver.mjs — numérotation des références selon le style de Vancouver :
// numéros attribués dans l'ordre de première citation, liste limitée aux
// références effectivement citées et classée dans cet ordre.
//
// Le texte est rédigé avec les numéros de la bibliographie du protocole (1 à
// 71, puis les références ajoutées). Quand le mémoire n'en reprend qu'une
// partie, ces numéros ne suivent plus l'ordre de citation : renumeroter()
// réécrit, dans le document produit, chaque appel [n] et la liste elle-même.
// Les paragraphes de la liste portent le style « Bibliographie » et
// commencent par « n.<tabulation> ».

const APPEL = /\[(\d+(?:\s*[-–,]\s*\d+)*)\]/g;
const developper = contenu => contenu.split(",").flatMap(m => {
  const [a, b] = m.split(/[-–]/).map(x => Number(x.trim()));
  return b ? Array.from({ length: b - a + 1 }, (_, i) => a + i) : [a];
});
// [3,4,5,9] → « 3-5,9 » : trois numéros consécutifs ou plus forment un intervalle.
function compacter(nums) {
  const t = [...new Set(nums)].sort((a, b) => a - b), out = [];
  for (let i = 0; i < t.length;) {
    let j = i;
    while (j + 1 < t.length && t[j + 1] === t[j] + 1) j++;
    out.push(j - i >= 2 ? `${t[i]}-${t[j]}` : t.slice(i, j + 1).join(","));
    i = j + 1;
  }
  return out.join(",");
}

/**
 * Renumérote les appels et la liste. Renvoie { xml, correspondance, nbCitees }.
 * `correspondance` associe l'ancien numéro au nouveau.
 */
export function renumeroter(xml) {
  const paragraphes = xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || [];
  const estListe = p => /<w:pStyle w:val="Bibliographie"\/>/.test(p);
  // 1. Ordre de première citation, hors de la liste elle-même.
  const correspondance = new Map();
  for (const p of paragraphes) {
    if (estListe(p)) continue;
    const texte = p.replace(/<[^>]+>/g, "");
    for (const [, contenu] of texte.matchAll(APPEL)) {
      for (const n of developper(contenu)) if (!correspondance.has(n)) correspondance.set(n, correspondance.size + 1);
    }
  }
  // 2. Réécriture des appels, dans le texte des runs (un appel n'est jamais coupé entre deux runs).
  const nouvelAppel = (m, contenu) => `[${compacter(developper(contenu).map(n => correspondance.get(n)))}]`;
  // 3. Liste : on garde les références citées, renumérotées et classées.
  const liste = [];
  let premiere = -1;
  const sansListe = xml.replace(/<w:p[ >][\s\S]*?<\/w:p>/g, (p, pos) => {
    if (!estListe(p)) return p.replace(/(<w:t(?: [^>]*)?>)([^<]*)(<\/w:t>)/g, (m, o, t, f) => o + t.replace(APPEL, nouvelAppel) + f);
    if (premiere < 0) premiere = pos;
    const ancien = Number(p.replace(/<[^>]+>/g, "").match(/^(\d+)\./)[1]);
    if (correspondance.has(ancien)) {
      const nouveau = correspondance.get(ancien);
      liste.push([nouveau, p.replace(/(<w:t(?: [^>]*)?>)\d+\./, `$1${nouveau}.`)]);
    }
    return "\u0000";   // emplacement de la liste
  });
  liste.sort((a, b) => a[0] - b[0]);
  const xmlFinal = sansListe.replace("\u0000", liste.map(x => x[1]).join("")).replace(/\u0000/g, "");
  const manquantes = [...correspondance.keys()].filter(n => !liste.some(([nv]) => nv === correspondance.get(n)));
  if (manquantes.length) throw new Error(`appels sans référence dans la liste : ${manquantes.join(", ")}`);
  return { xml: xmlFinal, correspondance, nbCitees: liste.length };
}
