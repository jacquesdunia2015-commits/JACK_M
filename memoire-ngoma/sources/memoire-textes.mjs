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
  "ASC : agent de santé communautaire",
  "HGPO : hyperglycémie provoquée par voie orale",
  "κ : coefficient kappa de Cohen",
  "REFI-QDA : format d'échange des logiciels d'analyse qualitative",
];

export const EXECUTIVE_SUMMARY = [
  { h: "Background and methods" },
  { p: "Antenatal care (ANC) is the most regular contact between young women and a qualified provider in Rwanda. This descriptive qualitative study analysed how ANC nurses and midwives perceive and report screening for hypertension and diabetes in pregnancy, and the equity of access they recognise. Semi-structured interviews were held with {N} providers in {v:nbCentres} of the 16 health centres of Ngoma District, with non-participant observation of each service; data were analysed thematically, with double coding (κ = {v:kappaInter})." },
  { h: "Key findings" },
  { p: "Screening is split in two: blood pressure is measured at ANC, but glucose testing belongs to the laboratory or the chronic disease clinic, and was available to pregnant women in only {v:glycPossible} centres — on warning signs only, and at the woman's expense, since it is outside the ANC care package. Explanation of results is inversely related to need. Screening is absent from ANC indicators, so it is neither supplied nor supervised; referral often fails and follow-up stops at delivery." },
  { h: "Recommendations" },
  { p: "Include free glucose testing in the ANC package with written criteria; add a screening line to the monthly ANC report; make hospital feedback systematic; support providers' explanation of results and community follow-up of referred women." },
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
  { p: "Cette étude visait à comprendre comment les infirmiers et sages-femmes de CPN du district de Ngoma perçoivent le dépistage de l'hypertension et du diabète chez la femme enceinte, quelles pratiques ils déclarent et quelle portée ils lui reconnaissent en matière d'équité. Les professionnels reconnaissent ce dépistage comme relevant de la CPN, mais n'en accomplissent que la moitié : la tension est mesurée, tandis que la glycémie, rattachée au laboratoire, n'était accessible à la femme enceinte que dans {v:glycPossible} centres sur {v:nbCentres}, sur des signes d'appel et à ses frais. L'explication, qui fonde la capacité d'agir, est distribuée à l'inverse des besoins." },
  { p: "Les limites relèvent surtout du système — indicateurs, intrants, référence, rupture à l'accouchement —, et les participants jugent le plus souvent ces différences inacceptables, en reconnaissant la part qui leur revient. Au regard de la promotion de la santé, le dépistage en CPN apparaît comme une réorientation des services restée incomplète, dont le manque se distribue inégalement entre les femmes. Les suggestions suivantes en découlent." },
];

export const SUGGESTIONS = [
  ["Au Ministère de la Santé et au Rwanda Biomedical Centre", [
    "inscrire la glycémie de la femme enceinte dans le paquet de soins de la CPN, sans frais pour elle, avec des critères écrits (signes d'appel et facteurs de risque) ;",
    "introduire dans le rapport mensuel de la CPN un indicateur portant sur les actes de dépistage et leur suite.",
  ]],
  ["À la Direction de la santé du district de Ngoma", [
    "organiser le circuit « bon de CPN → laboratoire » le matin même, réserver aux bons de CPN une part des bandelettes et prévoir une dispense écrite pour les femmes qui ne peuvent pas payer ;",
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
    ["Introduction", "La consultation prénatale (CPN) est le contact le plus régulier entre une femme jeune et un professionnel qualifié. Y dépister l'hypertension artérielle et le diabète relève d'une réorientation des services au sens de la Charte d'Ottawa, dont la réalisation et la portée capacitante dépendent des infirmiers et sages-femmes. L'étude visait à analyser leurs perceptions et pratiques déclarées à l'égard de ce dépistage, et la portée qu'ils reconnaissent en matière d'équité d'accès, dans le district de Ngoma (Rwanda)."],
    ["Méthodes", "Étude qualitative descriptive. Entretiens semi-structurés auprès de {N} prestataires ({v:nbInf} infirmiers et infirmières, {v:nbSf} sages-femmes) de {v:nbCentres} des seize centres de santé du district, observation non participante de chaque service et données de routine. Analyse thématique en six phases, codage hybride, double codage indépendant (κ = {v:kappaInter}) et contrôle intra-codeur (κ = {v:kappaIntra})."],
    ["Résultats", "Sept thèmes ont été dégagés. La tension est mesurée en CPN, mais la glycémie relève du laboratoire ou de la consultation des maladies chroniques : aucun centre ne disposait d'un glucomètre en salle de CPN, et la glycémie n'était accessible à la femme enceinte que dans {v:glycPossible} centres sur {v:nbCentres}, sur des signes d'appel et à ses frais, le test ne figurant pas dans le paquet de soins de la CPN. L'explication du résultat est modulée à l'inverse des besoins. Le dépistage, absent des indicateurs de la CPN, n'y est ni approvisionné ni supervisé ; la référence aboutit mal et le suivi s'interrompt à l'accouchement. La majorité des participants jugent ces différences inacceptables et reconnaissent une part qui leur revient."],
    ["Conclusion", "Le dépistage en CPN reste une réorientation incomplète, dont le manque se distribue inégalement entre les femmes. Inscrire la glycémie dans le paquet de soins de la CPN, sans frais pour la femme, compter les actes de dépistage et soutenir la pratique informative en sont les leviers."],
    ["Mots-clés", "dépistage ; hypertension artérielle ; diabète gestationnel ; consultation prénatale ; équité ; promotion de la santé ; Rwanda."],
  ],
};

export const ABSTRACT = {
  titre: "ABSTRACT",
  blocs: [
    ["Introduction", "Antenatal care (ANC) is the most regular contact between young women and a qualified provider. Screening for hypertension and diabetes at ANC is a reorientation of health services in the sense of the Ottawa Charter, whose delivery and empowering value depend on nurses and midwives. This study analysed their perceptions and reported practices regarding this screening, and the equity of access they recognise, in Ngoma District, Rwanda."],
    ["Methods", "Descriptive qualitative study. Semi-structured interviews with {N} providers ({v:nbInf} nurses, {v:nbSf} midwives) in {v:nbCentres} of the 16 health centres of the district, non-participant observation of each service, and routine data. Six-phase thematic analysis, hybrid coding, independent double coding (κ = {v:kappaInter}) and intra-coder check (κ = {v:kappaIntra})."],
    ["Results", "Seven themes emerged. Blood pressure is measured at ANC, but blood glucose belongs to the laboratory or the chronic disease clinic: no centre kept a glucometer in the ANC room, and glucose testing was available to pregnant women in only {v:glycPossible} of {v:nbCentres} centres, on warning signs and at their own expense, the test not being part of the ANC care package. Explanation of results is inversely related to need. Absent from ANC indicators, screening is neither supplied nor supervised; referral often fails and follow-up stops at delivery. Most participants judged these differences unacceptable and acknowledged their own share."],
    ["Conclusion", "ANC screening remains an incomplete reorientation whose shortfall is unequally distributed among women. Including free glucose testing in the ANC package, counting screening acts and supporting the informative practice are the main levers."],
    ["Keywords", "screening; hypertension; gestational diabetes; antenatal care; equity; health promotion; Rwanda."],
  ],
};
