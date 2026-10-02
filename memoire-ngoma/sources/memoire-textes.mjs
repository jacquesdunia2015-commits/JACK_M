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
  "Au collaborateur trilingue qui a assuré bénévolement la transcription des entretiens en kinyarwanda, et à la personne bilingue qui en a vérifié un échantillon.",
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
  { p: "Antenatal care (ANC) is the most regular contact between young women and a qualified provider in Rwanda. This descriptive qualitative study analysed how ANC nurses and midwives perceive and report screening for hypertension and diabetes in pregnancy, and the equity of access they recognise. Semi-structured interviews were held with {N} providers in {v:nbCentres} of the 16 health centres of Ngoma District, with non-participant observation of each service; data were analysed thematically, with double coding (κ = {v:kappaInter})." },
  { h: "Key findings" },
  { p: "Screening is split in two: blood pressure is measured at ANC, but glucose testing belongs to the laboratory or the chronic disease clinic, and although it is planned for every woman at the first visit, it was actually performed in only {v:glycPossible} centres; it is not repeated at 24-28 weeks, when gestational diabetes appears, except on warning signs. Explanation of results is inversely related to need. Screening is absent from ANC indicators, so it is neither supplied nor supervised; referral often fails and follow-up stops at delivery." },
  { h: "Recommendations" },
  { p: "Secure test strips for the first-visit glucose test and make gestational diabetes screening at 24-28 weeks feasible, with written criteria; add a screening line to the monthly ANC report; make hospital feedback systematic; support providers' explanation of results and community follow-up of referred women." },
];

// § 4.2.5 à 4.2.7, tels que conduits (au passé).
export const METHODES_CONDUITES = [
  { h3: "4.2.5. Collecte des données" },
  { p: "4.2.5.1. Techniques et outils. L'entretien individuel semi-structuré a été la technique principale et l'observation non participante du service, portant sur le service et non sur les personnes, la technique secondaire. Les outils du protocole ont été utilisés — guide d'entretien (annexe 1), guide d'observation (annexe 2), fiche sociodémographique (annexe 3), enregistreur et journal de bord —, traduits en kinyarwanda et en anglais par traduction et rétro-traduction indépendantes." },
  { p: "4.2.5.2. Période et déroulement. Le guide a été pré-testé auprès de deux professionnels du seizième centre du district, exclu de l'échantillon ; l'étude a donc porté sur les quinze autres. Les entretiens se sont déroulés du {v:debutEntretiens} au {v:finEntretiens} et les observations du {v:debutObservations} au {v:finObservations}, en deux vagues (cinq centres contrastés, puis les dix autres), sans médiation hiérarchique du recrutement. Précédés du consentement écrit, les entretiens ont duré de {v:dureeMin} à {v:dureeMax} minutes ({v:dureeMoyenne} en moyenne) ; sur {v:nbEntretiens}, {v:nbKinyarwanda} ont été conduits en kinyarwanda et {v:nbFrancais} en français. Chaque centre a été observé une demi-journée, l'équipement étant vérifié en salle de CPN et au laboratoire." },
  { p: "4.2.5.3. Assurance qualité. La crédibilité s'est appuyée sur la triangulation des sources, la variation maximale et la vérification des interprétations auprès de trois participants ; la dépendabilité, sur une piste d'audit, un double codage indépendant de {v:relusInter} entretiens et un recodage intra-codeur de {v:relusIntra} entretiens à quatre semaines ; la confirmabilité, sur la conservation des enregistrements, un journal réflexif et une note de positionnalité rédigée avant le codage. Le chercheur n'a jamais exercé en CPN ni dans la hiérarchie des participants." },

  { h3: "4.2.6. Traitement et analyse des données" },
  { p: "Les entretiens en kinyarwanda ont été transcrits verbatim par un collaborateur trilingue, puis traduits en français par le chercheur ; un échantillon de passages d'un tiers des entretiens a été vérifié par une personne bilingue indépendante. L'analyse thématique a suivi six phases {p:48}, selon une approche hybride : la grille initiale, dérivée du tableau III, comptait {v:codesDeductifs} codes en {v:familles} familles, auxquels {v:nbInductifs} codes inductifs ont été ajoutés et consignés dans la piste d'audit. L'accord entre codeurs a été de κ = {v:kappaInter}, la stabilité intra-codeur de κ = {v:kappaIntra}. La collecte a été close à {N} participants sur une appréciation de la suffisance informationnelle {p:44,45}. Écart au protocole : le codage a été réalisé avec QualiCode plutôt que NVivo, avec les mêmes fonctions et un export au format REFI-QDA lisible par NVivo." },

  { h3: "4.2.7. Considérations éthiques et déontologiques" },
  { p: "La recherche s'est conformée à la Déclaration d'Helsinki {p:49}, aux lignes directrices du CIOMS {p:50} et au cadre légal rwandais. Le protocole a été validé par le jury de l'ENATSE, approuvé par le comité d'éthique [références et date d'approbation — à compléter] et autorisé par le district [référence — à compléter] avant toute collecte. Les {N} participants ont donné un consentement écrit, avec des accords distincts pour l'enregistrement et la citation : le refus de citation ({v:nbCitationRefus} participant) a été respecté, et une citation acceptée sous condition n'est associée à aucun élément identifiant le centre. Aucun extrait n'est associé à plus d'une caractéristique ni au code d'un centre ; les fichiers ont été chiffrés. L'étude a été autofinancée, sans conflit d'intérêts." },
];

export const CONCLUSION = [
  { p: "Cette étude visait à comprendre comment les infirmiers et sages-femmes de CPN du district de Ngoma perçoivent le dépistage de l'hypertension et du diabète chez la femme enceinte, quelles pratiques ils déclarent et quelle portée ils lui reconnaissent en matière d'équité. Les professionnels reconnaissent ce dépistage comme relevant de la CPN, mais n'en accomplissent que la moitié : la tension est mesurée, tandis que la glycémie, rattachée au laboratoire et prévue pour toutes à la première CPN, n'était effectivement réalisée que dans {v:glycPossible} centres sur {v:nbCentres}, et n'est refaite nulle part de façon systématique entre 24 et 28 semaines, quand apparaît le diabète gestationnel. L'explication, qui fonde la capacité d'agir, est distribuée à l'inverse des besoins." },
  { p: "Les limites relèvent surtout du système — indicateurs, intrants, référence, rupture à l'accouchement —, et les participants jugent le plus souvent ces différences inacceptables, en reconnaissant la part qui leur revient. Au regard de la promotion de la santé, le dépistage en CPN apparaît comme une réorientation des services restée incomplète, dont le manque se distribue inégalement entre les femmes. Les suggestions suivantes en découlent." },
];

export const SUGGESTIONS = [
  ["Au Ministère de la Santé et au Rwanda Biomedical Centre", [
    "garantir les bandelettes nécessaires à la glycémie de la première CPN, et rendre praticable le dépistage du diabète gestationnel entre 24 et 28 semaines, au contact de 26 semaines du modèle national à huit contacts ;",
    "introduire dans le rapport mensuel de la CPN un indicateur portant sur les actes de dépistage et leur suite.",
  ]],
  ["À la Direction de la santé du district de Ngoma", [
    "organiser le circuit « bon de CPN → laboratoire » le matin même et réserver aux bons de CPN une part des bandelettes, pour la première CPN comme pour le contrôle à 24-28 semaines ;",
    "organiser la maintenance des appareils et superviser les actes par l'observation, non par la seule complétude des registres.",
  ]],
  ["À l'hôpital de district", [
    "rendre systématique le retour d'information pour chaque femme référée et organiser le suivi après l'accouchement.",
  ]],
  ["Aux équipes des centres de santé", [
    "vérifier la compréhension en faisant reformuler la femme, et consacrer davantage de temps à celles qui en ont le plus besoin ; tracer les références et leur suite.",
  ]],
  ["Aux institutions de formation, dont l'ENATSE", [
    "former des équipes plutôt que des personnes, et intégrer la pratique informative et sa distribution entre les femmes à la formation.",
  ]],
  ["Aux chercheurs", [
    "recueillir le point de vue des femmes, mesurer la couverture effective de la glycémie à partir des registres des laboratoires et suivre les femmes dépistées après l'accouchement.",
  ]],
];

export const RESUME = {
  titre: "RÉSUMÉ",
  blocs: [
    ["Introduction", "Dépister l'hypertension et le diabète en consultation prénatale (CPN) relève d'une réorientation des services au sens de la Charte d'Ottawa, dont la portée capacitante dépend des infirmiers et sages-femmes. L'étude analysait leurs perceptions et pratiques déclarées, et l'équité d'accès qu'ils reconnaissent, dans le district de Ngoma (Rwanda)."],
    ["Méthodes", "Étude qualitative descriptive : {N} entretiens semi-structurés dans {v:nbCentres} centres de santé, observation de chaque service, analyse thématique hybride, double codage (κ = {v:kappaInter})."],
    ["Résultats", "Sept thèmes ont été dégagés. La tension est mesurée en CPN ; la glycémie relève du laboratoire et prévue pour toutes à la première CPN, n'était réalisée que dans {v:glycPossible} centres sur {v:nbCentres} et n'est pas refaite à 24-28 semaines. L'explication est modulée à l'inverse des besoins. Absent des indicateurs, le dépistage n'est ni approvisionné ni supervisé ; la référence aboutit mal."],
    ["Conclusion", "Le dépistage en CPN reste une réorientation incomplète, inégalement distribuée entre les femmes."],
    ["Mots-clés", "dépistage ; hypertension ; diabète gestationnel ; consultation prénatale ; équité ; Rwanda."],
  ],
};

export const ABSTRACT = {
  titre: "ABSTRACT",
  blocs: [
    ["Introduction", "Screening for hypertension and diabetes at antenatal care (ANC) is a reorientation of health services in the sense of the Ottawa Charter, whose empowering value depends on nurses and midwives. This study analysed their perceptions and reported practices, and the equity of access they recognise, in Ngoma District, Rwanda."],
    ["Methods", "Descriptive qualitative study: {N} semi-structured interviews in {v:nbCentres} health centres, observation of each service, hybrid thematic analysis, double coding (κ = {v:kappaInter})."],
    ["Results", "Seven themes emerged. Blood pressure is measured at ANC; glucose testing belongs to the laboratory and planned for all women at the first visit, was performed in only {v:glycPossible} of {v:nbCentres} centres and is not repeated at 24-28 weeks. Explanation is inversely related to need. Absent from indicators, screening is neither supplied nor supervised; referral often fails."],
    ["Conclusion", "ANC screening remains an incomplete reorientation, unequally distributed among women."],
    ["Keywords", "screening; hypertension; gestational diabetes; antenatal care; equity; Rwanda."],
  ],
};
