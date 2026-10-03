// Projet exemple : entretiens fictifs sur le télétravail (pour la prise en main)
import { emptyProject, uid, CODE_COLORS } from "./state.js";

export function buildSampleProject() {
  const p = emptyProject("Exemple — Étude sur le télétravail (analyse terminée)");
  p.id = "exemple-teletravail"; // identifiant stable : recharger l'exemple le remplace au lieu de le dupliquer
  p.memo = `ÉTUDE TERMINÉE — démonstration du processus complet d'analyse dans QualiCode (données fictives).

QUESTION DE RECHERCHE — Comment les salariés vivent-ils le télétravail, et quelles conditions organisationnelles rendent ce vécu positif ?

MÉTHODE — 3 entretiens semi-directifs (profils contrastés : expérimentée avec enfants, junior en studio, sénior réticente devenue convaincue) + 1 focus group RH. Analyse thématique (Braun & Clarke) : codage descriptif, regroupement en 3 thèmes (Avantages perçus, Difficultés, Organisation et management), codage complet, puis croisements par variables (âge, ancienneté de télétravail).

RÉSULTATS PRINCIPAUX —
1. Les avantages (concentration, flexibilité, temps gagné) sont unanimes et non négociables : personne ne veut revenir au bureau à temps plein.
2. Les difficultés dominantes sont la frontière vie pro/vie perso et l'isolement ; elles frappent différemment selon les profils : le junior (Karim) souffre d'un déficit d'apprentissage et de matériel, l'expérimentée (Aline) de la porosité des temps, la sénior (Marguerite) a construit des stratégies (pièce dédiée, porte fermée).
3. La variable décisive n'est pas l'âge mais l'ANCIENNETÉ de télétravail : avec le temps, chacun construit des stratégies de séparation — voir la requête sauvegardée « Frontière vie pro/perso (tous) » et la comparaison par variable.
4. Côté organisation : le management par objectifs est apprécié mais ambivalent (sentiment de surveillance par le reporting) ; les réponses RH (budget équipement, jours communs, formation des managers) répondent point par point aux difficultés exprimées — voir la carte conceptuelle « Modèle des résultats ».

RÉPONSE À LA QUESTION — Le vécu est positif quand trois conditions sont réunies : un espace de travail dédié, un cadre collectif clair (jours fixes, droit à la déconnexion appliqué) et un management par objectifs accompagné (points réguliers).

LIMITES — Corpus fictif de démonstration ; en situation réelle, viser la saturation (8–15 entretiens) et un double codage avec kappa (voir Guide, section 12).`;
  p.variables = ["âge", "sexe", "secteur", "ancienneté_télétravail"];

  const gEntretiens = { id: uid(), name: "Entretiens individuels" };
  const gFocus = { id: uid(), name: "Groupes de discussion" };
  p.documentGroups.push(gEntretiens, gFocus);

  const doc1 = {
    id: uid(), name: "Entretien 01 — Aline", groupId: gEntretiens.id,
    variables: { "âge": "34", "sexe": "F", "secteur": "Informatique", "ancienneté_télétravail": "4 ans" },
    created: new Date().toISOString(),
    text:
`Enquêteur : Pouvez-vous me décrire une journée type en télétravail ?
Aline : Je commence vers huit heures et demie, après avoir déposé les enfants à l'école. Le matin, je suis beaucoup plus concentrée qu'au bureau, il n'y a pas d'interruptions, pas de collègues qui passent à l'improviste. Je fais mes tâches de fond, celles qui demandent de la réflexion.
Enquêteur : Et l'après-midi ?
Aline : L'après-midi, c'est plutôt les réunions en visioconférence. Honnêtement, il y en a trop. On enchaîne parfois quatre ou cinq visios et à la fin de la journée je suis épuisée, plus fatiguée qu'après une journée au bureau.
Enquêteur : Comment vivez-vous la séparation entre vie professionnelle et vie personnelle ?
Aline : C'est le point noir. Mon bureau est dans le salon, donc le soir je vois l'ordinateur et j'ai du mal à décrocher. Il m'arrive de répondre à des courriels à vingt-deux heures. Mon conjoint me le reproche souvent.
Enquêteur : Qu'est-ce qui vous manque le plus du bureau ?
Aline : Les discussions informelles, clairement. La machine à café, les déjeuners d'équipe. C'est là que circulent les informations importantes et qu'on garde le lien. En télétravail, je me sens parfois isolée, même si on a des canaux de discussion en ligne.
Enquêteur : Souhaiteriez-vous revenir au bureau à temps plein ?
Aline : Non, certainement pas. L'idéal pour moi, c'est deux jours au bureau, trois jours à la maison. Je gagne trois heures de transport par jour, c'est du temps pour ma famille et pour le sport. Je ne suis pas prête à y renoncer.`
  };

  const doc2 = {
    id: uid(), name: "Entretien 02 — Karim", groupId: gEntretiens.id,
    variables: { "âge": "27", "sexe": "M", "secteur": "Banque", "ancienneté_télétravail": "1 an" },
    created: new Date().toISOString(),
    text:
`Enquêteur : Depuis quand télétravaillez-vous ?
Karim : Depuis un an environ, deux jours par semaine. C'est ma première expérience professionnelle, j'ai été embauché juste avant.
Enquêteur : Comment cela se passe-t-il ?
Karim : C'est mitigé. J'habite dans un petit studio, je travaille sur la table de la cuisine. Ce n'est pas confortable, j'ai mal au dos et je n'ai pas de deuxième écran. Le matériel, c'est un vrai problème que l'entreprise ne prend pas au sérieux.
Enquêteur : Et sur le plan de l'apprentissage du métier ?
Karim : C'est ma grande inquiétude. Au bureau, j'apprends en écoutant les collègues, en posant des questions à côté de moi. À distance, je n'ose pas déranger, j'attends la prochaine réunion. J'ai l'impression de progresser moins vite que si j'étais sur place tous les jours.
Enquêteur : Qu'est-ce que le télétravail vous apporte malgré tout ?
Karim : La flexibilité. Je peux aller à la salle de sport le midi, je fais des économies de transport et de repas. Et pour les tâches répétitives, franchement, je suis plus efficace chez moi, personne ne me sollicite.
Enquêteur : Que faudrait-il améliorer selon vous ?
Karim : Un vrai budget pour l'équipement à domicile, et des points réguliers avec mon manager. Parfois je me sens un peu abandonné, je ne sais pas si ce que je fais va dans la bonne direction.`
  };

  const doc3 = {
    id: uid(), name: "Entretien 03 — Marguerite", groupId: gEntretiens.id,
    variables: { "âge": "52", "sexe": "F", "secteur": "Administration", "ancienneté_télétravail": "3 ans" },
    created: new Date().toISOString(),
    text:
`Enquêteur : Quel est votre rapport au télétravail ?
Marguerite : Au début, j'étais très réticente. Je pensais que le travail, c'était un lieu, des horaires, des collègues. J'ai mis six mois à m'y faire. Maintenant, je ne pourrais plus m'en passer, au moins pour une partie de la semaine.
Enquêteur : Qu'est-ce qui a changé ?
Marguerite : J'ai aménagé une vraie pièce de travail dans l'ancienne chambre de ma fille. Une porte que je peux fermer, ça change tout. Le soir, je ferme la porte et le travail reste derrière. C'est ma frontière à moi.
Enquêteur : Et avec vos collègues plus jeunes ?
Marguerite : Je vois bien que les jeunes collègues sont plus à l'aise avec les outils, les visios, les messageries. Moi, j'ai dû me former sur le tas. L'entreprise n'a pas proposé assez de formation aux outils numériques, tout le monde s'est débrouillé.
Enquêteur : Le management a-t-il évolué ?
Marguerite : Mon chef est passé d'un contrôle des horaires à un suivi par objectifs. Pour moi, c'est mieux : on me juge sur ce que je produis, pas sur ma présence. Mais certains collègues le vivent mal, ils ont l'impression d'être surveillés autrement, par les outils de reporting.
Enquêteur : Un dernier mot ?
Marguerite : Le télétravail m'a réconciliée avec mon métier. Moins de bruit, moins de fatigue, plus de concentration. Mais il faut un cadre : des jours fixes, des règles claires, sinon chacun fait n'importe quoi et le collectif se délite.`
  };

  const doc4 = {
    id: uid(), name: "Focus group — Service RH", groupId: gFocus.id,
    variables: { "secteur": "Ressources humaines" },
    created: new Date().toISOString(),
    text:
`Animatrice : Quels retours recevez-vous des équipes sur le télétravail ?
Participant 1 : Le premier sujet, c'est l'équité. Les métiers qui ne peuvent pas télétravailler, l'accueil, la logistique, vivent mal le fait que d'autres soient chez eux. On a un vrai sujet de justice interne.
Participante 2 : Nous, ce qu'on voit remonter, c'est la fatigue liée aux visioconférences et le sentiment d'isolement chez les nouveaux embauchés. L'intégration à distance ne fonctionne pas bien.
Participant 3 : Et il y a la question du droit à la déconnexion. On a des salariés qui envoient des courriels le soir et le week-end. La charte existe, mais elle n'est pas appliquée.
Animatrice : Quelles actions avez-vous mises en place ?
Participante 2 : Un budget équipement de deux cents euros par salarié, et des jours de présence communs par équipe pour recréer du collectif.
Participant 1 : On forme aussi les managers au management à distance : fixer des objectifs, faire des points réguliers, repérer les signaux d'isolement. C'est un changement de culture profond.
Participant 3 : Il reste le chantier de la formation aux outils pour les salariés les plus éloignés du numérique. On l'a sous-estimé au départ.`
  };

  p.documents.push(doc1, doc2, doc3, doc4);

  // Système de codes hiérarchique
  const mk = (name, parentId, colorIdx) => ({ id: uid(), name, parentId, color: CODE_COLORS[colorIdx % CODE_COLORS.length], created: new Date().toISOString() });
  const cAvantages = mk("Avantages perçus", null, 3);
  const cConc = mk("Concentration / efficacité", cAvantages.id, 3);
  const cFlex = mk("Flexibilité / temps gagné", cAvantages.id, 6);
  const cDiff = mk("Difficultés", null, 0);
  const cIso = mk("Isolement social", cDiff.id, 0);
  const cFront = mk("Frontière vie pro / vie perso", cDiff.id, 1);
  const cFatigue = mk("Fatigue numérique", cDiff.id, 7);
  const cMateriel = mk("Matériel et espace de travail", cDiff.id, 8);
  const cOrg = mk("Organisation et management", null, 4);
  const cManag = mk("Management à distance", cOrg.id, 4);
  const cForm = mk("Formation aux outils", cOrg.id, 5);
  const cEquite = mk("Équité / justice interne", cOrg.id, 10);
  p.codes.push(cAvantages, cConc, cFlex, cDiff, cIso, cFront, cFatigue, cMateriel, cOrg, cManag, cForm, cEquite);

  // Segments codés (localisés par recherche de sous-chaîne pour rester robustes),
  // avec poids (1–100 : importance analytique) et commentaires d'analyse
  const seg = (doc, code, needle, weight = 1, comment = "") => {
    const start = doc.text.indexOf(needle);
    if (start === -1) return null;
    return { id: uid(), docId: doc.id, codeId: code.id, start, end: start + needle.length, text: needle, weight, comment, created: new Date().toISOString() };
  };
  const segments = [
    // — Entretien 01 : Aline (expérimentée, bureau dans le salon)
    seg(doc1, cConc, "Le matin, je suis beaucoup plus concentrée qu'au bureau, il n'y a pas d'interruptions, pas de collègues qui passent à l'improviste.", 60),
    seg(doc1, cFatigue, "On enchaîne parfois quatre ou cinq visios et à la fin de la journée je suis épuisée, plus fatiguée qu'après une journée au bureau.", 70, "Paradoxe : le télétravail fatigue autrement (écrans), pas moins."),
    seg(doc1, cFront, "Mon bureau est dans le salon, donc le soir je vois l'ordinateur et j'ai du mal à décrocher. Il m'arrive de répondre à des courriels à vingt-deux heures.", 85, "Cas type de porosité des temps : l'espace non séparé entraîne le débordement horaire. Contraster avec Marguerite (porte fermée)."),
    seg(doc1, cIso, "En télétravail, je me sens parfois isolée, même si on a des canaux de discussion en ligne.", 50),
    seg(doc1, cIso, "Les discussions informelles, clairement. La machine à café, les déjeuners d'équipe. C'est là que circulent les informations importantes et qu'on garde le lien.", 70, "L'informel comme canal d'information : la perte invisible du distanciel."),
    seg(doc1, cFlex, "Je gagne trois heures de transport par jour, c'est du temps pour ma famille et pour le sport.", 65),
    seg(doc1, cFlex, "L'idéal pour moi, c'est deux jours au bureau, trois jours à la maison.", 55, "Préférence hybride 2/3 — à confronter au « cadre » réclamé par Marguerite."),
    // — Entretien 02 : Karim (junior, studio, 1 an d'ancienneté)
    seg(doc2, cMateriel, "J'habite dans un petit studio, je travaille sur la table de la cuisine. Ce n'est pas confortable, j'ai mal au dos et je n'ai pas de deuxième écran.", 80, "Inégalité matérielle : condition de logement = condition de travail."),
    seg(doc2, cMateriel, "Un vrai budget pour l'équipement à domicile", 60, "Revendication reprise presque mot pour mot par la RH (budget 200 €) : croisement doc2 × doc4."),
    seg(doc2, cIso, "À distance, je n'ose pas déranger, j'attends la prochaine réunion.", 75, "Frein à l'apprentissage informel chez le junior."),
    seg(doc2, cIso, "J'ai l'impression de progresser moins vite que si j'étais sur place tous les jours.", 80, "Coût d'apprentissage du distanciel pour les nouveaux entrants — rejoint le constat RH sur l'intégration."),
    seg(doc2, cFlex, "Je peux aller à la salle de sport le midi, je fais des économies de transport et de repas.", 50),
    seg(doc2, cConc, "pour les tâches répétitives, franchement, je suis plus efficace chez moi, personne ne me sollicite.", 45),
    seg(doc2, cManag, "des points réguliers avec mon manager. Parfois je me sens un peu abandonné, je ne sais pas si ce que je fais va dans la bonne direction.", 75, "Besoin d'accompagnement managérial rapproché en début de carrière."),
    // — Entretien 03 : Marguerite (sénior, pièce dédiée, convertie)
    seg(doc3, cFront, "J'ai aménagé une vraie pièce de travail dans l'ancienne chambre de ma fille. Une porte que je peux fermer, ça change tout.", 90, "Stratégie spatiale de séparation — la « porte » comme frontière matérielle ET symbolique."),
    seg(doc3, cFront, "Le soir, je ferme la porte et le travail reste derrière. C'est ma frontière à moi.", 85, "Verbatim clé du thème : la frontière se construit."),
    seg(doc3, cForm, "L'entreprise n'a pas proposé assez de formation aux outils numériques, tout le monde s'est débrouillé.", 70),
    seg(doc3, cForm, "Moi, j'ai dû me former sur le tas.", 40),
    seg(doc3, cManag, "Mon chef est passé d'un contrôle des horaires à un suivi par objectifs.", 65),
    seg(doc3, cManag, "on me juge sur ce que je produis, pas sur ma présence. Mais certains collègues le vivent mal, ils ont l'impression d'être surveillés autrement, par les outils de reporting.", 80, "Ambivalence du management par objectifs : autonomie pour les uns, surveillance algorithmique pour les autres."),
    seg(doc3, cConc, "Moins de bruit, moins de fatigue, plus de concentration.", 55),
    seg(doc3, cOrg, "il faut un cadre : des jours fixes, des règles claires, sinon chacun fait n'importe quoi et le collectif se délite.", 85, "Verbatim de conclusion : l'adhésion au télétravail passe par un cadre collectif."),
    // — Focus group RH
    seg(doc4, cEquite, "Les métiers qui ne peuvent pas télétravailler, l'accueil, la logistique, vivent mal le fait que d'autres soient chez eux. On a un vrai sujet de justice interne.", 90, "Angle mort des entretiens individuels : l'équité entre télétravaillables et non-télétravaillables."),
    seg(doc4, cFatigue, "la fatigue liée aux visioconférences", 60, "Triangulation : confirme le vécu d'Aline au niveau collectif."),
    seg(doc4, cIso, "le sentiment d'isolement chez les nouveaux embauchés. L'intégration à distance ne fonctionne pas bien.", 85, "Triangulation : confirme le vécu de Karim au niveau collectif."),
    seg(doc4, cFront, "On a des salariés qui envoient des courriels le soir et le week-end.", 70),
    seg(doc4, cFront, "La charte existe, mais elle n'est pas appliquée.", 75, "Écart règle/pratique sur le droit à la déconnexion."),
    seg(doc4, cMateriel, "Un budget équipement de deux cents euros par salarié", 55, "Réponse organisationnelle au problème soulevé par Karim."),
    seg(doc4, cOrg, "des jours de présence communs par équipe pour recréer du collectif", 60),
    seg(doc4, cManag, "On forme aussi les managers au management à distance : fixer des objectifs, faire des points réguliers, repérer les signaux d'isolement.", 70),
    seg(doc4, cManag, "C'est un changement de culture profond.", 45),
    seg(doc4, cForm, "Il reste le chantier de la formation aux outils pour les salariés les plus éloignés du numérique.", 65, "Rejoint le vécu de Marguerite (« formée sur le tas »)."),
  ].filter(Boolean);
  p.segments.push(...segments);

  // ── Mémos : définitions des codes (grille de codage) et impressions par document
  const memo = (targetType, targetId, title, text) =>
    p.memos.push({ id: uid(), targetType, targetId, title, text, created: new Date().toISOString() });

  memo("code", cAvantages.id, "Définition",
    "THÈME 1. Tout bénéfice attribué au télétravail par la personne (concentration, flexibilité, économies, qualité de vie). Règle : coder le bénéfice VÉCU, pas les généralités (« on dit que… »).");
  memo("code", cDiff.id, "Définition",
    "THÈME 2. Toute difficulté, coût ou risque attribué au télétravail. Sous-codes : isolement, frontière vie pro/perso, fatigue numérique, matériel. Un même passage peut porter deux sous-codes.");
  memo("code", cOrg.id, "Définition",
    "THÈME 3. Ce qui relève de l'entreprise et du collectif : pratiques managériales, formation, équité, règles communes. C'est le thème des LEVIERS d'action.");
  memo("code", cIso.id, "Définition",
    "Coder ici tout passage exprimant un sentiment de solitude, de perte de lien avec le collectif, ou une difficulté d'intégration/apprentissage liée à la distance.");
  memo("code", cFront.id, "Définition + analyse",
    "Passages sur la (non-)séparation des temps et des espaces. RÉSULTAT : la frontière n'est pas donnée, elle se CONSTRUIT (pièce dédiée de Marguerite vs salon d'Aline) — c'est l'ancienneté de télétravail qui fait la différence, pas l'âge.");
  memo("code", cManag.id, "Définition + analyse",
    "Pratiques d'encadrement à distance. RÉSULTAT : le passage au management par objectifs est apprécié mais ambivalent (autonomie ↔ sentiment de surveillance par le reporting). Le besoin de points réguliers est maximal chez le junior.");
  memo("document", doc1.id, "Impression générale",
    "Profil expérimenté avec charge familiale : adhésion forte (gain de temps) mais porosité des temps maximale — bureau dans le salon, courriels tardifs. Cas d'école pour le thème Frontière.");
  memo("document", doc2.id, "Impression générale",
    "Profil junior : le télétravail interroge surtout l'apprentissage du métier, le matériel et l'accompagnement managérial. Contre-cas des récits enthousiastes.");
  memo("document", doc3.id, "Impression générale",
    "Profil sénior « convertie » : trajectoire réticence → adhésion. Porteuse des stratégies gagnantes (pièce dédiée, cadre, objectifs). Verbatims de conclusion du rapport.");
  memo("document", doc4.id, "Impression générale",
    "Regard organisationnel : triangule les trois entretiens (fatigue visio, isolement des nouveaux, déconnexion) et ajoute l'angle mort de l'équité interne. Les actions RH répondent point par point aux difficultés individuelles.");

  // ── Requêtes sauvegardées (combinaisons de filtres prêtes à rejouer)
  const allDocs = [doc1.id, doc2.id, doc3.id, doc4.id];
  const q = (name, docs, codes, mode) =>
    p.savedQueries.push({ id: uid(), name, activatedDocs: docs, activatedCodes: codes, retrievalMode: mode, created: new Date().toISOString() });
  q("Frontière vie pro/perso (tous les documents)", allDocs, [cFront.id], "or");
  q("Toutes les difficultés — entretiens individuels", [doc1.id, doc2.id, doc3.id], [cIso.id, cFront.id, cFatigue.id, cMateriel.id], "or");
  q("Avantages perçus (tous)", allDocs, [cConc.id, cFlex.id], "or");
  q("Leviers organisationnels (focus group)", [doc4.id], [cManag.id, cForm.id, cEquite.id, cOrg.id], "or");

  // ── Carte conceptuelle : le modèle final des résultats
  const n = (label, x, y, color, w) => ({ id: uid(), label, x, y, color, width: w, height: 36 });
  const nVecu = n("VÉCU DU TÉLÉTRAVAIL", 430, 40, "#3a7ca5", 200);
  const nAvant = n("Avantages : concentration, flexibilité", 120, 150, "#2e9e6b", 250);
  const nDiff = n("Difficultés : isolement, frontière, fatigue", 430, 260, "#d64545", 260);
  const nStrat = n("Stratégies individuelles (pièce dédiée, porte fermée)", 120, 370, "#e8a33d", 260);
  const nCadre = n("Cadre collectif (jours fixes, déconnexion)", 740, 150, "#7b5ea7", 250);
  const nManag = n("Management par objectifs + points réguliers", 740, 370, "#2ec4b6", 260);
  const e = (from, to, label) => ({ id: uid(), from: from.id, to: to.id, label });
  p.conceptMaps.push({
    id: uid(), name: "Modèle des résultats",
    nodes: [nVecu, nAvant, nDiff, nStrat, nCadre, nManag],
    edges: [
      e(nAvant, nVecu, "renforce l'adhésion"),
      e(nDiff, nVecu, "fragilise"),
      e(nStrat, nDiff, "atténue (avec l'ancienneté)"),
      e(nCadre, nDiff, "prévient"),
      e(nManag, nDiff, "atténue (surtout juniors)"),
      e(nManag, nVecu, "ambivalent : autonomie / surveillance"),
    ],
  });

  // ── Références bibliographiques (chapitre Références du rapport)
  const ref = (type, authors, year, title, container, publisher, doi) =>
    p.bibliography.push({ id: uid(), type, authors, year, title, container, publisher, volume: "", issue: "", pages: "", doi });
  ref("article", ["Braun, V.", "Clarke, V."], "2006", "Using thematic analysis in psychology", "Qualitative Research in Psychology, 3(2)", "", "10.1191/1478088706qp063oa");
  ref("book", ["Paillé, P.", "Mucchielli, A."], "2021", "L'analyse qualitative en sciences humaines et sociales (5e éd.)", "", "Armand Colin", "");
  ref("article", ["Vayre, É."], "2019", "Les incidences du télétravail sur le travailleur dans les domaines professionnel, familial et social", "Le travail humain, 82(1)", "", "10.3917/th.821.0001");

  return p;
}
