import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
        Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle, PageBreak } = require("docx");
import { ETUDE } from "./echantillon.mjs";

const L = 9026;
const p = (t, o = {}) => new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: t, size: 21, ...o })] });
const h1 = t => new Paragraph({ text: t, heading: HeadingLevel.HEADING_1 });
const h2 = t => new Paragraph({ text: t, heading: HeadingLevel.HEADING_2 });
const h3 = t => new Paragraph({ text: t, heading: HeadingLevel.HEADING_3 });
const vide = () => new Paragraph({ text: "" });
const saut = () => new Paragraph({ children: [new PageBreak()] });
const puce = t => new Paragraph({ spacing: { after: 60 }, bullet: { level: 0 }, children: [new TextRun({ text: t, size: 21 })] });

const cel = (t, { gras = false, fond = null, l } = {}) => new TableCell({
  width: { size: l, type: WidthType.DXA },
  shading: fond ? { type: ShadingType.CLEAR, fill: fond, color: "auto" } : undefined,
  margins: { top: 70, bottom: 70, left: 110, right: 110 },
  children: String(t).split("\n").map(x => new Paragraph({ children: [new TextRun({ text: x, bold: gras, size: 20 })] })),
});
const tab = (lignes, larg) => new Table({
  width: { size: L, type: WidthType.DXA }, columnWidths: larg,
  rows: lignes.map((ln, i) => new TableRow({ tableHeader: i === 0,
    children: ln.map((c, j) => cel(c, { gras: i === 0, fond: i === 0 ? "E8EDF2" : null, l: larg[j] })) })),
});
const encadre = (titre, lignes, couleur = "C0392B", fond = "FDEDEC") => new Table({
  width: { size: L, type: WidthType.DXA }, columnWidths: [L],
  borders: { top: { style: BorderStyle.SINGLE, size: 10, color: couleur }, bottom: { style: BorderStyle.SINGLE, size: 10, color: couleur },
             left: { style: BorderStyle.SINGLE, size: 24, color: couleur }, right: { style: BorderStyle.SINGLE, size: 10, color: couleur } },
  rows: [new TableRow({ children: [new TableCell({
    width: { size: L, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: fond, color: "auto" },
    margins: { top: 140, bottom: 140, left: 180, right: 160 },
    children: [new Paragraph({ children: [new TextRun({ text: titre, bold: true, size: 22, color: couleur })] }),
      ...lignes.map(x => new Paragraph({ spacing: { before: 60 }, children: [new TextRun({ text: x, size: 20 })] }))],
  })] })],
});

const enfants = [
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 300, after: 80 },
    children: [new TextRun({ text: "UNIVERSITÉ DE PARAKOU — ENATSE", bold: true, size: 22 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 260 },
    children: [new TextRun({ text: ETUDE.titre, italics: true, size: 21 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 },
    children: [new TextRun({ text: "Conduire ce mémoire dans QualiCode", bold: true, size: 34 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 300 },
    children: [new TextRun({ text: "Guide pas à pas, adossé au § 4.2.6 du protocole", size: 22, color: "26567D" })] }),
  encadre("⚠ Le projet d'exercice contient des données entièrement simulées", [
    "Les dix entretiens et les cinq observations livrés avec ce guide n'existent pas. Ils servent à apprendre les gestes de l'outil avant la collecte réelle.",
    "Aucun extrait ne peut être cité. Aucun chiffre ne peut être rapporté. Aucun de ces documents ne doit être présenté à un comité d'éthique ou à un jury comme une donnée de terrain.",
    "Quand la collecte réelle commencera, créez un projet NEUF (Accueil ▸ Nouveau projet). N'ajoutez jamais un entretien réel dans le projet d'exercice.",
  ]),
  saut(),

  h1("1. Avant tout : ne pas perdre le corpus"),
  p("Cette section passe avant l'analyse, parce qu'un corpus perdu ne se refait pas. Un navigateur considère par défaut les données d'un site comme jetables : il peut les effacer pour libérer de la place, et Safari sur iPhone efface celles d'un site non installé après sept jours sans visite."),
  vide(),
  tab([
    ["À faire", "Pourquoi", "Quand"],
    ["Installer QualiCode (bouton 📲 Installer l'application, onglet Accueil)", "C'est l'installation qui obtient du navigateur le statut de stockage durable — et, sur iPhone, ce qui empêche l'effacement automatique", "Une fois, maintenant"],
    ["Exporter le projet : Accueil ▸ Enregistrer (.projx)", "C'est votre seule vraie sauvegarde. Le fichier .projx contient tout : documents, codes, segments, mémos", "Après CHAQUE séance de travail"],
    ["Copier le .projx sur un autre support (clé USB, courriel à vous-même, cloud)", "Un disque qui meurt emporte l'appareil et l'application avec lui", "Chaque semaine"],
    ["Ne jamais travailler en navigation privée", "Tout est effacé à la fermeture de la fenêtre, sans avertissement", "Toujours"],
    ["Vérifier le témoin en bas à droite : « ✓ Sauvegarde automatique effectuée »", "S'il passe au rouge « NON ENREGISTRÉ », exportez immédiatement avant de fermer", "D'un coup d'œil, en travaillant"],
  ], [2900, 4300, 1826]),
  vide(),
  p("Repère de version : la barre d'état affiche l'empreinte de la version publiée (⟳ suivi d'un code et d'une date). Si une nouveauté semble absente, c'est la première chose à regarder.", { italics: true }),
  saut(),

  h1("2. Ouvrir le projet d'exercice"),
  p("Accueil ▸ Ouvrir (.projx), puis choisissez le fichier Memoire_Ngoma_SIMULATION.projx."),
  p("Vous devez voir apparaître, en bas de l'écran : 15 documents · 79 codes · 1 220 segments codés."),
  vide(),
  tab([
    ["Ce que contient le projet", "Où le voir"],
    ["10 transcriptions d'entretiens + 5 comptes rendus d'observation", "Volet « Système de documents », à gauche"],
    ["79 codes en 11 familles, dont 21 créés en cours de codage", "Volet « Système de codes », en bas à gauche"],
    ["15 variables de document (qualification, secteur, ancienneté…)", "Onglet Variables ▸ Éditeur de données"],
    ["20 mémos : journal de bord par entretien, mémos de phase, piste d'audit", "Onglet Mémos ▸ Gestionnaire de mémos"],
    ["8 requêtes sauvegardées correspondant aux thèmes provisoires", "Onglet Analyse ▸ Requêtes sauvegardées"],
    ["Une carte conceptuelle reprenant la figure 1 du protocole", "Onglet Visualisation ▸ Carte conceptuelle"],
    ["Un second codage (codeur C2) sur trois entretiens", "Onglet Analyse ▸ Accord inter-codeurs (κ)"],
  ], [4600, 4426]),
  saut(),

  h1("3. Les six phases de l'analyse thématique, dans l'outil"),
  p("Le § 4.2.6 du protocole retient les six phases de Braun et Clarke, en approche hybride. Voici où chacune se joue dans QualiCode."),

  h2("Phase 1 — Familiarisation"),
  p("Importer, puis LIRE avant de coder. La tentation est de coder dès la première lecture ; c'est ce qui produit un arbre de codes qui épouse le guide d'entretien au lieu du matériau."),
  puce("Importer : onglet Importer ▸ Fichiers (DOCX, PDF, TXT, images). QualiCode lit directement les .docx — vos transcriptions n'ont pas besoin d'être converties."),
  puce("Lire : cliquez un document dans le volet de gauche ; il s'ouvre dans le navigateur de document."),
  puce("Noter les premières impressions : onglet Mémos ▸ Mémo du projet. Dans le projet d'exercice, le mémo « Phase 1 — Familiarisation » montre ce qu'on y écrit."),
  puce("Renseigner le journal de bord de chaque entretien : dans le volet des documents, l'icône ✏️ sur la ligne du document ouvre son mémo. Le protocole l'exige (annexe 1, « Après »)."),

  h2("Phase 2 — Codage initial"),
  p("L'approche est hybride : on part de la grille dérivée du Tableau III, et on reste ouvert à ce que le matériau impose."),
  puce("Créer la grille initiale : onglet Codes ▸ Nouveau code. Créez d'abord les familles (« 1. Sens attribué au dépistage »…), puis les codes enfants à l'intérieur."),
  puce("Coder un passage : sélectionnez le texte à la souris ; le menu « Appliquer un code » apparaît sous la sélection — cliquez le code voulu, ou « Nouveau code… » pour en créer un sur-le-champ. L'onglet Codes ▸ Coder la sélection fait la même chose."),
  puce("Codage in vivo : sélectionnez un passage, puis « In vivo » dans le menu qui apparaît (ou onglet Codes ▸ Codage in vivo) — le code prend pour nom les mots mêmes du participant. C'est ainsi qu'est né le code « Ce qui est compté existe », repris d'une phrase de P09."),
  puce("Un même passage peut porter plusieurs codes. Dans le projet d'exercice, la plupart en portent deux ou trois : c'est ce qui rend les co-occurrences interprétables."),
  vide(),
  encadre("Marquez vos codes inductifs", [
    "Dans le projet d'exercice, les 21 codes nés du matériau portent la mention « [inductif] » dans leur intitulé. Ce n'est pas une coquetterie : c'est la trace qui permet au jury de vérifier que la grille est restée ouverte, comme l'annonce le § 4.2.6.",
    "Le mémo « Piste d'audit — décisions de codage » consigne, pour quatre d'entre eux, POURQUOI ils ont été créés. Faites de même pendant la collecte réelle : la raison s'oublie en trois semaines.",
  ], "2E86C1", "EAF2F8"),

  h2("Phase 3 — Recherche des thèmes"),
  p("Un thème n'est pas un code : c'est un regroupement de codes qui dit quelque chose. QualiCode aide à les faire apparaître."),
  puce("Activez des codes (case à cocher dans le volet des codes) : le volet « Segments récupérés » rassemble tous les extraits correspondants. C'est la lecture transversale qui fait émerger les thèmes."),
  puce("Onglet Analyse ▸ Matrice des codes : quels codes sont denses, lesquels sont vides. Un code jamais utilisé est un code à supprimer ou à redéfinir."),
  puce("Onglet Analyse ▸ Co-occurrences : quels codes se recouvrent. Deux codes qui co-occurrent systématiquement sont souvent un seul thème."),
  puce("Enregistrez chaque piste : onglet Analyse ▸ Requêtes sauvegardées. Le projet d'exercice en contient huit, dont les quatre thèmes provisoires (T1 à T4)."),

  h2("Phase 4 — Revue et validation"),
  p("Le protocole insiste sur cette phase : « chaque thème provisoire est confronté à l'ensemble des extraits codés puis au corpus entier »."),
  puce("Ouvrez une requête sauvegardée et relisez TOUS les extraits d'affilée. Un thème qui ne tient pas se voit à cette lecture."),
  puce("Consignez les thèmes écartés autant que les thèmes retenus. Le mémo « Phase 4 — Revue : un thème écarté » du projet d'exercice montre comment : le thème « résistance des femmes » ne reposait que sur un participant et a été abandonné, ses propos étant reversés en représentation professionnelle."),
  puce("Onglet Analyse ▸ Comparaison de groupes : croisez un code avec une variable (qualification, secteur) pour vérifier qu'un thème n'est pas l'artefact d'un seul profil."),

  h2("Phase 5 — Définition et dénomination"),
  puce("Écrivez la définition de chaque famille de codes : l'icône ✏️ sur la ligne du code ouvre son mémo. Le projet d'exercice en contient cinq, dont celle de la famille 7, qui rappelle une règle d'analyse essentielle : ces propos sont des représentations professionnelles, jamais des descriptions de la réalité des femmes."),
  puce("Renommez sans crainte : renommer un code conserve tous ses segments."),

  h2("Phase 6 — Production du rapport"),
  puce("Onglet Rapports ▸ Rapport Word (.docx) : tous les extraits classés par code, prêts à être travaillés dans le chapitre Résultats."),
  puce("Onglet Rapports ▸ Segments (CSV) : le même matériau en tableau, avec document, code, poids et commentaire."),
  puce("Onglet Rapports ▸ Matrice (CSV) : la matrice codes × documents, pour un tableau de fréquences dans le mémoire."),
  puce("Onglet Rapports ▸ Rapport imprimable : version mise en page, à imprimer ou à enregistrer en PDF."),
  saut(),

  h1("4. Le double codage et le kappa"),
  p("Le protocole annonce, au titre de la dépendabilité : « piste d'audit, double codage, contrôle de stabilité intra-codeur ». QualiCode calcule le kappa de Cohen — encore faut-il lui donner deux codages à comparer."),
  vide(),
  tab([
    ["Étape", "Dans QualiCode"],
    ["1. Vous codez le corpus", "Vos segments portent l'étiquette de codeur C1"],
    ["2. Un second codeur reprend un sous-ensemble à l'aveugle", "Il travaille sur SA copie du projet (.projx), qu'il vous renvoie"],
    ["3. Vous fusionnez son travail au vôtre", "Accueil ▸ Fusionner (.projx) — ses segments arrivent étiquetés C2"],
    ["4. Vous calculez l'accord", "Analyse ▸ Accord inter-codeurs (κ), puis vous choisissez les deux codeurs"],
    ["5. Vous discutez les désaccords et vous tranchez", "Les écarts se lisent code par code dans le tableau produit"],
  ], [3400, 5626]),
  vide(),
  encadre("Un kappa flatteur : sachez pourquoi, le jury le demandera", [
    "Sur le projet d'exercice, κ = 0,867 — « accord presque parfait » selon Landis et Koch. Ce chiffre est pourtant optimiste, et il faut savoir l'expliquer.",
    "L'unité d'analyse est le paragraphe : pour un code donné, l'immense majorité des paragraphes n'est codée ni par l'un ni par l'autre. Ces accords négatifs gonflent l'accord observé et tirent le kappa vers le haut.",
    "Ce qu'il faut rapporter dans le mémoire : la valeur, l'unité d'analyse retenue, la part du corpus double-codée, et la manière dont les désaccords ont été tranchés. Un kappa nu, sans ces quatre éléments, ne prouve rien.",
  ]),
  saut(),

  h1("5. Les statistiques avancées : ce qu'il ne faut PAS en faire ici"),
  p("QualiCode propose un test du χ², le V de Cramér et des corrélations (Analyse ▸ Statistiques avancées). Ces outils fonctionnent. Ils n'ont pas leur place dans les résultats de ce mémoire."),
  vide(),
  encadre("Votre protocole l'exclut explicitement", [
    "§ 4.2.4 : « Cette étude ne mesure aucune variable et n'éprouve aucune relation. »",
    "§ 1.4 : « Cette recherche ne formule pas d'hypothèse […] elle appartient à une logique hypothético-déductive incompatible avec la démarche compréhensive retenue. »",
    "Et matériellement : avec dix ou vingt entretiens, un χ² porte sur quinze ou vingt lignes. Sur le projet d'exercice, le croisement « modulation de l'information × secteur » donne p = 0,67 — un résultat qui ne signifie rien d'autre que « l'effectif est trop petit pour que ce test dise quoi que ce soit ».",
    "Présenter un tel test en soutenance exposerait le travail à une objection méthodologique immédiate, et affaiblirait des résultats qualitatifs qui, eux, tiennent.",
  ]),
  vide(),
  p("À quoi ces fonctions servent-elles alors ? À deux choses légitimes :"),
  puce("Décrire votre échantillon (Analyse ▸ Statistiques) : combien d'infirmiers, combien de sages-femmes, quelle répartition par secteur. C'est descriptif, et c'est attendu dans le chapitre Méthodes."),
  puce("Vérifier qu'un thème n'est pas l'artefact d'un seul profil — en lisant la matrice, pas en testant sa signification."),
  vide(),
  p("L'export vers R (Analyse ▸ Statistiques avancées ▸ export R/SPSS) reste utile si, plus tard, vous menez une étude quantitative. Pour celle-ci, laissez-le de côté.", { italics: true }),
  saut(),

  h1("6. La triangulation avec les observations"),
  p("Le protocole traite les notes d'observation comme un corpus secondaire, « intégré au même arbre thématique où elles font office de contexte et de contrepoint »."),
  puce("Les cinq comptes rendus sont dans le groupe « Observations (corpus secondaire) » et codés avec la famille 10."),
  puce("Le code « ÉCART déclaré / constaté » marque les quatre lieux où le dit et le vu divergent ou concordent. Ouvrez la requête sauvegardée « Écarts déclaré / constaté » pour les lire d'un bloc."),
  puce("Ces segments portent un poids de 3 — les seuls du projet. Ils se repèrent dans l'export Segments (CSV), dont la colonne « poids » se trie dans Excel, et le poids s'affiche à côté de l'extrait dans le volet « Segments récupérés »."),
  vide(),
  encadre("La règle d'interprétation, à ne pas enfreindre", [
    "Un écart entre ce qu'un participant déclare et ce que l'observation montre ne s'impute JAMAIS à une intention du participant — ni mensonge, ni négligence.",
    "Le § 4.2.6 le formule ainsi : l'écart « informe sur l'écart entre norme énoncée et condition d'exercice ». Dans le projet d'exercice, le participant qui affirme mesurer la tension « systématiquement » exerce dans le centre dont l'appareil est en panne : c'est une donnée sur la distance entre la norme intériorisée et les moyens, pas sur sa sincérité.",
    "Consignez aussi les CONCORDANCES. Le centre CS14, où le registre observé confirme la consigne déclarée, est un résultat au même titre.",
  ], "1E8449", "E9F7EF"),
  saut(),

  h1("7. Une phrase du protocole à corriger"),
  encadre("§ 4.2.6 nomme NVivo, pas QualiCode", [
    "Votre protocole indique : « Les transcriptions sont importées dans NVivo, outil de gestion, de codage et de traçabilité ; la méthode d'analyse demeure l'analyse thématique. »",
    "Si vous conduisez l'analyse dans QualiCode, cette phrase devient inexacte. Le chapitre Méthodes doit décrire ce que vous avez réellement fait : un jury vérifie cette correspondance.",
    "Formulation possible : « Les transcriptions sont importées dans un logiciel d'analyse qualitative assistée par ordinateur (QualiCode), utilisé comme outil de gestion, de codage et de traçabilité ; la méthode d'analyse demeure l'analyse thématique. Le projet est exporté au format d'échange REFI-QDA, ce qui garantit sa lisibilité par les logiciels du domaine et la conservation des matériaux prévue au § 4.2.7. »",
    "Faites valider ce changement par votre directrice de mémoire avant dépôt.",
  ], "B7950B", "FEF9E7"),
  vide(),
  h2("Passer à NVivo ou MAXQDA si nécessaire"),
  p("Le format REFI-QDA est le standard d'échange du domaine. Onglet Rapports ▸ REFI-QDA (.qdpx) produit une archive que NVivo 14+, MAXQDA 2022+ et ATLAS.ti 22+ savent ouvrir : documents, arbre de codes et codages sont conservés."),
  p("Sur le projet d'exercice, l'aller-retour a été vérifié : les 15 documents, 79 codes et 1 220 segments reviennent intacts, sans qu'aucune borne de codage ne bouge. Vous n'êtes donc enfermé nulle part — argument utile si un membre du jury s'inquiète du choix de l'outil.", { italics: true }),
  saut(),

  h1("8. Check-list pour la collecte réelle"),
  tab([
    ["Moment", "Geste", "Où"],
    ["Avant le premier entretien", "Créer un projet NEUF, distinct du projet d'exercice", "Accueil ▸ Nouveau projet"],
    ["Avant le premier entretien", "Créer la grille initiale de codes à partir du Tableau III", "Onglet Codes ▸ Nouveau code"],
    ["Avant le premier entretien", "Déclarer les variables de document (qualification, secteur…)", "Variables ▸ Liste des variables"],
    ["Après chaque entretien", "Importer la transcription, saisir les variables, écrire le journal de bord", "Importer ▸ Fichiers, puis Mémo du document"],
    ["Après chaque entretien", "Vérifier la couverture de la matrice de variation (Tableau II)", "Variables ▸ Éditeur de données"],
    ["Après chaque séance", "Exporter le .projx et le copier ailleurs", "Accueil ▸ Enregistrer (.projx)"],
    ["Toutes les semaines", "Relire la piste d'audit et y consigner les décisions de codage", "Mémos ▸ Gestionnaire de mémos"],
    ["À la clôture de la collecte", "Documenter la suffisance informationnelle dimension par dimension", "Mémo de projet"],
    ["Avant rédaction", "Faire double-coder un tiers des entretiens, fusionner, calculer κ", "Accueil ▸ Fusionner, puis Analyse ▸ κ"],
    ["Avant dépôt", "Exporter en REFI-QDA et archiver avec les transcriptions", "Rapports ▸ REFI-QDA (.qdpx)"],
  ], [2300, 4200, 2526]),
  saut(),

  h1("9. Ce que ce jeu de données ne prouve pas"),
  p("Il est facile, après quelques heures passées dans ces transcriptions, de se mettre à penser avec elles. Ce serait une erreur, et elle serait coûteuse."),
  puce("Aucun des constats qu'on y lit n'est un résultat : ni la rupture de bandelettes, ni le tensiomètre en panne, ni la modulation de l'information selon le niveau d'instruction. Ce sont des hypothèses que j'ai écrites pour que l'outil ait quelque chose à mouliner."),
  puce("Le terrain réel dira peut-être le contraire. S'il dit la même chose, ce sera une coïncidence, pas une confirmation."),
  puce("Le danger concret : arriver sur le terrain avec ces thèmes en tête et n'entendre que ce qui les confirme. Relisez votre grille initiale — celle du Tableau III — plutôt que l'arbre de codes de l'exercice, qui en est une version déjà orientée par un matériau fictif."),
  vide(),
  p("La bonne façon de se servir de ce dossier est de refaire les gestes, pas de retenir les conclusions.", { bold: true }),
];

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Calibri", size: 21 }, paragraph: { spacing: { line: 276 } } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 30, bold: true, color: "17334F" }, paragraph: { spacing: { before: 340, after: 160 } } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 25, bold: true, color: "26567D" }, paragraph: { spacing: { before: 280, after: 120 } } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 22, bold: true, color: "2E6DA4" }, paragraph: { spacing: { before: 200, after: 100 } } },
    ],
  },
  numbering: { config: [{ reference: "puces", levels: [{ level: 0, format: "bullet", text: "•", alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 400, hanging: 200 } } } }] }] },
  sections: [{ children: enfants }],
});
writeFileSync("3_Guide_QualiCode_pour_ce_memoire.docx", await Packer.toBuffer(doc));
console.log("écrit : 3_Guide_QualiCode_pour_ce_memoire.docx");
