// medistat/js/modules/statistiques.js
// Analyse quantitative — statistiques descriptives et inférentielles.
// L'écran guide l'utilisateur : il propose le test adapté à la nature des
// variables, vérifie les conditions d'application, et rédige l'interprétation
// en français. C'est ce qui distingue un logiciel utilisable en clinique d'une
// simple boîte à outils statistique.

import { h, fmt, tableau, badge, modale, erreur, succes, alerte, etatVide,
  remplacer, onglets, carteStat, copier } from "../core/ui.js";
import * as store from "../core/store.js";
import { autorise } from "../core/auth.js";
import { chargerJeux, jeuActif, definirJeuActif, colonnesTypees } from "./donnees.js";
import * as desc from "../stats/descriptive.js";
import * as inf from "../stats/inferential.js";
import * as reg from "../stats/regression.js";
import * as surv from "../stats/survival.js";
import * as diag from "../stats/diagnostic.js";
import * as mult from "../stats/multivariate.js";
import { barres, barresGroupees, lignes, boites, histogramme, nuage, carteChaleur, courbeROC,
  courbeSurvie, foret, secteurs, svgVersPNG, COULEURS } from "../core/charts.js";
import { telecharger, versCSV, versXLSX, DocumentPDF, exportStatistique } from "../core/export.js";

/* ===================== Catalogue des analyses ===================== */

// Chaque entrée décrit les variables attendues et la fonction à appeler.
// C'est ce catalogue qui permet de proposer à l'utilisateur uniquement les
// analyses réalisables avec les variables dont il dispose.
const ANALYSES = [
  { groupe: "Description", cle: "descriptif", nom: "Statistiques descriptives",
    aide: "Moyenne, médiane, dispersion, forme de la distribution, intervalles de confiance.",
    variables: [{ role: "quanti", libelle: "Variable(s) quantitative(s)", multiple: true, type: "numerique" }] },
  { groupe: "Description", cle: "frequences", nom: "Tableau de fréquences",
    aide: "Effectifs, pourcentages et pourcentages cumulés d'une variable qualitative.",
    variables: [{ role: "quali", libelle: "Variable(s) qualitative(s)", multiple: true, type: "categoriel" }] },
  { groupe: "Description", cle: "croise", nom: "Tableau croisé et χ²",
    aide: "Croise deux variables qualitatives et teste leur indépendance.",
    variables: [
      { role: "lignes", libelle: "Variable en lignes", type: "categoriel" },
      { role: "colonnes", libelle: "Variable en colonnes", type: "categoriel" }] },
  { groupe: "Description", cle: "parGroupe", nom: "Descriptif par groupe (tableau 1)",
    aide: "Le tableau de caractéristiques attendu en tête de toute publication.",
    variables: [
      { role: "quanti", libelle: "Variables quantitatives", multiple: true, type: "numerique" },
      { role: "groupe", libelle: "Facteur de groupement", type: "categoriel" }] },

  { groupe: "Conditions d'application", cle: "normalite", nom: "Tests de normalité",
    aide: "Shapiro-Wilk, Lilliefors, Anderson-Darling et D'Agostino-Pearson.",
    variables: [{ role: "quanti", libelle: "Variable quantitative", type: "numerique" }] },
  { groupe: "Conditions d'application", cle: "variances", nom: "Homogénéité des variances",
    aide: "Tests de Levene, Brown-Forsythe et Bartlett.",
    variables: [
      { role: "quanti", libelle: "Variable quantitative", type: "numerique" },
      { role: "groupe", libelle: "Facteur de groupement", type: "categoriel" }] },

  { groupe: "Comparaison de moyennes", cle: "tUn", nom: "Test t sur un échantillon",
    aide: "Compare la moyenne observée à une valeur de référence.",
    variables: [{ role: "quanti", libelle: "Variable quantitative", type: "numerique" }],
    parametres: [{ cle: "mu", libelle: "Valeur de référence", type: "number", defaut: 0 }] },
  { groupe: "Comparaison de moyennes", cle: "tIndep", nom: "Test t pour échantillons indépendants",
    aide: "Compare deux groupes. Bascule automatiquement sur Welch si les variances diffèrent.",
    variables: [
      { role: "quanti", libelle: "Variable quantitative", type: "numerique" },
      { role: "groupe", libelle: "Groupe (2 modalités)", type: "categoriel", modalites: 2 }] },
  { groupe: "Comparaison de moyennes", cle: "tApparie", nom: "Test t pour échantillons appariés",
    aide: "Compare deux mesures réalisées sur les mêmes sujets (avant / après).",
    variables: [
      { role: "avant", libelle: "Première mesure", type: "numerique" },
      { role: "apres", libelle: "Seconde mesure", type: "numerique" }] },
  { groupe: "Comparaison de moyennes", cle: "anova", nom: "ANOVA à un facteur",
    aide: "Compare les moyennes de trois groupes ou plus, avec post-hoc de Tukey.",
    variables: [
      { role: "quanti", libelle: "Variable quantitative", type: "numerique" },
      { role: "groupe", libelle: "Facteur", type: "categoriel" }] },
  { groupe: "Comparaison de moyennes", cle: "anova2", nom: "ANOVA à deux facteurs",
    aide: "Teste deux facteurs et leur interaction.",
    variables: [
      { role: "quanti", libelle: "Variable quantitative", type: "numerique" },
      { role: "facteurA", libelle: "Premier facteur", type: "categoriel" },
      { role: "facteurB", libelle: "Second facteur", type: "categoriel" }] },
  { groupe: "Comparaison de moyennes", cle: "ancova", nom: "ANCOVA",
    aide: "Compare des groupes après ajustement sur une covariable.",
    variables: [
      { role: "quanti", libelle: "Variable expliquée", type: "numerique" },
      { role: "groupe", libelle: "Facteur", type: "categoriel" },
      { role: "covariable", libelle: "Covariable", type: "numerique" }] },

  { groupe: "Tests non paramétriques", cle: "mannWhitney", nom: "Mann-Whitney",
    aide: "Alternative au test t indépendant, sans hypothèse de normalité.",
    variables: [
      { role: "quanti", libelle: "Variable quantitative", type: "numerique" },
      { role: "groupe", libelle: "Groupe (2 modalités)", type: "categoriel", modalites: 2 }] },
  { groupe: "Tests non paramétriques", cle: "wilcoxon", nom: "Wilcoxon (rangs signés)",
    aide: "Alternative au test t apparié.",
    variables: [
      { role: "avant", libelle: "Première mesure", type: "numerique" },
      { role: "apres", libelle: "Seconde mesure", type: "numerique" }] },
  { groupe: "Tests non paramétriques", cle: "kruskal", nom: "Kruskal-Wallis",
    aide: "Alternative à l'ANOVA, avec post-hoc de Dunn.",
    variables: [
      { role: "quanti", libelle: "Variable quantitative", type: "numerique" },
      { role: "groupe", libelle: "Facteur", type: "categoriel" }] },
  { groupe: "Tests non paramétriques", cle: "ks2", nom: "Kolmogorov-Smirnov (2 échantillons)",
    aide: "Compare la forme de deux distributions.",
    variables: [
      { role: "quanti", libelle: "Variable quantitative", type: "numerique" },
      { role: "groupe", libelle: "Groupe (2 modalités)", type: "categoriel", modalites: 2 }] },

  { groupe: "Corrélation et régression", cle: "correlation", nom: "Corrélation de deux variables",
    aide: "Pearson, Spearman et Kendall, avec nuage de points et droite d'ajustement.",
    variables: [
      { role: "x", libelle: "Première variable", type: "numerique" },
      { role: "y", libelle: "Seconde variable", type: "numerique" }] },
  { groupe: "Corrélation et régression", cle: "matrice", nom: "Matrice de corrélation",
    aide: "Corrélations deux à deux entre plusieurs variables.",
    variables: [{ role: "quanti", libelle: "Variables", multiple: true, type: "numerique", minimum: 2 }] },
  { groupe: "Corrélation et régression", cle: "regression", nom: "Régression linéaire multiple",
    aide: "Modélise une variable quantitative par plusieurs prédicteurs, avec VIF et diagnostics.",
    variables: [
      { role: "y", libelle: "Variable à expliquer", type: "numerique" },
      { role: "x", libelle: "Prédicteurs", multiple: true, type: "numerique" }] },
  { groupe: "Corrélation et régression", cle: "logistique", nom: "Régression logistique",
    aide: "Critère binaire : rapports de cotes ajustés, adéquation de Hosmer-Lemeshow.",
    variables: [
      { role: "y", libelle: "Variable binaire (0/1)", type: "binaire" },
      { role: "x", libelle: "Prédicteurs", multiple: true, type: "numerique" }] },

  { groupe: "Épidémiologie", cle: "diagnostic", nom: "Performance d'un test diagnostique",
    aide: "Sensibilité, spécificité, valeurs prédictives et rapports de vraisemblance.",
    variables: [
      { role: "test", libelle: "Résultat du test (0/1)", type: "binaire" },
      { role: "reference", libelle: "Diagnostic de référence (0/1)", type: "binaire" }] },
  { groupe: "Épidémiologie", cle: "roc", nom: "Courbe ROC",
    aide: "Détermine le seuil optimal d'un marqueur quantitatif.",
    variables: [
      { role: "marqueur", libelle: "Marqueur quantitatif", type: "numerique" },
      { role: "statut", libelle: "Statut réel (0/1)", type: "binaire" }] },
  { groupe: "Épidémiologie", cle: "risque", nom: "Mesures de risque (RR, OR)",
    aide: "Risque relatif, rapport de cotes et nombre de sujets à traiter.",
    variables: [
      { role: "exposition", libelle: "Exposition (0/1)", type: "binaire" },
      { role: "maladie", libelle: "Maladie (0/1)", type: "binaire" }] },
  { groupe: "Épidémiologie", cle: "survie", nom: "Survie de Kaplan-Meier",
    aide: "Courbes de survie et test du log-rank.",
    variables: [
      { role: "delai", libelle: "Délai de suivi", type: "numerique" },
      { role: "evenement", libelle: "Événement (1) ou censure (0)", type: "binaire" },
      { role: "groupe", libelle: "Groupe (facultatif)", type: "categoriel", facultatif: true }] },

  { groupe: "Analyses multivariées", cle: "acp", nom: "Analyse en composantes principales",
    aide: "Réduit la dimension et met en évidence la structure des variables.",
    variables: [{ role: "quanti", libelle: "Variables", multiple: true, type: "numerique", minimum: 3 }] },
  { groupe: "Analyses multivariées", cle: "classification", nom: "Classification (k-moyennes)",
    aide: "Constitue des groupes homogènes de patients.",
    variables: [{ role: "quanti", libelle: "Variables", multiple: true, type: "numerique", minimum: 2 }],
    parametres: [{ cle: "k", libelle: "Nombre de classes", type: "number", defaut: 3 }] },

  { groupe: "Fidélité", cle: "cronbach", nom: "Alpha de Cronbach",
    aide: "Cohérence interne d'une échelle composée de plusieurs items.",
    variables: [{ role: "items", libelle: "Items de l'échelle", multiple: true, type: "numerique", minimum: 2 }] },
  { groupe: "Fidélité", cle: "kappa", nom: "Accord inter-juges (kappa)",
    aide: "Concordance entre deux évaluateurs.",
    variables: [
      { role: "juge1", libelle: "Premier évaluateur", type: "categoriel" },
      { role: "juge2", libelle: "Second évaluateur", type: "categoriel" }] },
  { groupe: "Fidélité", cle: "blandAltman", nom: "Concordance de Bland-Altman",
    aide: "Compare deux méthodes de mesure quantitatives.",
    variables: [
      { role: "methode1", libelle: "Première méthode", type: "numerique" },
      { role: "methode2", libelle: "Seconde méthode", type: "numerique" }] },

  { groupe: "Planification", cle: "puissance", nom: "Taille d'échantillon et puissance",
    aide: "Calcule l'effectif nécessaire, ou la puissance atteinte.",
    variables: [],
    parametres: [
      { cle: "d", libelle: "Taille d'effet attendue (d de Cohen)", type: "number", defaut: 0.5 },
      { cle: "puissance", libelle: "Puissance visée", type: "number", defaut: 0.8 },
      { cle: "alpha", libelle: "Risque alpha", type: "number", defaut: 0.05 }] },
];

/* ===================== Vue principale ===================== */

let dernierResultat = null;

export async function vue_statistiques({ naviguer }) {
  const jeux = await chargerJeux();
  if (!jeux.length) {
    return etatVide({
      icone: "📈", titre: "Aucun jeu de données",
      message: "Créez d'abord un jeu de données : importez un fichier, ou extrayez les données " +
        "du dossier médical et du laboratoire.",
      action: { libelle: "Créer un jeu de données", action: () => naviguer("jeux-donnees") },
    });
  }

  let jeu = jeuActif(jeux);
  const zoneAnalyse = h("div");
  const zoneResultat = h("div");

  const selectJeu = h("select.champ", { style: { maxWidth: "340px" } },
    jeux.map(j => h("option", { value: j.id, texte: `${j.nom} (${j.lignes.length} observations)`,
      selected: j.id === jeu.id })));
  selectJeu.addEventListener("change", () => {
    jeu = jeux.find(j => j.id === selectJeu.value);
    definirJeuActif(jeu.id);
    remplacer(zoneResultat);
    construireSelecteur();
  });

  const selectAnalyse = h("select.champ");
  const groupes = [...new Set(ANALYSES.map(a => a.groupe))];
  for (const g of groupes) {
    const og = document.createElement("optgroup");
    og.label = g;
    for (const a of ANALYSES.filter(x => x.groupe === g)) {
      og.appendChild(h("option", { value: a.cle, texte: a.nom }));
    }
    selectAnalyse.appendChild(og);
  }

  function construireSelecteur() {
    const analyse = ANALYSES.find(a => a.cle === selectAnalyse.value) || ANALYSES[0];
    const colonnes = colonnesTypees(jeu);
    const selecteurs = {};

    const champs = (analyse.variables || []).map(v => {
      const eligibles = colonnes.filter(c => {
        if (v.type === "numerique") return c.type === "numerique";
        if (v.type === "binaire") return c.type === "binaire" || c.type === "numerique";
        if (v.type === "categoriel") return c.type !== "numerique" || c.modalites <= 12;
        return true;
      });
      if (!eligibles.length) {
        return h("div.avertissement", {
          texte: `Aucune variable ne convient pour « ${v.libelle} ». ` +
            `Ce jeu de données ne contient pas de variable ${v.type === "numerique" ? "quantitative" : v.type === "binaire" ? "binaire" : "qualitative"}.`,
        });
      }
      const controle = v.multiple
        ? h("select.champ", { multiple: true, size: Math.min(7, eligibles.length) },
            eligibles.map(c => h("option", { value: c.cle, texte: `${c.nom} (${c.type})` })))
        : h("select.champ", [
            v.facultatif ? h("option", { value: "", texte: "— Aucun —" }) : null,
            ...eligibles.map(c => h("option", { value: c.cle, texte: `${c.nom} (${c.type})` })),
          ]);
      selecteurs[v.role] = { controle, definition: v };
      return h("div.champ-groupe", [
        h("label.champ-libelle", { texte: v.libelle + (v.multiple ? " (sélection multiple)" : "") }),
        controle,
      ]);
    });

    const parametres = {};
    const champsParametres = (analyse.parametres || []).map(p => {
      const controle = h("input.champ", { type: p.type || "text", value: p.defaut, step: "any" });
      parametres[p.cle] = controle;
      return h("div.champ-groupe", [
        h("label.champ-libelle", { texte: p.libelle }), controle,
      ]);
    });

    const bouton = h("button.btn.btn--primaire.btn--large", { texte: "▶ Lancer l'analyse" });
    bouton.addEventListener("click", async () => {
      const choix = {};
      for (const [role, { controle, definition }] of Object.entries(selecteurs)) {
        choix[role] = definition.multiple
          ? [...controle.selectedOptions].map(o => o.value)
          : controle.value;
        if (definition.multiple && definition.minimum && choix[role].length < definition.minimum) {
          return erreur(`Sélectionnez au moins ${definition.minimum} variables pour « ${definition.libelle} ».`);
        }
        if (!definition.multiple && !definition.facultatif && !choix[role]) {
          return erreur(`Sélectionnez une variable pour « ${definition.libelle} ».`);
        }
      }
      const valeursParametres = Object.fromEntries(
        Object.entries(parametres).map(([k, el]) => [k, Number(el.value)]));

      remplacer(zoneResultat, h("div.carte", [h("p", { texte: "Calcul en cours…" })]));
      try {
        const sortie = await executer(analyse, jeu, choix, valeursParametres);
        dernierResultat = { analyse, jeu, choix, sortie };
        remplacer(zoneResultat, sortie);
        zoneResultat.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (e) {
        console.error(e);
        remplacer(zoneResultat, h("div.carte", [
          h("div.avertissement", { texte: "L'analyse n'a pas pu aboutir : " + e.message }),
        ]));
      }
    });

    remplacer(zoneAnalyse, h("div", [
      h("p.texte-secondaire", { texte: analyse.aide }),
      h("div.formulaire--grille", { style: { display: "grid" } }, [...champs, ...champsParametres]),
      bouton,
    ]));
  }

  selectAnalyse.addEventListener("change", () => { remplacer(zoneResultat); construireSelecteur(); });
  construireSelecteur();

  return h("div", [
    h("div.page-entete", [
      h("div.page-entete__titre", [
        h("h1", { texte: "Analyses statistiques" }),
        h("p.texte-secondaire", {
          texte: "Statistiques descriptives et inférentielles, avec vérification des conditions " +
            "d'application et interprétation rédigée.",
        }),
      ]),
      h("div.page-entete__actions", [
        h("button.btn", { texte: "⬇ Exporter le résultat", onclick: () => exporterResultat() }),
      ]),
    ]),
    h("div.carte", [
      h("div.carte__entete", [h("h3", { texte: "Jeu de données et analyse" })]),
      h("div.formulaire--grille", { style: { display: "grid" } }, [
        h("div.champ-groupe", [h("label.champ-libelle", { texte: "Jeu de données" }), selectJeu]),
        h("div.champ-groupe", [h("label.champ-libelle", { texte: "Analyse" }), selectAnalyse]),
      ]),
      zoneAnalyse,
    ]),
    zoneResultat,
  ]);
}

/* ===================== Exécution ===================== */

const colonne = (jeu, cle) => jeu.lignes.map(l => l[cle]);
const nomColonne = (jeu, cle) => jeu.variables.find(v => v.cle === cle)?.nom || cle;

async function executer(analyse, jeu, choix, parametres) {
  const col = cle => colonne(jeu, cle);
  const nom = cle => nomColonne(jeu, cle);

  switch (analyse.cle) {
    case "descriptif": return rendreDescriptif(jeu, choix.quanti);
    case "frequences": return rendreFrequences(jeu, choix.quali);
    case "croise": return rendreCroise(jeu, choix.lignes, choix.colonnes);
    case "parGroupe": return rendreParGroupe(jeu, choix.quanti, choix.groupe);
    case "normalite": return rendreNormalite(jeu, choix.quanti);
    case "variances": return rendreVariances(jeu, choix.quanti, choix.groupe);

    case "tUn": return rendreTest(
      inf.tTestOneSample(col(choix.quanti), parametres.mu ?? 0),
      { titre: `Test t — ${nom(choix.quanti)} contre ${parametres.mu ?? 0}`,
        graphique: () => graphiqueUneVariable(jeu, choix.quanti) });

    case "tIndep": {
      const g = desc.groupBy(col(choix.quanti), col(choix.groupe));
      const [a, b] = [...g.entries()];
      if (!b) throw new Error("Le facteur doit comporter exactement deux modalités.");
      return rendreTest(inf.tTestIndependent(a[1], b[1]),
        { titre: `Test t — ${nom(choix.quanti)} selon ${nom(choix.groupe)}`,
          sousTitre: `${a[0]} (n = ${desc.numeric(a[1]).length}) contre ${b[0]} (n = ${desc.numeric(b[1]).length})`,
          graphique: () => graphiqueGroupes(jeu, choix.quanti, choix.groupe) });
    }
    case "tApparie": return rendreTest(
      inf.tTestPaired(col(choix.avant), col(choix.apres)),
      { titre: `Test t apparié — ${nom(choix.avant)} contre ${nom(choix.apres)}`,
        graphique: () => graphiqueApparie(jeu, choix.avant, choix.apres) });

    case "anova": return rendreAnova(jeu, choix.quanti, choix.groupe);
    case "anova2": return rendreTest(
      inf.anovaTwoWay(col(choix.quanti), col(choix.facteurA), col(choix.facteurB)),
      { titre: `ANOVA à deux facteurs — ${nom(choix.quanti)}`, tableauAnova: true });
    case "ancova": return rendreTest(
      inf.ancova(col(choix.quanti), col(choix.groupe), col(choix.covariable)),
      { titre: `ANCOVA — ${nom(choix.quanti)} ajusté sur ${nom(choix.covariable)}` });

    case "mannWhitney": {
      const g = desc.groupBy(col(choix.quanti), col(choix.groupe));
      const [a, b] = [...g.entries()];
      if (!b) throw new Error("Le facteur doit comporter exactement deux modalités.");
      return rendreTest(inf.mannWhitney(a[1], b[1]),
        { titre: `Mann-Whitney — ${nom(choix.quanti)} selon ${nom(choix.groupe)}`,
          graphique: () => graphiqueGroupes(jeu, choix.quanti, choix.groupe) });
    }
    case "wilcoxon": return rendreTest(
      inf.wilcoxonSignedRank(col(choix.avant), col(choix.apres)),
      { titre: `Wilcoxon — ${nom(choix.avant)} contre ${nom(choix.apres)}`,
        graphique: () => graphiqueApparie(jeu, choix.avant, choix.apres) });
    case "kruskal": return rendreKruskal(jeu, choix.quanti, choix.groupe);
    case "ks2": {
      const g = desc.groupBy(col(choix.quanti), col(choix.groupe));
      const [a, b] = [...g.entries()];
      return rendreTest(inf.ksTwoSample(a[1], b[1]),
        { titre: `Kolmogorov-Smirnov — ${nom(choix.quanti)}` });
    }

    case "correlation": return rendreCorrelation(jeu, choix.x, choix.y);
    case "matrice": return rendreMatrice(jeu, choix.quanti);
    case "regression": return rendreRegression(jeu, choix.y, choix.x);
    case "logistique": return rendreLogistique(jeu, choix.y, choix.x);

    case "diagnostic": return rendreDiagnostic(jeu, choix.test, choix.reference);
    case "roc": return rendreROC(jeu, choix.marqueur, choix.statut);
    case "risque": return rendreRisque(jeu, choix.exposition, choix.maladie);
    case "survie": return rendreSurvie(jeu, choix.delai, choix.evenement, choix.groupe);

    case "acp": return rendreACP(jeu, choix.quanti);
    case "classification": return rendreClassification(jeu, choix.quanti, parametres.k || 3);

    case "cronbach": return rendreCronbach(jeu, choix.items);
    case "kappa": return rendreTest(
      inf.cohenKappa(col(choix.juge1), col(choix.juge2)),
      { titre: `Accord inter-juges — ${nom(choix.juge1)} et ${nom(choix.juge2)}` });
    case "blandAltman": return rendreBlandAltman(jeu, choix.methode1, choix.methode2);

    case "puissance": return rendrePuissance(parametres);
    default: throw new Error("Analyse non reconnue.");
  }
}

/* ===================== Rendu générique d'un test ===================== */

function blocStat(libelle, valeur, classe = "") {
  return h("div.stat-bloc", [
    h("span.stat-bloc__libelle", { texte: libelle }),
    h("span.stat-bloc__valeur", { class: classe, texte: String(valeur) }),
  ]);
}

function rendreTest(resultat, { titre, sousTitre = null, graphique = null, tableauAnova = false } = {}) {
  if (!resultat) {
    return h("div.carte", [h("div.avertissement", {
      texte: "L'analyse n'a pas pu être réalisée : effectif insuffisant ou variables inadaptées.",
    })]);
  }
  if (resultat.error) {
    return h("div.carte", [h("div.avertissement", { texte: resultat.error })]);
  }

  const significatif = resultat.p !== undefined && resultat.p !== null && resultat.p < (resultat.alpha ?? 0.05);
  const conteneur = h("div.resultat-test", [
    h("div.resultat-test__titre", [
      h("div", [
        h("h2", { style: { margin: 0 }, texte: titre || resultat.test }),
        sousTitre ? h("div.texte-secondaire", { texte: sousTitre }) : null,
        h("div.texte-secondaire", { texte: resultat.test }),
      ]),
      resultat.p !== undefined && resultat.p !== null
        ? badge(significatif ? "Différence significative" : "Non significatif",
            significatif ? COULEURS.normal : COULEURS.neutre)
        : null,
    ]),

    h("div.resultat-test__stat", [
      resultat.statistic !== undefined && resultat.statistic !== null
        ? blocStat(resultat.statisticName || "Statistique", fmt.nombre(resultat.statistic, 4)) : null,
      resultat.df !== undefined && resultat.df !== null
        ? blocStat("Degrés de liberté",
            Array.isArray(resultat.df) ? resultat.df.map(d => fmt.nombre(d, 1)).join(" ; ") : fmt.nombre(resultat.df, 1))
        : null,
      resultat.p !== undefined && resultat.p !== null
        ? blocStat("Valeur p", fmt.valeurP(resultat.p), significatif ? "significatif" : "non-significatif") : null,
      resultat.n ? blocStat("Effectif", fmt.nombre(resultat.n)) : null,
      resultat.effect?.value !== undefined
        ? blocStat(resultat.effect.name, fmt.nombre(resultat.effect.value, 3)) : null,
      resultat.ci
        ? blocStat(`IC ${Math.round((resultat.ci.level ?? 0.95) * 100)} %`,
            fmt.intervalle(resultat.ci.lower, resultat.ci.upper, 3)) : null,
    ].filter(Boolean)),

    resultat.effect?.magnitude
      ? h("p.texte-secondaire", { texte: `Ampleur de l'effet : ${resultat.effect.magnitude}.` })
      : null,

    resultat.interpretation ? h("div.interpretation", { texte: resultat.interpretation }) : null,
  ]);

  // Détail chiffré des groupes
  if (resultat.detail) {
    const d = resultat.detail;
    const paires = [];
    if (d.mean1 !== undefined) {
      paires.push(["Moyenne du groupe 1", fmt.nombre(d.mean1, 3)], ["Moyenne du groupe 2", fmt.nombre(d.mean2, 3)]);
      if (d.sd1 !== undefined) paires.push(["Écart-type 1", fmt.nombre(d.sd1, 3)], ["Écart-type 2", fmt.nombre(d.sd2, 3)]);
      if (d.meanDifference !== undefined) paires.push(["Différence", fmt.nombre(d.meanDifference, 3)]);
    }
    if (d.median1 !== undefined) paires.push(["Médiane 1", fmt.nombre(d.median1, 3)], ["Médiane 2", fmt.nombre(d.median2, 3)]);
    if (d.meanRank1 !== undefined) paires.push(["Rang moyen 1", fmt.nombre(d.meanRank1, 2)], ["Rang moyen 2", fmt.nombre(d.meanRank2, 2)]);
    if (paires.length) {
      conteneur.appendChild(h("div.resultat-test__stat",
        paires.map(([l, v]) => blocStat(l, v))));
    }
  }

  // Tableau d'analyse de variance
  if (tableauAnova && resultat.table) {
    conteneur.appendChild(tableau([
      { cle: "source", titre: "Source" },
      { cle: "ss", titre: "Somme des carrés", aligne: "droite", valeur: r => fmt.nombre(r.ss, 3) },
      { cle: "df", titre: "ddl", aligne: "droite", valeur: r => fmt.nombre(r.df, 0) },
      { cle: "ms", titre: "Carré moyen", aligne: "droite", valeur: r => r.ms === null ? "—" : fmt.nombre(r.ms, 3) },
      { cle: "F", titre: "F", aligne: "droite", valeur: r => r.F === null ? "—" : fmt.nombre(r.F, 3) },
      { cle: "p", titre: "p", aligne: "droite", valeur: r => r.p === null ? "—" : fmt.valeurP(r.p) },
      { cle: "eta", titre: "η² partiel", aligne: "droite",
        valeur: r => r.partialEta2 === undefined ? "—" : fmt.nombre(r.partialEta2, 3) },
    ], resultat.table, { parPage: 20, compact: true }));
  }

  // Conditions d'application vérifiées automatiquement
  if (resultat.assumptions) {
    const a = resultat.assumptions;
    const messages = [];
    if (a.levene && a.levene.p < 0.05) {
      messages.push(`Les variances diffèrent significativement (Levene : p = ${fmt.valeurP(a.levene.p)}). ` +
        `La correction de Welch a été appliquée.`);
    }
    if (Array.isArray(a.normality)) {
      const anormaux = a.normality.filter(n => n && n.p < 0.05).length;
      if (anormaux) {
        messages.push(`${anormaux} groupe(s) s'écartent de la normalité (Shapiro-Wilk). ` +
          `Un test non paramétrique (Kruskal-Wallis) serait plus prudent.`);
      }
    }
    if (a.warning) messages.push(a.warning);
    if (messages.length) {
      conteneur.appendChild(h("div.avertissement", [
        h("strong", { texte: "Conditions d'application : " }),
        h("ul", { style: { margin: "6px 0 0", paddingLeft: "18px" } },
          messages.map(m => h("li", { texte: m }))),
      ]));
    }
  }

  if (graphique) {
    try { conteneur.appendChild(h("div.graphique-carte", { style: { marginTop: "14px" } }, [graphique()])); }
    catch (e) { console.warn("Graphique indisponible :", e); }
  }

  return conteneur;
}

/* ===================== Rendus spécifiques ===================== */

function rendreDescriptif(jeu, cles) {
  const conteneur = h("div");
  for (const cle of cles) {
    const valeurs = colonne(jeu, cle);
    const d = desc.describe(valeurs);
    if (d.empty) continue;
    const xs = desc.numeric(valeurs);

    conteneur.appendChild(h("div.resultat-test", [
      h("h2", { texte: nomColonne(jeu, cle) }),
      h("div.resultat-test__stat", [
        blocStat("Effectif", fmt.nombre(d.n)),
        blocStat("Manquants", fmt.nombre(d.missing)),
        blocStat("Moyenne", fmt.nombre(d.mean, 3)),
        blocStat("Écart-type", fmt.nombre(d.sd, 3)),
        blocStat("Erreur-type", fmt.nombre(d.sem, 4)),
        blocStat("IC 95 % de la moyenne", fmt.intervalle(d.ciLower, d.ciUpper, 3)),
      ]),
      h("div.resultat-test__stat", [
        blocStat("Minimum", fmt.nombre(d.min, 3)),
        blocStat("Q1", fmt.nombre(d.q1, 3)),
        blocStat("Médiane", fmt.nombre(d.median, 3)),
        blocStat("Q3", fmt.nombre(d.q3, 3)),
        blocStat("Maximum", fmt.nombre(d.max, 3)),
        blocStat("Écart interquartile", fmt.nombre(d.iqr, 3)),
      ]),
      h("div.resultat-test__stat", [
        blocStat("Coefficient de variation", fmt.pourcent(d.cv)),
        blocStat("Asymétrie", fmt.nombre(d.skewness, 3)),
        blocStat("Aplatissement", fmt.nombre(d.kurtosis, 3)),
        blocStat("Écart médian absolu", fmt.nombre(d.mad, 3)),
      ]),
      // Lecture de la forme : l'utilisateur non statisticien doit comprendre
      // ce que signifient asymétrie et aplatissement.
      h("div.interpretation", {
        texte: `Distribution ${Math.abs(d.skewness) < 0.5 ? "à peu près symétrique"
          : d.skewness > 0 ? "étalée vers la droite (valeurs élevées)" : "étalée vers la gauche (valeurs faibles)"}` +
          `, ${Math.abs(d.kurtosis) < 0.5 ? "d'aplatissement normal"
            : d.kurtosis > 0 ? "à pic marqué et queues épaisses" : "aplatie"}. ` +
          (d.outliers.mild.length + d.outliers.extreme.length
            ? `${d.outliers.mild.length + d.outliers.extreme.length} valeur(s) atypique(s) détectée(s) par la règle de Tukey.`
            : "Aucune valeur atypique détectée."),
      }),
      h("div.grille.grille--2", { style: { marginTop: "12px" } }, [
        h("div.graphique-carte", [histogramme(desc.histogram(xs).bins, {
          titre: "Distribution", libelleX: nomColonne(jeu, cle),
          moyenne: d.mean, densite: desc.kde(xs), hauteur: 300,
        })]),
        h("div.graphique-carte", [boites([{ label: nomColonne(jeu, cle), ...desc.boxplotData(xs) }], {
          titre: "Boîte à moustaches", hauteur: 300,
        })]),
      ]),
    ]));
  }
  return conteneur.children.length ? conteneur
    : h("div.carte", [h("p", { texte: "Aucune donnée numérique exploitable." })]);
}

function rendreFrequences(jeu, cles) {
  const conteneur = h("div");
  for (const cle of cles) {
    const ft = desc.frequencyTable(colonne(jeu, cle));
    const div = desc.diversity(colonne(jeu, cle));
    conteneur.appendChild(h("div.resultat-test", [
      h("h2", { texte: nomColonne(jeu, cle) }),
      h("div.resultat-test__stat", [
        blocStat("Observations valides", fmt.nombre(ft.valid)),
        blocStat("Manquants", fmt.nombre(ft.missing)),
        blocStat("Modalités", fmt.nombre(ft.distinct)),
        blocStat("Indice de Shannon", fmt.nombre(div.shannon, 3)),
      ]),
      tableau([
        { cle: "value", titre: "Modalité" },
        { cle: "count", titre: "Effectif", aligne: "droite", valeur: r => fmt.nombre(r.count) },
        { cle: "percent", titre: "%", aligne: "droite", valeur: r => fmt.nombre(r.percent, 1) },
        { cle: "validPercent", titre: "% valide", aligne: "droite", valeur: r => fmt.nombre(r.validPercent, 1) },
        { cle: "cumulativePercent", titre: "% cumulé", aligne: "droite", valeur: r => fmt.nombre(r.cumulativePercent, 1) },
      ], ft.rows, { parPage: 25, compact: true }),
      ft.rows.length <= 12
        ? h("div.graphique-carte", { style: { marginTop: "12px" } }, [
            secteurs(ft.rows.map(r => ({ label: r.value, valeur: r.count })),
              { titre: nomColonne(jeu, cle), anneau: true,
                centre: { valeur: fmt.nombre(ft.valid), libelle: "observations" } }),
          ])
        : h("div.graphique-carte", { style: { marginTop: "12px" } }, [
            barres(ft.rows.slice(0, 20).map(r => ({ label: r.value, valeur: r.count })),
              { titre: nomColonne(jeu, cle), libelleY: "Effectif" }),
          ]),
    ]));
  }
  return conteneur;
}

function rendreCroise(jeu, cleL, cleC) {
  const resultat = inf.chiSquareIndependence(colonne(jeu, cleL), colonne(jeu, cleC));
  if (!resultat) return h("div.carte", [h("div.avertissement", {
    texte: "Le croisement n'est pas exploitable : chaque variable doit comporter au moins deux modalités.",
  })]);
  const ct = resultat.crosstab;

  const entetes = [nomColonne(jeu, cleL), ...ct.colLevels, "Total"];
  const lignesTableau = ct.rowLevels.map((l, i) => ({
    ligne: l,
    cellules: ct.counts[i],
    total: ct.rowTotals[i],
    residus: ct.adjustedResiduals[i],
  }));

  const tableauCroise = h("div.tableau-defilement", [
    h("table.tableau.tableau--compact", [
      h("thead", [h("tr", entetes.map(e => h("th", { texte: e })))]),
      h("tbody", [
        ...lignesTableau.map(r => h("tr", [
          h("td", [h("strong", { texte: r.ligne })]),
          ...r.cellules.map((v, j) => h("td", { style: { textAlign: "right" } }, [
            h("div", { texte: fmt.nombre(v) }),
            h("div.texte-secondaire", { style: { fontSize: ".72rem" },
              texte: `${fmt.nombre(v * 100 / (r.total || 1), 1)} %` }),
            // Un résidu ajusté au-delà de 1,96 signale la case qui « fait » le χ²
            Math.abs(r.residus[j]) > 1.96
              ? h("div", { style: { fontSize: ".68rem", fontWeight: "700",
                  color: r.residus[j] > 0 ? COULEURS.critique : COULEURS.accent },
                  texte: `r = ${fmt.nombre(r.residus[j], 1)}` })
              : null,
          ])),
          h("td", { style: { textAlign: "right", fontWeight: "600" }, texte: fmt.nombre(r.total) }),
        ])),
        h("tr", [
          h("td", [h("strong", { texte: "Total" })]),
          ...ct.colTotals.map(t => h("td", { style: { textAlign: "right", fontWeight: "600" }, texte: fmt.nombre(t) })),
          h("td", { style: { textAlign: "right", fontWeight: "700" }, texte: fmt.nombre(ct.n) }),
        ]),
      ]),
    ]),
  ]);

  const bloc = rendreTest(resultat, {
    titre: `Tableau croisé — ${nomColonne(jeu, cleL)} × ${nomColonne(jeu, cleC)}`,
  });
  bloc.insertBefore(tableauCroise, bloc.querySelector(".interpretation") || null);
  bloc.appendChild(h("p.texte-secondaire", {
    texte: "Les résidus ajustés (r) supérieurs à 1,96 en valeur absolue signalent les cases " +
      "qui contribuent le plus à l'association : en rouge un effectif supérieur à l'attendu, " +
      "en bleu un effectif inférieur.",
  }));
  bloc.appendChild(h("div.grille.grille--2", { style: { marginTop: "12px" } }, [
    h("div.graphique-carte", [
      barresGroupees(ct.rowLevels,
        ct.colLevels.map((c, j) => ({
          nom: c, valeurs: ct.rowLevels.map((_, i) => ct.counts[i][j]),
        })),
        { titre: "Effectifs croisés", libelleY: "Effectif", empile: true }),
    ]),
    h("div.graphique-carte", [
      carteChaleur(ct.adjustedResiduals, ct.rowLevels, ct.colLevels, {
        titre: "Résidus ajustés", divergente: true,
      }),
    ]),
  ]));
  return bloc;
}

function rendreParGroupe(jeu, cles, cleGroupe) {
  const groupes = colonne(jeu, cleGroupe);
  const niveaux = [...new Set(groupes.map(g => String(g ?? "").trim()).filter(Boolean))].sort();
  const lignesTableau = [];

  for (const cle of cles) {
    const valeurs = colonne(jeu, cle);
    const parGroupe = desc.describeByGroup(valeurs, groupes);
    const listes = niveaux.map(n => desc.numeric(
      valeurs.filter((_, i) => String(groupes[i] ?? "").trim() === n)));
    // Test adapté : ANOVA si normalité et homogénéité, Kruskal-Wallis sinon
    const normalite = listes.map(l => inf.shapiroWilk(l)).filter(Boolean);
    const normal = normalite.every(s => s.p >= 0.05);
    const levene = inf.levene(listes);
    const parametrique = normal && (!levene || levene.p >= 0.05);
    const test = niveaux.length === 2
      ? (parametrique ? inf.tTestIndependent(listes[0], listes[1]) : inf.mannWhitney(listes[0], listes[1]))
      : (parametrique ? inf.anovaOneWay(listes) : inf.kruskalWallis(listes));

    lignesTableau.push({
      variable: nomColonne(jeu, cle),
      cellules: niveaux.map(n => {
        const d = parGroupe.find(x => x.group === n);
        return d && !d.empty
          ? `${fmt.nombre(d.mean, 2)} ± ${fmt.nombre(d.sd, 2)}`
          : "—";
      }),
      medianes: niveaux.map(n => {
        const d = parGroupe.find(x => x.group === n);
        return d && !d.empty ? `${fmt.nombre(d.median, 2)} [${fmt.nombre(d.q1, 2)} ; ${fmt.nombre(d.q3, 2)}]` : "—";
      }),
      p: test?.p ?? null,
      testUtilise: test?.test || "—",
    });
  }

  const effectifs = niveaux.map(n => groupes.filter(g => String(g ?? "").trim() === n).length);

  return h("div.resultat-test", [
    h("h2", { texte: `Caractéristiques selon ${nomColonne(jeu, cleGroupe)}` }),
    h("p.texte-secondaire", {
      texte: "Moyenne ± écart-type, et médiane [Q1 ; Q3]. Le test est choisi automatiquement selon " +
        "la normalité (Shapiro-Wilk) et l'homogénéité des variances (Levene).",
    }),
    h("div.tableau-defilement", [
      h("table.tableau.tableau--compact", [
        h("thead", [h("tr", [
          h("th", { texte: "Variable" }),
          ...niveaux.map((n, i) => h("th", { style: { textAlign: "right" },
            texte: `${n} (n = ${effectifs[i]})` })),
          h("th", { style: { textAlign: "right" }, texte: "p" }),
          h("th", { texte: "Test" }),
        ])]),
        h("tbody", lignesTableau.flatMap(r => [
          h("tr", [
            h("td", [h("strong", { texte: r.variable })]),
            ...r.cellules.map(c => h("td", { style: { textAlign: "right" }, texte: c })),
            h("td", { style: { textAlign: "right", fontWeight: r.p < 0.05 ? "700" : "400",
              color: r.p < 0.05 ? "var(--succes)" : "inherit" }, texte: fmt.valeurP(r.p) }),
            h("td.texte-secondaire", { style: { fontSize: ".76rem" }, texte: r.testUtilise }),
          ]),
          h("tr", [
            h("td.texte-secondaire", { style: { paddingLeft: "22px", fontSize: ".78rem" }, texte: "médiane [Q1 ; Q3]" }),
            ...r.medianes.map(c => h("td.texte-secondaire", { style: { textAlign: "right", fontSize: ".78rem" }, texte: c })),
            h("td"), h("td"),
          ]),
        ])),
      ]),
    ]),
  ]);
}

function rendreNormalite(jeu, cle) {
  const valeurs = desc.numeric(colonne(jeu, cle));
  const tests = [
    inf.shapiroWilk(valeurs),
    inf.kolmogorovSmirnov(valeurs),
    inf.andersonDarling(valeurs),
    inf.dagostinoPearson(valeurs),
  ].filter(Boolean);
  const rejets = tests.filter(t => t.p < 0.05).length;

  return h("div.resultat-test", [
    h("h2", { texte: `Normalité — ${nomColonne(jeu, cle)}` }),
    tableau([
      { cle: "test", titre: "Test" },
      { cle: "statistic", titre: "Statistique", aligne: "droite",
        valeur: t => `${t.statisticName} = ${fmt.nombre(t.statistic, 4)}` },
      { cle: "p", titre: "p", aligne: "droite", valeur: t => fmt.valeurP(t.p) },
      { cle: "conclusion", titre: "Conclusion",
        rendu: t => badge(t.p < 0.05 ? "Écart à la normalité" : "Normalité acceptable",
          t.p < 0.05 ? COULEURS.bas : COULEURS.normal) },
    ], tests, { compact: true, parPage: 10 }),
    h("div.interpretation", {
      texte: rejets === 0
        ? "Aucun test ne rejette la normalité : les méthodes paramétriques (test t, ANOVA, corrélation de Pearson) sont utilisables."
        : rejets === tests.length
          ? "Tous les tests rejettent la normalité : privilégiez les méthodes non paramétriques (Mann-Whitney, Kruskal-Wallis, Spearman)."
          : `${rejets} test(s) sur ${tests.length} rejettent la normalité. Examinez le diagramme quantile-quantile : ` +
            `sur de grands échantillons, ces tests deviennent sensibles à des écarts sans conséquence pratique.`,
    }),
    h("div.grille.grille--2", { style: { marginTop: "12px" } }, [
      h("div.graphique-carte", [histogramme(desc.histogram(valeurs).bins, {
        titre: "Distribution observée", densite: desc.kde(valeurs),
        moyenne: desc.mean(valeurs), hauteur: 300,
      })]),
      h("div.graphique-carte", [(() => {
        const qq = desc.qqNormal(valeurs);
        return nuage(qq.map(p => ({ x: p.theoretical, y: p.standardized })), {
          titre: "Diagramme quantile-quantile normal",
          libelleX: "Quantiles théoriques", libelleY: "Quantiles observés",
          regression: true, hauteur: 300,
        });
      })()]),
    ]),
    h("p.texte-secondaire", {
      texte: "Sur le diagramme quantile-quantile, des points alignés sur la droite traduisent une distribution normale.",
    }),
  ]);
}

function rendreVariances(jeu, cle, cleGroupe) {
  const g = desc.groupBy(colonne(jeu, cle), colonne(jeu, cleGroupe));
  const listes = [...g.values()].map(desc.numeric);
  const tests = [inf.levene(listes, { center: "median" }), inf.levene(listes, { center: "mean" }),
    inf.bartlett(listes)].filter(Boolean);
  return h("div.resultat-test", [
    h("h2", { texte: `Homogénéité des variances — ${nomColonne(jeu, cle)} selon ${nomColonne(jeu, cleGroupe)}` }),
    tableau([
      { cle: "test", titre: "Test" },
      { cle: "statistic", titre: "Statistique", aligne: "droite",
        valeur: t => `${t.statisticName} = ${fmt.nombre(t.statistic, 4)}` },
      { cle: "p", titre: "p", aligne: "droite", valeur: t => fmt.valeurP(t.p) },
      { cle: "conclusion", titre: "Conclusion", valeur: t => t.interpretation },
    ], tests, { compact: true }),
    h("div.graphique-carte", { style: { marginTop: "12px" } }, [
      boites([...g.entries()].map(([label, vals]) => ({
        label, ...desc.boxplotData(desc.numeric(vals)),
      })), { titre: "Dispersion par groupe", libelleY: nomColonne(jeu, cle) }),
    ]),
  ]);
}

function rendreAnova(jeu, cle, cleGroupe) {
  const g = desc.groupBy(colonne(jeu, cle), colonne(jeu, cleGroupe));
  const labels = [...g.keys()];
  const listes = [...g.values()].map(desc.numeric);
  const resultat = inf.anovaOneWay(listes, labels);
  const bloc = rendreTest(resultat, {
    titre: `ANOVA — ${nomColonne(jeu, cle)} selon ${nomColonne(jeu, cleGroupe)}`,
    tableauAnova: true,
    graphique: () => boites(labels.map((l, i) => ({ label: l, ...desc.boxplotData(listes[i]) })),
      { titre: "Distribution par groupe", libelleY: nomColonne(jeu, cle) }),
  });

  if (resultat?.groups) {
    bloc.insertBefore(tableau([
      { cle: "label", titre: "Groupe" },
      { cle: "n", titre: "n", aligne: "droite" },
      { cle: "mean", titre: "Moyenne", aligne: "droite", valeur: r => fmt.nombre(r.mean, 3) },
      { cle: "sd", titre: "Écart-type", aligne: "droite", valeur: r => fmt.nombre(r.sd, 3) },
      { cle: "se", titre: "Erreur-type", aligne: "droite", valeur: r => fmt.nombre(r.se, 4) },
    ], resultat.groups, { compact: true, parPage: 20 }), bloc.children[2]);
  }

  // Post-hoc : indispensable après une ANOVA significative
  if (resultat && resultat.p < 0.05 && listes.length >= 3) {
    const tukey = inf.tukeyHSD(listes, labels);
    if (tukey) {
      bloc.appendChild(h("div", { style: { marginTop: "16px" } }, [
        h("h3", { texte: "Comparaisons deux à deux (Tukey HSD)" }),
        h("p.texte-secondaire", {
          texte: "L'ANOVA indique qu'au moins un groupe diffère ; le test post-hoc identifie lesquels, " +
            "en contrôlant le risque global d'erreur.",
        }),
        tableau([
          { cle: "paire", titre: "Comparaison", valeur: c => `${c.group1} — ${c.group2}` },
          { cle: "difference", titre: "Différence", aligne: "droite", valeur: c => fmt.nombre(c.difference, 3) },
          { cle: "ic", titre: "IC 95 %", aligne: "centre",
            valeur: c => fmt.intervalle(c.ciLower, c.ciUpper, 2) },
          { cle: "q", titre: "q", aligne: "droite", valeur: c => fmt.nombre(c.q, 3) },
          { cle: "p", titre: "p ajusté", aligne: "droite", valeur: c => fmt.valeurP(c.p) },
          { cle: "significatif", titre: "", rendu: c => c.significant
            ? badge("significatif", COULEURS.normal) : badge("n.s.", COULEURS.neutre) },
        ], tukey.comparisons, { compact: true, parPage: 25 }),
      ]));
    }
  }
  return bloc;
}

function rendreKruskal(jeu, cle, cleGroupe) {
  const g = desc.groupBy(colonne(jeu, cle), colonne(jeu, cleGroupe));
  const labels = [...g.keys()];
  const listes = [...g.values()].map(desc.numeric);
  const resultat = inf.kruskalWallis(listes, labels);
  const bloc = rendreTest(resultat, {
    titre: `Kruskal-Wallis — ${nomColonne(jeu, cle)} selon ${nomColonne(jeu, cleGroupe)}`,
    graphique: () => boites(labels.map((l, i) => ({ label: l, ...desc.boxplotData(listes[i]) })),
      { titre: "Distribution par groupe", libelleY: nomColonne(jeu, cle) }),
  });
  if (resultat?.groups) {
    bloc.insertBefore(tableau([
      { cle: "label", titre: "Groupe" },
      { cle: "n", titre: "n", aligne: "droite" },
      { cle: "median", titre: "Médiane", aligne: "droite", valeur: r => fmt.nombre(r.median, 3) },
      { cle: "q1", titre: "Q1", aligne: "droite", valeur: r => fmt.nombre(r.q1, 3) },
      { cle: "q3", titre: "Q3", aligne: "droite", valeur: r => fmt.nombre(r.q3, 3) },
      { cle: "meanRank", titre: "Rang moyen", aligne: "droite", valeur: r => fmt.nombre(r.meanRank, 2) },
    ], resultat.groups, { compact: true }), bloc.children[2]);
  }
  if (resultat && resultat.p < 0.05 && listes.length >= 3) {
    const dunn = inf.dunnTest(listes, labels);
    bloc.appendChild(h("div", { style: { marginTop: "16px" } }, [
      h("h3", { texte: "Comparaisons deux à deux (Dunn, ajustement de Holm)" }),
      tableau([
        { cle: "paire", titre: "Comparaison", valeur: c => `${c.group1} — ${c.group2}` },
        { cle: "z", titre: "z", aligne: "droite", valeur: c => fmt.nombre(c.z, 3) },
        { cle: "pRaw", titre: "p brut", aligne: "droite", valeur: c => fmt.valeurP(c.pRaw) },
        { cle: "pAdjusted", titre: "p ajusté", aligne: "droite", valeur: c => fmt.valeurP(c.pAdjusted) },
        { cle: "significatif", titre: "", rendu: c => c.significant
          ? badge("significatif", COULEURS.normal) : badge("n.s.", COULEURS.neutre) },
      ], dunn.comparisons, { compact: true, parPage: 25 }),
    ]));
  }
  return bloc;
}

function rendreCorrelation(jeu, cleX, cleY) {
  const xs = colonne(jeu, cleX), ys = colonne(jeu, cleY);
  const pearson = inf.pearsonCorrelation(xs, ys);
  const spearman = inf.spearmanCorrelation(xs, ys);
  const kendall = inf.kendallTau(xs, ys);
  const normalX = inf.shapiroWilk(desc.numeric(xs));
  const normalY = inf.shapiroWilk(desc.numeric(ys));
  const normal = normalX?.p >= 0.05 && normalY?.p >= 0.05;

  const points = [];
  for (let i = 0; i < Math.min(xs.length, ys.length); i++) {
    const a = Number(xs[i]), b = Number(ys[i]);
    if (Number.isFinite(a) && Number.isFinite(b)) points.push({ x: a, y: b });
  }

  return h("div.resultat-test", [
    h("h2", { texte: `Corrélation — ${nomColonne(jeu, cleX)} et ${nomColonne(jeu, cleY)}` }),
    tableau([
      { cle: "methode", titre: "Méthode", valeur: t => t.test },
      { cle: "coef", titre: "Coefficient", aligne: "droite",
        valeur: t => `${t.statisticName} = ${fmt.nombre(t.statistic, 4)}` },
      { cle: "ic", titre: "IC 95 %", aligne: "centre",
        valeur: t => t.ci ? fmt.intervalle(t.ci.lower, t.ci.upper, 3) : "—" },
      { cle: "p", titre: "p", aligne: "droite", valeur: t => fmt.valeurP(t.p) },
      { cle: "force", titre: "Intensité", valeur: t => t.effect?.magnitude || "—" },
    ], [pearson, spearman, kendall].filter(Boolean), { compact: true }),
    h("div.interpretation", {
      texte: `${normal ? "Les deux variables suivent une loi normale : le coefficient de Pearson est approprié."
        : "Au moins une variable s'écarte de la normalité : privilégiez le coefficient de Spearman."} ` +
        `La corrélation retenue vaut ${fmt.nombre(normal ? pearson.statistic : spearman.statistic, 3)}, ` +
        `soit ${fmt.pourcent((normal ? pearson.statistic : spearman.statistic) ** 2 * 100)} de variance partagée. ` +
        `Rappel : une corrélation ne démontre pas de lien de causalité.`,
    }),
    h("div.graphique-carte", { style: { marginTop: "12px" } }, [
      nuage(points, {
        titre: "Nuage de points et droite d'ajustement",
        libelleX: nomColonne(jeu, cleX), libelleY: nomColonne(jeu, cleY),
        regression: true, hauteur: 360,
      }),
    ]),
  ]);
}

function rendreMatrice(jeu, cles) {
  const variables = cles.map(c => desc.numeric(colonne(jeu, c)));
  const noms = cles.map(c => nomColonne(jeu, c));
  // Toutes les variables doivent porter sur les mêmes observations
  const n = Math.min(...cles.map(c => colonne(jeu, c).length));
  const brutes = cles.map(c => colonne(jeu, c).slice(0, n));
  const m = inf.correlationMatrix(brutes, noms, { method: "pearson" });

  return h("div.resultat-test", [
    h("h2", { texte: "Matrice de corrélation (Pearson)" }),
    h("div.graphique-carte", [
      carteChaleur(m.r, noms, noms, { titre: "Coefficients de corrélation", min: -1, max: 1, divergente: true }),
    ]),
    h("p.texte-secondaire", {
      texte: "Bleu : corrélation négative. Rouge : corrélation positive. " +
        "Le tableau ci-dessous précise les valeurs p associées.",
    }),
    h("div.tableau-defilement", [
      h("table.tableau.tableau--compact", [
        h("thead", [h("tr", [h("th", ""), ...noms.map(nm => h("th", { texte: nm }))])]),
        h("tbody", noms.map((nl, i) => h("tr", [
          h("td", [h("strong", { texte: nl })]),
          ...noms.map((_, j) => h("td", { style: { textAlign: "right" } }, [
            h("div", {
              style: { fontWeight: i !== j && m.p[i][j] < 0.05 ? "700" : "400" },
              texte: i === j ? "1" : fmt.nombre(m.r[i][j], 3),
            }),
            i !== j ? h("div.texte-secondaire", { style: { fontSize: ".7rem" },
              texte: "p " + fmt.valeurP(m.p[i][j]) }) : null,
          ])),
        ]))),
      ]),
    ]),
  ]);
}

function rendreRegression(jeu, cleY, clesX) {
  const modele = reg.multipleRegression(
    colonne(jeu, cleY),
    clesX.map(c => ({ name: nomColonne(jeu, c), values: colonne(jeu, c) })));
  if (!modele) return h("div.carte", [h("div.avertissement", { texte: "Effectif insuffisant pour ajuster le modèle." })]);
  if (modele.error) return h("div.carte", [h("div.avertissement", { texte: modele.error })]);

  const colinearite = modele.coefficients.filter(c => c.vif && c.vif > 10);

  return h("div.resultat-test", [
    h("h2", { texte: `Régression linéaire — ${nomColonne(jeu, cleY)}` }),
    h("div.resultat-test__stat", [
      blocStat("R²", fmt.nombre(modele.r2, 4)),
      blocStat("R² ajusté", fmt.nombre(modele.adjustedR2, 4)),
      blocStat("F", fmt.nombre(modele.F, 3)),
      blocStat("p du modèle", fmt.valeurP(modele.p), modele.p < 0.05 ? "significatif" : "non-significatif"),
      blocStat("Erreur résiduelle", fmt.nombre(modele.residualSE, 3)),
      blocStat("Durbin-Watson", fmt.nombre(modele.durbinWatson, 3)),
      blocStat("AIC", fmt.nombre(modele.aic, 1)),
      blocStat("n", fmt.nombre(modele.n)),
    ]),
    tableau([
      { cle: "name", titre: "Terme" },
      { cle: "estimate", titre: "Coefficient", aligne: "droite", valeur: c => fmt.nombre(c.estimate, 4) },
      { cle: "se", titre: "Erreur-type", aligne: "droite", valeur: c => fmt.nombre(c.se, 4) },
      { cle: "standardized", titre: "β standardisé", aligne: "droite",
        valeur: c => c.standardized === undefined ? "—" : fmt.nombre(c.standardized, 3) },
      { cle: "t", titre: "t", aligne: "droite", valeur: c => fmt.nombre(c.t, 3) },
      { cle: "p", titre: "p", aligne: "droite", valeur: c => fmt.valeurP(c.p) },
      { cle: "ic", titre: "IC 95 %", aligne: "centre", valeur: c => fmt.intervalle(c.ciLower, c.ciUpper, 3) },
      { cle: "vif", titre: "VIF", aligne: "droite", valeur: c => c.vif ? fmt.nombre(c.vif, 2) : "—" },
    ], modele.coefficients, { compact: true, parPage: 30 }),
    h("div.interpretation", {
      texte: `${modele.interpretation} Le β standardisé permet de comparer le poids relatif des prédicteurs, ` +
        `indépendamment de leurs unités.`,
    }),
    colinearite.length ? h("div.avertissement", {
      texte: `Colinéarité détectée (VIF > 10) sur : ${colinearite.map(c => c.name).join(", ")}. ` +
        `Les coefficients de ces variables sont instables ; envisagez d'en retirer une du modèle.`,
    }) : null,
    (modele.durbinWatson < 1.5 || modele.durbinWatson > 2.5) ? h("div.avertissement", {
      texte: `La statistique de Durbin-Watson (${fmt.nombre(modele.durbinWatson, 2)}) s'écarte de 2 : ` +
        `les résidus sont probablement autocorrélés.`,
    }) : null,
    h("div.carte", { style: { marginTop: "12px", background: "var(--surface-2)" } }, [
      h("div.champ-libelle", { texte: "Équation du modèle" }),
      h("code.texte-mono", { texte: modele.equation }),
    ]),
    h("div.grille.grille--2", { style: { marginTop: "12px" } }, [
      h("div.graphique-carte", [nuage(
        modele.fitted.map((f, i) => ({ x: f, y: modele.residuals[i] })),
        { titre: "Résidus contre valeurs ajustées", libelleX: "Valeur ajustée",
          libelleY: "Résidu", hauteur: 300 })]),
      h("div.graphique-carte", [(() => {
        const qq = desc.qqNormal(modele.residuals);
        return nuage(qq.map(p => ({ x: p.theoretical, y: p.standardized })), {
          titre: "Normalité des résidus", libelleX: "Quantiles théoriques",
          libelleY: "Résidus standardisés", regression: true, hauteur: 300,
        });
      })()]),
    ]),
    h("p.texte-secondaire", {
      texte: "Un nuage de résidus sans structure apparente et aligné sur la droite quantile-quantile " +
        "confirme la validité du modèle.",
    }),
  ]);
}

function rendreLogistique(jeu, cleY, clesX) {
  const modele = reg.logisticRegression(
    colonne(jeu, cleY).map(v => binaire(v)),
    clesX.map(c => ({ name: nomColonne(jeu, c), values: colonne(jeu, c) })));
  if (!modele) return h("div.carte", [h("div.avertissement", { texte: "Effectif insuffisant." })]);
  if (modele.error) return h("div.carte", [h("div.avertissement", { texte: modele.error })]);

  const predicteurs = modele.coefficients.slice(1);
  return h("div.resultat-test", [
    h("h2", { texte: `Régression logistique — ${nomColonne(jeu, cleY)}` }),
    h("div.resultat-test__stat", [
      blocStat("χ² du modèle", fmt.nombre(modele.modelChi2, 3)),
      blocStat("p", fmt.valeurP(modele.p), modele.p < 0.05 ? "significatif" : "non-significatif"),
      blocStat("R² de Nagelkerke", fmt.nombre(modele.pseudoR2.nagelkerke, 3)),
      blocStat("Exactitude", fmt.pourcent(modele.classification.accuracy * 100)),
      blocStat("Sensibilité", fmt.pourcent((modele.classification.sensitivity ?? 0) * 100)),
      blocStat("Spécificité", fmt.pourcent((modele.classification.specificity ?? 0) * 100)),
      blocStat("AIC", fmt.nombre(modele.aic, 1)),
      blocStat("n", fmt.nombre(modele.n)),
    ]),
    tableau([
      { cle: "name", titre: "Terme" },
      { cle: "estimate", titre: "Coefficient", aligne: "droite", valeur: c => fmt.nombre(c.estimate, 4) },
      { cle: "se", titre: "Erreur-type", aligne: "droite", valeur: c => fmt.nombre(c.se, 4) },
      { cle: "wald", titre: "Wald", aligne: "droite", valeur: c => fmt.nombre(c.wald, 3) },
      { cle: "p", titre: "p", aligne: "droite", valeur: c => fmt.valeurP(c.p) },
      { cle: "or", titre: "OR", aligne: "droite", valeur: c => fmt.nombre(c.oddsRatio, 3) },
      { cle: "ic", titre: "IC 95 % de l'OR", aligne: "centre",
        valeur: c => fmt.intervalle(c.orLower, c.orUpper, 2) },
    ], modele.coefficients, { compact: true, parPage: 30 }),
    predicteurs.length ? h("div.graphique-carte", { style: { marginTop: "12px" } }, [
      foret(predicteurs.map(c => ({
        label: c.name, estimation: c.oddsRatio, bas: c.orLower, haut: c.orUpper,
        significatif: c.p < 0.05,
      })), { titre: "Rapports de cotes ajustés", reference: 1, echelleLog: true }),
    ]) : null,
    h("div.interpretation", { texte: modele.interpretation }),
    modele.hosmerLemeshow ? h("div", {
      class: modele.hosmerLemeshow.p > 0.05 ? "interpretation" : "avertissement",
      style: { marginTop: "10px" },
      texte: `Test d'adéquation de Hosmer-Lemeshow : χ²(${modele.hosmerLemeshow.df}) = ` +
        `${fmt.nombre(modele.hosmerLemeshow.chi2, 3)}, p = ${fmt.valeurP(modele.hosmerLemeshow.p)}. ` +
        modele.hosmerLemeshow.interpretation,
    }) : null,
    h("p.texte-secondaire", {
      texte: "Un rapport de cotes supérieur à 1 traduit une augmentation du risque, inférieur à 1 une diminution. " +
        "L'effet est significatif lorsque l'intervalle de confiance ne contient pas 1.",
    }),
  ]);
}

const binaire = v => {
  const s = String(v ?? "").trim().toLowerCase();
  if (["1", "oui", "positif", "vrai", "true", "présent", "present", "malade"].includes(s)) return 1;
  if (["0", "non", "négatif", "negatif", "faux", "false", "absent", "sain"].includes(s)) return 0;
  const n = Number(s);
  return n === 1 ? 1 : n === 0 ? 0 : null;
};

function rendreDiagnostic(jeu, cleTest, cleRef) {
  const t = colonne(jeu, cleTest).map(binaire);
  const r = colonne(jeu, cleRef).map(binaire);
  let tp = 0, fp = 0, fn = 0, tn = 0;
  for (let i = 0; i < Math.min(t.length, r.length); i++) {
    if (t[i] === null || r[i] === null) continue;
    if (t[i] === 1 && r[i] === 1) tp++;
    else if (t[i] === 1 && r[i] === 0) fp++;
    else if (t[i] === 0 && r[i] === 1) fn++;
    else tn++;
  }
  const d = diag.diagnosticAccuracy(tp, fp, fn, tn);
  if (!d) return h("div.carte", [h("div.avertissement", { texte: "Données insuffisantes." })]);

  const pct = o => o.value === null ? "—"
    : `${fmt.pourcent(o.value * 100)} [${fmt.nombre(o.lower * 100, 1)} – ${fmt.nombre(o.upper * 100, 1)}]`;

  return h("div.resultat-test", [
    h("h2", { texte: `Performance diagnostique — ${nomColonne(jeu, cleTest)}` }),
    h("p.texte-secondaire", { texte: `Référence : ${nomColonne(jeu, cleRef)}` }),
    h("div.tableau-defilement", { style: { marginBottom: "14px" } }, [
      h("table.tableau.tableau--compact", [
        h("thead", [h("tr", [h("th", ""), h("th", "Malade"), h("th", "Non malade"), h("th", "Total")])]),
        h("tbody", [
          h("tr", [h("td", [h("strong", "Test positif")]),
            h("td", { style: { textAlign: "right" }, texte: `${tp} (VP)` }),
            h("td", { style: { textAlign: "right" }, texte: `${fp} (FP)` }),
            h("td", { style: { textAlign: "right" }, texte: String(tp + fp) })]),
          h("tr", [h("td", [h("strong", "Test négatif")]),
            h("td", { style: { textAlign: "right" }, texte: `${fn} (FN)` }),
            h("td", { style: { textAlign: "right" }, texte: `${tn} (VN)` }),
            h("td", { style: { textAlign: "right" }, texte: String(fn + tn) })]),
          h("tr", [h("td", [h("strong", "Total")]),
            h("td", { style: { textAlign: "right" }, texte: String(tp + fn) }),
            h("td", { style: { textAlign: "right" }, texte: String(fp + tn) }),
            h("td", { style: { textAlign: "right", fontWeight: "700" }, texte: String(d.n) })]),
        ]),
      ]),
    ]),
    h("div.resultat-test__stat", [
      blocStat("Sensibilité", pct(d.sensitivity)),
      blocStat("Spécificité", pct(d.specificity)),
      blocStat("VPP", pct(d.ppv)),
      blocStat("VPN", pct(d.npv)),
      blocStat("Exactitude", pct(d.accuracy)),
    ]),
    h("div.resultat-test__stat", [
      blocStat("Rapport de vraisemblance +", d.positiveLikelihoodRatio === Infinity ? "∞" : fmt.nombre(d.positiveLikelihoodRatio, 2)),
      blocStat("Rapport de vraisemblance −", fmt.nombre(d.negativeLikelihoodRatio, 3)),
      blocStat("Indice de Youden", fmt.nombre(d.youdenIndex, 3)),
      blocStat("OR diagnostique", fmt.nombre(d.diagnosticOddsRatio, 2)),
      blocStat("Kappa", fmt.nombre(d.cohenKappa, 3)),
      blocStat("Score F1", fmt.nombre(d.f1Score, 3)),
    ]),
    h("div.interpretation", { texte: d.interpretation }),
    h("p.texte-secondaire", {
      texte: `Les valeurs prédictives dépendent de la prévalence (ici ${fmt.pourcent(d.prevalence * 100)}). ` +
        `Les rapports de vraisemblance, eux, sont indépendants de la prévalence : ils sont donc transposables ` +
        `à une autre population.`,
    }),
  ]);
}

function rendreROC(jeu, cleMarqueur, cleStatut) {
  const roc = diag.rocCurve(colonne(jeu, cleMarqueur), colonne(jeu, cleStatut).map(binaire));
  if (!roc) return h("div.carte", [h("div.avertissement", {
    texte: "La courbe ROC exige au moins un sujet malade et un sujet sain.",
  })]);
  const best = roc.optimalThreshold.youden;

  return h("div.resultat-test", [
    h("h2", { texte: `Courbe ROC — ${nomColonne(jeu, cleMarqueur)}` }),
    h("div.resultat-test__stat", [
      blocStat("AUC", fmt.nombre(roc.auc, 4)),
      blocStat("IC 95 %", fmt.intervalle(roc.ci.lower, roc.ci.upper, 3)),
      blocStat("p (AUC ≠ 0,5)", fmt.valeurP(roc.p), roc.p < 0.05 ? "significatif" : "non-significatif"),
      blocStat("Malades", fmt.nombre(roc.nPositive)),
      blocStat("Non malades", fmt.nombre(roc.nNegative)),
    ]),
    h("div.graphique-carte", [courbeROC(roc)]),
    h("div.interpretation", { texte: roc.interpretation }),
    h("h3", { style: { marginTop: "14px" }, texte: "Choix du seuil" }),
    tableau([
      { cle: "seuil", titre: "Seuil", aligne: "droite", valeur: p => fmt.nombre(p.rawThreshold, 3) },
      { cle: "sens", titre: "Sensibilité", aligne: "droite", valeur: p => fmt.pourcent(p.sensitivity * 100) },
      { cle: "spec", titre: "Spécificité", aligne: "droite", valeur: p => fmt.pourcent(p.specificity * 100) },
      { cle: "youden", titre: "Youden", aligne: "droite", valeur: p => fmt.nombre(p.youden, 3) },
      { cle: "vp", titre: "VP", aligne: "droite", valeur: p => p.tp ?? "—" },
      { cle: "fp", titre: "FP", aligne: "droite", valeur: p => p.fp ?? "—" },
    ], roc.points.filter(p => Number.isFinite(p.rawThreshold))
        .sort((a, b) => b.youden - a.youden).slice(0, 15),
      { compact: true, parPage: 15 }),
    h("p.texte-secondaire", {
      texte: `Seuil optimal au sens de Youden : ${fmt.nombre(best.value, 3)}. ` +
        `Le choix définitif dépend cependant de l'usage : un test de dépistage privilégie la sensibilité, ` +
        `un test de confirmation la spécificité.`,
    }),
  ]);
}

function rendreRisque(jeu, cleExpo, cleMaladie) {
  const e = colonne(jeu, cleExpo).map(binaire);
  const m = colonne(jeu, cleMaladie).map(binaire);
  let a = 0, b = 0, c = 0, d = 0;
  for (let i = 0; i < Math.min(e.length, m.length); i++) {
    if (e[i] === null || m[i] === null) continue;
    if (e[i] === 1 && m[i] === 1) a++;
    else if (e[i] === 1 && m[i] === 0) b++;
    else if (e[i] === 0 && m[i] === 1) c++;
    else d++;
  }
  const r = diag.riskMeasures(a, b, c, d, { design: "cohort" });
  const chi2 = inf.chiSquareTable([[a, b], [c, d]]);
  const fisher = (a + b + c + d) < 100 ? inf.fisherExact(a, b, c, d) : null;

  const mesures = [
    { nom: "Rapport de cotes (OR)", ...r.oddsRatio },
    r.relativeRisk ? { nom: "Risque relatif (RR)", ...r.relativeRisk } : null,
  ].filter(Boolean);

  return h("div.resultat-test", [
    h("h2", { texte: `Association — ${nomColonne(jeu, cleExpo)} et ${nomColonne(jeu, cleMaladie)}` }),
    h("div.resultat-test__stat", [
      blocStat("Risque chez les exposés", fmt.pourcent((r.riskExposed ?? 0) * 100)),
      blocStat("Risque chez les non-exposés", fmt.pourcent((r.riskUnexposed ?? 0) * 100)),
      r.relativeRisk ? blocStat("Risque relatif", fmt.nombre(r.relativeRisk.value, 3)) : null,
      blocStat("Rapport de cotes", fmt.nombre(r.oddsRatio.value, 3)),
      r.riskDifference ? blocStat("Différence de risque", fmt.pourcent(r.riskDifference.value * 100)) : null,
      r.numberNeededToTreat && Number.isFinite(r.numberNeededToTreat)
        ? blocStat("Nombre de sujets nécessaires", fmt.nombre(Math.ceil(r.numberNeededToTreat))) : null,
      blocStat("χ²", fmt.nombre(chi2?.statistic, 3)),
      blocStat("p", fmt.valeurP(fisher ? fisher.p : chi2?.p),
        (fisher ? fisher.p : chi2?.p) < 0.05 ? "significatif" : "non-significatif"),
    ].filter(Boolean)),
    h("div.graphique-carte", [
      foret(mesures.map(x => ({ label: x.nom, estimation: x.value, bas: x.lower, haut: x.upper })),
        { titre: "Mesures d'association et intervalles de confiance", reference: 1, echelleLog: true }),
    ]),
    h("div.interpretation", { texte: r.interpretation }),
    fisher ? h("p.texte-secondaire", {
      texte: `Effectif inférieur à 100 : le test exact de Fisher a été retenu (p = ${fmt.valeurP(fisher.p)}), ` +
        `plus fiable que le χ² sur petits effectifs.`,
    }) : null,
    chi2?.assumptions?.warning ? h("div.avertissement", { texte: chi2.assumptions.warning }) : null,
  ]);
}

function rendreSurvie(jeu, cleDelai, cleEvenement, cleGroupe) {
  const delais = colonne(jeu, cleDelai);
  const evenements = colonne(jeu, cleEvenement).map(binaire);

  if (!cleGroupe) {
    const km = surv.kaplanMeier(delais, evenements);
    if (!km) return h("div.carte", [h("div.avertissement", { texte: "Données de survie inexploitables." })]);
    return h("div.resultat-test", [
      h("h2", { texte: "Analyse de survie de Kaplan-Meier" }),
      h("div.resultat-test__stat", [
        blocStat("Sujets", fmt.nombre(km.n)),
        blocStat("Événements", fmt.nombre(km.events)),
        blocStat("Censurés", fmt.nombre(km.censored)),
        blocStat("Survie médiane", km.medianSurvival !== null ? fmt.nombre(km.medianSurvival, 1) : "non atteinte"),
        blocStat("Survie moyenne restreinte", fmt.nombre(km.restrictedMeanSurvival, 2)),
      ]),
      h("div.graphique-carte", [courbeSurvie([{ label: "Ensemble", steps: km.steps, n: km.n }],
        { libelleX: nomColonne(jeu, cleDelai) })]),
      h("div.interpretation", { texte: km.interpretation }),
    ]);
  }

  const groupes = colonne(jeu, cleGroupe);
  const niveaux = [...new Set(groupes.map(g => String(g ?? "").trim()).filter(Boolean))].sort();
  const courbes = niveaux.map(n => {
    const idx = groupes.map((g, i) => (String(g ?? "").trim() === n ? i : -1)).filter(i => i >= 0);
    const km = surv.kaplanMeier(idx.map(i => delais[i]), idx.map(i => evenements[i]), { label: n });
    return km ? { label: n, steps: km.steps, n: km.n, km } : null;
  }).filter(Boolean);

  const logRank = surv.logRankTest(delais, evenements, groupes);

  return h("div.resultat-test", [
    h("h2", { texte: `Survie selon ${nomColonne(jeu, cleGroupe)}` }),
    logRank ? h("div.resultat-test__stat", [
      blocStat("χ² du log-rank", fmt.nombre(logRank.statistic, 3)),
      blocStat("ddl", String(logRank.df)),
      blocStat("p", fmt.valeurP(logRank.p), logRank.p < 0.05 ? "significatif" : "non-significatif"),
      logRank.hazardRatio ? blocStat("Rapport de risques", fmt.nombre(logRank.hazardRatio, 3)) : null,
      logRank.hazardRatioCI
        ? blocStat("IC 95 % du HR", fmt.intervalle(logRank.hazardRatioCI.lower, logRank.hazardRatioCI.upper, 2))
        : null,
    ].filter(Boolean)) : null,
    h("div.graphique-carte", [courbeSurvie(courbes, {
      libelleX: nomColonne(jeu, cleDelai), pLogRank: logRank?.p,
    })]),
    logRank ? tableau([
      { cle: "group", titre: "Groupe" },
      { cle: "n", titre: "n", aligne: "droite" },
      { cle: "observed", titre: "Observés", aligne: "droite", valeur: g => fmt.nombre(g.observed) },
      { cle: "expected", titre: "Attendus", aligne: "droite", valeur: g => fmt.nombre(g.expected, 2) },
      { cle: "median", titre: "Survie médiane", aligne: "droite",
        valeur: g => g.medianSurvival !== null ? fmt.nombre(g.medianSurvival, 1) : "non atteinte" },
    ], logRank.groups, { compact: true }) : null,
    logRank ? h("div.interpretation", { texte: logRank.interpretation }) : null,
  ]);
}

function rendreACP(jeu, cles) {
  const acp = mult.pca(cles.map(c => ({ name: nomColonne(jeu, c), values: colonne(jeu, c) })));
  if (!acp) return h("div.carte", [h("div.avertissement", { texte: "Effectif ou nombre de variables insuffisant." })]);

  return h("div.resultat-test", [
    h("h2", { texte: "Analyse en composantes principales" }),
    h("div.resultat-test__stat", [
      blocStat("Observations", fmt.nombre(acp.n)),
      blocStat("Variables", fmt.nombre(acp.variables.length)),
      blocStat("Composantes retenues", fmt.nombre(acp.componentsRetained)),
      blocStat("Indice KMO", fmt.nombre(acp.kmo, 3)),
      blocStat("Sphéricité de Bartlett", fmt.valeurP(acp.bartlettSphericity.p)),
    ]),
    acp.kmo < 0.6 ? h("div.avertissement", {
      texte: `L'indice KMO (${fmt.nombre(acp.kmo, 3)}) est inférieur à 0,60 : les variables sont trop peu ` +
        `corrélées entre elles pour qu'une ACP soit pertinente.`,
    }) : null,
    h("div.grille.grille--2", [
      h("div.graphique-carte", [barres(
        acp.eigenvalues.slice(0, 10).map((v, i) => ({
          label: `CP${i + 1}`, valeur: Number(v.toFixed(3)),
          couleur: v > 1 ? COULEURS.accent : COULEURS.neutre,
        })),
        { titre: "Éboulis des valeurs propres", libelleY: "Valeur propre" })]),
      h("div.graphique-carte", [nuage(
        acp.scores.map(s => ({ x: s[0], y: s[1] })),
        { titre: "Plan factoriel 1-2 (individus)",
          libelleX: `CP1 (${fmt.pourcent(acp.explainedVariance[0])})`,
          libelleY: `CP2 (${fmt.pourcent(acp.explainedVariance[1])})`, hauteur: 320 })]),
    ]),
    h("h3", { style: { marginTop: "14px" }, texte: "Saturations des variables" }),
    h("div.tableau-defilement", [
      h("table.tableau.tableau--compact", [
        h("thead", [h("tr", [h("th", "Variable"),
          ...acp.eigenvalues.slice(0, Math.min(4, acp.componentsRetained + 1))
            .map((_, i) => h("th", { style: { textAlign: "right" }, texte: `CP${i + 1}` })),
          h("th", { style: { textAlign: "right" }, texte: "Communauté" })])]),
        h("tbody", acp.variables.map((v, i) => h("tr", [
          h("td", [h("strong", { texte: v })]),
          ...acp.loadings[i].slice(0, Math.min(4, acp.componentsRetained + 1)).map(l =>
            h("td", { style: { textAlign: "right",
              fontWeight: Math.abs(l) > 0.5 ? "700" : "400",
              color: Math.abs(l) > 0.5 ? "var(--accent)" : "inherit" },
              texte: fmt.nombre(l, 3) })),
          h("td", { style: { textAlign: "right" }, texte: fmt.nombre(acp.communalities[i], 3) }),
        ]))),
      ]),
    ]),
    h("div.interpretation", { texte: acp.interpretation }),
    h("p.texte-secondaire", {
      texte: "Une saturation supérieure à 0,50 en valeur absolue (en gras) indique que la variable " +
        "contribue fortement à la composante.",
    }),
  ]);
}

function rendreClassification(jeu, cles, k) {
  const km = mult.kMeans(cles.map(c => ({ name: nomColonne(jeu, c), values: colonne(jeu, c) })), k);
  if (!km) return h("div.carte", [h("div.avertissement", { texte: "Effectif insuffisant." })]);

  return h("div.resultat-test", [
    h("h2", { texte: `Classification en ${k} groupes (k-moyennes)` }),
    h("div.resultat-test__stat", [
      blocStat("Observations classées", fmt.nombre(km.n)),
      blocStat("Inertie expliquée", fmt.pourcent(km.varianceExplained)),
      blocStat("Silhouette moyenne", fmt.nombre(km.silhouette, 3)),
      blocStat("Itérations", fmt.nombre(km.iterations)),
    ]),
    h("div.graphique-carte", [barres(km.clusters.map((c, i) => ({
      label: `Classe ${c.cluster}`, valeur: c.size,
    })), { titre: "Effectif des classes", libelleY: "Nombre d'observations" })]),
    ...km.clusters.map(c => h("div.carte", { style: { background: "var(--surface-2)" } }, [
      h("h3", { texte: `Classe ${c.cluster} — ${c.size} observations (${fmt.pourcent(c.percent)})` }),
      tableau([
        { cle: "variable", titre: "Variable" },
        { cle: "original", titre: "Valeur moyenne", aligne: "droite", valeur: x => fmt.nombre(x.original, 3) },
        { cle: "standardized", titre: "Écart à la moyenne générale", aligne: "droite",
          rendu: x => h("span", {
            style: { color: Math.abs(x.standardized) > 0.5
              ? (x.standardized > 0 ? "var(--critique)" : "var(--accent)") : "inherit",
              fontWeight: Math.abs(x.standardized) > 0.5 ? "700" : "400" },
            texte: `${x.standardized > 0 ? "+" : ""}${fmt.nombre(x.standardized, 2)} σ`,
          }) },
      ], c.centroid, { compact: true, parPage: 20 }),
    ])),
    h("div.interpretation", { texte: km.interpretation }),
    h("p.texte-secondaire", {
      texte: "L'écart est exprimé en nombre d'écarts-types par rapport à la moyenne de l'ensemble : " +
        "il caractérise le profil de chaque classe.",
    }),
  ]);
}

function rendreCronbach(jeu, cles) {
  const a = inf.cronbachAlpha(cles.map(c => colonne(jeu, c)));
  if (!a) return h("div.carte", [h("div.avertissement", { texte: "Au moins deux items sont nécessaires." })]);
  return h("div.resultat-test", [
    h("h2", { texte: "Cohérence interne de l'échelle" }),
    h("div.resultat-test__stat", [
      blocStat("Alpha de Cronbach", fmt.nombre(a.alpha, 4),
        a.alpha >= 0.7 ? "significatif" : "non-significatif"),
      blocStat("Items", fmt.nombre(a.items)),
      blocStat("Observations", fmt.nombre(a.n)),
    ]),
    tableau([
      { cle: "item", titre: "Item", valeur: (_, i) => "" },
      { cle: "correlation", titre: "Corrélation item-total", aligne: "droite" },
      { cle: "alphaSans", titre: "Alpha si l'item est retiré", aligne: "droite" },
    ], cles.map((c, i) => ({
      item: nomColonne(jeu, c),
      correlation: fmt.nombre(a.itemTotalCorrelations[i], 3),
      alphaSans: a.alphaIfItemDeleted[i] === null ? "—" : fmt.nombre(a.alphaIfItemDeleted[i], 3),
    })).map(r => ({ ...r })), { compact: true }),
    h("div.interpretation", { texte: a.interpretation }),
    h("p.texte-secondaire", {
      texte: "Un item dont le retrait augmenterait sensiblement l'alpha, ou dont la corrélation item-total " +
        "est inférieure à 0,30, mérite d'être reformulé ou écarté.",
    }),
  ]);
}

function rendreBlandAltman(jeu, cle1, cle2) {
  const ba = diag.blandAltman(colonne(jeu, cle1), colonne(jeu, cle2));
  if (!ba) return h("div.carte", [h("div.avertissement", { texte: "Effectif insuffisant." })]);
  const lin = diag.linConcordance(colonne(jeu, cle1), colonne(jeu, cle2));

  return h("div.resultat-test", [
    h("h2", { texte: `Concordance — ${nomColonne(jeu, cle1)} et ${nomColonne(jeu, cle2)}` }),
    h("div.resultat-test__stat", [
      blocStat("Biais moyen", fmt.nombre(ba.bias, 4)),
      blocStat("IC 95 % du biais", fmt.intervalle(ba.biasCI.lower, ba.biasCI.upper, 3)),
      blocStat("Limites d'agrément", fmt.intervalle(ba.limitsOfAgreement.lower, ba.limitsOfAgreement.upper, 3)),
      blocStat("Paires", fmt.nombre(ba.n)),
      lin ? blocStat("Concordance de Lin", fmt.nombre(lin.ccc, 4)) : null,
    ].filter(Boolean)),
    h("div.graphique-carte", [nuage(
      ba.points.map(p => ({ x: p.mean, y: p.difference })),
      { titre: "Diagramme de Bland-Altman",
        libelleX: "Moyenne des deux méthodes", libelleY: "Différence",
        hauteur: 360 })]),
    h("div.interpretation", { texte: ba.interpretation }),
    lin ? h("p.texte-secondaire", { texte: `Coefficient de concordance de Lin : ${lin.interpretation}` }) : null,
    Math.abs(ba.proportionalBiasSlope) > 0.1 ? h("div.avertissement", {
      texte: `Un biais proportionnel est détecté (pente ${fmt.nombre(ba.proportionalBiasSlope, 3)}) : ` +
        `l'écart entre les deux méthodes dépend du niveau de la mesure.`,
    }) : null,
  ]);
}

function rendrePuissance(p) {
  const taille = inf.powerTTest({ d: p.d, power: p.puissance, alpha: p.alpha });
  const courbe = [];
  for (let n = 5; n <= 200; n += 5) {
    const r = inf.powerTTest({ n, d: p.d, alpha: p.alpha });
    courbe.push({ x: n, y: r.power * 100 });
  }
  return h("div.resultat-test", [
    h("h2", { texte: "Taille d'échantillon et puissance" }),
    h("div.resultat-test__stat", [
      blocStat("Taille d'effet visée", fmt.nombre(p.d, 2)),
      blocStat("Puissance visée", fmt.pourcent(p.puissance * 100)),
      blocStat("Risque alpha", fmt.nombre(p.alpha, 3)),
      blocStat("Effectif par groupe", fmt.nombre(taille.n)),
      blocStat("Effectif total", fmt.nombre(taille.n * 2)),
    ]),
    h("div.interpretation", { texte: taille.interpretation }),
    h("div.graphique-carte", [lignes([{ nom: "Puissance", points: courbe }], {
      titre: "Puissance selon l'effectif par groupe",
      libelleX: "Effectif par groupe", libelleY: "Puissance (%)",
      points: false, yMin: 0, yMax: 100,
      references: [{ valeur: 80, label: "seuil usuel de 80 %", couleur: COULEURS.normal }],
    })]),
    h("p.texte-secondaire", {
      texte: "Repères usuels du d de Cohen : 0,20 effet faible, 0,50 effet moyen, 0,80 effet fort. " +
        "Un calcul d'effectif doit être réalisé avant le recueil des données, jamais après.",
    }),
  ]);
}

/* ===================== Graphiques auxiliaires ===================== */

function graphiqueUneVariable(jeu, cle) {
  const xs = desc.numeric(colonne(jeu, cle));
  return histogramme(desc.histogram(xs).bins, {
    titre: nomColonne(jeu, cle), densite: desc.kde(xs), moyenne: desc.mean(xs),
  });
}

function graphiqueGroupes(jeu, cle, cleGroupe) {
  const g = desc.groupBy(colonne(jeu, cle), colonne(jeu, cleGroupe));
  return boites([...g.entries()].map(([label, vals]) => ({
    label, ...desc.boxplotData(desc.numeric(vals)),
  })), { titre: `${nomColonne(jeu, cle)} selon ${nomColonne(jeu, cleGroupe)}`,
    libelleY: nomColonne(jeu, cle) });
}

function graphiqueApparie(jeu, cleAvant, cleApres) {
  const a = colonne(jeu, cleAvant), b = colonne(jeu, cleApres);
  const points = [];
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const x = Number(a[i]), y = Number(b[i]);
    if (Number.isFinite(x) && Number.isFinite(y)) points.push({ x, y });
  }
  return nuage(points, {
    titre: "Comparaison appariée",
    libelleX: nomColonne(jeu, cleAvant), libelleY: nomColonne(jeu, cleApres),
    regression: true,
  });
}

/* ===================== Export du résultat ===================== */

async function exporterResultat() {
  if (!dernierResultat) return alerte("Lancez d'abord une analyse.");
  const { analyse, jeu, sortie } = dernierResultat;
  // Le rendu HTML est converti en texte structuré, exploitable dans un mémoire
  const texte = sortie.innerText || sortie.textContent || "";
  const enTete = `MediStat — ${analyse.nom}\n` +
    `Jeu de données : ${jeu.nom} (${jeu.lignes.length} observations)\n` +
    `Date : ${new Date().toLocaleString("fr-FR")}\n` +
    `${"=".repeat(64)}\n\n`;
  telecharger(enTete + texte,
    `analyse-${analyse.cle}-${new Date().toISOString().slice(0, 10)}.txt`, "text/plain");
  await store.tracer("export", "analyse", null, `Export du résultat : ${analyse.nom}`);
  succes("Résultat exporté.");
}
