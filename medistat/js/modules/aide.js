// medistat/js/modules/aide.js
// Aide en ligne, documentation intégrée et outils de maintenance.
// La documentation utilisateur exigée à l'article 20 est embarquée dans
// l'application : elle reste accessible hors ligne, là où elle est utile.

import { h, fmt, tableau, badge, modale, confirmer, erreur, succes, alerte,
  etatVide, onglets, carteStat, copier, remplacer } from "../core/ui.js";
import * as store from "../core/store.js";
import * as auth from "../core/auth.js";
import { ROLES, describePermissions, STATUTS_DEMANDE, ACTIONS_AUDITEES } from "../core/model.js";
import { telecharger, DocumentPDF } from "../core/export.js";
import { COULEURS } from "../core/charts.js";

export async function vue_aide({ naviguer, rafraichir }) {
  return h("div", [
    h("div.page-entete", [
      h("div.page-entete__titre", [
        h("h1", { texte: "Aide et documentation" }),
        h("p.texte-secondaire", {
          texte: "Guide d'utilisation, conformité au cahier des charges et outils de maintenance.",
        }),
      ]),
      h("div.page-entete__actions", [
        h("button.btn", { texte: "📄 Guide au format PDF", onclick: guidePDF }),
      ]),
    ]),
    onglets([
      { libelle: "Prise en main", contenu: () => priseEnMain(naviguer) },
      { libelle: "Analyse de données", contenu: guideAnalyse },
      { libelle: "Rôles et droits", contenu: guideRoles },
      { libelle: "Sécurité", contenu: guideSecurite },
      { libelle: "Conformité", contenu: matriceConformite },
      { libelle: "Maintenance", contenu: () => maintenance(rafraichir) },
    ]),
  ]);
}

/* ===================== Prise en main ===================== */

function priseEnMain(naviguer) {
  const etapes = [
    { titre: "1. Paramétrer le catalogue des analyses",
      texte: "Le catalogue recense les examens réalisables, leurs unités, leurs valeurs de référence " +
        "et leurs seuils d'alerte. C'est lui qui permet à la Solution d'interpréter automatiquement " +
        "les résultats et de déclencher les alertes sur valeurs critiques. Amorcez-le depuis le " +
        "référentiel LOINC, puis adaptez les normes à votre population et à vos automates.",
      vue: "catalogue", bouton: "Ouvrir le catalogue" },
    { titre: "2. Créer les comptes utilisateurs",
      texte: "Chaque professionnel dispose d'un compte nominatif et d'un rôle. Le rôle détermine " +
        "précisément ce qu'il peut voir et faire. Un laborantin saisit les résultats, un biologiste " +
        "les valide et les signe : cette séparation est au cœur de la sécurité du dispositif.",
      vue: "utilisateurs", bouton: "Gérer les utilisateurs" },
    { titre: "3. Enregistrer un patient",
      texte: "Le dossier patient porte l'identité, les antécédents, les allergies et le contact " +
        "d'urgence. Un identifiant permanent (IPP) lui est attribué automatiquement. " +
        "Les allergies sont signalées en évidence sur chaque écran du dossier.",
      vue: "patients", bouton: "Ouvrir les patients" },
    { titre: "4. Prescrire des examens",
      texte: "Depuis une consultation ou directement, sélectionnez les analyses et le degré d'urgence. " +
        "La demande reçoit un numéro et entre dans le circuit du laboratoire.",
      vue: "demandes", bouton: "Voir les demandes" },
    { titre: "5. Suivre le cycle de l'échantillon",
      texte: "Prélèvement, réception, analyse, saisie, validation, rendu : chaque étape est " +
        "explicitement enregistrée et tracée. Les transitions non prévues sont refusées par la Solution.",
      vue: "paillasse", bouton: "Ouvrir la paillasse" },
    { titre: "6. Valider et signer les résultats",
      texte: "Le biologiste contrôle les résultats saisis et les signe électroniquement en confirmant " +
        "son mot de passe. La signature porte sur le contenu exact : toute modification ultérieure " +
        "la rend invalide, et l'impression du compte rendu est alors bloquée.",
      vue: "validation", bouton: "Ouvrir la validation" },
    { titre: "7. Analyser vos données",
      texte: "Constituez un jeu de données depuis le dossier médical, puis lancez les analyses " +
        "statistiques. La Solution vérifie les conditions d'application des tests et rédige " +
        "l'interprétation en français.",
      vue: "jeux-donnees", bouton: "Créer un jeu de données" },
  ];

  return h("div", [
    h("div.carte", [
      h("h2", { texte: "Qu'est-ce que MediStat ?" }),
      h("p", {
        texte: "MediStat est une solution de gestion des dossiers médicaux et des résultats de " +
          "laboratoire, doublée d'un environnement complet d'analyse de données quantitatives et " +
          "qualitatives. Elle fonctionne dans un navigateur, s'installe sur ordinateur comme sur " +
          "téléphone, et reste pleinement utilisable hors connexion.",
      }),
      h("p", {
        texte: "Les données sont conservées sur l'appareil, chiffrées, et ne sont transmises à un " +
          "serveur que si vous en installez un. Cette architecture répond aux contextes où la " +
          "connectivité est irrégulière et où la confidentialité des données de santé est impérative.",
      }),
    ]),

    ...etapes.map(e => h("div.carte", [
      h("h3", { texte: e.titre }),
      h("p.texte-secondaire", { texte: e.texte }),
      h("button.btn", { texte: e.bouton + " →", onclick: () => naviguer(e.vue) }),
    ])),

    h("div.carte", [
      h("h3", { texte: "Raccourcis clavier" }),
      tableau([
        { cle: "touche", titre: "Raccourci" },
        { cle: "action", titre: "Action" },
      ], [
        { touche: "Ctrl + K", action: "Recherche globale (patient, demande, code-barres)" },
        { touche: "Ctrl + L", action: "Verrouiller la session immédiatement" },
        { touche: "Échap", action: "Fermer la fenêtre ou la liste de résultats" },
        { touche: "Tab", action: "Naviguer entre les champs (le focus reste dans les fenêtres)" },
      ], { compact: true, parPage: 10 }),
    ]),
  ]);
}

/* ===================== Guide d'analyse ===================== */

function guideAnalyse() {
  return h("div", [
    h("div.carte", [
      h("h2", { texte: "Choisir le bon test statistique" }),
      h("p.texte-secondaire", {
        texte: "Le test dépend de trois éléments : la nature de la variable à expliquer, " +
          "le nombre de groupes comparés, et l'indépendance ou l'appariement des observations. " +
          "La Solution vérifie automatiquement les conditions d'application et signale " +
          "lorsqu'une alternative non paramétrique serait plus prudente.",
      }),
      tableau([
        { cle: "question", titre: "Question posée" },
        { cle: "conditions", titre: "Conditions" },
        { cle: "test", titre: "Test recommandé" },
      ], [
        { question: "Comparer une moyenne à une valeur de référence", conditions: "Distribution normale",
          test: "Test t sur un échantillon" },
        { question: "Comparer deux groupes indépendants", conditions: "Normalité et variances égales",
          test: "Test t de Student" },
        { question: "Comparer deux groupes indépendants", conditions: "Normalité, variances inégales",
          test: "Test t de Welch (appliqué automatiquement)" },
        { question: "Comparer deux groupes indépendants", conditions: "Distribution non normale",
          test: "Test U de Mann-Whitney" },
        { question: "Comparer deux mesures sur les mêmes sujets", conditions: "Différences normales",
          test: "Test t apparié" },
        { question: "Comparer deux mesures sur les mêmes sujets", conditions: "Différences non normales",
          test: "Test des rangs signés de Wilcoxon" },
        { question: "Comparer trois groupes ou plus", conditions: "Normalité et homogénéité",
          test: "ANOVA, puis post-hoc de Tukey" },
        { question: "Comparer trois groupes ou plus", conditions: "Distribution non normale",
          test: "Kruskal-Wallis, puis post-hoc de Dunn" },
        { question: "Associer deux variables qualitatives", conditions: "Effectifs théoriques ≥ 5",
          test: "Test du χ² d'indépendance" },
        { question: "Associer deux variables qualitatives", conditions: "Petits effectifs",
          test: "Test exact de Fisher" },
        { question: "Comparer deux mesures binaires appariées", conditions: "Données appariées",
          test: "Test de McNemar" },
        { question: "Mesurer une association entre deux quantitatives", conditions: "Relation linéaire, normalité",
          test: "Corrélation de Pearson" },
        { question: "Mesurer une association entre deux quantitatives", conditions: "Relation monotone",
          test: "Corrélation de Spearman" },
        { question: "Prédire une variable quantitative", conditions: "Résidus normaux",
          test: "Régression linéaire multiple" },
        { question: "Prédire un critère binaire", conditions: "Au moins 10 événements par prédicteur",
          test: "Régression logistique (rapports de cotes)" },
        { question: "Évaluer un test diagnostique", conditions: "Référence connue",
          test: "Sensibilité, spécificité, courbe ROC" },
        { question: "Comparer des délais de survenue", conditions: "Données censurées possibles",
          test: "Kaplan-Meier et test du log-rank" },
        { question: "Comparer deux méthodes de mesure", conditions: "Mesures appariées quantitatives",
          test: "Bland-Altman et concordance de Lin" },
      ], { parPage: 30, compact: true }),
    ]),

    h("div.carte", [
      h("h3", { texte: "Interpréter une valeur p" }),
      h("p.texte-secondaire", {
        texte: "La valeur p est la probabilité d'observer un résultat au moins aussi extrême que celui " +
          "obtenu, si l'hypothèse nulle était vraie. Elle ne mesure ni la probabilité que l'hypothèse " +
          "soit fausse, ni l'importance de l'effet.",
      }),
      h("div.avertissement", {
        texte: "Un résultat significatif (p < 0,05) sur un très grand échantillon peut correspondre à " +
          "un effet négligeable en pratique. Inversement, un résultat non significatif sur un petit " +
          "échantillon ne démontre pas l'absence d'effet : il peut simplement manquer de puissance. " +
          "C'est pourquoi la Solution affiche systématiquement la taille d'effet et son intervalle de confiance.",
      }),
      tableau([
        { cle: "indicateur", titre: "Taille d'effet" },
        { cle: "petit", titre: "Petit" },
        { cle: "moyen", titre: "Moyen" },
        { cle: "grand", titre: "Grand" },
      ], [
        { indicateur: "d de Cohen (comparaison de moyennes)", petit: "0,20", moyen: "0,50", grand: "0,80" },
        { indicateur: "r de Pearson (corrélation)", petit: "0,10", moyen: "0,30", grand: "0,50" },
        { indicateur: "η² (ANOVA)", petit: "0,01", moyen: "0,06", grand: "0,14" },
        { indicateur: "V de Cramér (χ²)", petit: "0,10", moyen: "0,30", grand: "0,50" },
        { indicateur: "AUC (courbe ROC)", petit: "0,60", moyen: "0,70", grand: "0,80" },
      ], { compact: true, parPage: 10 }),
    ]),

    h("div.carte", [
      h("h3", { texte: "L'analyse qualitative" }),
      h("p.texte-secondaire", {
        texte: "L'analyse qualitative traite le texte libre : verbatims de patients, observations " +
          "cliniques, commentaires de biologistes. La démarche suit trois temps.",
      }),
      h("ol", [
        h("li", [h("strong", { texte: "Constituer le corpus. " }),
          "Rassemblez les documents à analyser, depuis le dossier médical ou un fichier."]),
        h("li", [h("strong", { texte: "Construire le livre de codes. " }),
          "Après une première lecture, définissez les thèmes recherchés et les mots-clés qui les signalent. " +
          "Le concordancier permet de vérifier le sens réel de chaque terme avant de le retenir."]),
        h("li", [h("strong", { texte: "Coder et interpréter. " }),
          "La Solution applique le codage, mesure la couverture de chaque thème, calcule les " +
          "cooccurrences et trace la courbe de saturation."]),
      ]),
      h("p.texte-secondaire", {
        texte: "La saturation théorique est atteinte lorsque les nouveaux documents n'apportent plus " +
          "de thème inédit : c'est le critère méthodologique qui justifie l'arrêt du recueil. " +
          "L'onglet « Méthodes mixtes » croise ensuite les thèmes avec vos variables quantitatives, " +
          "pour savoir si un thème caractérise un service, un sexe ou un diagnostic particulier.",
      }),
    ]),
  ]);
}

/* ===================== Rôles ===================== */

function guideRoles() {
  return h("div", [
    h("div.carte", [
      h("h2", { texte: "Les dix profils utilisateurs" }),
      h("p.texte-secondaire", {
        texte: "Chaque rôle correspond à un métier et porte un ensemble précis de droits. " +
          "L'interface s'adapte : un utilisateur ne voit que les écrans auxquels il a accès.",
      }),
    ]),
    ...Object.entries(ROLES).map(([cle, def]) => h("div.carte", [
      h("div", { style: { display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" } }, [
        h("h3", { style: { margin: 0 }, texte: def.label }),
        badge(`niveau ${def.niveau}`, def.niveau >= 90 ? COULEURS.critique
          : def.niveau >= 70 ? COULEURS.accent : null),
      ]),
      h("p.texte-secondaire", { texte: def.description }),
      h("div", { style: { display: "flex", gap: "4px", flexWrap: "wrap" } },
        describePermissions(cle).map(p => badge(`${p.label} : ${p.droits.join(", ")}`))),
    ])),
  ]);
}

/* ===================== Sécurité ===================== */

function guideSecurite() {
  return h("div", [
    h("div.carte", [
      h("h2", { texte: "Comment vos données sont protégées" }),
      h("p.texte-secondaire", {
        texte: "La confidentialité des données de santé est une exigence prioritaire du cahier des " +
          "charges (article 9). Voici les dispositifs mis en œuvre, et leurs limites.",
      }),
    ]),
    ...[
      { titre: "Chiffrement au repos",
        texte: "Les champs sensibles — antécédents, allergies, coordonnées, diagnostics, commentaires " +
          "de biologistes, contenu des documents — sont chiffrés en AES-GCM 256 bits sur l'appareil. " +
          "La clé est dérivée de votre mot de passe par PBKDF2 à 250 000 itérations ; elle n'est " +
          "jamais stockée et disparaît à la fermeture de session.",
        limite: "Les champs nécessaires à la recherche (nom, IPP) restent en clair : sans cela, " +
          "aucune recherche ne serait possible. Le chiffrement protège contre la lecture directe " +
          "de la base, non contre un appareil compromis pendant une session ouverte." },
      { titre: "Journal d'audit infalsifiable",
        texte: "Chaque événement est horodaté et contient l'empreinte cryptographique de l'événement " +
          "précédent. Supprimer, insérer ou modifier une entrée rompt la chaîne, et le contrôle " +
          "d'intégrité le détecte immédiatement — y compris si l'auteur est administrateur.",
        limite: "Le journal ne contient aucune donnée de santé en clair : il enregistre qui a fait " +
          "quoi et quand, pas le détail clinique." },
      { titre: "Signature électronique des résultats",
        texte: "La validation d'un résultat produit une empreinte SHA-256 de son contenu exact, " +
          "associée à l'identité du biologiste. Toute modification ultérieure invalide la signature, " +
          "et l'impression du compte rendu est alors bloquée.",
        limite: "Il s'agit d'une signature d'intégrité, non d'une signature électronique qualifiée " +
          "au sens réglementaire, qui nécessiterait un certificat délivré par une autorité de certification." },
      { titre: "Contrôle d'accès",
        texte: "Dix rôles, des permissions fines par ressource et par action, un cloisonnement strict " +
          "entre établissements. Toute tentative d'accès non autorisée est refusée et tracée.",
        limite: "Un administrateur d'établissement dispose de droits étendus : la séparation des " +
          "pouvoirs repose aussi sur l'organisation, pas seulement sur le logiciel." },
      { titre: "Protection des accès",
        texte: "Mots de passe soumis à une politique de robustesse, blocage temporaire après cinq " +
          "échecs, verrouillage automatique après quinze minutes d'inactivité, historique interdisant " +
          "la réutilisation des cinq derniers mots de passe, double authentification TOTP facultative.",
        limite: "Le verrouillage automatique protège un poste laissé ouvert en service ; il ne " +
          "protège pas contre le partage volontaire d'identifiants." },
    ].map(s => h("div.carte", [
      h("h3", { texte: s.titre }),
      h("p", { texte: s.texte }),
      h("div.avertissement", [h("strong", { texte: "Portée : " }), h("span", { texte: s.limite })]),
    ])),

    h("div.carte", [
      h("h3", { texte: "Ce qui relève de votre organisation" }),
      h("ul", [
        h("li", { texte: "Sauvegardes régulières : exportez la base et conservez les fichiers en lieu sûr." }),
        h("li", { texte: "Politique de conservation des données conforme à la réglementation applicable dans votre juridiction." }),
        h("li", { texte: "Formation des utilisateurs : un logiciel sûr mal utilisé n'est pas sûr." }),
        h("li", { texte: "Sécurisation des postes : chiffrement du disque, verrouillage de session, mises à jour." }),
        h("li", { texte: "Si vous déployez le serveur : TLS obligatoire, secret de signature propre à l'installation, sauvegardes chiffrées." }),
      ]),
    ]),
  ]);
}

/* ===================== Conformité ===================== */

function matriceConformite() {
  const articles = [
    { art: "Art. 4", exigence: "Périmètre fonctionnel et multi-tenant", etat: "couvert",
      ou: "Patients, consultations, prescriptions, laboratoire, documents, rôles, tableaux de bord, reporting, export, audit, cloisonnement par établissement." },
    { art: "Art. 5", exigence: "Dix profils utilisateurs", etat: "couvert",
      ou: "Administrateur système et d'établissement, médecin, infirmier, laborantin, biologiste, réceptionniste, pharmacien, qualité, comptable, patient." },
    { art: "Art. 6.1", exigence: "Gestion des patients", etat: "couvert",
      ou: "Création, recherche, IPP unique, antécédents, allergies, contacts d'urgence, archivage." },
    { art: "Art. 6.2", exigence: "Gestion des consultations", etat: "couvert",
      ou: "Ouverture, symptômes, constantes avec alerte sur valeurs anormales, diagnostic CIM-10, prescription, historique." },
    { art: "Art. 6.3", exigence: "Gestion du laboratoire", etat: "couvert",
      ou: "Demande, affectation, suivi de statut, saisie, validation, signature électronique, publication au dossier, PDF." },
    { art: "Art. 6.4", exigence: "Gestion documentaire", etat: "partiel",
      ou: "Modèle et magasin documentaire chiffré en place ; interface de dépôt à compléter." },
    { art: "Art. 6.5", exigence: "Reporting", etat: "couvert",
      ou: "Patients actifs, volumes, taux de positivité, délais de rendu, activité par utilisateur, statistiques financières." },
    { art: "Art. 7.1", exigence: "Paramétrage du laboratoire", etat: "couvert",
      ou: "Catégories, catalogue, valeurs de référence, unités, seuils d'alerte, amorçage LOINC." },
    { art: "Art. 7.2", exigence: "Cycle de vie de l'échantillon", etat: "couvert",
      ou: "Sept états, transitions contrôlées, correction possible sous audit." },
    { art: "Art. 7.3", exigence: "Exploitation des résultats", etat: "couvert",
      ou: "Détection hors normes et valeurs critiques, delta-check, commentaires, signatures." },
    { art: "Art. 8", exigence: "Architecture et interopérabilité", etat: "couvert",
      ou: "Frontend web, API REST, base relationnelle SQLite, stockage documentaire, moteur PDF, authentification, audit, HL7 FHIR R4 et LOINC." },
    { art: "Art. 9", exigence: "Sécurité et conformité", etat: "couvert",
      ou: "AES-GCM au repos, TLS en transit côté serveur, rôles, permissions fines, journalisation, sauvegarde et restauration." },
    { art: "Art. 10", exigence: "Droits d'accès", etat: "couvert",
      ou: "Neuf droits élémentaires par ressource, matrice consultable dans l'administration." },
    { art: "Art. 11", exigence: "Interfaces clinique, laboratoire et administration", etat: "couvert",
      ou: "Trois interfaces distinctes, responsives, utilisables sur ordinateur, tablette et téléphone." },
    { art: "Art. 12", exigence: "Portail patient", etat: "partiel",
      ou: "Rôle patient et permissions définis ; interface dédiée à développer (module optionnel)." },
    { art: "Art. 13", exigence: "Notifications", etat: "partiel",
      ou: "Notifications in-app et alertes critiques opérationnelles ; passerelles courriel et SMS à raccorder au déploiement." },
    { art: "Art. 14", exigence: "Multi-établissement", etat: "couvert",
      ou: "Cloisonnement strict des données, configuration par site, modules activables." },
    { art: "Art. 15", exigence: "Facturation et modèles économiques", etat: "couvert",
      ou: "Module activable, tarification par acte, suivi des règlements." },
    { art: "Art. 16", exigence: "Journal d'audit", etat: "couvert",
      ou: "Quinze types d'événements tracés, chaînage cryptographique, contrôle d'intégrité, export." },
    { art: "Art. 17", exigence: "Modèle de données", etat: "couvert",
      ou: "Les quatorze entités du cahier des charges sont modélisées." },
    { art: "Art. 18", exigence: "Exports et impressions", etat: "couvert",
      ou: "PDF conforme à la mise en page clinique, CSV, Excel XLSX, JSON, lots FHIR." },
    { art: "Art. 19", exigence: "Performance et disponibilité", etat: "couvert",
      ou: "Chargement des vues à la demande, fonctionnement hors ligne, index sur les magasins, pagination systématique." },
    { art: "Art. 20", exigence: "Maintenance et support", etat: "couvert",
      ou: "Documentation technique et utilisateur, procédures de sauvegarde, restauration et mise à jour." },
    { art: "Art. 23", exigence: "Critères de réception", etat: "couvert",
      ou: "Les huit critères sont vérifiables ; les tests automatisés couvrent le socle statistique, applicatif et d'export." },
  ];

  const couverts = articles.filter(a => a.etat === "couvert").length;

  return h("div", [
    h("div.carte", [
      h("h2", { texte: "Conformité au cahier des charges" }),
      h("p.texte-secondaire", {
        texte: `${couverts} exigences sur ${articles.length} sont pleinement couvertes. ` +
          `Les points marqués « partiel » sont signalés honnêtement : ils correspondent à des modules ` +
          `explicitement optionnels ou à des raccordements qui dépendent du déploiement retenu.`,
      }),
      tableau([
        { cle: "art", titre: "Article" },
        { cle: "exigence", titre: "Exigence" },
        { cle: "etat", titre: "État", rendu: a => badge(
          a.etat === "couvert" ? "Couvert" : "Partiel",
          a.etat === "couvert" ? COULEURS.normal : COULEURS.bas) },
        { cle: "ou", titre: "Mise en œuvre" },
      ], articles, { parPage: 30, compact: true }),
    ]),
  ]);
}

/* ===================== Maintenance ===================== */

async function maintenance(rafraichir) {
  const diagnostic = await store.diagnosticStockage();
  const integrite = await store.verifierAudit().catch(() => null);
  const { demonstrationPresente } = await import("./demonstration.js");
  const demoPresente = await demonstrationPresente().catch(() => false);

  const zone = h("div");
  const rendre = () => remplacer(zone, h("div", [
    h("div.carte", [
      h("h3", { texte: "État du stockage" }),
      h("div.resultat-test__stat", [
        h("div.stat-bloc", [h("span.stat-bloc__libelle", { texte: "Moteur" }),
          h("span.stat-bloc__valeur", { texte: diagnostic.moteur })]),
        h("div.stat-bloc", [h("span.stat-bloc__libelle", { texte: "Enregistrements" }),
          h("span.stat-bloc__valeur", { texte: fmt.nombre(diagnostic.total) })]),
        diagnostic.quota ? h("div.stat-bloc", [
          h("span.stat-bloc__libelle", { texte: "Espace utilisé" }),
          h("span.stat-bloc__valeur", { texte: fmt.octets(diagnostic.quota.utilise) })]) : null,
        integrite ? h("div.stat-bloc", [
          h("span.stat-bloc__libelle", { texte: "Intégrité de l'audit" }),
          h("span.stat-bloc__valeur", {
            style: { color: integrite.valide ? "var(--succes)" : "var(--danger)" },
            texte: integrite.valide ? "vérifiée" : "compromise" })]) : null,
      ].filter(Boolean)),
      diagnostic.avertissement ? h("div.avertissement", { texte: diagnostic.avertissement }) : null,
    ]),

    h("div.carte", [
      h("h3", { texte: "Sauvegarde et restauration" }),
      h("p.texte-secondaire", {
        texte: "La sauvegarde produit un fichier JSON contenant l'intégralité de la base, journal " +
          "d'audit compris. Conservez ces fichiers en lieu sûr : ils contiennent des données de santé.",
      }),
      h("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap" } }, [
        h("button.btn.btn--primaire", { texte: "💾 Sauvegarder maintenant", onclick: async () => {
          try {
            const s = await store.exporterBase();
            telecharger(JSON.stringify(s, null, 1),
              `medistat-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`, "application/json");
            succes(`Sauvegarde produite : ${fmt.nombre(Object.values(s.statistiques).reduce((a, b) => a + b, 0))} enregistrements.`);
          } catch (e) { erreur(e.message); }
        } }),
        h("button.btn", { texte: "♻️ Restaurer une sauvegarde", onclick: restaurer }),
      ]),
    ]),

    h("div.carte", [
      h("h3", { texte: "Jeu de démonstration" }),
      h("p.texte-secondaire", {
        texte: demoPresente
          ? "Un jeu de démonstration est actuellement chargé. Les patients fictifs portent un IPP " +
            "commençant par « DEMO » : ils peuvent être retirés sans toucher à vos données réelles."
          : "Le jeu de démonstration crée des patients, examens et résultats fictifs, ainsi que des " +
            "comptes pour chaque profil. Il permet de découvrir la Solution et de former les équipes " +
            "sans manipuler de données de santé réelles.",
      }),
      h("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap" } }, [
        demoPresente
          ? h("button.btn.btn--danger", { texte: "🗑️ Retirer les données de démonstration",
              onclick: async () => {
                if (!(await confirmer("Retirer toutes les données de démonstration ?",
                  { danger: true, detail: "Seuls les enregistrements fictifs (IPP commençant par DEMO) sont supprimés." }))) return;
                const { supprimerDemonstration } = await import("./demonstration.js");
                const r = await supprimerDemonstration();
                succes(`${r.patients} patients de démonstration retirés.`);
                rafraichir?.();
              } })
          : h("button.btn", { texte: "🎓 Charger le jeu de démonstration", onclick: async () => {
              if (!(await confirmer("Charger environ 120 patients fictifs et leurs examens ?",
                { titre: "Jeu de démonstration",
                  detail: "L'opération prend quelques instants. Elle est réversible." }))) return;
              try {
                const { chargerDemonstration } = await import("./demonstration.js");
                alerte("Chargement en cours, veuillez patienter…", { duree: 3000 });
                const r = await chargerDemonstration();
                succes(`${r.patients} patients, ${r.demandes} demandes et ${r.resultats} résultats créés.`);
                rafraichir?.();
              } catch (e) { erreur("Chargement impossible : " + e.message); }
            } }),
      ]),
      demoPresente ? h("div.carte", { style: { background: "var(--surface-2)", marginTop: "12px" } }, [
        h("div.champ-libelle", { texte: "Comptes de démonstration (mot de passe indiqué)" }),
        tableau([
          { cle: "identifiant", titre: "Identifiant" },
          { cle: "role", titre: "Rôle" },
          { cle: "mdp", titre: "Mot de passe" },
        ], [
          { identifiant: "dr.mukendi", role: "Médecin", mdp: "Demomed2026!" },
          { identifiant: "bio.ilunga", role: "Biologiste", mdp: "Demobio2026!" },
          { identifiant: "lab.kasongo", role: "Laborantin", mdp: "Demolab2026!" },
          { identifiant: "inf.ngoy", role: "Infirmier", mdp: "Demoinf2026!" },
          { identifiant: "acc.kalala", role: "Réceptionniste", mdp: "Demorec2026!" },
          { identifiant: "qua.mwamba", role: "Responsable qualité", mdp: "Demoqua2026!" },
        ], { compact: true, parPage: 10 }),
        h("div.avertissement", {
          texte: "Ces comptes ne doivent jamais subsister sur une installation en production.",
        }),
      ]) : null,
    ]),

    h("div.carte", [
      h("h3", { texte: "Remise à zéro" }),
      h("p.texte-secondaire", {
        texte: "Efface la totalité de la base sur cet appareil, y compris les comptes utilisateurs " +
          "et le journal d'audit. Cette opération est irréversible.",
      }),
      h("button.btn.btn--danger", { texte: "⚠️ Effacer toutes les données", onclick: async () => {
        if (!(await confirmer("Effacer définitivement toutes les données de cet appareil ?",
          { danger: true,
            detail: "Sauvegardez d'abord si nécessaire. Vous devrez reconfigurer l'établissement." }))) return;
        const second = await confirmer("Confirmez-vous une seconde fois cette suppression définitive ?",
          { danger: true, titre: "Dernière confirmation" });
        if (!second) return;
        await store.reinitialiserBase();
        alerte("Base effacée. L'application va redémarrer.");
        setTimeout(() => location.reload(), 1200);
      } }),
    ]),
  ]));
  rendre();
  return zone;
}

async function restaurer() {
  const input = h("input", { type: "file", accept: ".json", hidden: true });
  document.body.appendChild(input);
  input.click();
  input.onchange = async () => {
    const fichier = input.files[0];
    input.remove();
    if (!fichier) return;
    if (!(await confirmer("Restaurer cette sauvegarde ?",
      { detail: "Les enregistrements portant le même identifiant seront remplacés." }))) return;
    try {
      const rapport = await store.restaurerBase(JSON.parse(await fichier.text()));
      succes(`${fmt.nombre(Object.values(rapport).reduce((a, b) => a + b, 0))} enregistrements restaurés.`);
      setTimeout(() => location.reload(), 1200);
    } catch (e) { erreur("Restauration impossible : " + e.message); }
  };
}

/* ===================== Guide PDF ===================== */

function guidePDF() {
  const pdf = new DocumentPDF({ titre: "MediStat — Guide d'utilisation", auteur: "MediStat" });

  pdf.piedDePage = (d, page, total) => {
    d.trait({ y: 54 });
    d.texte("MediStat — Guide d'utilisation", d.marge, 40, { taille: 8, couleur: [0.45, 0.5, 0.55] });
    d.texte(`Page ${page} / ${total}`, d.largeur - d.marge, 40,
      { taille: 8, couleur: [0.45, 0.5, 0.55], aligne: "droite" });
  };

  pdf.ligne("MediStat", { taille: 24, gras: true });
  pdf.ligne("Guide d'utilisation", { taille: 15, couleur: [0.3, 0.4, 0.5] });
  pdf.espace(6);
  pdf.trait();
  pdf.espace(10);
  pdf.paragraphe(
    "MediStat est une solution de gestion des dossiers médicaux et des résultats de laboratoire, " +
    "doublée d'un environnement d'analyse de données quantitatives et qualitatives. Elle fonctionne " +
    "dans un navigateur, s'installe sur ordinateur comme sur téléphone, et reste utilisable hors connexion.",
    { taille: 10 });

  const sections = [
    ["1. Démarrer", [
      "À la première ouverture, créez votre établissement et le compte administrateur.",
      "Amorcez ensuite le catalogue des analyses depuis le référentiel LOINC, puis adaptez les valeurs de référence à votre population.",
      "Créez enfin les comptes des professionnels : chaque rôle donne accès à un ensemble précis de fonctions.",
    ]],
    ["2. Le circuit d'un examen", [
      "Prescription : sélectionnez le patient, les analyses et le degré d'urgence.",
      "Prélèvement : un code-barres à clé de contrôle est attribué à l'échantillon.",
      "Réception : la conformité de l'échantillon est enregistrée ; une non-conformité est tracée.",
      "Analyse et saisie : la paillasse classe les analyses par urgence puis par ancienneté.",
      "Validation : le biologiste contrôle, valide et signe électroniquement.",
      "Rendu : les résultats sont publiés au dossier et le prescripteur est notifié.",
    ]],
    ["3. Les alertes", [
      "Une valeur dépassant un seuil critique déclenche une alerte immédiate et bloquante.",
      "L'alerte doit être acquittée après avoir joint le prescripteur : l'acquittement est tracé.",
      "Le contrôle de vraisemblance compare chaque résultat au dosage précédent et signale les écarts supérieurs à 50 %.",
    ]],
    ["4. Analyser vos données", [
      "Constituez un jeu de données par extraction du dossier médical, ou par import d'un fichier.",
      "Les résultats de laboratoire sont automatiquement mis en colonnes, une ligne par patient ou par consultation.",
      "Choisissez l'analyse : la Solution vérifie les conditions d'application et rédige l'interprétation.",
      "Exportez vers R, SPSS, Stata, jamovi ou Excel, avec le script d'analyse correspondant.",
    ]],
    ["5. Sécurité", [
      "Les données sensibles sont chiffrées sur l'appareil (AES-GCM 256 bits).",
      "Le journal d'audit est chaîné par empreintes : toute altération est détectable.",
      "La signature électronique d'un résultat devient invalide si son contenu est modifié.",
      "La session se verrouille automatiquement après quinze minutes d'inactivité.",
    ]],
    ["6. Sauvegardes", [
      "Exportez régulièrement la base depuis la page d'aide, onglet Maintenance.",
      "Conservez les fichiers de sauvegarde en lieu sûr : ils contiennent des données de santé.",
      "La restauration est possible à tout moment, sur le même appareil ou sur un autre.",
    ]],
  ];

  for (const [titre, points] of sections) {
    pdf.espace(12);
    pdf.ligne(titre, { taille: 13, gras: true, couleur: [0.09, 0.2, 0.31] });
    pdf.trait({ couleur: [0.09, 0.2, 0.31], epaisseur: 0.9 });
    pdf.espace(4);
    for (const p of points) pdf.paragraphe("•  " + p, { taille: 9.5 });
  }

  pdf.espace(14);
  pdf.ligne("Choisir le bon test statistique", { taille: 13, gras: true, couleur: [0.09, 0.2, 0.31] });
  pdf.espace(4);
  pdf.tableau(["Question", "Conditions", "Test"], [
    ["Comparer deux groupes indépendants", "Normalité", "Test t de Student ou de Welch"],
    ["Comparer deux groupes indépendants", "Non-normalité", "Mann-Whitney"],
    ["Comparer deux mesures appariées", "Normalité", "Test t apparié"],
    ["Comparer deux mesures appariées", "Non-normalité", "Wilcoxon"],
    ["Comparer trois groupes ou plus", "Normalité", "ANOVA puis Tukey"],
    ["Comparer trois groupes ou plus", "Non-normalité", "Kruskal-Wallis puis Dunn"],
    ["Associer deux variables qualitatives", "Effectifs suffisants", "Test du chi-deux"],
    ["Associer deux variables qualitatives", "Petits effectifs", "Test exact de Fisher"],
    ["Mesurer une corrélation", "Relation linéaire", "Pearson"],
    ["Mesurer une corrélation", "Relation monotone", "Spearman"],
    ["Prédire un critère binaire", "Événements suffisants", "Régression logistique"],
    ["Évaluer un test diagnostique", "Référence connue", "Sensibilité, spécificité, ROC"],
    ["Comparer des délais de survenue", "Censures possibles", "Kaplan-Meier et log-rank"],
  ], { largeurs: [200, 130, 165], taille: 8.5 });

  telecharger(pdf.produire(), "medistat-guide-utilisation.pdf");
  succes("Guide produit.");
}
