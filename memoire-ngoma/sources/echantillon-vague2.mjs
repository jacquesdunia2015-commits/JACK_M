// echantillon-vague2.mjs — SECONDE VAGUE SIMULÉE (exercice de formation)
//
// ⚠️ DONNÉES ENTIÈREMENT FICTIVES, comme la première vague. Aucun entretien n'a
// été conduit, aucun centre n'a été visité. Les codes de structure ne désignent
// aucun établissement réel.
//
// Onze participants sur les onze centres de santé restants du district : le
// protocole en compte seize, la vague 1 en couvrait cinq (CS02, CS03, CS07,
// CS11, CS14). Avec la première vague, l'ensemble atteint 21 participants sur
// 16 centres — la fourchette de seize à vingt-quatre du § 4.2.3.1 et la règle
// « un participant au minimum par centre ».
//
// Composition demandée : 6 sages-femmes et 5 infirmiers ou infirmières.
//
// Cette vague n'est pas une répétition de la première. Elle introduit ce que
// la vague 1 ne permettait pas d'observer :
//   · un centre BIEN doté (CS01), contrepoint indispensable : ce que change la
//     disponibilité réelle du glucomètre et des bandelettes ;
//   · un registre rempli sans suite clinique (CS13) : compter ne suffit pas ;
//   · les agents de santé communautaire comme relais (CS16, CS08) ;
//   · le recours au traitement traditionnel, tel que perçu (CS05, CS15) ;
//   · une population frontalière et mobile (CS10) ;
//   · la rotation du personnel (CS06, CS09) ;
//   · une participante qui récuse toute généralisation sur les femmes (P18),
//     en contrepoint des représentations stéréotypées de la vague 1.

export const participantsV2 = [
  {
    code: "P11", cs: "CS01", sexe: "féminin", age: "30-39", qualif: "sage-femme",
    niveau: "A1", ancTotale: "5-10 ans", ancCpn: "> 2 ans", titulaire: false,
    formationMnt: "oui", anneeFormation: "2025", secteur: "urbain",
    distanceHopital: "proche", volume: "élevé", pauvreteSecteur: "plus faible",
    langue: "français", date: "22/09/2026", duree: "57 min",
  },
  {
    code: "P12", cs: "CS04", sexe: "masculin", age: "30-39", qualif: "infirmier",
    niveau: "A1", ancTotale: "5-10 ans", ancCpn: "> 2 ans", titulaire: true,
    formationMnt: "non", anneeFormation: "", secteur: "rural périphérique",
    distanceHopital: "éloignée", volume: "modéré", pauvreteSecteur: "plus élevée",
    langue: "kinyarwanda", date: "22/09/2026", duree: "46 min",
  },
  {
    code: "P13", cs: "CS05", sexe: "féminin", age: "40-49", qualif: "sage-femme",
    niveau: "A1", ancTotale: "> 10 ans", ancCpn: "> 2 ans", titulaire: false,
    formationMnt: "oui", anneeFormation: "2021", secteur: "rural périphérique",
    distanceHopital: "éloignée", volume: "modéré", pauvreteSecteur: "plus élevée",
    langue: "kinyarwanda", date: "23/09/2026", duree: "53 min",
  },
  {
    code: "P14", cs: "CS06", sexe: "féminin", age: "20-29", qualif: "infirmier",
    niveau: "A1", ancTotale: "< 5 ans", ancCpn: "6 mois-2 ans", titulaire: false,
    formationMnt: "non", anneeFormation: "", secteur: "urbain",
    distanceHopital: "proche", volume: "élevé", pauvreteSecteur: "plus faible",
    langue: "kinyarwanda", date: "23/09/2026", duree: "40 min",
  },
  {
    code: "P15", cs: "CS08", sexe: "féminin", age: "30-39", qualif: "sage-femme",
    niveau: "A1", ancTotale: "5-10 ans", ancCpn: "> 2 ans", titulaire: false,
    formationMnt: "ne sait pas", anneeFormation: "", secteur: "rural périphérique",
    distanceHopital: "éloignée", volume: "modéré", pauvreteSecteur: "plus élevée",
    langue: "kinyarwanda", date: "24/09/2026", duree: "49 min",
  },
  {
    code: "P16", cs: "CS09", sexe: "masculin", age: "40-49", qualif: "infirmier",
    niveau: "A2", ancTotale: "> 10 ans", ancCpn: "6 mois-2 ans", titulaire: true,
    formationMnt: "non", anneeFormation: "", secteur: "rural périphérique",
    distanceHopital: "éloignée", volume: "modéré", pauvreteSecteur: "plus élevée",
    langue: "kinyarwanda", date: "24/09/2026", duree: "43 min",
  },
  {
    code: "P17", cs: "CS10", sexe: "féminin", age: "20-29", qualif: "sage-femme",
    niveau: "A1", ancTotale: "< 5 ans", ancCpn: "6 mois-2 ans", titulaire: false,
    formationMnt: "oui", anneeFormation: "2026", secteur: "rural périphérique",
    distanceHopital: "éloignée", volume: "modéré", pauvreteSecteur: "plus élevée",
    langue: "kinyarwanda", date: "25/09/2026", duree: "51 min",
  },
  {
    code: "P18", cs: "CS12", sexe: "féminin", age: "40-49", qualif: "infirmier",
    niveau: "A1", ancTotale: "> 10 ans", ancCpn: "> 2 ans", titulaire: false,
    formationMnt: "oui", anneeFormation: "2023", secteur: "rural périphérique",
    distanceHopital: "éloignée", volume: "modéré", pauvreteSecteur: "plus élevée",
    langue: "kinyarwanda", date: "25/09/2026", duree: "55 min",
  },
  {
    code: "P19", cs: "CS13", sexe: "féminin", age: "30-39", qualif: "sage-femme",
    niveau: "A0", ancTotale: "5-10 ans", ancCpn: "> 2 ans", titulaire: false,
    formationMnt: "oui", anneeFormation: "2024", secteur: "rural périphérique",
    distanceHopital: "éloignée", volume: "élevé", pauvreteSecteur: "plus élevée",
    langue: "français", date: "28/09/2026", duree: "60 min",
  },
  {
    code: "P20", cs: "CS15", sexe: "masculin", age: "50 et plus", qualif: "infirmier",
    niveau: "A2", ancTotale: "> 10 ans", ancCpn: "> 2 ans", titulaire: false,
    formationMnt: "non", anneeFormation: "", secteur: "rural périphérique",
    distanceHopital: "éloignée", volume: "modéré", pauvreteSecteur: "plus élevée",
    langue: "kinyarwanda", date: "29/09/2026", duree: "45 min",
  },
  {
    code: "P21", cs: "CS16", sexe: "féminin", age: "30-39", qualif: "sage-femme",
    niveau: "A1", ancTotale: "5-10 ans", ancCpn: "> 2 ans", titulaire: true,
    formationMnt: "non", anneeFormation: "", secteur: "rural périphérique",
    distanceHopital: "éloignée", volume: "modéré", pauvreteSecteur: "plus élevée",
    langue: "kinyarwanda", date: "30/09/2026", duree: "52 min",
  },
];
