// echantillon.mjs — ÉCHANTILLON SIMULÉ (exercice de formation)
//
// ⚠️ DONNÉES ENTIÈREMENT FICTIVES. Aucun entretien n'a été conduit, aucun
// centre de santé n'a été visité. Ce jeu de données sert exclusivement à
// apprendre à manipuler QualiCode avant la collecte réelle. Il ne peut être
// cité, ni figurer dans le mémoire, ni servir de résultat.
//
// La composition suit le Tableau II du protocole (matrice de variation de
// l'échantillon) : 5 infirmiers et 5 sages-femmes, répartis sur 5 centres de
// santé codés, couvrant chaque modalité des sept dimensions de variation.

export const AVERTISSEMENT =
  "DONNÉES SIMULÉES — EXERCICE DE FORMATION. Aucun entretien réel. " +
  "Ne peut être cité ni utilisé comme résultat de recherche.";

export const ETUDE = {
  titre: "L'équité d'accès au dépistage capacitant de l'hypertension artérielle et du diabète " +
    "en consultation prénatale : perceptions et pratiques déclarées des infirmiers et sages-femmes " +
    "de Ngoma (Rwanda)",
  chercheur: "MUKAKI DUNIA Jacques",
  institution: "ENATSE, Université de Parakou (Bénin) — Master en Santé publique, Promotion de la santé",
  directrice: "Professeure N. Fanny M. HOUNKPONOU AHOUINGNAN",
  periodeSimulee: "11 août – 30 septembre 2026 (période prévue au protocole, § 4.2.5.3)",
};

/* ================================================================
   Participants — Annexe 3 (fiche sociodémographique et professionnelle)
   Les tranches remplacent les valeurs exactes, comme le prescrit l'annexe 3 :
   dans une équipe réduite, âge + qualification + ancienneté exacts
   identifieraient la personne.
================================================================ */
export const participants = [
  {
    code: "P01", cs: "CS03", sexe: "masculin", age: "40-49", qualif: "infirmier",
    niveau: "A1", ancTotale: "> 10 ans", ancCpn: "> 2 ans", titulaire: true,
    formationMnt: "oui", anneeFormation: "2023", secteur: "urbain",
    distanceHopital: "proche", volume: "élevé", pauvreteSecteur: "plus faible",
    langue: "kinyarwanda", date: "18/08/2026", duree: "52 min",
  },
  {
    code: "P02", cs: "CS03", sexe: "féminin", age: "30-39", qualif: "sage-femme",
    niveau: "A1", ancTotale: "5-10 ans", ancCpn: "> 2 ans", titulaire: false,
    formationMnt: "oui", anneeFormation: "2024", secteur: "urbain",
    distanceHopital: "proche", volume: "élevé", pauvreteSecteur: "plus faible",
    langue: "français", date: "18/08/2026", duree: "58 min",
  },
  {
    code: "P03", cs: "CS07", sexe: "féminin", age: "20-29", qualif: "sage-femme",
    niveau: "A1", ancTotale: "< 5 ans", ancCpn: "6 mois-2 ans", titulaire: false,
    formationMnt: "non", anneeFormation: "", secteur: "rural périphérique",
    distanceHopital: "éloignée", volume: "modéré", pauvreteSecteur: "plus élevée",
    langue: "kinyarwanda", date: "25/08/2026", duree: "41 min",
  },
  {
    code: "P04", cs: "CS07", sexe: "féminin", age: "30-39", qualif: "infirmier",
    niveau: "A2", ancTotale: "5-10 ans", ancCpn: "> 2 ans", titulaire: false,
    formationMnt: "ne sait pas", anneeFormation: "", secteur: "rural périphérique",
    distanceHopital: "éloignée", volume: "modéré", pauvreteSecteur: "plus élevée",
    langue: "kinyarwanda", date: "25/08/2026", duree: "47 min",
  },
  {
    code: "P05", cs: "CS11", sexe: "masculin", age: "50 et plus", qualif: "infirmier",
    niveau: "A2", ancTotale: "> 10 ans", ancCpn: "> 2 ans", titulaire: true,
    formationMnt: "non", anneeFormation: "", secteur: "rural périphérique",
    distanceHopital: "éloignée", volume: "modéré", pauvreteSecteur: "plus élevée",
    langue: "kinyarwanda", date: "01/09/2026", duree: "44 min",
  },
  {
    code: "P06", cs: "CS11", sexe: "féminin", age: "20-29", qualif: "sage-femme",
    niveau: "A1", ancTotale: "< 5 ans", ancCpn: "6 mois-2 ans", titulaire: false,
    formationMnt: "oui", anneeFormation: "2025", secteur: "rural périphérique",
    distanceHopital: "éloignée", volume: "modéré", pauvreteSecteur: "plus élevée",
    langue: "kinyarwanda", date: "01/09/2026", duree: "49 min",
  },
  {
    code: "P07", cs: "CS02", sexe: "féminin", age: "40-49", qualif: "sage-femme",
    niveau: "A0", ancTotale: "> 10 ans", ancCpn: "> 2 ans", titulaire: false,
    formationMnt: "oui", anneeFormation: "2022", secteur: "urbain",
    distanceHopital: "proche", volume: "élevé", pauvreteSecteur: "plus faible",
    langue: "français", date: "08/09/2026", duree: "61 min",
  },
  {
    code: "P08", cs: "CS02", sexe: "masculin", age: "30-39", qualif: "infirmier",
    niveau: "A1", ancTotale: "5-10 ans", ancCpn: "6 mois-2 ans", titulaire: false,
    formationMnt: "non", anneeFormation: "", secteur: "urbain",
    distanceHopital: "proche", volume: "élevé", pauvreteSecteur: "plus faible",
    langue: "kinyarwanda", date: "08/09/2026", duree: "38 min",
  },
  {
    code: "P09", cs: "CS14", sexe: "féminin", age: "40-49", qualif: "infirmier",
    niveau: "A1", ancTotale: "> 10 ans", ancCpn: "> 2 ans", titulaire: true,
    formationMnt: "oui", anneeFormation: "2021", secteur: "rural périphérique",
    distanceHopital: "éloignée", volume: "modéré", pauvreteSecteur: "plus élevée",
    langue: "kinyarwanda", date: "15/09/2026", duree: "55 min",
  },
  {
    code: "P10", cs: "CS14", sexe: "féminin", age: "30-39", qualif: "sage-femme",
    niveau: "A1", ancTotale: "5-10 ans", ancCpn: "> 2 ans", titulaire: false,
    formationMnt: "non", anneeFormation: "", secteur: "rural périphérique",
    distanceHopital: "éloignée", volume: "modéré", pauvreteSecteur: "plus élevée",
    langue: "kinyarwanda", date: "15/09/2026", duree: "50 min",
  },
];

/* ================================================================
   Guide d'entretien — Annexe 1 (intitulés exacts du protocole)
================================================================ */
export const guide = [
  { id: "O1", axe: "Ouverture", texte: "Pouvez-vous me parler de votre parcours et de la manière dont vous êtes arrivé à travailler en consultation prénatale ?" },
  { id: "O2", axe: "Ouverture", texte: "Comment décririez-vous une journée de consultation prénatale dans votre centre ?" },
  { id: "Q1", axe: "Axe 1", texte: "Lorsqu'une femme enceinte se présente pour une consultation, pouvez-vous me raconter, étape par étape, comment se déroule sa prise en charge ?" },
  { id: "Q2", axe: "Axe 1", texte: "Où se situe, dans ce déroulement, la mesure de la tension artérielle et la recherche d'un trouble du sucre ?" },
  { id: "Q3", axe: "Axe 1", texte: "Racontez-moi une consultation au cours de laquelle vous avez trouvé une tension élevée ou un taux de sucre anormal chez une femme enceinte. Que s'est-il passé ?" },
  { id: "Q4", axe: "Axe 1", texte: "À ce moment-là, qu'avez-vous expliqué à cette femme ?" },
  { id: "Q5", axe: "Axe 1", texte: "Selon vous, que comprend une femme enceinte de ce que vous lui dites dans ces situations ?" },
  { id: "Q6", axe: "Axe 1", texte: "Ce que vous expliquez à une femme, l'adaptez-vous selon les personnes ? Comment ?" },
  { id: "Q7", axe: "Axe 1", texte: "Pour vous, que représente ce dépistage dans votre travail, si vous le comparez aux autres choses ou tâches que vous devez faire pendant une consultation prénatale ?" },
  { id: "Q8", axe: "Axe 1", texte: "Dépister l'hypertension et le diabète, est-ce que cela fait partie, selon vous, du rôle d'une consultation prénatale ?" },
  { id: "Q9", axe: "Axe 2", texte: "Qu'est-ce qui, dans votre travail, vous permet de faire ce dépistage comme vous souhaiteriez le faire ?" },
  { id: "Q10", axe: "Axe 2", texte: "Racontez-moi une situation où vous n'avez pas pu réaliser ce dépistage, ou pas comme vous l'auriez voulu. Comment l'expliquez-vous ?" },
  { id: "Q11", axe: "Axe 2", texte: "Parlez-moi des femmes que vous recevez en consultation prénatale. Y a-t-il des différences entre elles dans la manière dont se passe ce dépistage ?" },
  { id: "Q12", axe: "Axe 2", texte: "Y a-t-il des femmes pour lesquelles vous savez d'avance que ce sera plus difficile ? Qu'est-ce qui fait cette difficulté ?" },
  { id: "Q13", axe: "Axe 2", texte: "Que se passe-t-il, concrètement, lorsque vous détectez un cas ? Jusqu'où va votre rôle, et que devient la femme ensuite ?" },
  { id: "Q14", axe: "Axe 2", texte: "Certaines femmes arrivent tard dans la grossesse, ou ne reviennent pas. D'après vous, pourquoi ?" },
  { id: "Q15", axe: "Axe 2", texte: "Comment votre centre de santé vous a-t-il préparé à dépister ces deux maladies chez la femme enceinte ?" },
  { id: "Q16", axe: "Axe 2", texte: "Selon vous, comment ce dépistage est-il considéré par les personnes qui organisent et supervisent votre travail ?" },
  { id: "Q17", axe: "Axe 2", texte: "Si vous pouviez changer une seule chose pour que ce dépistage se fasse mieux dans votre centre, quelle serait-elle, et pourquoi celle-là plutôt qu'une autre ?" },
  { id: "Q18", axe: "Axe 2", texte: "Qu'attendriez-vous de ceux qui prennent les décisions, au niveau du district ou au niveau national ?" },
  { id: "Q19", axe: "Axe 2", texte: "Vous m'avez décrit des situations où le dépistage se passe bien et d'autres où il se passe mal. Trouvez-vous cela normal ?" },
  { id: "Q20", axe: "Clôture", texte: "Y a-t-il quelque chose d'important sur ce sujet que je ne vous ai pas demandé et que vous souhaiteriez ajouter ?" },
];
