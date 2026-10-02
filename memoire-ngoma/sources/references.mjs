// references.mjs — bibliographie du mémoire (style Vancouver).
//
// · Les références 1 à 71 sont celles du protocole corrigé, dans son ordre et
//   avec son texte (references-protocole.json, produit par extraire-protocole.py ;
//   le texte du protocole lui-même n'est pas versé au dépôt).
// · Les références ajoutées pendant la rédaction (discussion) sont numérotées à
//   la suite, dans l'ordre de leur première citation. Elles sont repérées par
//   une clé dans le texte : {c:cle}. Chacune doit être vérifiée dans sa source
//   avant le dépôt : elles sont listées comme telles dans l'annexe d'exercice.
import { readFileSync } from "node:fs";

export const PROTOCOLE = JSON.parse(readFileSync(new URL("./references-protocole.json", import.meta.url), "utf8"));
if (PROTOCOLE.length !== 71) throw new Error(`le protocole devrait compter 71 références, ${PROTOCOLE.length} lues`);

export const AJOUTEES = {
  niyonsenga: "Niyonsenga SP, Park PH, Ngoga G, et al. Implementation outcomes of national decentralization of integrated outpatient services for severe non-communicable diseases to district hospitals in Rwanda. Trop Med Int Health. 2021;26(8):953-61.",
  tudorHart: "Tudor Hart J. The inverse care law. Lancet. 1971;1(7696):405-12.",
  nutbeam: "Nutbeam D. Health literacy as a public health goal: a challenge for contemporary health education and communication strategies into the 21st century. Health Promot Int. 2000;15(3):259-67.",
  lipsky: "Lipsky M. Street-level bureaucracy: dilemmas of the individual in public services. New York: Russell Sage Foundation; 1980.",
  marmot: "Marmot M, Allen J, Goldblatt P, Boyce T, McNeish D, Grady M, et al. Fair society, healthy lives: the Marmot Review. London: The Marmot Review; 2010.",
  campbell: "Campbell DT. Assessing the impact of planned social change. Eval Program Plann. 1979;2(1):67-90.",
  rurangirwa: "Rurangirwa AA, Mogren I, Ntaganira J, Govender K, Krantz G. Quality of antenatal care services in Rwanda: assessing practices of health care providers. BMC Health Serv Res. 2018;18(1):865.",
  mccambridge: "McCambridge J, Witton J, Elbourne DR. Systematic review of the Hawthorne effect: new concepts are needed to study research participation effects. J Clin Epidemiol. 2014;67(3):267-77.",
};

/** Numérotation des références ajoutées, dans l'ordre de première citation. */
export function numeroteur() {
  const ordre = [];
  return {
    numero(cle) {
      if (!AJOUTEES[cle]) throw new Error(`référence ajoutée inconnue : ${cle}`);
      if (!ordre.includes(cle)) ordre.push(cle);
      return PROTOCOLE.length + ordre.indexOf(cle) + 1;
    },
    protocole(n) {
      if (!(n >= 1 && n <= PROTOCOLE.length)) throw new Error(`référence [${n}] absente de la bibliographie du protocole`);
      return n;
    },
    ajoutees: () => ordre.map((cle, i) => ({ numero: PROTOCOLE.length + i + 1, cle, texte: AJOUTEES[cle] })),
    nonCitees: () => Object.keys(AJOUTEES).filter(k => !ordre.includes(k)),
  };
}
