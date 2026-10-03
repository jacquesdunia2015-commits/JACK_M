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
    { id: "B2", nom: "Glycémie : test de la première CPN et sa suite" },
    { id: "B3", nom: "Déroulement décrit de la consultation" },
    { id: "B4", nom: "Conduite devant un cas détecté" },
    { id: "B5", nom: "Bandelette urinaire comme substitut [inductif]" },
    { id: "B6", nom: "Mesure omise faute d'appareil disponible [inductif]" },
    { id: "B7", nom: "Dotation incomplète d'un centre neuf [inductif, vague 2]" },
    { id: "B8", nom: "Test de la première CPN non réalisé : rupture, panne, laborantin absent ou prélèvements arrêtés à midi [inductif, révision]" },
    { id: "B9", nom: "Glycémie unique à la première CPN, non refaite à 24-28 semaines [inductif, révision]" },
    { id: "B10", nom: "Rattrapage du test manqué, organisé ou absent [inductif, révision]" },
    { id: "B11", nom: "Glycémie d'urgence : glucomètre de la CPN ou appel au laboratoire [inductif, révision]" },
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
    { id: "C9", nom: "Support visuel d'information [inductif, vague 2]" },
    { id: "C10", nom: "Séance d'éducation collective en CPN [inductif, relecture]" },
    { id: "C11", nom: "Séance collective et restitution individuelle du résultat [inductif, relecture]" },
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
    { id: "E8", nom: "Rotation du personnel et perte des savoirs [inductif, vague 2]" },
    { id: "E9", nom: "Charge administrative du titulaire [inductif, vague 2]" },
  ]},
  { id: "F", nom: "6. Conditions systémiques et politiques", couleur: "#76b7b2", enfants: [
    { id: "F1", nom: "Directives et protocoles disponibles" },
    { id: "F2", nom: "Circuit de référence" },
    { id: "F3", nom: "Absence de retour d'information de l'hôpital [inductif]" },
    { id: "F4", nom: "Ce qui est compté existe [inductif]" },
    { id: "F5", nom: "Approvisionnement en intrants" },
    { id: "F6", nom: "Discontinuité après l'accouchement [inductif]" },
    { id: "F7", nom: "Registre rempli sans acte [inductif, vague 2]" },
    { id: "F8", nom: "Contre-référence effective [inductif, vague 2]" },
    { id: "F9", nom: "Campagnes de dépistage des MNT hors de la CPN [inductif, relecture]" },
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
    { id: "G9", nom: "Relais communautaire (animatrices de santé maternelle) [inductif, vague 2]" },
    { id: "G10", nom: "Recours au traitement traditionnel, tel que perçu [inductif, vague 2]" },
    { id: "G11", nom: "Mobilité des femmes et rupture du suivi [inductif, vague 2]" },
    { id: "G12", nom: "Attente du conjoint pour la première CPN [inductif, relecture]" },
    { id: "G13", nom: "Catégorie ubudehe et aides liées à la grossesse [inductif, relecture]" },
    { id: "G14", nom: "Signalement des grossesses et alertes par téléphone des ASM [inductif, relecture]" },
    { id: "G15", nom: "Autosurveillance à domicile réservée aux ménages aisés [inductif, relecture]" },
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
    { id: "H9", nom: "Refus de catégoriser les femmes [inductif, vague 2]" },
  ]},
  { id: "I", nom: "9. Transformations proposées", couleur: "#ff9da7", enfants: [
    { id: "I1", nom: "Équipements et consommables" },
    { id: "I2", nom: "Formation" },
    { id: "I3", nom: "Personnel et organisation" },
    { id: "I4", nom: "Supports d'information adaptés" },
    { id: "I5", nom: "Indicateur et redevabilité [inductif]" },
    { id: "I6", nom: "Transport et référence effective [inductif]" },
    { id: "I7", nom: "Destinataires désignés" },
    { id: "I8", nom: "Initiative locale déjà mise en œuvre [inductif, vague 2]" },
    { id: "I9", nom: "Relais par les forums communautaires (umugoroba w'ababyeyi) [inductif, relecture]" },
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
  P01: { Q2: "+B5,E2,B9,B11", Q3: "+G1,G4", Q5: "+C3", Q6: "+C4,G3,H5,C10,C11", Q7: "+A3,F4", Q10: "+E2,F5,G2,B8,B10",
         Q11: "+G7,H7", Q12: "+G1,G2,F2", Q13: "+F3", Q16: "+F4,E4", Q17: "+I1,E2,E6", Q18: "+I5,I7,I9",
         Q19: "+H2,H4,H5", Q20: "+F6,A4,F9", Q1: "+C10" },
  P02: { Q2: "+B2,E2,E6,H1,B9", Q3: "+C6,B4", Q5: "+C6,G7", Q6: "=C4,G3,H5,C6", Q7: "+A5,D5",
         Q8: "+A2,A4", Q9: "+E5,D2", Q10: "+E2,F5,G1,G2,B8,B10", Q11: "+G7,H7,E1", Q12: "+G1,G2,G4,H5,G15,H1",
         Q13: "+F2,F3", Q14: "+G1,G2,G5", Q15: "+D1,D4", Q16: "+F4,E4", Q17: "=I4,C4,H5",
         Q18: "+I5,I4", Q19: "+H2,H5,H4", Q20: "+H5" },
  P03: { Q1: "+B3,E3", Q2: "+B2,D1,D3,B8,B10,B11", Q3: "+B4,D3,F2", Q4: "+C2,D3", Q5: "+C6,F2",
         Q6: "+C4,C8,C10", Q7: "+A3", Q8: "+A2", Q9: "+E2,D4", Q10: "+B6,E2,E6",
         Q11: "+H1,E1,G2", Q12: "+G3,G7,E1", Q13: "+F2,F3", Q14: "+G2,G5", Q15: "+D1,F1,D3",
         Q16: "+E4,F4", Q17: "=I2,D3", Q18: "+I7,H8", Q19: "+H3,H2,H1", Q20: "+D3" },
  P04: { O2: "+E1,E6", Q1: "+B3,E1", Q2: "+B1,B2,E2,E1,B8,B10,B11", Q3: "+B4,G1,G2,F2",
         Q4: "+C2,G4", Q5: "+C6,C3", Q6: "=C4,E1,H7,H5", Q7: "+A3,E1", Q8: "+A2,E1",
         Q9: "+E1,I3", Q10: "+E1,E6,B6,F4", Q11: "+H1,E1,G2", Q12: "+G1,G2,F2",
         Q13: "+F2,F3", Q14: "+G1,G2,G5", Q15: "+D1,D3", Q16: "+E4,F4", Q17: "=I3,E1",
         Q18: "+I7,E4", Q19: "+H2,H4,H7", Q20: "+H4" },
  P05: { Q2: "+B1,B2,E2,H4,B8", Q3: "+B4,F2", Q4: "+C1,C2", Q5: "+C6,G3,G6",
         Q6: "=C5,G3", Q7: "+A3", Q8: "+A2,F1", Q9: "+D3", Q10: "+E2,F5,E7,B6,B8",
         Q11: "=G6,H1", Q12: "=G6,G5", Q13: "+F2,F3", Q14: "=G6,G2,G5", Q15: "+D1,D3",
         Q16: "+E4,F4", Q17: "=I1,E2", Q18: "+I1,E7,I7", Q19: "+H3,H4,G6", Q20: "+H8,I7" },
  P06: { O2: "+E2,E1", Q1: "+B3,B6,E2", Q2: "+B2,E2,D5,D2,B8,B10", Q3: "+B4,F2,F6",
         Q4: "+C1,C2,C3", Q5: "+C3,C6", Q6: "=C4,C8,G3,E1", Q7: "+A5,A3,D2",
         Q8: "+A2,A4,F1", Q9: "+D2,E2", Q10: "+B6,E2,E7,E6", Q11: "=H7,H1,B6",
         Q12: "+G2,G1,G4,G13", Q13: "+F2,F3", Q14: "+G2,G1,G8", Q15: "+D2,D4,I2",
         Q16: "+E4,F4", Q17: "=I1,E2,B1", Q18: "+E7,I2,I7", Q19: "+H2,H7,H5", Q20: "+F6,A5" },
  P07: { Q1: "+B3,C1", Q2: "+B1,B2,E2,G1,F5,B8,B11", Q3: "+B4,B5,F2,F6,G15",
         Q4: "+C1,C2", Q5: "+C6,G3,C10,C11", Q6: "=C4,G3,H5,D2", Q7: "+A3,A5,F6",
         Q8: "+A2,A4", Q9: "+E5,D2,G2,F2", Q10: "+E2,F5,F4,B8,B10", Q11: "+H1,G1,G3,G5",
         Q12: "=G1,H1", Q13: "+F2,F3", Q14: "+G1,G5,G8,G12", Q15: "+D1,D2,D4",
         Q16: "+E4,F4,F5", Q17: "=I6,F3", Q18: "+I5,F3,F6,I7", Q19: "+H2,H4,H5",
         Q20: "+F6" },
  P08: { O2: "+E1", Q1: "+B3", Q2: "+B1,B2,E2,C7,B8", Q3: "+B4,C7,F3",
         Q4: "=C7,D3,C10,C11", Q5: "+C6,C7", Q6: "=C5,C4", Q7: "+A3,E1,E2", Q8: "+A2,C7",
         Q9: "+E2,E5", Q10: "+E2,B6,D3", Q11: "+H1,H7,E1", Q12: "=C7,H6",
         Q13: "=C7,F2", Q14: "+G1,G2,G8", Q15: "+D1,F1", Q16: "+E4", Q17: "=I1,E2,B6",
         Q18: "=I2,D1", Q19: "+H6,H2,H4", Q20: "+D1,I2" },
  P09: { O2: "+E1,G2", Q1: "+B3,C1", Q2: "+B1,B2,E2,E7,F4,B8,B10", Q3: "+B4,G2,F2,E2",
         Q4: "+C1,C2", Q5: "+C3,C6", Q6: "=C4,G1,H5,E1", Q7: "+A3,F4,H5",
         Q8: "+A2,A4", Q9: "+D2,E4,B1", Q10: "+E2,E7,F4,G2", Q11: "+H1,G2,H8",
         Q12: "+G1,G2,G4", Q13: "+F2,G2,F3", Q14: "+G2,G1,G5,G8", Q15: "+D1,D2,D4",
         Q16: "+E4,F4,E7,C10", Q17: "=I5,F4", Q18: "+I5,E7,I7", Q19: "+H2,H8,H4,H5,G15",
         Q20: "+I5,E4,I9" },
  P10: { O2: "+E1,E6", Q1: "+B3", Q2: "+B1,B2,E2,E7,B8", Q3: "+B4,G2,G4,F2,G1",
         Q4: "+C1,C2,G4", Q5: "=G4,C6,H4", Q6: "+C4,G4,C8,G3", Q7: "+A3,B1",
         Q8: "+A2,E2", Q9: "+E5,E1", Q10: "+E6,E1,B6", Q11: "+H1,G2,G4",
         Q12: "+G4,G2,F2", Q13: "+F2,G2,I6,G9,G14", Q14: "+G2,G1,G5", Q15: "+D1,D4",
         Q16: "+E4,E7", Q17: "=I6,F2", Q18: "+I6,I7", Q19: "+H2,H8,G2,G4", Q20: "+G4,H8" },
};

/** Ajustements de la vague 2 — même logique : « = » remplace, « + » complète. */
export const ajustementsV2 = {
  P11: { Q2: "+B2,E2,F5,H8,B9,B10,B11", Q3: "+B4,F2,F8", Q4: "+C1,C2,C3,C9", Q5: "+C9,C3,C6",
         Q6: "=C4,E1,H7,H5", Q7: "+A3,A5", Q8: "+A2,A4", Q9: "+E5,F8,F5", Q10: "+F3,F8",
         Q11: "+H1,H7,G1", Q12: "+G2,G11", Q13: "+F2,F8,G15,G1,H1", Q14: "+G1,G5", Q15: "+D2,D4",
         Q16: "+F4,E4,I5", Q17: "=I6,F3,F8", Q18: "+I7,H8", Q19: "+H2,H8,H4", Q20: "+H8,A4" },
  P12: { O2: "+E1,E9", Q2: "+B1,B2,D1,D3,B8", Q3: "+B4,F3", Q4: "+C2,D3", Q5: "+C6,D3",
         Q6: "+C4,E9", Q7: "+A3,F4,E9", Q8: "+A2", Q10: "+E1,E9,B2,B8,B10", Q11: "+H1,G5",
         Q12: "+G1,G2", Q13: "+F3", Q14: "+G2,G1,G5,G8", Q15: "+D1", Q16: "+E4,F4",
         Q17: "=I2,D1", Q18: "+I5,E9,I7", Q19: "+H2,H4,H5,E9", Q20: "+E9,F9" },
  P13: { O2: "+G2,E1", Q2: "+B1,B2,F5,E2,B8", Q3: "+B4,G2,F2", Q4: "+C1,C2,G10",
         Q5: "+C6,G10", Q6: "=C4,G10,G3", Q7: "+A3,A1", Q8: "+A2,A4", Q9: "+D2,D3,E2",
         Q10: "+F5,E2,G2", Q11: "+H1,G2", Q12: "+G2,G4,G10", Q13: "+F2,G2,F3",
         Q14: "+G2,G1,G5,G10", Q15: "+D2,D5", Q16: "+E4,F4,F5", Q17: "=I1,F5",
         Q18: "+I6,I7,G10", Q19: "+H2,H8,G2", Q20: "+G10" },
  P14: { O1: "+E8", O2: "+E1,E8", Q2: "+B1,B2,D4,D3,E8,B9,B11", Q3: "+B4,D3", Q4: "=C7",
         Q5: "+C6,D3", Q6: "=C4,D3", Q7: "+A3,D3", Q8: "+A2", Q9: "+D4,D3",
         Q10: "+B6,E8,E1", Q11: "+H1,G7,D3", Q12: "+G7", Q13: "+C7,F2", Q14: "+G1,G8",
         Q15: "+D1,D4,E8,C10", Q16: "+E4", Q17: "=I3,E8", Q18: "+I7,F1,E8", Q19: "+H3,H5,E8",
         Q20: "+E8" },
  P15: { O2: "+G9", Q2: "+B1,B2,G9,F2,B8", Q3: "+B4,G1,G4,G9", Q4: "+C1,C2,C9",
         Q5: "+C9,C6,I8", Q6: "=C4,C9,G3", Q7: "+A3,I8", Q8: "+A2,G9", Q9: "+G9,C9,E2",
         Q10: "+E2,G9,F3", Q11: "=H1,G9", Q12: "+G9,G4", Q13: "+F2,G9", Q14: "+G2,G1,G5,G9",
         Q15: "+D3", Q16: "+E4,I8", Q17: "=I3,G9", Q18: "+I4,G9,I7", Q19: "+H2,H5,I8",
         Q20: "+G9" },
  P16: { O1: "+B7", O2: "+B7", Q1: "+B3,B7", Q2: "+B1,B2,B7,B11", Q3: "+B4,F3,B7",
         Q4: "+C2", Q5: "+C6", Q6: "=C5,E1", Q7: "+A3,B7", Q8: "+A2,F1", Q9: "+E2",
         Q10: "+B7,E2,F5", Q11: "+H1,B7", Q12: "=H6", Q13: "+F3", Q14: "+G5,G8",
         Q15: "+D1", Q16: "+E4,B7", Q17: "=I1,B7,C10", Q18: "+I7,B7", Q19: "+H3,B7,H1",
         Q20: "+B7" },
  P17: { O2: "+G11", Q2: "+B1,B2,D2,B9,B10,B11,G11", Q3: "+B4,G11", Q4: "+C1,C2,C3,G11,C10",
         Q5: "+C6,G11", Q6: "=C4,G11", Q7: "+A3,D2", Q8: "+A2,A4", Q9: "+D2,E2",
         Q10: "+G11,F2,F6", Q11: "+H1,G11", Q12: "+G11", Q13: "+F2,G11", Q14: "=G11,G5,G12",
         Q15: "+D2", Q16: "+E4,F4,G11", Q17: "=I6,G11", Q18: "+I5,G11,I7",
         Q19: "+H2,H4,G11", Q20: "+G11" },
  P18: { Q2: "+B1,B2,F5,B8,B10", Q3: "+B4,B2,F2", Q4: "+C1,C2,C3", Q5: "+C6,C8,H9",
         Q6: "=C4,C8,H9", Q7: "+A3,A1", Q8: "+A2", Q9: "+D2,D4,C8", Q10: "+F5,E2",
         Q11: "=H9,G1,G4", Q12: "=H9,C5", Q13: "+F2,G1", Q14: "+G1,G4,G8,H9",
         Q15: "+D2,D4", Q16: "+E4,F4", Q17: "=I1,F5", Q18: "+I7,F5", Q19: "+H2,H9,H5",
         Q20: "+H9" },
  P19: { O2: "+E1", Q1: "+B3,E1", Q2: "+B1,B2,B9", Q3: "+B4,F2,G5", Q4: "+C2", Q5: "+C6",
         Q6: "=C4,E1,H7", Q7: "+A3,F7", Q8: "+A2,F7", Q9: "+D2,E2,E1", Q10: "=F7,E1,F4,B6",
         Q11: "+H1,H7,F7", Q12: "+H7,F7", Q13: "+F2", Q14: "+G8,G2,G1", Q15: "+D2,E1",
         Q16: "+E4,F4,F7", Q17: "=I3,E1,F7", Q18: "+I5,F7,I7", Q19: "+H2,F7,H4", Q20: "+F7" },
  P20: { Q2: "+B1,B2,E2,E7,H7,B8,B10", Q3: "+B4,F3", Q4: "+C2", Q5: "+C6,G10", Q6: "=C5",
         Q7: "+A3", Q8: "+A2", Q9: "+E2", Q10: "+E2,E7,B6", Q11: "=G6,G10,H3",
         Q12: "+G2,G10,G13,G15", Q13: "+F2,H3,G14", Q14: "+G2,G1,G5,G10", Q15: "+D1", Q16: "+E4,F4",
         Q17: "=I1,E7", Q18: "+I1,I2", Q19: "+H3,H4,C10,C11", Q20: "+I2" },
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
  S: ["J1", "C10"],
  F: ["J6"],
};

/** Écarts déclaré / constaté relevés à la lecture croisée (code J5). */
export const ecarts = [
  { cs: "CS11", code: "J5", nature: "écart",
    constat: "Un participant de ce centre déclare que la tension est prise « systématiquement, à toutes les femmes » ; l'observation et le registre montrent quatorze valeurs manquantes sur une page de trente lignes, et l'appareil électronique est hors d'usage. L'autre participant du même centre décrit ces mesures manquantes explicitement. Écart consigné sans être imputé à une intention : il informe sur la distance entre la norme intériorisée et la condition d'exercice (§ 4.2.6)." },
  { cs: "CS02", code: "J5", nature: "écart",
    constat: "Les deux participants décrivent une explication individualisée du résultat ; la configuration observée — constantes prises dans le couloir d'attente, valeurs annoncées à voix audible — rend cette individualisation matériellement difficile à tenir." },
  { cs: "CS14", code: "J5", nature: "concordance",
    constat: "La titulaire déclare vérifier chaque semaine le remplissage de la colonne tension ; le registre observé est effectivement le mieux tenu des trois centres ruraux. Concordance, à consigner autant qu'un écart." },
  { cs: "CS07", code: "J5", nature: "concordance",
    constat: "Une participante déclare ne pas savoir se servir du glucomètre d'urgence de la CPN, faute de formation, et n'avoir jamais fait de glycémie elle-même ; l'observation montre que, le laborantin absent, seule une collègue peut faire le test en CPN, et que les femmes de première CPN reçues pendant les absences de celle-ci repartent sans test. La déclaration renvoie à une condition de formation et d'organisation, non à la pratique individuelle." },
];

/** Écarts et concordances relevés à la lecture croisée de la vague 2. */
export const ecartsV2 = [
  { cs: "CS13", code: "J5", nature: "concordance",
    constat: "CONCORDANCE sur un point sensible. La participante déclare d'elle-même que la colonne tension du registre est toujours remplie, y compris quand la mesure n'a pas été faite sous la pression de l'affluence ; l'observation relève une proportion inhabituelle de valeurs identiques dans un registre intégralement renseigné. Ni l'un ni l'autre ne prouve quoi que ce soit sur une personne. Consigné comme ce que produit un contrôle portant sur la complétude des registres plutôt que sur les actes (§ 4.2.6), jamais comme une faute individuelle." },
  { cs: "CS01", code: "J5", nature: "concordance",
    constat: "CONCORDANCE. Le circuit de la glycémie de la première CPN décrit par la participante — bon de la CPN, test au laboratoire, résultat rapporté le matin même — est observé, et la mention « glycémie à refaire au prochain rendez-vous », portée au registre pour deux femmes, confirme le rattrapage qu'elle décrit ; les visites suivantes ne comportent pas de glycémie systématique, ce qui correspond à un test unique à la première visite." },
  { cs: "CS10", code: "J5", nature: "concordance",
    constat: "CONCORDANCE sur la séance d'éducation. La participante décrit une séance du mardi sur les signes de danger, avec la boîte à images, où la tension apparaît et le sucre non. Le cahier des séances confirme le thème et la date, et la boîte à images du centre comporte une planche sur les maux de tête et les œdèmes, aucune sur le diabète." },
  { cs: "CS05", code: "J5", nature: "concordance",
    constat: "CONCORDANCE. Le paradoxe décrit — glucomètre fonctionnel et bandelettes périmées — est constaté. L'observation suggère d'ajouter à la grille la distinction entre « présent » et « utilisable »." },
];
