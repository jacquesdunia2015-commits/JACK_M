// discussion.mjs — Chapitre 6 du mémoire : DISCUSSION (rédaction d'exercice).
//
// Discute les résultats du chapitre 5 au regard du protocole corrigé : revue de
// littérature (§ 2.2), cadre conceptuel (§ 3), et données rwandaises.
//
// RÉFÉRENCES — aucune n'est inventée :
//   · {p:23}, {p:52-55}, {p:6,7}  références du protocole corrigé (1 à 71) ;
//   · {c:cle}  référence ajoutée pendant la rédaction (references.mjs),
//              numérotée à la suite du protocole et listée pour vérification.
// Effectifs et valeurs : {N}, {n:CODE}, {v:clé}, comme au chapitre 5.

export const TITRE_DISCUSSION = "6. DISCUSSION";

export const blocsDiscussion = [
  { h2: "6.1. Rappel des principaux résultats" },
  { p: "Le dépistage est « coupé en deux » : la tension est mesurée en CPN, la glycémie relève du laboratoire et n'était réalisable pour une femme enceinte que dans {v:glycPossible} centres sur {v:nbCentres}, sur signes d'appel et à ses frais. L'explication est modulée à l'inverse des besoins ({n:C4} participants). Les limites relèvent surtout du système, mais une majorité de participants reconnaissent une part qui leur revient." },

  { h2: "6.2. Discussion des résultats" },
  { h3: "6.2.1. Deux programmes dans le même centre" },
  { p: "Les recommandations font de la CPN le lieu d'une mesure systématique de la pression artérielle et d'un dépistage du diabète orienté par les facteurs de risque {p:11}, et des milieux de vie le cadre de l'action promotionnelle {p:12}. Or la décentralisation des soins chroniques, prolongée par le mentorat d'infirmiers de centres de santé {c:niyonsenga} dans la logique du paquet essentiel de l'OMS {p:14}, a rattaché le glucomètre à la consultation des maladies chroniques. Deux programmes coexistent sans la jonction que la revue jugeait absente {p:63,64}, ce qui donne un contenu matériel au déficit de mise en œuvre pointé par l'Appel de Nairobi {p:22}. Les données nationales concordent : dépistage du diabète gestationnel non systématique, prévalence de 3,2 % estimée pour la recherche {p:27}, et 87,0 % des femmes jamais testées pour la glycémie contre 38 % pour la tension {p:16}." },
  { p: "Là où le circuit est ouvert, la sélection se fait sur des signes, faute de critères écrits, puis sur les moyens, le test étant hors du paquet de soins. La couverture de l'assurance communautaire (85,3 %) {p:59} n'empêche pas un recours concentré parmi les plus aisés {p:61,62} : cette seconde sélection porte sur ce que la Charte demande de corriger en conférant les moyens {p:23}. Elle invite à ne pas lire la faible prévalence rwandaise, quand les estimations africaines varient selon les critères {p:6,7,35-37}, comme une donnée épidémiologique pure." },

  { h3: "6.2.2. Le prestataire, opérateur concret de l'équité" },
  { p: "La littérature établit un gradient social du suivi prénatal {p:52-55} et des obstacles vus par les femmes {p:56,57}, mais un seul travail avait interrogé des prestataires {p:58}. Nos résultats décrivent comment le service reproduit l'inégalité : l'explication va d'abord aux femmes qui en ont le moins besoin, à l'image de la « loi inverse des soins » {c:tudorHart}. Au regard de l'axe « aptitudes individuelles » de la Charte {p:23}, une inégalité de littératie {c:nutbeam} devient une inégalité de capacité d'agir {p:51} ; la CPN en groupe montre d'ailleurs que cette portée ne se lit pas dans les indicateurs de contact {p:65,66}. Il s'agit d'un rationnement sous contrainte de temps {c:lipsky}, dans un pays en déficit de professionnels {p:70} ; les contre-pratiques décrites rejoignent l'universalisme proportionné {c:marmot}." },

  { h3: "6.2.3. Ce qui est compté, et ce qui le suit" },
  { p: "Ce qui n'est pas compté au titre de la CPN n'y est ni commandé, ni réparé, ni supervisé ; le mentorat clinique a montré que ces pratiques changent quand on leur porte attention {p:68}. À l'inverse, contrôler la complétude produit de la complétude {c:campbell}, comme le suggère la faible concordance entre indicateurs prénatals et registres rwandais {p:69}. La détection, enfin, n'a de valeur que si la référence aboutit : les facteurs limitants inventoriés ailleurs {p:24-26} s'articulent ici en une chaîne — transport, décision du ménage, retour d'information —, en accord avec les références sous-optimales décrites au Rwanda {c:rurangirwa}, et le suivi s'interrompt à l'accouchement alors que la grossesse peut révéler ces affections {p:4,5}. Ces résultats relèvent des milieux favorables et de la médiation {p:23}." },

  { h3: "6.2.4. Une portée reconnue en équité" },
  { p: "Sans que le mot soit prononcé, {n:H2} participants sur {N} jugent inacceptables des différences qu'ils situent dans les conditions plutôt que dans les femmes, conformément à la définition de l'équité retenue {p:51} ; que {n:H5} reconnaissent une part qui leur revient donne un point d'appui à la réorientation des services." },

  { h2: "6.3. Retour sur le cadre conceptuel" },
  { p: "Sur les {v:nbCodes} codes de l'arbre final, {v:nbInductifs} sont nés du matériau. Ils ne remettent pas en cause les deux ensembles du cadre, mais appellent trois révisions (tableau VIII), que la figure 3 intègre : une cascade d'accès à la glycémie au niveau organisationnel, que le modèle socio-écologique {p:41} ne laissait pas voir ; le dispositif de contrôle comme condition systémique ; une articulation communautaire ; et trois dimensions de l'équité d'accès — au test, à l'explication, à la continuité." },
  { tableau: "cadre" },
  { figure: "cadre_conceptuel_revise.png", legende: "Figure 3. Cadre conceptuel révisé à la lumière des résultats", source: "auteur, à partir de la figure 1, du tableau VIII et des observations" },

  { h2: "6.4. Forces et limites de l'étude" },
  { p: "Forces. L'échantillon couvre quinze des seize centres et chaque modalité du tableau II ; la puissance informationnelle {p:44} a été appréciée par dimension plutôt que par saturation {p:45} ; la fidélité du codage a été contrôlée (κ = {v:kappaInter} ; intra-codeur κ = {v:kappaIntra}) ; la rigueur répond aux critères retenus {p:46} et à la grille COREQ {p:47}." },
  { p: "Limites. Les résultats portent sur des pratiques déclarées et des représentations professionnelles ; le point de vue des femmes reste hors champ. L'observation est exposée à un effet de présence {c:mccambridge}, les données de routine sont de qualité limitée {p:69}, et l'étude, limitée à un district, ne se généralise pas. Les perspectives et suggestions sont présentées en conclusion." },
];

// Tableau VIII — révisions du cadre (mémo « Piste d'audit 3 » du projet).
export const revisionsCadre = [
  ["Niveau organisationnel", "Distinguer l'intrant présent, l'intrant utilisable, l'intrant accessible à la CPN et le test accessible sans frais à la femme", "Glucomètre au laboratoire ou à la consultation des maladies chroniques ; bandelettes réservées, absentes ou périmées ; appareils en panne ; test hors du paquet de la CPN, payé par la femme (thèmes 1 et 5)"],
  ["Entre le service et le social perçu", "Ajouter une articulation communautaire", "Relais des agents de santé communautaire, suivi des femmes référées (thème 7)"],
  ["Niveau systémique", "Faire du dispositif de contrôle une condition à part entière", "Indicateurs et complétude des registres orientent l'attention et peuvent masquer l'inégalité (thèmes 4 et 6)"],
];

// Recommandations par destinataire : tableau du chapitre 6 dans le document séparé et du rapport ;
// dans le mémoire, elles sont reprises sous forme de suggestions en conclusion.
export const recommandations = [
  ["Ministère de la Santé et Rwanda Biomedical Centre", "Inscrire la glycémie de la femme enceinte dans le paquet de soins de la CPN, sans frais pour elle ; fixer par écrit les signes d'appel et les facteurs de risque qui justifient le test", "Thème 1"],
  ["Direction de la santé du district", "Rattacher explicitement la glycémie de la femme enceinte à la CPN : réserver au laboratoire une part des bandelettes pour les bons de la CPN, et inclure ces bandelettes et les piles des tensiomètres dans les intrants essentiels ; inscrire dans le rapport mensuel une ligne sur le dépistage (tensions mesurées, glycémies réalisées, résultats anormaux, références abouties) ; organiser la maintenance des appareils ; superviser par l'observation des actes et non par la seule complétude des registres", "Thèmes 1, 4, 5 et 6"],
  ["Responsables des centres de santé", "Organiser le circuit « bon de CPN → laboratoire » le matin même ; coordonner la CPN et la consultation des maladies chroniques pour l'usage du glucomètre", "Thème 1"],
  ["Hôpital de district", "Rendre systématique le retour d'information vers le centre pour chaque femme référée ; organiser le suivi après l'accouchement des femmes dépistées", "Thème 3"],
  ["Équipes de CPN", "Vérifier la compréhension en faisant reformuler la femme ; utiliser un support visuel commun ; consacrer davantage de temps d'explication aux femmes qui en ont le plus besoin ; tracer les références", "Thème 2"],
  ["Formation initiale et continue", "Former les infirmiers affectés aux constantes autant que les sages-femmes ; former des équipes plutôt que des personnes ; intégrer la pratique informative et sa distribution entre les femmes au contenu des formations", "Thèmes 1 et 2 ; conditions individuelles"],
  ["Programme de santé communautaire", "Appuyer le rôle des agents dans le suivi des femmes référées et après l'accouchement, et reconnaître les outils de suivi créés localement", "Thème 7"],
];
