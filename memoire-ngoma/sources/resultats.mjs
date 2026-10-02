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
  { p: "Ce chapitre présente les résultats de l'analyse thématique de {N} entretiens semi-structurés et de {v:nbCentres} observations de service, conduits dans les {v:nbCentres} centres de santé du district. Il suit les objectifs du protocole : l'objectif spécifique 1 (décrire le sens attribué au dépistage et les pratiques déclarées) puis l'objectif spécifique 2 (examiner les conditions perçues, la portée reconnue en équité et les changements jugés nécessaires). Sept thèmes structurent l'ensemble ; ils sont présentés avec leur définition, les variations observées entre participants, et des extraits d'entretiens." },
  { p: "Conventions de lecture. Chaque extrait est suivi du code du participant et d'une seule caractéristique, sa qualification, afin qu'aucun croisement ne permette d'identifier une personne dans une équipe de deux ou trois professionnels (§ 4.2.7). Lorsqu'un effectif est donné, il désigne le nombre de participants dont au moins un passage a été codé dans la catégorie correspondante ; il indique l'étendue d'un propos dans le corpus, non une fréquence dans la population. Les propos relatifs aux femmes enceintes sont rapportés comme des représentations professionnelles, sans généralisation." },
  { encadre: "Langue des extraits", t: "Les entretiens conduits en kinyarwanda sont cités dans leur traduction française, signalée par la mention « traduit du kinyarwanda ». Dans le mémoire réel, chaque extrait traduit est accompagné de sa version originale (§ 4.2.6) ; les transcriptions simulées n'existant qu'en français, cette version n'est pas reproduite ici." },

  { h2: "5.1. Caractéristiques des participants et des centres" },
  { p: "Les {N} participants se répartissent en {v:nbInf} infirmiers ou infirmières et {v:nbSf} sages-femmes ; {v:nbTitulaires} exercent la fonction de titulaire. La durée des entretiens varie de {v:dureeMin} à {v:dureeMax} minutes. Le tableau VI présente leurs caractéristiques de manière agrégée, et le tableau VII celles des centres. Les deux tableaux ne sont pas croisés : associer une caractéristique individuelle à un centre identifierait la personne." },
  { tableau: "participants" },
  { tableau: "centres" },
  { p: "Le jour de l'observation, le tensiomètre était présent dans les {v:nbCentres} centres, mais la recherche de la glycémie n'était réalisable que dans {v:glycPossible} d'entre eux. Dans {v:glucoInutilisable} centres, le glucomètre était présent sans pouvoir servir (bandelettes absentes ou périmées, appareil en panne) ; {v:glucoAbsent} centres n'en disposaient pas. Cette distribution matérielle forme l'arrière-plan des propos rapportés dans la suite du chapitre." },

  { h2: "5.2. Sens attribué au dépistage et pratiques déclarées (objectif spécifique 1)" },
  { h3: "5.2.1. Un dépistage légitime, mais inégalement investi" },
  { p: "Tous les participants ({n:A2}) reconnaissent le dépistage de l'hypertension et du diabète comme relevant du mandat de la consultation prénatale. La justification la plus fréquente tient à la position de la CPN dans le parcours des femmes : c'est souvent le seul moment de la vie adulte où une femme en bonne santé rencontre régulièrement un soignant." },
  { cite: "P01", codes: ["A2"], t: "La femme enceinte vient chez nous quatre fois, cinq fois ; c'est souvent la seule fois dans sa vie d'adulte où elle voit un soignant régulièrement. Si on ne mesure pas sa tension là, on la mesure où ?" },
  { p: "Cette légitimité de principe se dissocie de la place réelle du dépistage dans le travail. La tension est décrite comme un geste intégré, « comme le poids » ; la glycémie, là où elle n'est pas possible, sort progressivement du champ de pensée. {n:A5} participants décrivent ce désinvestissement comme un effet de l'impuissance, non comme un choix." },
  { cite: "P06", codes: ["A3", "A5"], t: "La tension, je peux seulement la trouver et l'envoyer ailleurs. Le sucre, je ne peux même pas le trouver. Plus on est impuissant, moins on y pense — et ça, c'est grave." },

  { h3: "5.2.2. Thème 1 — Un dépistage coupé en deux" },
  { p: "Définition. La mesure de la tension est un geste intégré presque partout ; la recherche du diabète dépend entièrement des moyens du centre, et cesse d'être pensée là où elle n'est pas possible. Ce thème ne décrit pas un défaut de connaissance des professionnels." },
  { p: "La tension est déclarée prise « à toutes » par la quasi-totalité des participants. Mais {n:B6} d'entre eux décrivent des situations où la mesure est omise faute d'appareil disponible : tensiomètre partagé avec le service curatif, appareil en panne, absence d'une collègue. L'omission ne relève alors ni de la femme ni de la volonté du soignant." },
  { cite: "P06", codes: ["B6"], t: "la différence ne vient pas des femmes, elle vient de l'heure et du matériel. La femme qui arrive quand le tensiomètre est là a un dépistage ; celle qui arrive quand il est de l'autre côté n'en a pas. Elles n'ont rien fait de différent." },
  { p: "Pour la glycémie, trois situations se dégagent : l'absence d'appareil, qui fait disparaître le geste ; l'appareil présent mais inutilisable, vécu comme plus pénible encore ; et le dépistage ciblé sur des facteurs de risque, là où les intrants existent. Dans ce dernier cas, la sélection des femmes repose sur le jugement du professionnel, parfois sur des habitudes transmises de bouche à oreille." },
  { cite: "P13", codes: ["B2", "F5"], t: "Quand on n'a rien, on n'y pense plus. Quand on a tout sous les yeux et qu'on ne peut pas s'en servir, on y pense à chaque femme." },
  { cite: "P14", codes: ["B1", "B2"], t: "Il y avait une sage-femme qui faisait le test aux femmes grosses ou qui avaient eu un gros bébé. Je fais pareil. Mais je ne sais pas si c'est la règle complète ou seulement son habitude à elle." },
  { p: "Le savoir lui-même s'érode lorsqu'il n'est pas pratiqué : {n:D5} participants décrivent une compétence acquise en formation puis désapprise faute d'outil." },
  { cite: "P06", codes: ["B2", "D5"], t: "J'ai la connaissance et je n'ai pas l'outil. C'est comme apprendre à conduire et ne pas avoir de voiture. Et avec le temps j'ai peur d'oublier." },

  { h3: "5.2.3. Thème 2 — Expliquer moins à celles qui savent le moins" },
  { p: "Définition. L'explication qui suit la mesure varie selon l'heure, la charge de travail et l'idée que le soignant se fait de la femme — à l'inverse des besoins. Ce thème n'est pas présenté comme une faute individuelle : ce sont les participants eux-mêmes qui le décrivent." },
  { p: "{n:C4} participants décrivent une modulation de l'information selon les femmes. Trois critères reviennent : le niveau d'instruction supposé, l'heure d'arrivée et l'assurance de la femme à poser des questions. Plusieurs participants formulent eux-mêmes le paradoxe : celles qui disposent d'autres sources d'information reçoivent l'explication la plus complète." },
  { cite: "P02", codes: ["C4"], t: "Celle qui a fait le secondaire, elle ira chercher l'information ailleurs, elle a un téléphone, elle connaît quelqu'un. Celle à qui je dis deux mots, c'est tout ce qu'elle aura. Donc je donne le plus à celle qui a déjà, et le moins à celle qui n'a rien." },
  { cite: "P04", codes: ["C4"], t: "Si vous venez à sept heures trente, vous aurez une infirmière qui vous explique. Si vous venez à onze heures, vous aurez la même infirmière mais elle vous dira trois mots. C'est le même service et ce n'est pas le même service." },
  { p: "La modulation est parfois découverte au cours même de l'entretien, ce qui en signale le caractère non réfléchi." },
  { cite: "P01", codes: ["C4"], t: "c'est vrai que celle qui aurait le plus besoin d'explications, c'est peut-être celle-là. Je n'y avais pas pensé comme ça." },
  { p: "À l'inverse, {n:C5} participants affirment donner la même explication à toutes. Deux justifications apparaissent : un nombre de femmes assez faible pour laisser le temps à chacune, ou une explication devenue si brève qu'elle ne peut plus varier." },
  { cite: "P20", codes: ["C5"], t: "Je dis la même chose à toutes. Après trente ans, on a ses phrases." },
  { p: "Le contenu de l'explication porte sur le danger immédiat et l'orientation vers l'hôpital ; le risque au-delà de la grossesse n'est évoqué que par {n:C3} participants. Certains disent le taire délibérément, faute de service vers lequel orienter la femme après l'accouchement." },
  { cite: "P09", codes: ["C3", "C6"], t: "Dire à quelqu'un de se faire suivre quand il n'y a pas de service pour le suivre, ça crée de l'inquiétude sans rien résoudre. Alors je me tais, et je sais que ce n'est pas bien." },
  { p: "Des contre-pratiques sont décrites. {n:C8} participants vérifient la compréhension en faisant reformuler la femme ; {n:C9} utilisent un support visuel, qui donne la même information à celle qui lit et à celle qui ne lit pas. Une participante refuse explicitement de classer les femmes par avance." },
  { cite: "P15", codes: ["C4", "C9"], t: "Avec l'affiche, j'explique pareil à toutes, c'est ça l'avantage : l'image est la même pour celle qui sait lire et pour celle qui ne sait pas." },
  { cite: "P18", codes: ["H9"], t: "quand j'étais jeune, j'adaptais selon ce que je croyais : celle-ci a l'air pauvre, elle ne comprendra pas. Et je me trompais souvent. Depuis, je ne devine plus." },
  { p: "Enfin, {n:C7} infirmiers ou infirmières déclarent ne pas expliquer eux-mêmes le résultat, qu'ils laissent à une collègue sage-femme. Le premier professionnel à connaître une tension élevée n'est donc pas toujours celui qui l'explique." },

  { h2: "5.3. Conditions perçues du dépistage (objectif spécifique 2)" },
  { p: "Les conditions sont présentées selon les niveaux du cadre conceptuel : individuel, organisationnel, systémique, puis social et communautaire. Les thèmes 3 à 7 s'y rattachent." },
  { h3: "5.3.1. Conditions individuelles et professionnelles" },
  { p: "La formation est évoquée dans tous les entretiens, et {n:D1} participants sur {N} décrivent une préparation initiale absente ou insuffisante au dépistage du diabète gestationnel. La formation continue, lorsqu'elle a eu lieu, est décrite comme décisive : elle donne « les mots » pour expliquer. Mais elle est ponctuelle et nominative : quand la seule personne formée est absente ou mutée, le savoir part avec elle. {n:D4} participants décrivent une transmission informelle entre collègues, qui comble ce manque sans en garantir le contenu." },
  { cite: "P06", codes: ["I2", "E7"], t: "une personne formée qui part en congé, c'est un centre qui redevient comme avant." },
  { cite: "P08", codes: ["A4", "I2"], t: "On est nombreux dans les centres, et on n'est ni formés ni consultés. C'est nous qui tenons les constantes, et les constantes, c'est là que le dépistage commence." },

  { h3: "5.3.2. Conditions organisationnelles" },
  { p: "La charge de travail est évoquée par {n:E1} participants sur {N}, et elle se lit dans le temps : deux professionnels pour une file de vingt-cinq à cinquante femmes, une consultation interrompue par un accouchement, une matinée où la collègue est appelée à la vaccination. {n:E6} participants décrivent une concurrence entre programmes, au détriment de la CPN. L'absence de maintenance des appareils est rapportée par {n:E7} participants." },
  { cite: "P10", codes: ["B6"], t: "Nous sommes deux pour la CPN et la maternité en même temps. Un accouchement ne peut pas attendre. Donc c'est la CPN qui attend, toujours." },
  { cite: "P09", codes: ["B2", "F5"], t: "Il n'y a pas de service qui répare : quand un appareil tombe, il reste sur la table." },
  { p: "Le facilitateur le plus souvent cité est organisationnel : un poste des constantes tenu par une personne dédiée, qui ne peut pas être appelée ailleurs." },
  { cite: "P01", codes: ["E5"], t: "la personne aux constantes ne fait que ça, elle ne saute pas la tension parce qu'elle est appelée ailleurs." },

  { h3: "5.3.3. Thème 4 — Ce qui est compté existe" },
  { p: "Définition. Les intrants, la maintenance et l'attention de l'encadrement suivent les indicateurs ; le dépistage de l'hypertension et du diabète n'en fait pas partie." },
  { p: "Interrogés sur la manière dont l'encadrement considère ce dépistage, les participants décrivent de façon concordante une supervision centrée sur la fréquentation (CPN1, CPN4, accouchements assistés, vaccination) et sur la complétude des registres. Aucun ne rapporte avoir eu à déclarer un nombre de tensions élevées dépistées ou de glycémies réalisées. Plusieurs établissent un lien direct entre cette absence et la rupture des intrants." },
  { cite: "P07", codes: ["F4", "F5"], t: "Le fer, on l'a toujours. La moustiquaire, on l'a toujours. Parce qu'ils sont dans les indicateurs. Les bandelettes de glycémie ne sont dans aucun indicateur, donc elles arrivent en dernier ou pas du tout." },
  { cite: "P09", codes: ["F4", "E7"], t: "S'il y avait un chiffre à rendre sur les glycémies faites, l'appareil serait réparé depuis longtemps. Je le dis sans amertume : c'est comme ça que le système fonctionne, il répare ce qu'il mesure." },
  { p: "Le même mécanisme oriente le travail des titulaires, dont {n:E9} décrivent une charge administrative qui les éloigne de la consultation. Un contre-exemple confirme le thème par l'inverse : dans un centre dont l'équipe a fait inscrire les glycémies dans le rapport mensuel interne, l'approvisionnement est décrit comme régulier." },
  { cite: "P12", codes: ["F4"], t: "Comme titulaire, je vois le travail par les rapports. Et dans les rapports, la tension n'apparaît pas. Alors c'est une chose que l'on fait parce que c'est dans la fiche, pas une chose que l'on suit." },

  { h3: "5.3.4. Thème 5 — Ce que change la dotation, et ce qu'elle ne change pas" },
  { p: "Définition. L'équipement supprime l'inégalité du test, pas celle de l'explication ; et il est réparti au bénéfice des centres déjà les mieux placés." },
  { p: "Les participants des centres dotés confirment que la disponibilité des intrants transforme la pratique : le dépistage glycémique y devient une routine ciblée, tracée dans le registre. Mais l'explication reste soumise au temps disponible, et la modulation décrite au thème 2 y persiste." },
  { cite: "P11", codes: ["C4"], t: "Le matériel ne crée pas de temps. Nous avons les bandelettes, mais quand il y a cinquante femmes, l'explication est plus courte pour celles qui passent en fin de matinée. Le matériel règle l'inégalité du test ; il ne règle pas celle de l'explication." },
  { p: "La distribution des moyens est elle-même perçue comme inégale : {n:H8} participants estiment que le lieu d'exercice décide de ce que reçoivent les femmes, au détriment des centres éloignés. Les participants des centres bien dotés le reconnaissent eux-mêmes." },
  { cite: "P11", codes: ["A4"], t: "Ne présentez pas mon centre comme la preuve que tout est possible. Présentez-le comme la preuve que c'est possible AVEC des moyens. La nuance est importante pour mes collègues des centres ruraux : ils ne font pas moins bien que nous, ils ont moins." },
  { cite: "P21", codes: ["F5"], t: "Les piles, personne n'y pense dans les commandes : on commande des appareils, pas les piles qui les font marcher. Le sucre, nous sommes trop loin pour qu'on pense à nous." },

  { h3: "5.3.5. Thème 3 — Trouver sans pouvoir suivre" },
  { p: "Définition. La détection ne devient une prise en charge que si la référence aboutit et si l'information revient ; elle s'interrompt à l'accouchement et lorsque la femme se déplace." },
  { p: "Tous les participants décrivent la même conduite devant une tension élevée : reprise après repos, recherche de protéines lorsque les bandelettes urinaires sont disponibles, référence vers l'hôpital de district. Les récits divergent sur ce qui suit. Dans les centres éloignés, la référence dépend d'un véhicule, de l'argent de la famille et de la personne qui décide dans le ménage." },
  { cite: "P10", codes: ["I6"], t: "pour nous qui sommes loin, une référence n'est pas une feuille de papier, c'est un véhicule. Tant qu'il n'y a pas de véhicule, la référence est une idée." },
  { cite: "P10", codes: ["B4", "F2"], t: "Nous, nous avions trouvé. Nous avions bien trouvé. Nous avions même bien expliqué. Ça n'a pas suffi." },
  { p: "{n:G4} participants situent l'échec de la référence dans la marge de décision de la femme : l'information a été comprise, mais la décision de partir appartient au conjoint ou à la famille." },
  { cite: "P10", codes: ["C6", "G4"], t: "Ce n'est pas la compréhension qui a manqué. C'est qu'elle n'était pas celle qui décide." },
  { p: "Lorsque la référence aboutit, l'information revient rarement : {n:F3} participants rapportent l'absence de tout retour écrit de l'hôpital. Le professionnel qui revoit la femme doit alors deviner le traitement prescrit. Dans le centre où un volet de retour circule, l'effet inverse est décrit." },
  { cite: "P07", codes: ["I6"], t: "Aujourd'hui je réfère dans le vide. Et tant que je réfère dans le vide, mon dépistage s'arrête à la détection : ce n'est pas un dépistage, c'est un signalement." },
  { cite: "P11", codes: ["F8"], t: "C'est la première fois depuis que je travaille que j'ai ce genre de retour régulièrement. Ça change tout : je ne devine plus." },
  { p: "Deux ruptures prolongent ce thème. La première survient à l'accouchement : {n:F6} participants décrivent des femmes dépistées qui, n'étant plus enceintes ni « malades déclarées », ne relèvent plus d'aucun service. La seconde touche les femmes mobiles, saisonnières ou de passage, pour qui le dépistage s'arrête au moment où elles partent." },
  { cite: "P07", codes: ["F6"], t: "Elles ne sont plus enceintes, donc plus à la CPN ; elles ne sont pas malades déclarées, donc pas à la consultation des chroniques. Elles tombent entre les deux." },
  { cite: "P17", codes: ["F6", "G11"], t: "Le système suppose qu'elle reste au même endroit pendant toute sa grossesse. Beaucoup ne restent pas." },

  { h3: "5.3.6. Conditions sociales perçues" },
  { p: "Les conditions sociales des femmes, telles que les perçoivent les participants, sont dominées par la distance ({n:G2}), le coût et la mutuelle ({n:G1}), et l'instruction ({n:G3}). Le recours tardif et le non-retour sont évoqués par {n:G5} participants sur {N} ; leur explication varie. {n:G6} participants l'attribuent principalement aux femmes elles-mêmes, tandis que {n:G8} désignent aussi le service comme une cause : attente prolongée, visite sans résultat, rupture de matériel." },
  { cite: "P06", codes: ["G5", "G8"], t: "celles qui sont venues une fois et qui ont attendu trois heures pour rien, parce qu'il manquait quelque chose, celles-là ne reviennent pas volontiers. Nous perdons des femmes par nos propres ruptures." },
  { cite: "P11", codes: ["G5"], t: "Une femme m'a dit une fois : « si je ne viens pas, on ne me trouvera pas de maladie ». Ce n'est pas de l'ignorance, c'est une manière de se protéger." },
  { p: "Le recours aux guérisseurs, évoqué par {n:G10} participants de centres éloignés, est décrit sans mépris, comme une ressource de proximité avec laquelle composer." },
  { cite: "P13", codes: ["G10"], t: "Je ne leur en veux pas : l'hôpital est loin, le guérisseur est à côté et il les connaît. Mais je leur demande de ne pas attendre le résultat des plantes pour partir." },
  { p: "Une participante récuse la catégorisation elle-même, en déplaçant l'analyse des groupes de femmes vers les situations." },
  { cite: "P18", codes: ["G4", "H9"], t: "Les différences qui comptent pour le dépistage, ce sont des situations, pas des catégories de femmes : avoir de l'argent pour le transport aujourd'hui, avoir quelqu'un pour garder les enfants, avoir le mari d'accord." },

  { h3: "5.3.7. Thème 6 — Le registre comme écran" },
  { p: "Définition. Un contrôle portant sur la complétude des registres produit de la complétude, et peut rendre invisible l'inégalité qu'il devrait révéler. Ce thème décrit un effet de système, jamais une faute individuelle ; il n'est rapporté en association avec aucun centre." },
  { p: "Plusieurs participants opposent le registre rempli au service rendu. Une participante décrit le mécanisme jusqu'à son terme : sous la pression du nombre, la colonne est remplie même lorsque la mesure n'a pas été faite, parce que c'est la colonne que l'on contrôle." },
  { cite: "P04", codes: ["E4", "F4"], t: "Un registre bien rempli, ça compte plus que ce qu'on a fait. Je peux avoir un beau registre et un mauvais service. Personne ne vérifie la deuxième chose." },
  { cite: "P19", codes: ["F7"], t: "On ne contrôle pas si la tension a été prise : on contrôle si la case est remplie. Alors on remplit la case. Et le dépistage disparaît derrière un registre parfait." },
  { cite: "P19", codes: ["F7"], t: "Dans le registre, toutes les femmes ont une tension. Dans la réalité, certaines n'en ont pas eu. Le registre dit que tout est égal ; c'est faux. Une inégalité qu'on ne voit pas, personne ne la corrigera." },
  { p: "Ce thème repose principalement sur un entretien. Il est conservé parce que l'observation d'un registre le corrobore (section 5.6) et parce qu'il éclaire, par l'inverse, le thème 4 : ce qui n'est pas compté manque, et ce qui est compté peut tromper." },

  { h3: "5.3.8. Thème 7 — Le dépistage hors des murs" },
  { p: "Définition. Les relais communautaires et les initiatives locales prolongent le dépistage là où le système ne prévoit rien. Ils reposent sur une personne : c'est leur force et leur fragilité." },
  { p: "{n:G9} participantes de centres ruraux décrivent un dépistage qui se poursuit hors du centre grâce aux agents de santé communautaire : suivi des femmes référées, signalement des non-retours, explication reprise dans la langue de tous les jours. L'écart ne passe plus alors entre les femmes, mais entre les villages qui ont un agent actif et les autres." },
  { cite: "P15", codes: ["G9"], t: "Il y a les villages où l'agent communautaire est actif et ceux où il ne l'est pas. La différence est grande : dans les premiers, les femmes viennent plus tôt et reviennent. Ce n'est pas la femme qui change, c'est l'agent." },
  { p: "Les mêmes participantes rapportent des initiatives déjà mises en œuvre : une affiche dessinée à la main, un cahier de suivi après l'accouchement, des piles achetées sur fonds propres. Toutes sont portées par une personne, et aucune n'est reconnue comme outil officiel." },
  { cite: "P21", codes: ["I3", "I8"], t: "Parce que mon cahier repose sur moi. Si je pars, il s'arrête. Et pourtant c'est la seule chose ici qui suit ces femmes après la grossesse." },

  { h2: "5.4. Portée reconnue en équité" },
  { p: "La question 19 invitait les participants à dire s'ils jugeaient normales les différences qu'ils avaient décrites. Le mot « équité » n'a jamais été prononcé par l'enquêteur ; il apparaît spontanément dans {v:equiteSpontane} entretiens. Le tableau VIII présente la distribution des jugements et des attributions de responsabilité ; un même participant peut figurer dans plusieurs lignes." },
  { tableau: "equite" },
  { p: "Le jugement dominant est celui d'une inégalité inacceptable ({n:H2} participants). Il s'accompagne le plus souvent d'une attribution au système ({n:H4}) ; mais {n:H5} participants reconnaissent aussi une part qui leur revient, généralement la part de l'explication." },
  { cite: "P07", codes: ["H5"], t: "Il y a l'inégalité qui vient du système — le stock, l'absence de retour, l'absence d'indicateur : celle-là, je la subis autant que les femmes. Et il y a l'inégalité qui vient de moi — le temps que je donne, les mots que je choisis selon la personne que j'ai devant moi : celle-là, elle est à moi, et c'est la seule sur laquelle j'ai prise." },
  { cite: "P09", codes: ["H8"], t: "l'équité, si je comprends bien ce mot — vous ne l'avez pas employé, c'est moi qui le dis — ce n'est pas donner la même chose à tout le monde, c'est faire que le lieu où tu vis ne décide pas de ce que tu reçois. Ici, le lieu décide." },
  { p: "Deux facteurs d'inégalité, nés du codage inductif, traversent les jugements : l'heure d'arrivée ({n:H7}) et le lieu de résidence ou d'exercice ({n:H8}). Dans les deux cas, les participants soulignent que la différence ne dépend pas de la femme." },
  { cite: "P04", codes: ["H7"], t: "Du personnel, du jour de la semaine, de l'heure à laquelle la femme arrive. Vous voyez, ça ne dépend même pas d'elle. C'est le hasard de l'heure. C'est ça qui n'est pas normal." },
  { p: "Une minorité exprime une normalisation ou une résignation ({n:H3}) : l'inégalité est jugée regrettable mais inévitable, « partout pareil », ou temporaire. {n:H6} participants refusent de juger, au motif qu'ils ne décident de rien ou que le centre est trop récent." },
  { cite: "P16", codes: ["H3"], t: "Les femmes qui viennent maintenant ont moins que celles qui viendront dans un an. C'est le prix d'un centre neuf." },
  { cite: "P08", codes: ["H6"], t: "Ce n'est pas à moi de juger. Je fais ce qu'on me demande." },

  { h2: "5.5. Transformations proposées et transformations déjà réalisées" },
  { p: "Invités à désigner une seule priorité, puis ses destinataires, les participants se partagent entre les intrants, la formation, le personnel, la référence et la redevabilité (tableau IX). Le choix est souvent argumenté contre une autre option : l'appareil contre le temps, les bandelettes contre l'explication, le glucomètre contre le transport." },
  { tableau: "transformations" },
  { cite: "P04", codes: ["I3"], t: "Un appareil ne me donne pas de temps. Une personne, oui." },
  { cite: "P02", codes: ["I4"], t: "Si j'ai une image à montrer, je donne la même chose à celle qui a fait l'école et à celle qui ne l'a pas faite. Ça corrige mon propre biais. Les bandelettes ne le corrigent pas." },
  { p: "La proposition d'un indicateur ({n:I5} participants) se distingue des autres parce qu'elle vise le mécanisme du thème 4 plutôt que l'un de ses effets." },
  { cite: "P09", codes: ["I5"], t: "Une seule ligne dans le rapport mensuel : nombre de femmes dont la tension a été mesurée, nombre de tensions élevées trouvées, nombre référées." },
  { cite: "P01", codes: ["I5", "I7"], t: "S'il est demandé, qu'il entre dans les indicateurs et que les intrants suivent. S'il n'est pas demandé, qu'on nous le dise, et nous arrêterons de faire semblant." },
  { p: "Les destinataires désignés sont d'abord le district (supervision, approvisionnement, maintenance), puis l'hôpital (retour d'information). Plusieurs demandes portent sur la manière de regarder plutôt que sur des moyens : venir observer une matinée entière, sans prévenir, et vérifier si la tension est prise et non si elle est écrite. Enfin, {n:I8} participantes ne proposent pas seulement des transformations : elles en décrivent qu'elles ont déjà réalisées (section 5.3.8)." },

  { h2: "5.6. Triangulation avec l'observation et les données de routine" },
  { p: "Sur les {v:nbCentres} centres observés, {v:nbConstats} ont fait l'objet d'un constat consigné de confrontation entre propos et observation : {v:nbEcarts} écarts et {v:nbConcordances} concordances (tableau X). Aucun écart n'est imputé à une intention du participant ; un écart renseigne sur la distance entre la norme intériorisée et la condition d'exercice." },
  { tableau: "triangulation" },
  { p: "Les données de routine du district ({v:sourceRoutine}) caractérisent le contexte sans mesurer la pratique de dépistage. Rapportées à la catégorie de pauvreté du secteur, elles montrent un premier contact plus tardif et une rétention plus faible jusqu'à la quatrième visite dans les secteurs les plus pauvres (tableau XI). Le dépistage glycémique n'y est pas collecté, ce qui confirme, du côté du système d'information, le constat du thème 4." },
  { tableau: "routine" },
  { encadre: "Réserve sur les données de routine", t: "{v:reserveRoutine}" },

  { h2: "5.7. Synthèse des résultats" },
  { p: "Le tableau XII rassemble les sept thèmes. Pris ensemble, ils décrivent un dépistage dont la réalisation dépend moins de la volonté ou de la compétence des professionnels que de conditions qu'ils ne maîtrisent pas : le matériel, le temps, le véhicule, l'indicateur. Mais les participants identifient aussi une part qui leur revient — l'explication — et des initiatives locales qui réduisent une partie de l'écart. Ce double constat, systémique et professionnel, est repris dans la discussion." },
  { tableau: "themes" },
];

// Constats de triangulation tels qu'ils figurent dans le chapitre. Ceux du
// projet (mémo « Triangulation ») sont rédigés pour la piste d'audit : ils
// associent un propos au code d'un centre, désignent parfois la fonction de
// la personne (« la titulaire ») et citent ses mots. Ici, aucun code de centre,
// aucune fonction, aucune citation : seulement ce que la confrontation établit.
// faire-resultats.mjs exige une formulation pour chaque constat du projet.
export const constatsChapitre = {
  CS11: "Dans un centre rural, la tension est déclarée prise à toutes les femmes ; le registre observé présente de nombreuses valeurs manquantes (quatorze sur une page de trente lignes) et l'appareil électronique est hors d'usage. Un second entretien conduit dans le même centre décrit ces mesures manquantes.",
  CS02: "Dans un centre urbain, l'explication du résultat est décrite comme individualisée ; la configuration observée — constantes prises dans le couloir d'attente, valeurs annoncées à voix audible — rend cette individualisation difficile à tenir.",
  CS14: "Une vérification hebdomadaire de la colonne tension est déclarée ; le registre observé est le mieux tenu des centres ruraux de la première vague.",
  CS07: "L'absence de toute glycémie réalisée, déclarée en entretien, correspond à l'absence de glucomètre constatée : la déclaration s'explique par la condition matérielle, non par une pratique individuelle.",
  CS13: "Un registre intégralement renseigné présente une proportion inhabituelle de valeurs identiques ; il corrobore un propos recueilli sur le remplissage des registres (thème 6). Ni l'un ni l'autre ne prouve rien sur une personne.",
  CS01: "Le dépistage glycémique ciblé décrit en entretien est observé directement, et la colonne glycémie du registre est renseignée dans une proportion compatible avec un dépistage ciblé.",
  CS05: "Le paradoxe décrit — glucomètre fonctionnel, bandelettes périmées — est constaté ; il conduit à distinguer, dans la grille, le matériel « présent » du matériel « utilisable ».",
  CS16: "Le cahier de suivi après l'accouchement décrit en entretien est observé ; les piles du tensiomètre sont signalées comme un intrant manquant de façon répétée.",
};
