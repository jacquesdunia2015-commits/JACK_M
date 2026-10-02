// resultats.mjs — Chapitre 5 du mémoire : RÉSULTATS (rédaction d'exercice).
//
// ⚠️ DONNÉES SIMULÉES. Ce chapitre montre comment rédiger les résultats à
// partir du projet QualiCode ; il ne rapporte aucun résultat réel.
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
  { p: "Conventions de lecture. Chaque extrait est suivi du code du participant et de sa seule qualification, afin qu'aucun croisement ne permette d'identifier une personne (§ 4.2.7). Un effectif désigne le nombre de participants dont au moins un passage a été codé dans la catégorie : il indique l'étendue d'un propos dans le corpus, non une fréquence dans la population. Les propos sur les femmes enceintes sont des représentations professionnelles. Les extraits traduits du kinyarwanda sont signalés ; dans le mémoire réel, la version originale les accompagne (§ 4.2.6)." },

  { h2: "5.1. Caractéristiques des participants et des centres" },
  { p: "Les {N} participants se répartissent en {v:nbInf} infirmiers ou infirmières et {v:nbSf} sages-femmes, dont {v:nbTitulaires} titulaires ; les entretiens ont duré de {v:dureeMin} à {v:dureeMax} minutes. Les tableaux IV et V ne sont pas croisés : associer une caractéristique individuelle à un centre identifierait la personne." },
  { tableau: "participants" },
  { tableau: "centres" },
  { p: "Le tensiomètre était présent en salle de CPN dans les {v:nbCentres} centres. Un glucomètre existait dans {v:glucoPresent} centres, mais jamais en salle de CPN : il était au laboratoire ou à la consultation des maladies chroniques. La glycémie d'une femme enceinte n'était réalisable, sur bon de la CPN, que dans {v:glycPossible} centres, pour les seules femmes présentant un signe d'appel ; dans {v:glycPayante} d'entre eux, le test, qui ne figure pas dans le paquet de soins de la CPN, restait payé par la femme. Ailleurs, le glucomètre était réservé aux malades chroniques ({v:glycMnt}), inutilisable ({v:glucoInutilisable}) ou absent ({v:glucoAbsent})." },

  { h2: "5.2. Sens attribué au dépistage et pratiques déclarées (objectif spécifique 1)" },
  { h3: "5.2.1. Un dépistage légitime, mais inégalement investi" },
  { p: "Tous les participants ({n:A2}) reconnaissent ce dépistage comme relevant du mandat de la CPN, souvent le seul moment de la vie adulte où une femme en bonne santé rencontre régulièrement un soignant. Cette légitimité se dissocie pourtant de la pratique : la tension est un geste intégré, « comme le poids » ; la glycémie, là où elle n'est pas possible, sort du champ de pensée, ce que {n:A5} participants décrivent comme un effet de l'impuissance." },
  { cite: "P06", codes: ["A3", "A5"], t: "La tension, je peux seulement la trouver et l'envoyer ailleurs. Le sucre, je ne peux même pas le trouver. Plus on est impuissant, moins on y pense — et ça, c'est grave." },

  { h3: "5.2.2. Thème 1 — Un dépistage coupé en deux" },
  { p: "Définition. La tension est mesurée en CPN ; la recherche du diabète se fait ailleurs, au laboratoire ou à la consultation des maladies chroniques, sur des signes d'appel, avec des bandelettes que la CPN ne gère pas et un test que la femme paie. Là où ce circuit est fermé à la femme enceinte, la glycémie cesse d'être pensée." },
  { p: "Même la tension connaît des omissions faute d'appareil disponible ({n:B6} participants), et le savoir glycémique s'érode quand il n'est pas pratiqué ({n:D5}). Pour la glycémie, aucun ne décrit un geste réalisé en salle de CPN ; {n:B8} décrivent le circuit du bon, du laboratoire et des bandelettes réservées d'abord aux malades chroniques." },
  { cite: "P20", codes: ["B8"], t: "Le sucre, il y a un appareil au laboratoire, pour les malades chroniques. Pour les femmes enceintes, on ne l'a jamais fait. Jamais." },
  { p: "Là où le circuit est ouvert, deux sélections s'ajoutent. La première porte sur les signes : le bon n'est rédigé que pour les femmes qui présentent un signe d'appel ou un facteur de risque, selon le jugement du professionnel ou une habitude transmise entre collègues. La seconde porte sur les moyens : {n:B9} participants rapportent que le test, absent du paquet de soins de la CPN, est payé au laboratoire, et que celles qui n'ont pas l'argent le jour même repartent sans l'avoir fait." },
  { cite: "P01", codes: ["B9"], t: "Le test n'est pas dans le paquet de la CPN : au laboratoire, elle doit le payer. Celle qui n'a pas l'argent ce jour-là repart avec le bon dans son carnet, et pour ça, souvent, elle ne revient pas." },

  { h3: "5.2.3. Thème 2 — Expliquer moins à celles qui savent le moins" },
  { p: "Définition. L'explication qui suit la mesure varie selon l'heure, la charge de travail et l'idée que le soignant se fait de la femme, à l'inverse des besoins. Ce sont les participants eux-mêmes qui le décrivent ; le thème ne désigne pas une faute individuelle." },
  { p: "{n:C4} participants décrivent cette modulation, selon l'instruction supposée, l'heure d'arrivée et l'assurance de la femme ; plusieurs formulent eux-mêmes le paradoxe, parfois en le découvrant au cours de l'entretien." },
  { cite: "P04", codes: ["C4"], t: "Si vous venez à sept heures trente, vous aurez une infirmière qui vous explique. Si vous venez à onze heures, vous aurez la même infirmière mais elle vous dira trois mots. C'est le même service et ce n'est pas le même service." },
  { p: "{n:C5} participants affirment au contraire donner la même explication à toutes. Le risque au-delà de la grossesse n'est évoqué que par {n:C3} participants, certains le taisant faute de service vers lequel orienter la femme. Des contre-pratiques existent : faire reformuler la femme ({n:C8}), utiliser un support visuel commun ({n:C9}), refuser de classer les femmes par avance. Enfin, {n:C7} infirmiers ou infirmières laissent l'explication à une collègue sage-femme." },
  { cite: "P15", codes: ["C4", "C9"], t: "Avec l'affiche, j'explique pareil à toutes, c'est ça l'avantage : l'image est la même pour celle qui sait lire et pour celle qui ne sait pas." },

  { h2: "5.3. Conditions perçues du dépistage (objectif spécifique 2)" },
  { h3: "5.3.1. Conditions individuelles et organisationnelles" },
  { p: "{n:D1} participants sur {N} décrivent une préparation initiale absente ou insuffisante au dépistage du diabète gestationnel ; la formation continue, décisive quand elle a eu lieu, reste ponctuelle et nominative, et le savoir part avec la personne formée. La charge de travail ({n:E1} participants), la concurrence entre programmes ({n:E6}) et l'absence de maintenance des appareils ({n:E7}) limitent le dépistage ; un poste de constantes tenu par une personne dédiée est le facilitateur le plus cité." },

  { h3: "5.3.2. Thème 4 — Ce qui est compté existe" },
  { p: "Définition. Intrants, maintenance et attention de l'encadrement suivent les indicateurs ; le dépistage n'en fait pas partie. La supervision décrite porte sur la fréquentation et la complétude des registres ; aucun participant n'a eu à déclarer une tension élevée dépistée ou une glycémie réalisée, et plusieurs relient cette absence à la rupture des intrants." },
  { cite: "P07", codes: ["F4", "F5"], t: "Le fer, on l'a toujours. La moustiquaire, on l'a toujours. Parce qu'ils sont dans les indicateurs. Les bandelettes de glycémie ne sont dans aucun indicateur, donc elles arrivent en dernier ou pas du tout." },

  { h3: "5.3.3. Thème 5 — Ce que change la dotation, et ce qu'elle ne change pas" },
  { p: "Définition. L'équipement réduit l'inégalité du test, mais ni celle du coût ni celle de l'explication, et il est réparti au bénéfice des centres déjà les mieux placés. Là où le laboratoire accepte les bons de la CPN, le dépistage glycémique devient une routine ciblée ; mais même dans le centre le mieux pourvu, le test reste payé par la femme, et l'explication reste soumise au temps disponible. {n:H8} participants estiment que le lieu d'exercice décide de ce que reçoivent les femmes." },
  { cite: "P11", codes: ["B9", "I8"], t: "Le titulaire laisse passer celles qui ne peuvent pas payer, mais c'est un arrangement, ce n'est écrit nulle part." },

  { h3: "5.3.4. Thème 3 — Trouver sans pouvoir suivre" },
  { p: "Définition. La détection ne devient une prise en charge que si la référence aboutit et si l'information revient. Devant une tension élevée, la conduite décrite est la même partout : reprise après repos, recherche de protéines, référence. La suite diverge : dans les centres éloignés, la référence dépend d'un véhicule, de l'argent de la famille et de la personne qui décide ({n:G4} participants) ; {n:F3} participants rapportent l'absence de tout retour écrit de l'hôpital ; {n:F6} décrivent des femmes dépistées qui, après l'accouchement, ne relèvent plus d'aucun service." },
  { cite: "P07", codes: ["I6"], t: "Aujourd'hui je réfère dans le vide. Et tant que je réfère dans le vide, mon dépistage s'arrête à la détection : ce n'est pas un dépistage, c'est un signalement." },

  { h3: "5.3.5. Conditions sociales perçues" },
  { p: "Les conditions sociales des femmes, telles que les perçoivent les participants, sont dominées par la distance ({n:G2}), le coût et la mutuelle ({n:G1}) et l'instruction ({n:G3}). Le recours tardif et le non-retour ({n:G5}) sont attribués aux femmes par {n:G6} participants, tandis que {n:G8} désignent aussi le service : attente prolongée, visite sans résultat, rupture de matériel. Le recours aux guérisseurs ({n:G10}) est décrit sans mépris, comme une ressource de proximité." },
  { cite: "P18", codes: ["G4", "H9"], t: "Les différences qui comptent pour le dépistage, ce sont des situations, pas des catégories de femmes : avoir de l'argent pour le transport aujourd'hui, avoir quelqu'un pour garder les enfants, avoir le mari d'accord." },

  { h3: "5.3.6. Thème 6 — Le registre comme écran" },
  { p: "Définition. Un contrôle portant sur la complétude des registres produit de la complétude, et peut rendre invisible l'inégalité qu'il devrait révéler. Ce thème décrit un effet de système, jamais une faute individuelle, et n'est associé à aucun centre ; il repose surtout sur un entretien, corroboré par l'observation d'un registre (section 5.5)." },
  { cite: "P19", codes: ["F7"], t: "Dans le registre, toutes les femmes ont une tension. Dans la réalité, certaines n'en ont pas eu. Le registre dit que tout est égal ; c'est faux. Une inégalité qu'on ne voit pas, personne ne la corrigera." },

  { h3: "5.3.7. Thème 7 — Le dépistage hors des murs" },
  { p: "Définition. Relais communautaires et initiatives locales prolongent le dépistage là où le système ne prévoit rien ; ils reposent sur une personne. {n:G9} participantes de centres ruraux s'appuient sur les agents de santé communautaire pour suivre les femmes référées, sans qu'aucune règle ne le prévoie ; l'écart passe alors entre les villages qui ont un agent actif et les autres." },

  { h2: "5.4. Portée reconnue en équité et transformations proposées" },
  { p: "Le mot « équité » n'a jamais été prononcé par l'enquêteur ; il apparaît spontanément dans {v:equiteSpontane} entretiens. Le jugement dominant est celui d'une inégalité inacceptable ({n:H2} participants), attribuée au système ({n:H4}) mais aussi, pour {n:H5} participants, à une part qui leur revient : l'explication (tableau VI). L'heure d'arrivée ({n:H7}) et le lieu ({n:H8}) apparaissent comme des facteurs d'inégalité qui ne dépendent pas de la femme. Une minorité exprime une résignation ({n:H3}) ou refuse de juger ({n:H6})." },
  { tableau: "equite" },
  { cite: "P07", codes: ["H5"], t: "Et il y a l'inégalité qui vient de moi — le temps que je donne, les mots que je choisis selon la personne que j'ai devant moi : celle-là, elle est à moi, et c'est la seule sur laquelle j'ai prise." },
  { p: "Invités à désigner une seule priorité, les participants se partagent entre intrants, formation, personnel, référence et redevabilité, souvent en l'argumentant contre une autre option. La proposition d'un indicateur ({n:I5} participants) vise le mécanisme du thème 4 plutôt que l'un de ses effets." },
  { cite: "P09", codes: ["I5"], t: "Une seule ligne dans le rapport mensuel : nombre de femmes dont la tension a été mesurée, nombre de tensions élevées trouvées, nombre référées." },

  { h2: "5.5. Triangulation et synthèse" },
  { p: "Sur les {v:nbCentres} centres observés, {v:nbConstats} ont fait l'objet d'un constat de confrontation entre propos et observation : {v:nbConcordances} concordances et {v:nbEcarts} écarts. L'observation a situé le glucomètre au laboratoire, confirmé le circuit de la glycémie là où il fonctionne et corroboré l'effet de registre du thème 6 ; les écarts, consignés sans être imputés à une intention, portent sur une mesure déclarée systématique et sur une explication déclarée individualisée. Les données de routine, qui ne collectent pas la glycémie de CPN, montrent un premier contact plus tardif dans les secteurs les plus pauvres." },
  { p: "Le tableau VII rassemble les sept thèmes. Ils décrivent un dépistage dont la réalisation dépend moins de la volonté des professionnels que de conditions qu'ils ne maîtrisent pas — le circuit et le coût de la glycémie, le temps, le véhicule, l'indicateur —, mais aussi d'une part qui leur revient : l'explication." },
  { tableau: "themes" },
];

// Tableau VII — synthèse des thèmes (mémo « Phase 5 » du projet).
export const THEMES = [
  ["T1. Un dépistage coupé en deux", "OS1", "La tension est intégrée à la CPN ; la glycémie, demandée sur des signes d'appel, se fait au laboratoire ou à la consultation des maladies chroniques, aux frais de la femme, et cesse d'être pensée là où ce circuit est fermé à la femme enceinte."],
  ["T2. Expliquer moins à celles qui savent le moins", "OS1", "L'explication varie avec l'heure, la charge et l'idée que l'on se fait de la femme, à l'inverse des besoins."],
  ["T3. Trouver sans pouvoir suivre", "OS2", "La détection ne devient prise en charge que si la référence aboutit et si l'information revient."],
  ["T4. Ce qui est compté existe", "OS2", "Intrants, maintenance et attention suivent les indicateurs ; le dépistage n'en fait pas partie."],
  ["T5. Ce que change la dotation, et ce qu'elle ne change pas", "OS2", "L'équipement réduit l'inégalité du test, mais ni celle du coût ni celle de l'explication."],
  ["T6. Le registre comme écran", "OS2, équité", "Un contrôle de complétude produit de la complétude et peut masquer l'inégalité."],
  ["T7. Le dépistage hors des murs", "OS2, transformations", "Relais communautaires et initiatives locales prolongent le dépistage ; ils reposent sur une personne."],
];
