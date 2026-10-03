// resultats.mjs — Chapitre 5 du mémoire : RÉSULTATS (version d'entraînement).
//
// Entretiens et observations fictifs : ce chapitre montre comment rédiger les
// résultats à partir du projet QualiCode.
//
// Le plan est celui du mémo « Phase 6 — Production du rapport » : participants
// et centres, objectif spécifique 1 (T1, T2), objectif spécifique 2 (T3 à T7,
// dans l'ordre des niveaux du cadre), portée reconnue en équité,
// transformations proposées, triangulation.
//
// Rien n'est écrit « à la main » qui puisse être calculé :
//   · {N}            nombre d'entretiens ;
//   · {n:B6}         nombre de participants ayant au moins un passage codé B6
//                    (codeur principal C1) ; {n:H2+H3} : union de plusieurs codes ;
//   · {v:clé}        valeur calculée par faire-resultats.mjs (tableaux, centres) ;
//   · { cite, codes, t } : citation. faire-resultats.mjs REFUSE de produire le
//                    document si le texte n'est pas, mot pour mot, dans un passage
//                    de ce participant codé avec l'un de ces codes, ou si le
//                    participant a refusé la citation (P05).

export const TITRE_CHAPITRE = "5. RÉSULTATS";

export const blocs = [
  { p: "Ce chapitre présente les résultats de l'analyse thématique de {N} entretiens semi-structurés et de {v:nbCentres} observations de service, conduits dans {v:nbCentres} des seize centres de santé du district, le seizième ayant servi au pré-test. Il suit les deux objectifs spécifiques ; sept thèmes structurent l'ensemble." },
  { p: "Conventions de lecture. Chaque extrait est suivi du code du participant et de sa seule qualification, afin qu'aucun croisement ne permette d'identifier une personne (§ 4.2.7). Un effectif désigne le nombre de participants dont au moins un passage a été codé dans la catégorie : il indique l'étendue d'un propos dans le corpus, non une fréquence dans la population. Les propos sur les femmes enceintes sont des représentations professionnelles. Les extraits sont des propos notés pendant l'entretien et mis au propre le jour même, non des transcriptions d'enregistrement ; ceux qui sont traduits du kinyarwanda sont signalés, et la version originale les accompagne (§ 4.2.6)." },

  { h2: "5.1. Caractéristiques des participants et des centres" },
  { p: "Les {N} participants se répartissent en {v:nbInf} infirmiers ou infirmières et {v:nbSf} sages-femmes, dont {v:nbTitulaires} titulaires ; les entretiens ont duré de {v:dureeMin} à {v:dureeMax} minutes. Les tableaux IV et V ne sont pas croisés : associer une caractéristique individuelle à un centre identifierait la personne." },
  { tableau: "participants" },
  { tableau: "centres" },
  { p: "Le tensiomètre et le glucomètre étaient présents en salle de CPN dans les {v:nbCentres} centres : la glycémie de la première CPN y est la règle pour toutes les femmes. Le jour de l'observation, elle était faite dans {v:glycFaite} centres ; dans les {v:glycInterrompue} autres, elle ne l'était pas, faute de bandelettes valides ({v:glycRupture}), d'un appareil en état ({v:glycPanne}) ou d'un prestataire formé présent ({v:glycNonForme}). Au cours des trois mois précédents, {v:glycRupture3Mois} centres avaient connu une rupture de bandelettes. Seuls {v:glycRattrapage} centres notaient le test manqué pour le refaire au rendez-vous suivant, et aucun ({v:glycT3Systematique}) ne refaisait la glycémie de façon systématique entre 24 et 28 semaines." },

  { h2: "5.2. Sens attribué au dépistage et pratiques déclarées (objectif spécifique 1)" },
  { h3: "5.2.1. Un dépistage légitime, mais inégalement investi" },
  { p: "Tous les participants ({n:A2}) reconnaissent ce dépistage comme relevant du mandat de la CPN, souvent le seul moment de la vie adulte où une femme en bonne santé rencontre régulièrement un soignant. Cette légitimité se dissocie pourtant de la pratique : la tension est un geste intégré, « comme le poids » ; la glycémie, là où elle manque durablement, sort du champ de pensée, ce que {n:A5} participants décrivent comme un effet de l'impuissance." },
  { cite: "P06", codes: ["A3", "A5"], t: "La tension, je peux seulement la trouver et l'envoyer ailleurs. Le sucre, je ne peux même pas le trouver. Plus on est impuissant, moins on y pense — et ça, c'est grave." },

  { h3: "5.2.2. Thème 1 — Un test pour toutes, sauf les jours où il manque quelque chose" },
  { p: "Définition. La tension est mesurée à chaque visite ; la glycémie est faite à toutes au premier contact, en salle de CPN, mais elle saute les jours de rupture de bandelettes, de panne du glucomètre ou d'absence d'un prestataire formé à son usage. La femme reçue ces jours-là n'est presque jamais rattrapée, et le test, même quand il est fait, n'est pas refait entre 24 et 28 semaines." },
  { p: "Tous les participants ({n:B2}) décrivent la glycémie de la première CPN comme une règle pour toutes ; {n:B8} décrivent des jours, des semaines ou des mois où elle ne se fait pas. Trois causes reviennent : la rupture ou la péremption des bandelettes, dont la CPN partage le stock avec la consultation des maladies chroniques ({n:E6} participants évoquent cette concurrence) ; la panne d'un appareil que personne ne répare ({n:E7}) ; et l'absence, certains jours, du seul prestataire qui sait se servir du glucomètre, ses collègues n'ayant jamais été formés à son usage. Même la tension connaît des omissions faute d'appareil disponible ({n:B6} participants), et le savoir glycémique s'érode quand il n'est pas pratiqué ({n:D5})." },
  { cite: "P20", codes: ["B8"], t: "Le sucre, c'est pour toutes à la première visite, c'est sur la fiche, et le glucomètre est là, sur la table. Mais c'est ma collègue qui s'en sert ; moi, on ne m'a jamais formé à cet appareil. Quand elle est en congé, la case du sucre reste vide, et personne ne rappelle ces femmes." },
  { p: "{n:B10} participants parlent du devenir de la femme manquée : la case vide du registre n'est relue par personne, et les femmes reçues pendant une rupture ne sont pas rappelées quand les bandelettes reviennent ; {v:glycRattrapage} centres seulement inscrivent « glycémie à refaire » sur le carnet. L'accès au test dépend ainsi du jour où la femme se présente et de la personne qui la reçoit." },
  { cite: "P01", codes: ["B10"], t: "Toutes les femmes venues pour leur première visite pendant ce temps-là sont reparties sans le test, et personne ne les a rappelées quand les bandelettes sont revenues : on n'a pas de liste, et à la visite suivante on ne pense pas à regarder si la case est vide." },
  { p: "Là où tout est en place, le test reste unique : {n:B9} participants décrivent une glycémie qui n'est refaite qu'en présence d'un signe d'appel ou d'un facteur de risque — surpoids, antécédent de gros bébé, diabète dans la famille, sucre dans les urines, âge —, et aucune épreuve de charge entre 24 et 28 semaines, la période où le diabète gestationnel apparaît. Hors de la CPN, les campagnes de dépistage des maladies non transmissibles mesurent la tension et la glycémie de toute personne qui se présente, femmes enceintes comprises, sans que le résultat revienne à la CPN ({n:F9} participants)." },

  { h3: "5.2.3. Thème 2 — Expliquer moins à celles qui savent le moins" },
  { p: "Définition. L'explication qui suit la mesure varie selon l'heure, la charge de travail et l'idée que le soignant se fait de la femme, à l'inverse des besoins. Ce sont les participants eux-mêmes qui le décrivent ; le thème ne désigne pas une faute individuelle." },
  { p: "{n:C4} participants décrivent cette modulation, selon l'instruction supposée, l'heure d'arrivée et l'assurance de la femme ; plusieurs formulent eux-mêmes le paradoxe, parfois en le découvrant au cours de l'entretien." },
  { cite: "P04", codes: ["C4"], t: "Si vous venez à sept heures trente, vous aurez une infirmière qui vous explique. Si vous venez à onze heures, vous aurez la même infirmière mais elle vous dira trois mots. C'est le même service et ce n'est pas le même service." },
  { p: "{n:C5} participants affirment au contraire donner la même explication à toutes. Le risque au-delà de la grossesse n'est évoqué que par {n:C3} participants, certains le taisant faute de service vers lequel orienter la femme. Des contre-pratiques existent : faire reformuler la femme ({n:C8}), utiliser un support visuel commun ({n:C9}), refuser de classer les femmes par avance. Enfin, {n:C7} infirmiers ou infirmières laissent l'explication à une collègue sage-femme." },
  { cite: "P15", codes: ["C4", "C9"], t: "Avec l'affiche, j'explique pareil à toutes, c'est ça l'avantage : l'image est la même pour celle qui sait lire et pour celle qui ne sait pas." },
  { p: "Un moment échappe à cette modulation : la séance d'éducation collective, tenue deux à trois matins par semaine avant les consultations, observée le jour de la visite dans {v:nbSeancesObservees} centres sur {v:nbCentres}. {n:C10} participants la décrivent : la même information générale pour toutes les présentes, sur la nutrition, les signes de danger, le planning familial ou la mutuelle ; la tension n'y apparaît qu'à travers les signes de danger (thème observé dans {v:nbSeancesTension} centres) et le sucre presque jamais. Elle commence avant l'arrivée des femmes des collines éloignées. {n:C11} participants discutent de son usage : pour les uns, elle « prépare le terrain » sans remplacer la restitution du résultat ; pour d'autres, les jours d'affluence, elle en tient lieu." },
  { cite: "P03", codes: ["C10"], t: "Les femmes des collines du fond arrivent à dix heures, parfois onze heures, après deux heures de marche. Elles ont raté la séance. Et ce sont justement celles qui en auraient le plus besoin." },

  { h2: "5.3. Conditions perçues du dépistage (objectif spécifique 2)" },
  { h3: "5.3.1. Conditions individuelles et organisationnelles" },
  { p: "{n:D1} participants sur {N} décrivent une préparation initiale absente ou insuffisante au dépistage du diabète gestationnel ; la formation continue, décisive quand elle a eu lieu, reste ponctuelle et nominative, et le savoir part avec la personne formée. La charge de travail ({n:E1} participants), la concurrence entre programmes ({n:E6}) et l'absence de maintenance des appareils ({n:E7}) limitent le dépistage ; un poste de constantes tenu par une personne dédiée est le facilitateur le plus cité." },

  { h3: "5.3.2. Thème 4 — Ce qui est compté existe" },
  { p: "Définition. Intrants, maintenance et attention de l'encadrement suivent les indicateurs ; le dépistage n'en fait pas partie. La supervision décrite porte sur la fréquentation et la complétude des registres ; aucun participant n'a eu à déclarer une tension élevée dépistée ou une glycémie réalisée, et plusieurs relient cette absence à la rupture des intrants." },
  { cite: "P07", codes: ["F4", "F5"], t: "Le fer, on l'a toujours. La moustiquaire, on l'a toujours. Parce qu'ils sont dans les indicateurs. Les bandelettes de glycémie ne sont dans aucun indicateur, donc elles arrivent en dernier ou pas du tout." },

  { h3: "5.3.3. Thème 5 — Ce que change la dotation, et ce qu'elle ne change pas" },
  { p: "Définition. Des bandelettes en continu, un appareil entretenu et des prestataires formés rendent le test de la première CPN régulier et permettent de rattraper la femme manquée ; ils ne règlent ni le contrôle au troisième trimestre ni l'explication, et ils sont répartis au bénéfice des centres déjà les mieux placés. Même dans le centre le mieux pourvu, la glycémie n'est refaite qu'aux femmes à risque, faute d'une épreuve de charge praticable entre 24 et 28 semaines, et l'explication reste soumise au temps disponible. {n:H8} participants estiment que le lieu d'exercice décide de ce que reçoivent les femmes." },
  { cite: "P11", codes: ["B9"], t: "Le protocole parle d'une épreuve à ce moment-là, mais ici personne ne la fait : il faudrait que la femme vienne à jeun et reste deux heures." },

  { h3: "5.3.4. Thème 3 — Trouver sans pouvoir suivre" },
  { p: "Définition. La détection ne devient une prise en charge que si la référence aboutit et si l'information revient. Devant une tension élevée, la conduite décrite est la même partout : reprise après repos, recherche de protéines, référence. La suite diverge : dans les centres éloignés, la référence dépend d'un véhicule, de l'argent de la famille et de la personne qui décide ({n:G4} participants) ; {n:F3} participants rapportent l'absence de tout retour écrit de l'hôpital ; {n:F6} décrivent des femmes dépistées qui, après l'accouchement, ne relèvent plus d'aucun service. Deux dispositifs nationaux pèsent sur ce parcours. La venue du conjoint à la première CPN, liée au test VIH du couple, est comprise comme une condition d'accueil : des femmes attendent qu'il soit disponible et arrivent à quatre ou cinq mois, ce qui retarde aussi la glycémie ({n:G12} participantes). Les aides ciblées de l'ubudehe — mutuelle prise en charge, farine Shisha Kibondo — fidélisent les femmes des ménages les plus pauvres ; la difficulté se déplace vers celles qui sont juste au-dessus du seuil ({n:G13} participants)." },
  { cite: "P06", codes: ["G13"], t: "Les plus difficiles, ce sont celles juste au-dessus : pas assez pauvres pour être aidées, pas assez riches pour payer la mutuelle à temps. Celles-là, on les perd." },
  { p: "Après le diagnostic, le suivi lui-même suit les moyens du ménage. {n:G15} participants rapportent que des femmes de ménages aisés s'achètent un tensiomètre ou un glucomètre et se surveillent à domicile, puis reviennent avec leurs chiffres ; les femmes des ménages modestes, souvent les plus éloignées du centre, n'ont que le rendez-vous." },
  { cite: "P11", codes: ["G15"], t: "Mais ce sont des femmes de fonctionnaires ou de commerçants ; la femme qui cultive ne le pourra jamais, et c'est elle qui habite le plus loin." },
  { cite: "P07", codes: ["I6"], t: "Aujourd'hui je réfère dans le vide. Et tant que je réfère dans le vide, mon dépistage s'arrête à la détection : ce n'est pas un dépistage, c'est un signalement." },

  { h3: "5.3.5. Conditions sociales perçues" },
  { p: "Les conditions sociales des femmes, telles que les perçoivent les participants, sont dominées par la distance ({n:G2}), le coût et la mutuelle ({n:G1}) et l'instruction ({n:G3}). Le recours tardif et le non-retour ({n:G5}) sont attribués aux femmes par {n:G6} participants, tandis que {n:G8} désignent aussi le service : attente prolongée, visite sans résultat, rupture de matériel. Le recours aux guérisseurs ({n:G10}) est décrit sans mépris, comme une ressource de proximité." },
  { cite: "P18", codes: ["G4", "H9"], t: "Les différences qui comptent pour le dépistage, ce sont des situations, pas des catégories de femmes : avoir de l'argent pour le transport aujourd'hui, avoir quelqu'un pour garder les enfants, avoir le mari d'accord." },

  { h3: "5.3.6. Thème 6 — Le registre comme écran" },
  { p: "Définition. Un contrôle portant sur la complétude des registres produit de la complétude, et peut rendre invisible l'inégalité qu'il devrait révéler. Ce thème décrit un effet de système, jamais une faute individuelle, et n'est associé à aucun centre ; il repose surtout sur un entretien, corroboré par l'observation d'un registre (section 5.5)." },
  { cite: "P19", codes: ["F7"], t: "Dans le registre, toutes les femmes ont une tension. Dans la réalité, certaines n'en ont pas eu. Le registre dit que tout est égal ; c'est faux. Une inégalité qu'on ne voit pas, personne ne la corrigera." },

  { h3: "5.3.7. Thème 7 — Le dépistage hors des murs" },
  { p: "Définition. Relais communautaires et initiatives locales prolongent le dépistage là où le système ne prévoit rien ; ils reposent sur une personne. {n:G9} participantes de centres ruraux s'appuient sur l'animatrice de santé maternelle (ASM) du village pour vérifier qu'une femme référée s'est rendue à l'hôpital ; aucun circuit de contre-référence ne formalise ce retour d'information, et l'écart passe alors entre les villages dont l'ASM est active et les autres. L'alerte que l'ASM envoie par téléphone organise l'urgence — convulsions, saignement — jusqu'à l'ambulance ; elle ne prévoit rien pour une femme référée pour une tension élevée qui ne se plaint de rien ({n:G14} participants)." },

  { h2: "5.4. Portée reconnue en équité et transformations proposées" },
  { p: "Le mot « équité » n'a jamais été prononcé par l'enquêteur ; il apparaît spontanément dans {v:equiteSpontane} entretiens. Le jugement dominant est celui d'une inégalité inacceptable ({n:H2} participants), attribuée au système ({n:H4}) mais aussi, pour {n:H5} participants, à une part qui leur revient : l'explication (tableau VI). L'heure d'arrivée ({n:H7}) et le lieu ({n:H8}) apparaissent comme des facteurs d'inégalité qui ne dépendent pas de la femme. Une minorité exprime une résignation ({n:H3}) ou refuse de juger ({n:H6})." },
  { tableau: "equite" },
  { cite: "P07", codes: ["H5"], t: "Et il y a l'inégalité qui vient de moi — le temps que je donne, les mots que je choisis selon la personne que j'ai devant moi : celle-là, elle est à moi, et c'est la seule sur laquelle j'ai prise." },
  { p: "Invités à désigner une seule priorité, les participants se partagent entre intrants, formation, personnel, référence et redevabilité, souvent en l'argumentant contre une autre option. La proposition d'un indicateur ({n:I5} participants) vise le mécanisme du thème 4 plutôt que l'un de ses effets. D'autres proposent d'inscrire la tension et le sucre au programme des séances d'éducation, ou de passer par l'umugoroba w'ababyeyi, le forum villageois des parents, pour atteindre les maris et les familles ({n:I9})." },
  { cite: "P09", codes: ["I5"], t: "Une seule ligne dans le rapport mensuel : nombre de femmes dont la tension a été mesurée, nombre de tensions élevées trouvées, nombre référées." },

  { h2: "5.5. Triangulation et synthèse" },
  { p: "Sur les {v:nbCentres} centres observés, {v:nbConstats} ont fait l'objet d'un constat de confrontation entre propos et observation : {v:nbConcordances} concordances et {v:nbEcarts} écarts. L'observation a confirmé la glycémie de la première CPN là où elle se fait, montré ses interruptions et le rattrapage là où il existe, et corroboré l'effet de registre du thème 6 et le contenu des séances d'éducation ; les écarts, consignés sans être imputés à une intention, portent sur une mesure déclarée systématique et sur une explication déclarée individualisée. Les données de routine du district situent la part des premières CPN ayant reçu une glycémie entre {v:couvGlycMin} et {v:couvGlycMax} selon les centres, plus bas là où ruptures, pannes ou manque de personnel formé se sont accumulés ; elles montrent aussi un premier contact plus tardif dans les secteurs les plus pauvres." },
  { p: "Le tableau VII rassemble les sept thèmes. Ils décrivent un dépistage dont la réalisation dépend moins de la volonté des professionnels que de conditions qu'ils ne maîtrisent pas — les bandelettes, l'appareil et la formation dont dépend la glycémie, le temps, le véhicule, l'indicateur, les moyens du ménage après le diagnostic —, mais aussi d'une part qui leur revient : l'explication." },
  { tableau: "themes" },
];

// Tableau VII — synthèse des thèmes (mémo « Phase 5 » du projet).
export const THEMES = [
  ["T1. Un test pour toutes, sauf les jours où il manque quelque chose", "OS1", "La tension est mesurée à chaque visite ; la glycémie est faite à toutes au premier contact, mais saute les jours de rupture, de panne ou d'absence d'un prestataire formé, sans rattrapage, et n'est pas refaite à 24-28 semaines."],
  ["T2. Expliquer moins à celles qui savent le moins", "OS1", "L'explication varie avec l'heure, la charge et l'idée que l'on se fait de la femme, à l'inverse des besoins ; la séance collective, égale pour les présentes, ne restitue aucun résultat."],
  ["T3. Trouver sans pouvoir suivre", "OS2", "La détection ne devient prise en charge que si la référence aboutit et si l'information revient ; l'attente du conjoint et l'effet de seuil de l'ubudehe pèsent sur le parcours ; après le diagnostic, l'autosurveillance à domicile reste réservée aux ménages aisés."],
  ["T4. Ce qui est compté existe", "OS2", "Intrants, maintenance et attention suivent les indicateurs ; le dépistage n'en fait pas partie."],
  ["T5. Ce que change la dotation, et ce qu'elle ne change pas", "OS2", "Bandelettes, appareil et formation rendent le test initial régulier, mais ne règlent ni le contrôle tardif ni l'explication."],
  ["T6. Le registre comme écran", "OS2, équité", "Un contrôle de complétude produit de la complétude et peut masquer l'inégalité."],
  ["T7. Le dépistage hors des murs", "OS2, transformations", "Relais communautaires et initiatives locales prolongent le dépistage ; l'alerte des ASM organise l'urgence, pas le contrôle."],
];
