// codes.mjs — Système de codes et grille de codage.
//
// Approche HYBRIDE, comme le prescrit le § 4.2.6 du protocole : une grille
// initiale dérivée du cadre conceptuel (Tableau III, « Grille
// d'opérationnalisation des concepts ») garantit la couverture des dimensions
// retenues, et reste ouverte à des codes inductifs susceptibles de la modifier.
//
// Les codes marqués « inductif » ne viennent PAS du cadre : ils ont été créés
// en cours de codage parce que le matériau les imposait. C'est cette trace qui
// rend l'analyse vérifiable — un arbre purement déductif ne prouverait rien.

export const arbre = [
  { id: "A", nom: "1. Sens attribué au dépistage", couleur: "#4e79a7", enfants: [
    { id: "A1", nom: "Utilité perçue pour la femme" },
    { id: "A2", nom: "Légitimité au regard du mandat de la CPN" },
    { id: "A3", nom: "Hiérarchisation face aux autres tâches" },
    { id: "A4", nom: "Porte d'entrée vers les maladies chroniques [inductif]" },
    { id: "A5", nom: "Désinvestissement par impuissance [inductif]" },
  ]},
  { id: "B", nom: "2. Pratiques techniques déclarées", couleur: "#59a14f", enfants: [
    { id: "B1", nom: "Tension : geste intégré aux constantes" },
    { id: "B2", nom: "Glycémie : dépistage absent ou sélectif" },
    { id: "B3", nom: "Déroulement décrit de la consultation" },
    { id: "B4", nom: "Conduite devant un cas détecté" },
    { id: "B5", nom: "Bandelette urinaire comme substitut [inductif]" },
    { id: "B6", nom: "Mesure omise faute d'appareil disponible [inductif]" },
  ]},
  { id: "C", nom: "3. Pratique informative et éducative", couleur: "#f28e2b", enfants: [
    { id: "C1", nom: "Explication de la mesure et du risque" },
    { id: "C2", nom: "Restitution d'un résultat anormal" },
    { id: "C3", nom: "Risque au-delà de la grossesse" },
    { id: "C4", nom: "Modulation de l'information selon les femmes" },
    { id: "C5", nom: "Modulation contestée ou niée" },
    { id: "C6", nom: "Écart perçu entre information et compréhension" },
    { id: "C7", nom: "Information reportée sur un autre professionnel [inductif]" },
    { id: "C8", nom: "Vérification de la compréhension [inductif]" },
  ]},
  { id: "D", nom: "4. Conditions individuelles et professionnelles", couleur: "#b07aa1", enfants: [
    { id: "D1", nom: "Absence de préparation initiale" },
    { id: "D2", nom: "Formation continue reçue" },
    { id: "D3", nom: "Sentiment de compétence ou doute" },
    { id: "D4", nom: "Transmission informelle entre collègues [inductif]" },
    { id: "D5", nom: "Compétence acquise puis désapprise [inductif]" },
  ]},
  { id: "E", nom: "5. Conditions organisationnelles", couleur: "#e15759", enfants: [
    { id: "E1", nom: "Charge de travail et flux" },
    { id: "E2", nom: "Équipements et consommables" },
    { id: "E3", nom: "Absence d'espace confidentiel" },
    { id: "E4", nom: "Supervision et attentes de l'encadrement" },
    { id: "E5", nom: "Facilitateur : poste de constantes dédié [inductif]" },
    { id: "E6", nom: "Concurrence entre programmes [inductif]" },
    { id: "E7", nom: "Absence de maintenance des appareils [inductif]" },
  ]},
  { id: "F", nom: "6. Conditions systémiques et politiques", couleur: "#76b7b2", enfants: [
    { id: "F1", nom: "Directives et protocoles disponibles" },
    { id: "F2", nom: "Circuit de référence" },
    { id: "F3", nom: "Absence de retour d'information de l'hôpital [inductif]" },
    { id: "F4", nom: "Ce qui est compté existe [inductif]" },
    { id: "F5", nom: "Approvisionnement en intrants" },
    { id: "F6", nom: "Discontinuité après l'accouchement [inductif]" },
  ]},
  { id: "G", nom: "7. Conditions sociales perçues (représentations professionnelles)", couleur: "#edc948", enfants: [
    { id: "G1", nom: "Moyens, coût et mutuelle" },
    { id: "G2", nom: "Distance et transport" },
    { id: "G3", nom: "Instruction et compréhension" },
    { id: "G4", nom: "Marge de décision de la femme (conjoint, famille)" },
    { id: "G5", nom: "Recours tardif et non-retour" },
    { id: "G6", nom: "Responsabilité attribuée à la femme [inductif]" },
    { id: "G7", nom: "Assurance et capacité à demander [inductif]" },
    { id: "G8", nom: "Le service comme cause du non-retour [inductif]" },
  ]},
  { id: "H", nom: "8. Portée reconnue en équité", couleur: "#9c755f", enfants: [
    { id: "H1", nom: "Perception d'un accès différencié" },
    { id: "H2", nom: "Jugement : inacceptable" },
    { id: "H3", nom: "Jugement : normalisation ou résignation" },
    { id: "H4", nom: "Responsabilité attribuée au système" },
    { id: "H5", nom: "Responsabilité reconnue comme sienne" },
    { id: "H6", nom: "Refus de juger" },
    { id: "H7", nom: "L'heure d'arrivée comme facteur d'inégalité [inductif]" },
    { id: "H8", nom: "Le lieu décide de ce qu'on reçoit [inductif]" },
  ]},
  { id: "I", nom: "9. Transformations proposées", couleur: "#ff9da7", enfants: [
    { id: "I1", nom: "Équipements et consommables" },
    { id: "I2", nom: "Formation" },
    { id: "I3", nom: "Personnel et organisation" },
    { id: "I4", nom: "Supports d'information adaptés" },
    { id: "I5", nom: "Indicateur et redevabilité [inductif]" },
    { id: "I6", nom: "Transport et référence effective [inductif]" },
    { id: "I7", nom: "Destinataires désignés" },
  ]},
  { id: "J", nom: "10. Contexte observé (corpus secondaire)", couleur: "#499894", enfants: [
    { id: "J1", nom: "Espace et flux observés" },
    { id: "J2", nom: "Équipement constaté" },
    { id: "J3", nom: "Protocoles et supports constatés" },
    { id: "J4", nom: "Tenue des supports d'enregistrement" },
    { id: "J5", nom: "ÉCART déclaré / constaté" },
    { id: "J6", nom: "Réflexivité du chercheur" },
  ]},
  { id: "K", nom: "0. Parcours et contexte (hors analyse thématique)", couleur: "#bab0ac", enfants: [
    { id: "K1", nom: "Parcours professionnel" },
    { id: "K2", nom: "Description d'une journée" },
  ]},
];

/* ================================================================
   Grille initiale : correspondance question → codes attendus.
   Dérivée du Tableau III (colonne « Source ») et de l'annexe 8.
   C'est le point de départ déductif ; les ajustements par participant
   ci-dessous enregistrent ce que le matériau a imposé de changer.
================================================================ */
export const grilleParQuestion = {
  O1: ["K1"], O2: ["K2", "E1"],
  Q1: ["B3"], Q2: ["B1", "B2"], Q3: ["B4", "F2"], Q4: ["C1", "C2"],
  Q5: ["C6"], Q6: ["C4"], Q7: ["A3"], Q8: ["A2"],
  Q9: ["D2", "E5"], Q10: ["E2", "F5"], Q11: ["H1", "G3"], Q12: ["G1", "G2"],
  Q13: ["B4", "F2"], Q14: ["G5"], Q15: ["D1", "D2"], Q16: ["E4", "F4"],
  Q17: ["I1"], Q18: ["I7"], Q19: ["H1"], Q20: ["A4"],
};

/**
 * Ajustements par participant : ce que la grille initiale ne prévoyait pas.
 * Chaque entrée remplace (« = ») ou complète (« + ») les codes de la grille.
 * Cette table EST la trace de l'ouverture inductive exigée au § 4.2.6.
 */
export const ajustements = {
  P01: { Q2: "+B5,E2", Q3: "+G1,G4", Q5: "+C3", Q6: "+C4,G3,H5", Q7: "+A3,F4", Q10: "+E2,F5,G2",
         Q11: "+G7,H7", Q12: "+G1,G2,F2", Q13: "+F3", Q16: "+F4,E4", Q17: "+I1,E2", Q18: "+I5,I7",
         Q19: "+H2,H4,H5", Q20: "+F6,A4" },
  P02: { Q2: "+B2,E2,H1", Q3: "+C6,B4", Q5: "+C6,G7", Q6: "=C4,G3,H5,C6", Q7: "+A5,D5",
         Q8: "+A2,A4", Q9: "+E5,D2", Q10: "+E2,F5,G1,G2", Q11: "+G7,H7,E1", Q12: "+G1,G2,G4,H5",
         Q13: "+F2,F3", Q14: "+G1,G2,G5", Q15: "+D1,D4", Q16: "+F4,E4", Q17: "=I4,C4,H5",
         Q18: "+I5,I4", Q19: "+H2,H5,H4", Q20: "+H5" },
  P03: { Q1: "+B3,E3", Q2: "+B2,E2,D5", Q3: "+B4,D3,F2", Q4: "+C2,D3", Q5: "+C6,F2",
         Q6: "+C4,C8", Q7: "+A3", Q8: "+A2", Q9: "+E2,D4", Q10: "+B6,E2,E6",
         Q11: "+H1,E1,G2", Q12: "+G3,G7,E1", Q13: "+F2,F3", Q14: "+G2,G5", Q15: "+D1,F1,D3",
         Q16: "+E4,F4", Q17: "=I2,D3", Q18: "+I7,H8", Q19: "+H3,H2,H1", Q20: "+D3" },
  P04: { O2: "+E1,E6", Q1: "+B3,E1", Q2: "+B1,B2,E2,E1", Q3: "+B4,G1,G2,F2",
         Q4: "+C2,G4", Q5: "+C6,C3", Q6: "=C4,E1,H7,H5", Q7: "+A3,E1", Q8: "+A2,E1",
         Q9: "+E1,I3", Q10: "+E1,E6,B6,F4", Q11: "+H1,E1,G2", Q12: "+G1,G2,F2",
         Q13: "+F2,F3", Q14: "+G1,G2,G5", Q15: "+D1,D3", Q16: "+E4,F4", Q17: "=I3,E1",
         Q18: "+I7,E4", Q19: "+H2,H4,H7", Q20: "+H4" },
  P05: { Q2: "+B1,B2,E2,H4", Q3: "+B4,F2", Q4: "+C1,C2", Q5: "+C6,G3,G6",
         Q6: "=C5,G3", Q7: "+A3", Q8: "+A2,F1", Q9: "+D3", Q10: "+E2,F5,E7,B6",
         Q11: "=G6,H1", Q12: "=G6,G5", Q13: "+F2,F3", Q14: "=G6,G2,G5", Q15: "+D1,D3",
         Q16: "+E4,F4", Q17: "=I1,E2", Q18: "+I1,E7,I7", Q19: "+H3,H4,G6", Q20: "+H8,I7" },
  P06: { O2: "+E2,E1", Q1: "+B3,B6,E2", Q2: "+B2,E2,D5,D2", Q3: "+B4,F2,F6",
         Q4: "+C1,C2,C3", Q5: "+C3,C6", Q6: "=C4,C8,G3,E1", Q7: "+A5,A3,D2",
         Q8: "+A2,A4,F1", Q9: "+D2,E2", Q10: "+B6,E2,E7,E6", Q11: "=H7,H1,B6",
         Q12: "+G2,G1,G4", Q13: "+F2,F3", Q14: "+G2,G1,G8", Q15: "+D2,D4,I2",
         Q16: "+E4,F4", Q17: "=I1,E2,B1", Q18: "+E7,I2,I7", Q19: "+H2,H7,H5", Q20: "+F6,A5" },
  P07: { Q1: "+B3,C1", Q2: "+B1,B2,E2,G1,F5", Q3: "+B4,B5,F2,F6",
         Q4: "+C1,C2", Q5: "+C6,G3", Q6: "=C4,G3,H5,D2", Q7: "+A3,A5,F6",
         Q8: "+A2,A4", Q9: "+E5,D2,G2,F2", Q10: "+E2,F5,F4", Q11: "+H1,G1,G3,G5",
         Q12: "=G1,H1", Q13: "+F2,F3", Q14: "+G1,G5,G8", Q15: "+D1,D2,D4",
         Q16: "+E4,F4,F5", Q17: "=I6,F3", Q18: "+I5,F3,F6,I7", Q19: "+H2,H4,H5",
         Q20: "+F6" },
  P08: { O2: "+E1", Q1: "+B3", Q2: "+B1,B2,E2,C7", Q3: "+B4,C7,F3",
         Q4: "=C7,D3", Q5: "+C6,C7", Q6: "=C5,C4", Q7: "+A3,E1,E2", Q8: "+A2,C7",
         Q9: "+E2,E5", Q10: "+E2,B6,D3", Q11: "+H1,H7,E1", Q12: "=C7,H6",
         Q13: "=C7,F2", Q14: "+G1,G2,G8", Q15: "+D1,F1", Q16: "+E4", Q17: "=I1,E2,B6",
         Q18: "=I2,D1", Q19: "+H6,H2,H4", Q20: "+D1,I2" },
  P09: { O2: "+E1,G2", Q1: "+B3,C1", Q2: "+B1,B2,E2,E7,F4", Q3: "+B4,G2,F2,E2",
         Q4: "+C1,C2", Q5: "+C3,C6", Q6: "=C4,G1,H5,E1", Q7: "+A3,F4,H5",
         Q8: "+A2,A4", Q9: "+D2,E4,B1", Q10: "+E2,E7,F4,G2", Q11: "+H1,G2,H8",
         Q12: "+G1,G2,G4", Q13: "+F2,G2,F3", Q14: "+G2,G1,G5,G8", Q15: "+D1,D2,D4",
         Q16: "+E4,F4,E7", Q17: "=I5,F4", Q18: "+I5,E7,I7", Q19: "+H2,H8,H4,H5",
         Q20: "+I5,E4" },
  P10: { O2: "+E1,E6", Q1: "+B3", Q2: "+B1,B2,E2,E7", Q3: "+B4,G2,G4,F2,G1",
         Q4: "+C1,C2,G4", Q5: "=G4,C6,H4", Q6: "+C4,G4,C8,G3", Q7: "+A3,B1",
         Q8: "+A2,E2", Q9: "+E5,E1", Q10: "+E6,E1,B6", Q11: "+H1,G2,G4",
         Q12: "+G4,G2,F2", Q13: "+F2,G2,I6", Q14: "+G2,G1,G5", Q15: "+D1,D4",
         Q16: "+E4,E7", Q17: "=I6,F2", Q18: "+I6,I7", Q19: "+H2,H8,G2,G4", Q20: "+G4,H8" },
};

/* ================================================================
   Codage des grilles d'observation (corpus secondaire, § 4.2.6)
================================================================ */
export const grilleObservation = {
  A: ["J1", "E1", "E3"],
  B: ["J2", "E2"],
  C: ["J3", "F1"],
  D: ["J4", "F4"],
  E: ["J1", "E1"],
  F: ["J6"],
};

/** Écarts déclaré / constaté relevés à la lecture croisée (code J5). */
export const ecarts = [
  { cs: "CS11", code: "J5",
    constat: "Un participant de ce centre déclare que la tension est prise « systématiquement, à toutes les femmes » ; l'observation et le registre montrent quatorze valeurs manquantes sur une page de trente lignes, et l'appareil électronique est hors d'usage. L'autre participant du même centre décrit ces mesures manquantes explicitement. Écart consigné sans être imputé à une intention : il informe sur la distance entre la norme intériorisée et la condition d'exercice (§ 4.2.6)." },
  { cs: "CS02", code: "J5",
    constat: "Les deux participants décrivent une explication individualisée du résultat ; la configuration observée — constantes prises dans le couloir d'attente, valeurs annoncées à voix audible — rend cette individualisation matériellement difficile à tenir." },
  { cs: "CS14", code: "J5",
    constat: "La titulaire déclare vérifier chaque semaine le remplissage de la colonne tension ; le registre observé est effectivement le mieux tenu des trois centres ruraux. Concordance, à consigner autant qu'un écart." },
  { cs: "CS07", code: "J5",
    constat: "Une participante déclare n'avoir jamais réalisé de glycémie ; l'absence totale de glucomètre dans le centre est confirmée par l'observation. La déclaration s'explique par la condition matérielle et non par la pratique individuelle." },
];
