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
  // Références ci-dessous relevées le 2 octobre 2026 : articles vérifiés dans PubMed
  // (auteurs, revue, volume, pages et DOI) ; données de l'EDS 2025 relevées par
  // l'API du programme DHS ; directives nationales sur le site du RBC.
  schmidt: "Schmidt CN, Butrick E, Musange S, Mulindahabi N, Walker D. Towards stronger antenatal care: understanding predictors of late presentation to antenatal services and implications for obstetric risk management in Rwanda. PLoS One. 2021;16(8):e0256415. doi:10.1371/journal.pone.0256415",
  eds2025: "National Institute of Statistics of Rwanda, Ministry of Health, ICF. Rwanda Demographic and Health Survey 2025: indicateurs de soins prénatals [Internet]. Rockville (MD): The DHS Program, ICF; 2026 [cité le 2 oct 2026]. Disponible sur: https://api.dhsprogram.com",
  nshimiyumuremyi: "Nshimiyumuremyi E, Nigatu BK, Amberbir A, Gilson GJ, Manzi S, Nkubito V, et al. Maternal, fetal and neonatal adverse outcomes associated with gestational diabetes: a prospective cohort study at King Faisal Hospital, Kigali. BMJ Open. 2025;15(8):e098248. doi:10.1136/bmjopen-2024-098248",
  rbcAnc: "Rwanda Biomedical Centre, Ministry of Health. National antenatal care guidelines. Kigali: RBC; 2021. Disponible sur: https://rbc.gov.rw/MCCH/wp-content/uploads/2025/02/ANC-guideline_-final-Edited-4-February-2021-1-1.pdf",
  basinga: "Basinga P, Gertler PJ, Binagwaho A, Soucat AL, Sturdy J, Vermeersch CM. Effect on maternal and child health services in Rwanda of payment to primary health-care providers for performance: an impact evaluation. Lancet. 2011;377(9775):1421-8. doi:10.1016/S0140-6736(11)60177-3",
  rulisa: "Rulisa S, Ntihinyurwa P, Ntirushwa D, Wong A, Olufolabi A. Causes of maternal mortality in Rwanda, 2017-2019. Obstet Gynecol. 2021;138(4):552-6. doi:10.1097/AOG.0000000000004534",
  condo: "Condo J, Mugeni C, Naughton B, Hall K, Tuazon MA, Omwega A, et al. Rwanda's evolving community health worker system: a qualitative assessment of client and provider perspectives. Hum Resour Health. 2014;12:71. doi:10.1186/1478-4491-12-71",
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
