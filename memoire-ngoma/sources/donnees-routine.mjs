// donnees-routine.mjs — Annexe 9 : données de routine du district (SIMULÉES).
//
// ⚠️ VALEURS ENTIÈREMENT FICTIVES. Aucune donnée du système d'information
// sanitaire n'a été consultée. Les centres sont désignés par leur code, et les
// secteurs administratifs par le code du centre qu'ils abritent : inventer des
// chiffres de pauvreté sous le nom d'un secteur réel du district produirait une
// statistique fausse sur un lieu réel. Aucun nom de secteur n'apparaît donc ici.
//
// Les valeurs sont construites pour être COHÉRENTES avec les grilles
// d'observation et les entretiens simulés (un centre sans glucomètre n'a pas de
// dépistage glycémique, un centre à forte affluence a beaucoup d'inscriptions,
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
  { cs: "CS01", cpn1: 470, cpn4: 305, t1: 52, refHta: 48, glyc: "156 (suivi dans le rapport interne du centre)", rupt: "0", effectif: 4, pauvrete: "plus faible", tauxPauvrete: 14 },
  { cs: "CS02", cpn1: 360, cpn4: 214, t1: 46, refHta: 41, glyc: "non collecté", rupt: "5", effectif: 3, pauvrete: "plus faible", tauxPauvrete: 16 },
  { cs: "CS03", cpn1: 410, cpn4: 262, t1: 49, refHta: 57, glyc: "non collecté (colonne présente au registre)", rupt: "2", effectif: 4, pauvrete: "plus faible", tauxPauvrete: 13 },
  { cs: "CS04", cpn1: 230, cpn4: 115, t1: 38, refHta: 9, glyc: "sans objet (pas de glucomètre)", rupt: "sans objet", effectif: 2, pauvrete: "plus élevée", tauxPauvrete: 37 },
  { cs: "CS05", cpn1: 170, cpn4: 70, t1: 31, refHta: 7, glyc: "non collecté", rupt: "3", effectif: 2, pauvrete: "plus élevée", tauxPauvrete: 44 },
  { cs: "CS06", cpn1: 395, cpn4: 221, t1: 44, refHta: 33, glyc: "non collecté", rupt: "6", effectif: 3, pauvrete: "plus faible", tauxPauvrete: 19 },
  { cs: "CS07", cpn1: 245, cpn4: 110, t1: 35, refHta: 8, glyc: "sans objet (pas de glucomètre)", rupt: "sans objet", effectif: 2, pauvrete: "plus élevée", tauxPauvrete: 41 },
  { cs: "CS08", cpn1: 250, cpn4: 140, t1: 42, refHta: 12, glyc: "sans objet (pas de glucomètre)", rupt: "sans objet", effectif: 2, pauvrete: "plus élevée", tauxPauvrete: 38 },
  { cs: "CS09", cpn1: 85, cpn4: 31, t1: 33, refHta: 2, glyc: "sans objet (glucomètre non livré)", rupt: "sans objet", effectif: 2, pauvrete: "plus élevée", tauxPauvrete: 46, note: "Centre ouvert en cours d'année : données partielles (avril à décembre)." },
  { cs: "CS10", cpn1: 300, cpn4: 96, t1: 29, refHta: 10, glyc: "non collecté", rupt: "1", effectif: 2, pauvrete: "plus élevée", tauxPauvrete: 35, note: "Population mobile : une part des femmes inscrites a poursuivi son suivi dans un autre centre ; le taux de CPN4 ne mesure pas ici la qualité du suivi." },
  { cs: "CS11", cpn1: 275, cpn4: 118, t1: 30, refHta: 3, glyc: "sans objet (pas de glucomètre)", rupt: "sans objet", effectif: 2, pauvrete: "plus élevée", tauxPauvrete: 43, note: "Références non tracées au centre : la valeur sous-estime probablement le nombre réel." },
  { cs: "CS12", cpn1: 225, cpn4: 133, t1: 45, refHta: 11, glyc: "non collecté (colonne présente au registre)", rupt: "2", effectif: 2, pauvrete: "plus élevée", tauxPauvrete: 34 },
  { cs: "CS13", cpn1: 410, cpn4: 361, t1: 41, refHta: 14, glyc: "non collecté", rupt: "0", effectif: 3, pauvrete: "plus élevée", tauxPauvrete: 39, note: "Taux de CPN4 (88 %) nettement supérieur au reste du district : à lire avec la réserve de qualité ci-dessous, et à rapprocher de la note d'observation sur la complétude du registre." },
  { cs: "CS14", cpn1: 215, cpn4: 116, t1: 40, refHta: 9, glyc: "sans objet (glucomètre en panne)", rupt: "sans objet", effectif: 2, pauvrete: "plus élevée", tauxPauvrete: 40 },
  { cs: "CS15", cpn1: 200, cpn4: 92, t1: 34, refHta: 6, glyc: "sans objet (pas de glucomètre)", rupt: "sans objet", effectif: 2, pauvrete: "plus élevée", tauxPauvrete: 42 },
  { cs: "CS16", cpn1: 190, cpn4: 101, t1: 36, refHta: 8, glyc: "sans objet (pas de glucomètre)", rupt: "sans objet", effectif: 2, pauvrete: "plus élevée", tauxPauvrete: 45 },
];

export const fileActiveMnt = "1 240 personnes suivies en consultation dédiée aux maladies non transmissibles (hôpital et centres), dont aucune ventilation disponible pour les femmes dépistées pendant la grossesse.";

export const RESERVE = "Réserve de qualité (annexe 9 du protocole) : les indicateurs relatifs au nombre de visites prénatales présentent, dans le système d'information sanitaire rwandais, une concordance faible avec les registres, avec tendance à la surdéclaration. Les valeurs servent à caractériser le contexte, non à mesurer la pratique de dépistage.";
