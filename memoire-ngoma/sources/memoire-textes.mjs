// memoire-textes.mjs — les parties du mémoire qui ne viennent ni du protocole
// (protocole.json) ni des chapitres 5 et 6 : pages liminaires, résumé exécutif,
// méthodes telles que conduites (§ 4.2.5 à 4.2.7, au passé), conclusion et
// suggestions, résumé et abstract.
//
// ⚠️ EXERCICE DE FORMATION : les faits de terrain décrits ici (dates, effectifs,
// déroulement) sont ceux du projet simulé. Les champs entre crochets ne peuvent
// pas être simulés (numéros d'approbation, noms du jury, dédicace) : ils sont à
// compléter par l'auteur.
//
// Marqueurs : {N}, {n:CODE}, {v:clé} (calculs.mjs), {v:clé} (valeurs propres au
// mémoire, ajoutées par faire-memoire.mjs), {p:n} et {c:cle} (références).

export const PAGE_DE_GARDE = {
  type: "MÉMOIRE DE FIN DE FORMATION",
  diplome: "Pour l'obtention du diplôme de Master en Santé publique",
  specialite: "Spécialité : Promotion de la santé",
  annee: "Année académique : 2025-2026",
  soutenu: "Présenté et soutenu par MUKAKI DUNIA Jacques",
  jury: "[Date de soutenance et composition du jury — à compléter]",
};

export const LISTE_PERSONNEL = "[Liste officielle du personnel administratif et enseignant de l'ENATSE et de l'Université de Parakou, à reprendre du modèle fourni par l'école.]";

export const DEDICACE = "[Dédicace — à rédiger par l'auteur.]";

export const REMERCIEMENTS = [
  "À la Professeure N. Fanny M. HOUNKPONOU AHOUINGNAN, directrice de ce mémoire, pour la rigueur de son accompagnement, de la validation du protocole à la relecture du manuscrit.",
  "Aux infirmiers et sages-femmes des centres de santé du district de Ngoma qui ont accepté de parler de leur travail avec franchise, souvent au terme d'une matinée de consultation. Ce mémoire leur appartient autant qu'à son auteur ; conformément à l'engagement pris, ils ne sont pas nommés.",
  "À la Direction de la santé du district de Ngoma et aux responsables des centres de santé, qui ont facilité l'accès au terrain sans jamais intervenir dans le recrutement.",
  "À la personne bilingue qui a vérifié un échantillon des traductions des entretiens conduits en kinyarwanda.",
  "Au pair qui a accepté le double codage indépendant de trois entretiens.",
  "Aux enseignants et au personnel administratif de l'ENATSE.",
  "[Remerciements personnels — à compléter par l'auteur.]",
];

export const HOMMAGES = [
  ["À notre maître et présidente ou président du jury", "[Nom, titre et fonctions — à compléter]. Vous nous faites un grand honneur en acceptant de présider ce jury. Veuillez trouver ici l'expression de notre profond respect."],
  ["À notre maître et juge", "[Nom, titre et fonctions — à compléter]. Nous vous remercions d'avoir accepté de juger ce travail."],
  ["À notre maître et directrice de mémoire", "Professeure N. Fanny M. HOUNKPONOU AHOUINGNAN, Professeur titulaire du CAMES, enseignante de gynécologie-obstétrique à la Faculté de médecine de l'Université de Parakou, directrice de l'ENATSE. Vous avez dirigé ce travail avec exigence et disponibilité. Veuillez trouver ici l'expression de notre sincère reconnaissance."],
];

export const SIGLES_AJOUTES = [
  "ASM : animatrice de santé maternelle (agent de santé communautaire chargée de la santé maternelle)",
  "EDS : enquête démographique et de santé",
  "HGPO : hyperglycémie provoquée par voie orale",
  "κ : coefficient kappa de Cohen",
  "REFI-QDA : format d'échange des logiciels d'analyse qualitative",
];

export const EXECUTIVE_SUMMARY = [
  { h: "Background and methods" },
  { p: "This descriptive qualitative study analysed how antenatal care (ANC) nurses and midwives in Ngoma District, Rwanda, perceive and report screening for hypertension and diabetes in pregnancy, and the equity of access they recognise: {N} semi-structured interviews in {v:nbCentres} health centres, observation of each service, thematic analysis with double coding (κ = {v:kappaInter})." },
  { h: "Key findings" },
  { p: "Blood pressure is measured at every visit; every woman is referred for a laboratory glucose test at her first visit, but the test is skipped during strip stock-outs, meter breakdowns or when the laboratory technician is absent (done in {v:glycFaite} of {v:nbCentres} centres on the observation day), missed women are rarely retested, and the test is not repeated at 24-28 weeks. Explanation of results is inversely related to need; the collective education session rarely mentions blood pressure or glucose. Screening is absent from ANC indicators; referral often fails; home self-monitoring is limited to better-off households." },
  { h: "Recommendations" },
  { p: "Secure laboratory strips, a technician or substitute during ANC hours and an emergency glucose meter in ANC; keep a list of women to retest; make screening at 24-28 weeks feasible; add a screening line to the monthly report; make hospital feedback systematic." },
];

// § 4.2.5 à 4.2.7, tels que conduits (au passé).
export const METHODES_CONDUITES = [
  { h3: "4.2.5. Collecte des données" },
  { p: "4.2.5.1. Techniques et outils. Entretien semi-structuré (technique principale) et observation non participante du service ; guide d'entretien (annexe 1), grille d'observation (annexe 2), fiche sociodémographique (annexe 3), carnet de notes et journal de bord, traduits en kinyarwanda et en anglais." },
  { p: "4.2.5.2. Période et déroulement. Les entretiens se sont déroulés du {v:debutEntretiens} au {v:finEntretiens} et les observations du {v:debutObservations} au {v:finObservations}, en deux vagues. Ils ont duré de {v:dureeMin} à {v:dureeMax} minutes ; {v:nbKinyarwanda} ont été conduits en kinyarwanda et {v:nbFrancais} en français. Chaque centre a été observé une demi-journée." },
  { p: "4.2.5.3. Assurance qualité. Triangulation, variation maximale et vérification des interprétations auprès de trois participants ; piste d'audit, double codage et recodage (§ 4.2.6) ; notes originales, journal réflexif et note de positionnalité." },

  { h3: "4.2.6. Traitement et analyse des données" },
  { p: "Les entretiens n'ont pas été enregistrés : les réponses ont été notées, mises au propre le jour même et, pour le kinyarwanda, traduites puis vérifiées par sondage. L'analyse thématique a suivi six phases {p:48} selon une approche hybride : {v:codesDeductifs} codes déductifs en {v:familles} familles, et {v:nbInductifs} codes inductifs. Collecte close à {N} participants sur la suffisance informationnelle {p:44,45} ; codage dans QualiCode (export REFI-QDA)." },
  { p: "Fidélité du codage. {v:relusInter} entretiens sur {N} ({v:partInter}) ont été recodés à l'aveugle par un pair extérieur ; {v:relusIntra} autres ont été recodés par le chercheur quatre semaines plus tard. L'accord a été mesuré par le kappa de Cohen, qui retire l'accord dû au hasard, par paragraphe : κ = {v:kappaInter} entre codeurs ({v:unitesInter} paragraphes) et κ = {v:kappaIntra} en recodage, soit un accord « presque parfait » selon Landis et Koch {c:landis}. Les désaccords ont été tranchés en consensus." },

  { h3: "4.2.7. Considérations éthiques et déontologiques" },
  { p: "Helsinki {p:49}, CIOMS {p:50} et droit rwandais respectés ; approbation éthique et autorisation du district [références à compléter] ; consentement écrit, accord distinct pour la citation." },
];

export const CONCLUSION = [
  { p: "Les infirmiers et sages-femmes de CPN du district de Ngoma reconnaissent le dépistage de l'hypertension et du diabète comme relevant de leur mandat, et le demandent pour toutes. Mais la glycémie, faite au laboratoire, saute les jours de rupture de bandelettes, de panne ou d'absence du laborantin — elle n'était faite le jour de l'observation que dans {v:glycFaite} centres sur {v:nbCentres} —, la femme manquée n'est presque jamais rattrapée, et le test n'est pas refait entre 24 et 28 semaines. L'explication est distribuée à l'inverse des besoins, et l'autosurveillance après le diagnostic reste réservée aux ménages aisés. Les limites relèvent surtout du système, et les participants jugent ces différences inacceptables : le dépistage en CPN est une réorientation des services restée incomplète, dont le manque se distribue inégalement entre les femmes." },
];

export const SUGGESTIONS = [
  ["Au Ministère de la Santé et au Rwanda Biomedical Centre", [
    "garantir les bandelettes du laboratoire, rendre praticable le contrôle à 24-28 semaines et inscrire le dépistage et sa suite dans le rapport mensuel de la CPN.",
  ]],
  ["À la Direction de la santé du district et à l'hôpital de district", [
    "garantir un laborantin ou un remplaçant aux heures de CPN, doter chaque CPN d'un glucomètre d'urgence, mettre la tension et le sucre au programme des séances d'éducation et rendre systématique le retour d'information pour chaque femme référée.",
  ]],
  ["Aux équipes de CPN, aux formateurs et aux chercheurs", [
    "tenir la liste des femmes à retester, faire reformuler la femme, former des équipes plutôt que des personnes, et recueillir le point de vue des femmes.",
  ]],
];

export const RESUME = {
  titre: "RÉSUMÉ",
  blocs: [
    ["Introduction", "Dépister l'hypertension et le diabète en consultation prénatale (CPN) relève d'une réorientation des services au sens de la Charte d'Ottawa, dont la portée capacitante dépend des infirmiers et sages-femmes. L'étude analysait leurs perceptions et pratiques déclarées, et l'équité d'accès qu'ils reconnaissent, dans le district de Ngoma (Rwanda)."],
    ["Méthodes", "Étude qualitative descriptive : {N} entretiens semi-structurés dans {v:nbCentres} centres de santé, observation de chaque service, analyse thématique hybride, double codage (κ = {v:kappaInter})."],
    ["Résultats", "Sept thèmes ont été dégagés. La tension est mesurée à chaque visite et la glycémie, demandée pour toutes à la première CPN, est faite au laboratoire ; mais ce test saute les jours de rupture, de panne ou d'absence du laborantin (fait dans {v:glycFaite} centres sur {v:nbCentres} le jour de l'observation), sans rattrapage, et n'est pas refait à 24-28 semaines. L'autosurveillance à domicile reste réservée aux ménages aisés. L'explication est modulée à l'inverse des besoins ; la séance d'éducation collective, égale pour les présentes, parle peu de la tension et du sucre et manque les femmes arrivées tard. Absent des indicateurs, le dépistage n'est ni approvisionné ni supervisé ; la référence aboutit mal."],
    ["Conclusion", "Le dépistage en CPN reste une réorientation incomplète, inégalement distribuée entre les femmes."],
    ["Mots-clés", "dépistage ; hypertension ; diabète gestationnel ; consultation prénatale ; équité ; Rwanda."],
  ],
};

export const ABSTRACT = {
  titre: "ABSTRACT",
  blocs: [
    ["Introduction", "Screening for hypertension and diabetes at antenatal care (ANC) is a reorientation of health services in the sense of the Ottawa Charter, whose empowering value depends on nurses and midwives. This study analysed their perceptions and reported practices, and the equity of access they recognise, in Ngoma District, Rwanda."],
    ["Methods", "Descriptive qualitative study: {N} semi-structured interviews in {v:nbCentres} health centres, observation of each service, hybrid thematic analysis, double coding (κ = {v:kappaInter})."],
    ["Results", "Seven themes emerged. Blood pressure is measured at every visit and all women are referred for a laboratory glucose test at the first visit, but it is skipped during strip stock-outs, meter breakdowns or when the technician is absent (done in {v:glycFaite} of {v:nbCentres} centres on the observation day), missed women are not retested, and it is not repeated at 24-28 weeks. Home self-monitoring is limited to better-off households. Explanation is inversely related to need; the collective education session rarely covers blood pressure or glucose and misses late arrivals. Absent from indicators, screening is neither supplied nor supervised; referral often fails."],
    ["Conclusion", "ANC screening remains an incomplete reorientation, unequally distributed among women."],
    ["Keywords", "screening; hypertension; gestational diabetes; antenatal care; equity; Rwanda."],
  ],
};
