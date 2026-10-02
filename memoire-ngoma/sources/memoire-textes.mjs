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
  { h: "Background" },
  { p: "Antenatal care (ANC) is the main regular contact between young women and a qualified provider in Rwanda, and WHO recommends systematic blood pressure measurement and risk-based diabetes screening at ANC. Whether this screening actually happens, and whether its result is explained in a way that enables women to act, depends on the nurses and midwives who run ANC. Their point of view had not been studied in Rwanda, and never in Ngoma District." },
  { h: "Objective and methods" },
  { p: "This descriptive qualitative study analysed the perceptions and reported practices of ANC nurses and midwives regarding screening for hypertension and diabetes in pregnancy, and the equity of access they recognise. Semi-structured interviews were conducted with {N} providers ({v:nbInf} nurses, {v:nbSf} midwives) in all {v:nbCentres} health centres of the district, complemented by non-participant observation of each ANC service and routine district data. Data were analysed thematically (six phases, hybrid coding), with independent double coding and intra-coder checks." },
  { h: "Key findings" },
  { p: "1. Screening is split in two. Blood pressure is measured at ANC; blood glucose is not. No health centre kept a glucometer in the ANC room: the device belonged to the laboratory or to the chronic disease clinic, and a pregnant woman could have her glucose tested, on an ANC request, in only {v:glycPossible} of {v:nbCentres} centres." },
  { p: "2. Explanation follows an inverse care pattern. Providers describe explaining least to the women who know least: explanations shorten with the hour of arrival, the workload and the provider's assumptions about the woman." },
  { p: "3. What is counted exists. ANC indicators ignore screening, so strips, maintenance and supervision follow other priorities; a register checked for completeness may hide unequal care." },
  { p: "4. Detection without follow-up. Referral depends on transport, household decision-makers and hospital feedback, which rarely returns; follow-up stops at delivery." },
  { p: "5. Local arrangements (community health workers, hand-made posters, post-partum follow-up notebooks) reduce part of the gap but rest on individuals." },
  { h: "Recommendations" },
  { p: "Link glucose testing of pregnant women explicitly to ANC (reserved laboratory strips, same-morning ANC request circuit); add one screening line to the monthly ANC report and supervise acts rather than register completeness; make hospital feedback systematic; train teams rather than individuals, including nurses at the vital-signs post; support community health workers in following referred women." },
];

// § 4.2.5 à 4.2.7, tels que conduits (au passé).
export const METHODES_CONDUITES = [
  { h3: "4.2.5. Collecte des données" },
  { p: "4.2.5.1. Techniques et outils. L'entretien individuel semi-structuré a constitué la technique principale, et l'observation non participante du service la technique secondaire, portant sur le service et non sur les personnes : aucune observation du contenu des consultations, aucune présence pendant l'examen clinique, aucun recueil de données relatives aux patientes. Les outils étaient ceux du protocole : guide d'entretien en trois axes (annexe 1), guide d'observation (annexe 2), fiche de données sociodémographiques et professionnelles (annexe 3), enregistreur audio et journal de bord. Ils ont été traduits en kinyarwanda et en anglais par traduction et rétro-traduction indépendantes." },
  { p: "4.2.5.2. Période et déroulement. Le guide a été pré-testé auprès de deux professionnels d'un centre de santé n'appartenant pas à l'échantillon ; le pré-test n'a pas été intégré à l'analyse. Les entretiens se sont déroulés du {v:debutEntretiens} au {v:finEntretiens}, et les observations du {v:debutObservations} au {v:finObservations}, en deux vagues : une première vague dans cinq centres contrastés, puis une seconde dans les onze autres. Le recrutement a échappé à la médiation hiérarchique : les responsables de centre ont communiqué les disponibilités sans désigner les personnes ni être informés de leur acceptation ou de leur refus." },
  { p: "Chaque entretien a été précédé de l'information et de la signature du consentement, l'enregistrement faisant l'objet d'une autorisation distincte. Les entretiens se sont tenus dans un local isolé et ont duré de {v:dureeMin} à {v:dureeMax} minutes, {v:dureeMoyenne} minutes en moyenne. Sur les {v:nbEntretiens} entretiens, {v:nbKinyarwanda} ont été conduits en kinyarwanda et {v:nbFrancais} en français, à la demande des participantes. Chaque centre a fait l'objet d'une observation d'une demi-journée, la disponibilité des équipements étant vérifiée dans le service de CPN et, avec l'accord du responsable, au laboratoire du centre." },
  { p: "4.2.5.3. Assurance qualité. La crédibilité s'est appuyée sur la triangulation des entretiens, des observations et des données de routine, sur la variation maximale de l'échantillon et sur la vérification des interprétations auprès de quatre participants volontaires en fin d'analyse. La dépendabilité a reposé sur une piste d'audit documentant chaque décision méthodologique, un double codage indépendant de {v:relusInter} entretiens par un pair extérieur, un recodage de {v:relusIntra} entretiens par le chercheur quatre semaines après le premier codage, et deux séances de discussion critique de l'arbre de codage avec la direction de mémoire. La confirmabilité a tenu à la conservation des enregistrements et des transcriptions, à la traçabilité du codage, à un journal réflexif et à une note de positionnalité rédigée avant le codage. Le chercheur, qui exerce depuis plus de vingt ans en santé, notamment en biologie médicale, n'a jamais exercé en consultation prénatale ni dans la hiérarchie des participants ; le kinyarwanda n'étant pas sa langue première, la vérification indépendante des traductions a constitué un contrôle essentiel. La restitution suit la grille COREQ {p:47}." },

  { h3: "4.2.6. Traitement et analyse des données" },
  { p: "Les entretiens conduits en kinyarwanda ont été transcrits verbatim dans cette langue par le collaborateur trilingue, selon des consignes écrites, puis traduits en français par le chercheur ; les termes propres au discours des participants ont été conservés entre crochets. Les entretiens conduits en français ont été transcrits directement par le chercheur. Un contrôle de fidélité a été exercé à deux niveaux : sondage de la transcription contre l'enregistrement par le chercheur, et vérification indépendante d'un échantillon de passages prélevé dans un tiers des entretiens par une personne bilingue liée par l'engagement de confidentialité." },
  { p: "Les données ont été analysées par analyse thématique en six phases : familiarisation, codage initial, recherche des thèmes, revue, définition et dénomination, production du rapport {p:48}. L'approche était hybride : la grille initiale, dérivée du tableau III, comptait {v:codesDeductifs} codes répartis en {v:familles} familles ; {v:nbInductifs} codes inductifs y ont été ajoutés au fil de l'analyse, chacun consigné dans la piste d'audit avec l'entretien qui l'avait fait naître. Les comptes rendus d'observation ont été intégrés au même arbre comme corpus secondaire, et toute divergence entre pratique déclarée et constat matériel a été consignée sans être imputée à une intention du participant." },
  { p: "L'accord entre codeurs, calculé par paragraphe, a été de κ = {v:kappaInter} sur les {v:relusInter} entretiens double-codés, et la stabilité intra-codeur de κ = {v:kappaIntra} ; les désaccords ont été tranchés en séance de consensus et consignés. La collecte a été close à {N} participants sur une appréciation de la suffisance informationnelle dimension par dimension {p:44,45}, chaque dimension du cadre étant renseignée par des propos contrastés." },
  { p: "Écart au protocole. Le protocole prévoyait l'usage de NVivo. Le codage a été réalisé avec QualiCode, logiciel d'analyse qualitative qui offre les mêmes fonctions de gestion, de codage, de mémos, de requêtes et de calcul de l'accord entre codeurs, et fonctionne sans connexion. Le projet a été exporté au format d'échange REFI-QDA, lisible par NVivo, ce qui garantit sa conservation et sa vérifiabilité. La méthode d'analyse demeure l'analyse thématique." },

  { h3: "4.2.7. Considérations éthiques et déontologiques" },
  { p: "La recherche s'est conformée à la Déclaration d'Helsinki {p:49}, aux lignes directrices du CIOMS {p:50} et au cadre légal rwandais relatif à la recherche sur l'être humain. Le protocole a été validé par le jury de l'ENATSE, approuvé par le comité d'éthique [références et date d'approbation — à compléter], puis autorisé par les autorités du district [référence de l'autorisation — à compléter] ; aucune collecte n'a été engagée avant l'obtention de l'ensemble de ces accords." },
  { p: "Les {N} participants ont donné un consentement écrit après une information complète, dans la langue de leur choix. L'enregistrement et la citation d'extraits ont fait l'objet d'accords distincts : {v:nbEnregistrement} participants ont accepté l'enregistrement et {v:nbRecontact} d'être recontactés. Le refus de citation d'extraits ({v:nbCitationRefus} participant) a été respecté : ses propos sont rapportés de manière agrégée, jamais cités ; une citation acceptée sous condition ({v:nbCitationCondition} participante) n'est associée à aucun élément permettant d'identifier le centre. Les participants sont désignés par un code, les centres par un code de structure, et aucun extrait n'est associé à plus d'une caractéristique ni au code de son centre. Les enregistrements et fichiers ont été chiffrés et la table de correspondance conservée séparément. Les propos défavorables ou stéréotypés sur les patientes sont rapportés comme des représentations professionnelles. Aucun conflit d'intérêts n'est déclaré ; l'étude a été autofinancée." },
];

export const CONCLUSION = [
  { p: "Cette étude visait à comprendre comment les infirmiers et sages-femmes de consultation prénatale du district de Ngoma perçoivent le dépistage de l'hypertension et du diabète chez la femme enceinte, quelles pratiques ils déclarent et quelle portée ils reconnaissent en matière d'équité d'accès. Ses résultats répondent aux deux questions spécifiques." },
  { p: "Quant au sens et aux pratiques, les professionnels reconnaissent unanimement le dépistage comme relevant de la CPN, mais ils n'en accomplissent que la moitié. La tension est mesurée ; la glycémie, rattachée au laboratoire et à la consultation des maladies chroniques, n'était accessible à la femme enceinte que dans {v:glycPossible} centres sur {v:nbCentres}. Surtout, la part du dépistage qui produit la capacité d'agir, l'explication, est distribuée à l'inverse des besoins : elle se raccourcit pour celles qui arrivent tard, qui posent peu de questions, qui n'ont pas d'autre source d'information." },
  { p: "Quant aux conditions et à l'équité, les participants situent les limites principalement dans le système : un dépistage qu'aucun indicateur de la CPN ne compte, des intrants gérés par d'autres programmes, une référence qui dépend d'un véhicule et revient rarement, un suivi qui s'arrête à l'accouchement. Ils jugent le plus souvent ces différences inacceptables, et beaucoup reconnaissent la part qui leur revient. Des arrangements locaux montrent qu'une partie de l'écart peut être réduite au niveau des équipes, mais ils reposent sur des personnes." },
  { p: "Au regard de la promotion de la santé, le dépistage en CPN apparaît ainsi comme une réorientation des services restée incomplète : le mandat est accepté, les moyens et la reconnaissance ne l'ont pas suivi, et ce manque se distribue inégalement entre les femmes. Les suggestions qui suivent en découlent." },
];

export const SUGGESTIONS = [
  ["Au Ministère de la Santé et au Rwanda Biomedical Centre", [
    "intégrer la glycémie de la femme enceinte au paquet de la CPN, avec des bandelettes affectées à ce service, et l'articuler explicitement au programme de lutte contre les maladies non transmissibles ;",
    "introduire dans le rapport mensuel de la CPN un indicateur portant sur les actes de dépistage et leur suite (mesures réalisées, résultats anormaux, références abouties) ;",
    "doter les centres d'un support d'information visuel commun, conçu pour des femmes qui lisent peu.",
  ]],
  ["À la Direction de la santé du district de Ngoma", [
    "organiser, dans chaque centre, le circuit « bon de CPN → laboratoire » le matin même, et réserver aux bons de CPN une part des bandelettes du laboratoire ;",
    "organiser la maintenance des tensiomètres et des glucomètres, et inclure les piles dans les commandes ;",
    "superviser les actes par l'observation, et non la seule complétude des registres.",
  ]],
  ["À l'hôpital de district", [
    "rendre systématique le retour d'information vers le centre pour chaque femme référée ;",
    "organiser, avec les centres, le suivi après l'accouchement des femmes dépistées.",
  ]],
  ["Aux responsables et aux équipes des centres de santé", [
    "coordonner la CPN et la consultation des maladies chroniques pour l'usage du glucomètre ;",
    "vérifier la compréhension en faisant reformuler la femme, et consacrer davantage de temps d'explication à celles qui en ont le plus besoin ;",
    "tracer les références et leur suite.",
  ]],
  ["Aux institutions de formation, dont l'ENATSE", [
    "former des équipes plutôt que des personnes, y compris les infirmiers affectés aux constantes ;",
    "intégrer à la formation la pratique informative et sa distribution entre les femmes, comme dimension de l'équité.",
  ]],
  ["Aux chercheurs", [
    "recueillir le point de vue des femmes sur l'explication reçue ;",
    "mesurer la couverture effective de la glycémie chez les femmes enceintes à partir des registres des laboratoires ;",
    "suivre les femmes dépistées après l'accouchement.",
  ]],
];

export const RESUME = {
  titre: "RÉSUMÉ",
  blocs: [
    ["Introduction", "La consultation prénatale (CPN) est le contact le plus régulier entre une femme jeune et un professionnel qualifié. Y dépister l'hypertension artérielle et le diabète relève d'une réorientation des services au sens de la Charte d'Ottawa, dont la réalisation et la portée capacitante dépendent des infirmiers et sages-femmes. L'étude visait à analyser leurs perceptions et pratiques déclarées à l'égard de ce dépistage, et la portée qu'ils reconnaissent en matière d'équité d'accès, dans le district de Ngoma (Rwanda)."],
    ["Méthodes", "Étude qualitative descriptive. Entretiens semi-structurés auprès de {N} prestataires ({v:nbInf} infirmiers et infirmières, {v:nbSf} sages-femmes) des {v:nbCentres} centres de santé du district, observation non participante de chaque service et données de routine. Analyse thématique en six phases, codage hybride, double codage indépendant (κ = {v:kappaInter}) et contrôle intra-codeur (κ = {v:kappaIntra})."],
    ["Résultats", "Sept thèmes ont été dégagés. La tension est mesurée en CPN, mais la glycémie relève du laboratoire ou de la consultation des maladies chroniques : aucun centre ne disposait d'un glucomètre en salle de CPN, et la glycémie n'était accessible à la femme enceinte que dans {v:glycPossible} centres sur {v:nbCentres}. L'explication du résultat est modulée à l'inverse des besoins. Le dépistage, absent des indicateurs de la CPN, n'y est ni approvisionné ni supervisé ; la référence aboutit mal et le suivi s'interrompt à l'accouchement. La majorité des participants jugent ces différences inacceptables et reconnaissent une part qui leur revient."],
    ["Conclusion", "Le dépistage en CPN reste une réorientation incomplète, dont le manque se distribue inégalement entre les femmes. Rattacher la glycémie à la CPN, compter les actes de dépistage et soutenir la pratique informative en sont les leviers."],
    ["Mots-clés", "dépistage ; hypertension artérielle ; diabète gestationnel ; consultation prénatale ; équité ; promotion de la santé ; Rwanda."],
  ],
};

export const ABSTRACT = {
  titre: "ABSTRACT",
  blocs: [
    ["Introduction", "Antenatal care (ANC) is the most regular contact between young women and a qualified provider. Screening for hypertension and diabetes at ANC is a reorientation of health services in the sense of the Ottawa Charter, whose delivery and empowering value depend on nurses and midwives. This study analysed their perceptions and reported practices regarding this screening, and the equity of access they recognise, in Ngoma District, Rwanda."],
    ["Methods", "Descriptive qualitative study. Semi-structured interviews with {N} providers ({v:nbInf} nurses, {v:nbSf} midwives) in all {v:nbCentres} health centres of the district, non-participant observation of each service, and routine data. Six-phase thematic analysis, hybrid coding, independent double coding (κ = {v:kappaInter}) and intra-coder check (κ = {v:kappaIntra})."],
    ["Results", "Seven themes emerged. Blood pressure is measured at ANC, but blood glucose belongs to the laboratory or the chronic disease clinic: no centre kept a glucometer in the ANC room, and glucose testing was available to pregnant women in only {v:glycPossible} of {v:nbCentres} centres. Explanation of results is inversely related to need. Absent from ANC indicators, screening is neither supplied nor supervised; referral often fails and follow-up stops at delivery. Most participants judged these differences unacceptable and acknowledged their own share."],
    ["Conclusion", "ANC screening remains an incomplete reorientation whose shortfall is unequally distributed among women. Linking glucose testing to ANC, counting screening acts and supporting the informative practice are the main levers."],
    ["Keywords", "screening; hypertension; gestational diabetes; antenatal care; equity; health promotion; Rwanda."],
  ],
};
