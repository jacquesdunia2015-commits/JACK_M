// donnees-routine.mjs — Annexe 9 : données de routine du district (SIMULÉES).
//
// ⚠️ VALEURS ENTIÈREMENT FICTIVES. Aucune donnée du système d'information
// sanitaire n'a été consultée. Les centres sont désignés par leur code, et les
// secteurs administratifs par le code du centre qu'ils abritent : inventer des
// chiffres de pauvreté sous le nom d'un secteur réel du district produirait une
// statistique fausse sur un lieu réel. Aucun nom de secteur n'apparaît donc ici.
//
// Les valeurs sont construites pour être COHÉRENTES avec les grilles
// d'observation et les entretiens simulés (un centre dont le glucomètre est
// réservé à la consultation MNT ne déclare pas de glycémie de CPN, un centre à
// forte affluence a beaucoup d'inscriptions,
// etc.), afin que l'exercice de triangulation ait un sens.
//
// Période de référence simulée : année civile 2025 (« dernière année civile
// complète », annexe 9).

export const SOURCE = "Direction de la santé du district (SIMULÉ) — année civile 2025";

// cpn1 : nouvelles inscrites ; cpn4 : femmes ayant atteint la 4e CPN ;
// t1 : % de premiers contacts au 1er trimestre ; refHta : femmes référées pour
// HTA gravidique ou prééclampsie ; glyc : dépistages glycémiques en CPN ;
// rupt : ruptures de bandelettes de glycémie (mois dans l'année) ;
// effectif : infirmiers et sages-femmes affectés à la CPN ;
// pauvrete : catégorie du secteur ; tauxPauvrete : % fictif.
export const parCentre = [
  { cs: "CS01", cpn1: 1080, cpn4: 896, t1: 74, refHta: 46, glyc: "1 015 (94 % des CPN1)", rupt: "0", effectif: 5, pauvrete: "plus faible", tauxPauvrete: 19 },
  { cs: "CS02", cpn1: 860, cpn4: 688, t1: 70, refHta: 30, glyc: "350 (41 %)", rupt: "5", effectif: 4, pauvrete: "plus faible", tauxPauvrete: 21 },
  { cs: "CS03", cpn1: 990, cpn4: 812, t1: 72, refHta: 41, glyc: "790 (80 %)", rupt: "2", effectif: 5, pauvrete: "plus faible", tauxPauvrete: 18 },
  { cs: "CS04", cpn1: 560, cpn4: 392, t1: 60, refHta: 8, glyc: "aucun : glucomètre réservé à la consultation MNT", rupt: "0", effectif: 3, pauvrete: "plus élevée", tauxPauvrete: 36 },
  { cs: "CS05", cpn1: 430, cpn4: 275, t1: 56, refHta: 6, glyc: "250 (58 %)", rupt: "3", effectif: 2, pauvrete: "plus élevée", tauxPauvrete: 40 },
  { cs: "CS06", cpn1: 900, cpn4: 711, t1: 69, refHta: 33, glyc: "450 (50 %)", rupt: "6", effectif: 4, pauvrete: "plus faible", tauxPauvrete: 23 },
  { cs: "CS07", cpn1: 590, cpn4: 401, t1: 59, refHta: 9, glyc: "aucun : glucomètre réservé à la consultation MNT", rupt: "0", effectif: 3, pauvrete: "plus élevée", tauxPauvrete: 38 },
  { cs: "CS08", cpn1: 610, cpn4: 439, t1: 63, refHta: 12, glyc: "aucun : glucomètre du laboratoire en panne (référence pour glycémie)", rupt: "sans objet (appareil en panne)", effectif: 3, pauvrete: "plus élevée", tauxPauvrete: 35 },
  { cs: "CS09", cpn1: 240, cpn4: 139, t1: 57, refHta: 2, glyc: "aucun : glucomètre du laboratoire non livré", rupt: "sans objet", effectif: 2, pauvrete: "plus élevée", tauxPauvrete: 41, note: "Centre ouvert en cours d'année : données partielles (avril à décembre)." },
  { cs: "CS10", cpn1: 720, cpn4: 331, t1: 52, refHta: 11, glyc: "610 (85 %)", rupt: "1", effectif: 3, pauvrete: "plus élevée", tauxPauvrete: 33, note: "Population mobile : une part des femmes inscrites a poursuivi son suivi dans un autre centre ; le taux de CPN4 ne mesure pas ici la qualité du suivi." },
  { cs: "CS11", cpn1: 650, cpn4: 429, t1: 55, refHta: 4, glyc: "300 (46 %)", rupt: "4", effectif: 3, pauvrete: "plus élevée", tauxPauvrete: 39, note: "Références non tracées au centre : la valeur sous-estime probablement le nombre réel." },
  { cs: "CS12", cpn1: 540, cpn4: 394, t1: 65, refHta: 10, glyc: "380 (70 %)", rupt: "2", effectif: 3, pauvrete: "plus élevée", tauxPauvrete: 32 },
  { cs: "CS13", cpn1: 870, cpn4: 809, t1: 64, refHta: 13, glyc: "830 (95 %)", rupt: "0", effectif: 4, pauvrete: "plus élevée", tauxPauvrete: 37, note: "Taux de CPN4 (93 %) nettement supérieur au reste du district : à lire avec la réserve de qualité ci-dessous." },
  { cs: "CS14", cpn1: 520, cpn4: 369, t1: 61, refHta: 8, glyc: "aucun : glucomètre du laboratoire en panne (référence pour glycémie)", rupt: "sans objet (appareil en panne)", effectif: 3, pauvrete: "plus élevée", tauxPauvrete: 36 },
  { cs: "CS15", cpn1: 500, cpn4: 335, t1: 58, refHta: 7, glyc: "aucun : glucomètre réservé à la consultation MNT", rupt: "1", effectif: 2, pauvrete: "plus élevée", tauxPauvrete: 38 },
];

export const fileActiveMnt = "1 240 personnes suivies en consultation dédiée aux maladies non transmissibles (hôpital et centres), dont aucune ventilation disponible pour les femmes dépistées pendant la grossesse.";

export const RESERVE = "Réserve de qualité (annexe 9 du protocole) : les indicateurs relatifs au nombre de visites prénatales présentent, dans le système d'information sanitaire rwandais, une concordance faible avec les registres, avec tendance à la surdéclaration. Les valeurs servent à caractériser le contexte, non à mesurer la pratique de dépistage.";
