// Projet exemple : entretiens fictifs sur le télétravail (pour la prise en main)
import { emptyProject, uid, CODE_COLORS } from "./state.js";

export function buildSampleProject() {
  const p = emptyProject("Exemple — Étude sur le télétravail");
  p.memo = "Projet de démonstration : trois entretiens semi-directifs et un focus group fictifs sur le vécu du télétravail. Utilisez-le pour tester le codage, la récupération de segments et les analyses.";
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

  // Segments pré-codés (localisés par recherche de sous-chaîne pour rester robustes)
  const seg = (doc, code, needle) => {
    const start = doc.text.indexOf(needle);
    if (start === -1) return null;
    return { id: uid(), docId: doc.id, codeId: code.id, start, end: start + needle.length, text: needle, weight: 1, comment: "", created: new Date().toISOString() };
  };
  const segments = [
    seg(doc1, cConc, "Le matin, je suis beaucoup plus concentrée qu'au bureau, il n'y a pas d'interruptions, pas de collègues qui passent à l'improviste."),
    seg(doc1, cFatigue, "On enchaîne parfois quatre ou cinq visios et à la fin de la journée je suis épuisée, plus fatiguée qu'après une journée au bureau."),
    seg(doc1, cFront, "Mon bureau est dans le salon, donc le soir je vois l'ordinateur et j'ai du mal à décrocher. Il m'arrive de répondre à des courriels à vingt-deux heures."),
    seg(doc1, cIso, "En télétravail, je me sens parfois isolée, même si on a des canaux de discussion en ligne."),
    seg(doc1, cFlex, "Je gagne trois heures de transport par jour, c'est du temps pour ma famille et pour le sport."),
    seg(doc2, cMateriel, "J'habite dans un petit studio, je travaille sur la table de la cuisine. Ce n'est pas confortable, j'ai mal au dos et je n'ai pas de deuxième écran."),
    seg(doc2, cIso, "À distance, je n'ose pas déranger, j'attends la prochaine réunion."),
    seg(doc2, cFlex, "Je peux aller à la salle de sport le midi, je fais des économies de transport et de repas."),
    seg(doc2, cConc, "pour les tâches répétitives, franchement, je suis plus efficace chez moi, personne ne me sollicite."),
    seg(doc2, cManag, "des points réguliers avec mon manager. Parfois je me sens un peu abandonné, je ne sais pas si ce que je fais va dans la bonne direction."),
    seg(doc3, cFront, "Le soir, je ferme la porte et le travail reste derrière. C'est ma frontière à moi."),
    seg(doc3, cForm, "L'entreprise n'a pas proposé assez de formation aux outils numériques, tout le monde s'est débrouillé."),
    seg(doc3, cManag, "Mon chef est passé d'un contrôle des horaires à un suivi par objectifs."),
    seg(doc3, cConc, "Moins de bruit, moins de fatigue, plus de concentration."),
    seg(doc4, cEquite, "Les métiers qui ne peuvent pas télétravailler, l'accueil, la logistique, vivent mal le fait que d'autres soient chez eux. On a un vrai sujet de justice interne."),
    seg(doc4, cFatigue, "la fatigue liée aux visioconférences"),
    seg(doc4, cIso, "le sentiment d'isolement chez les nouveaux embauchés. L'intégration à distance ne fonctionne pas bien."),
    seg(doc4, cFront, "On a des salariés qui envoient des courriels le soir et le week-end."),
    seg(doc4, cManag, "On forme aussi les managers au management à distance : fixer des objectifs, faire des points réguliers, repérer les signaux d'isolement."),
    seg(doc4, cForm, "Il reste le chantier de la formation aux outils pour les salariés les plus éloignés du numérique."),
  ].filter(Boolean);
  p.segments.push(...segments);

  p.memos.push({
    id: uid(), targetType: "code", targetId: cIso.id, title: "Définition",
    text: "Coder ici tout passage exprimant un sentiment de solitude, de perte de lien avec le collectif, ou une difficulté d'intégration liée à la distance.",
    created: new Date().toISOString(),
  });
  p.memos.push({
    id: uid(), targetType: "document", targetId: doc2.id, title: "Impression générale",
    text: "Profil junior : le télétravail interroge surtout l'apprentissage du métier et l'accompagnement managérial. À comparer avec les profils expérimentés.",
    created: new Date().toISOString(),
  });

  return p;
}
