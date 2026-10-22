// medistat/js/modules/qualitatif.js
// Analyse qualitative — texte libre, verbatims patients, commentaires de
// biologistes, motifs de consultation. Livre de codes, codage thématique,
// lexicométrie, concordancier, cooccurrences, saturation, accord inter-codeurs
// et passerelle méthodes mixtes vers l'analyse quantitative.

import { h, fmt, tableau, badge, modale, confirmer, erreur, succes, alerte,
  etatVide, formulaire, remplacer, onglets, carteStat, surligner } from "../core/ui.js";
import * as store from "../core/store.js";
import { utilisateurCourant } from "../core/auth.js";
import { nouvelId } from "../core/model.js";
import { chargerJeux, colonnesTypees } from "./donnees.js";
import * as qual from "../stats/qualitative.js";
import { barres, secteurs, lignes as graphLignes, carteChaleur, pareto, COULEURS, PALETTE } from "../core/charts.js";
import { telecharger, versCSV, versXLSX } from "../core/export.js";

/* ===================== Corpus ===================== */

async function chargerCorpus() {
  const u = utilisateurCourant();
  return (await store.lireTout("corpus"))
    .filter(c => !c._supprime && (!c.etablissementId || c.etablissementId === u?.etablissementId))
    .sort((a, b) => (a.dateCreation < b.dateCreation ? 1 : -1));
}

// Livre de codes proposé par défaut, adapté au retour d'expérience patient.
// Il sert d'amorce : l'utilisateur l'adapte à sa problématique.
const LIVRE_DE_CODES_TYPE = [
  { code: "ATTENTE", theme: "Organisation", patterns: ["attente", "attendu", "attendre", "retard", "long", "lent", "file"] },
  { code: "ACCUEIL", theme: "Organisation", patterns: ["accueil", "accueilli", "réception", "secrétariat", "orientation"] },
  { code: "COUT", theme: "Accessibilité", patterns: ["coût", "cout", "cher", "prix", "tarif", "payer", "moyens", "argent"] },
  { code: "COMPETENCE", theme: "Qualité des soins", patterns: ["compétent", "competent", "professionnel", "sérieux", "expérience"] },
  { code: "ECOUTE", theme: "Relation soignant-soigné", patterns: ["écoute", "ecoute", "attentif", "attentive", "rassurant", "explique", "explication"] },
  { code: "DOULEUR", theme: "Vécu corporel", patterns: ["douleur", "douloureux", "mal", "souffrance", "piqûre", "piqure"] },
  { code: "AMELIORATION", theme: "Résultat clinique", patterns: ["amélioration", "amelioration", "mieux", "guéri", "gueri", "guérison", "efficace"] },
  { code: "INQUIETUDE", theme: "Vécu psychique", patterns: ["inquiet", "inquiétude", "angoisse", "peur", "stress", "anxieux"] },
  { code: "INFORMATION", theme: "Relation soignant-soigné", patterns: ["information", "informé", "informe", "prévenu", "prevenu", "savoir", "communication"] },
  { code: "PROPRETE", theme: "Environnement", patterns: ["propre", "propreté", "sale", "hygiène", "hygiene", "confort"] },
];

/* ===================== Vue principale ===================== */

export async function vue_qualitatif({ naviguer, rafraichir, segments }) {
  if (segments?.[0]) return analyserCorpus(segments[0], { naviguer, rafraichir });

  const corpus = await chargerCorpus();

  return h("div", [
    h("div.page-entete", [
      h("div.page-entete__titre", [
        h("h1", { texte: "Analyse qualitative" }),
        h("p.texte-secondaire", {
          texte: "Analysez les commentaires libres, verbatims et observations : codage thématique, " +
            "lexicométrie, cooccurrences et croisement avec les variables quantitatives.",
        }),
      ]),
      h("div.page-entete__actions", [
        h("button.btn.btn--primaire", { texte: "＋ Nouveau corpus",
          onclick: () => assistantCorpus(rafraichir) }),
      ]),
    ]),

    corpus.length
      ? h("div.grille.grille--3", corpus.map(c => h("div.carte-stat.carte-stat--cliquable", {
          onclick: () => naviguer(`qualitatif/${c.id}`),
        }, [
          h("div.carte-stat__icone", { texte: "💬" }),
          h("div.carte-stat__corps", [
            h("div", { style: { fontWeight: "650" }, texte: c.nom }),
            h("div.carte-stat__libelle", {
              texte: `${fmt.nombre(c.documents.length)} documents — ${c.codebook.length} codes`,
            }),
            h("div.carte-stat__detail", { texte: `Créé ${fmt.relatif(c.dateCreation)}` }),
          ]),
        ])))
      : etatVide({
          icone: "💬", titre: "Aucun corpus",
          message: "Constituez un corpus à partir des commentaires de vos patients, des observations " +
            "cliniques ou d'un fichier texte.",
          action: { libelle: "Créer un corpus", action: () => assistantCorpus(rafraichir) },
        }),

    h("div.carte", { style: { marginTop: "20px" } }, [
      h("h3", { texte: "À quoi sert l'analyse qualitative ?" }),
      h("p.texte-secondaire", {
        texte: "Les chiffres disent combien ; les mots disent pourquoi. Un taux de satisfaction de 62 % " +
          "ne dit pas ce qui déplaît : le codage thématique des commentaires le révèle, et le croisement " +
          "avec les variables quantitatives montre si le problème touche tous les patients ou seulement " +
          "certains services.",
      }),
      h("p.texte-secondaire", {
        texte: "La démarche suit trois temps : constituer le corpus, construire le livre de codes " +
          "(les thèmes recherchés), puis appliquer ce codage et l'interpréter. La courbe de saturation " +
          "indique quand le recueil peut s'arrêter : lorsque les nouveaux documents n'apportent plus " +
          "de thème inédit.",
      }),
    ]),
  ]);
}

/* ===================== Constitution d'un corpus ===================== */

async function assistantCorpus(apres) {
  const jeux = await chargerJeux();
  const sources = [
    { valeur: "consultations", libelle: "Commentaires des patients (consultations)" },
    { valeur: "biologistes", libelle: "Commentaires des biologistes (résultats)" },
    { valeur: "symptomes", libelle: "Descriptions de symptômes (consultations)" },
    ...jeux.map(j => ({ valeur: `jeu:${j.id}`, libelle: `Jeu de données : ${j.nom}` })),
    { valeur: "fichier", libelle: "Importer un fichier texte ou CSV" },
  ];

  const form = formulaire([
    { cle: "nom", libelle: "Nom du corpus", obligatoire: true, pleineLargeur: true,
      defaut: `Corpus du ${new Date().toLocaleDateString("fr-FR")}` },
    { cle: "source", libelle: "Source des documents", type: "select", obligatoire: true, vide: false,
      options: sources, pleineLargeur: true },
    { cle: "livreCodes", libelle: "Livre de codes", type: "select", vide: false,
      options: [
        { valeur: "type", libelle: "Livre de codes type (retour d'expérience patient)" },
        { valeur: "vide", libelle: "Partir d'un livre vide" },
      ], pleineLargeur: true },
  ]);
  form.classList.add("formulaire--grille");

  const choix = await modale({
    titre: "Nouveau corpus", contenu: form, largeur: "620px",
    actions: [
      { libelle: "Annuler", type: "neutre", valeur: null },
      { libelle: "Constituer le corpus", type: "primaire", action: () => form.valeurs() },
    ],
  });
  if (!choix) return;

  try {
    let documents = [];

    if (choix.source === "fichier") {
      documents = await importerTextes();
      if (!documents) return;
    } else if (choix.source.startsWith("jeu:")) {
      const jeu = jeux.find(j => j.id === choix.source.slice(4));
      const colonnes = colonnesTypees(jeu);
      // Une variable texte est nécessaire : sans elle, il n'y a rien à analyser
      const textuelles = jeu.variables.filter(v =>
        v.type === "texte" || v.cle === "verbatim" ||
        jeu.lignes.some(l => String(l[v.cle] ?? "").length > 40));
      if (!textuelles.length) {
        return erreur("Ce jeu de données ne contient aucune variable textuelle exploitable.");
      }
      const select = h("select.champ", textuelles.map(v =>
        h("option", { value: v.cle, texte: v.nom || v.cle })));
      const ok = await modale({
        titre: "Choisir la variable textuelle",
        contenu: h("div.formulaire", [
          h("div.champ-groupe", [h("label.champ-libelle", { texte: "Variable à analyser" }), select]),
        ]),
        largeur: "460px",
        actions: [{ libelle: "Annuler", type: "neutre", valeur: null },
          { libelle: "Valider", type: "primaire", valeur: true }],
      });
      if (!ok) return;
      documents = jeu.lignes
        .map((l, i) => ({ id: String(l.id ?? `L${i + 1}`), text: String(l[select.value] ?? ""), meta: l }))
        .filter(d => d.text.trim().length > 10);
    } else {
      documents = await extraireDocuments(choix.source);
    }

    if (!documents.length) {
      return alerte("Aucun document exploitable n'a été trouvé pour cette source.");
    }

    const corpus = {
      id: nouvelId("cor"),
      nom: choix.nom,
      source: choix.source,
      documents,
      codebook: choix.livreCodes === "type"
        ? LIVRE_DE_CODES_TYPE.map(c => ({ ...c }))
        : [],
      dateCreation: new Date().toISOString(),
      creePar: utilisateurCourant()?.id,
      etablissementId: utilisateurCourant()?.etablissementId,
    };
    await store.ecrire("corpus", corpus);
    await store.tracer("creation", "analyse", corpus.id,
      `Constitution d'un corpus qualitatif : ${documents.length} documents`);
    succes(`Corpus créé : ${documents.length} documents.`);
    apres?.();
  } catch (e) { erreur(e.message); }
}

async function extraireDocuments(source) {
  if (source === "consultations" || source === "symptomes") {
    const consultations = await store.depots.consultations.lister({ filtre: c => !c._supprime });
    const patients = await store.lireTout("patients");
    const champ = source === "consultations" ? "commentairePatient" : "symptomes";
    return consultations
      .filter(c => String(c[champ] ?? "").trim().length > 10)
      .map(c => {
        const p = patients.find(x => x.id === c.patientId);
        return {
          id: c.id,
          text: c[champ],
          // Les métadonnées permettront le croisement méthodes mixtes
          meta: {
            service: c.service || "",
            diagnostic: c.diagnostic || "",
            date: c.date,
            sexe: p?.sexe || "",
            ville: p?.ville || "",
          },
        };
      });
  }
  if (source === "biologistes") {
    const resultats = await store.depots.resultats.lister({ filtre: r => !r._supprime });
    return resultats
      .filter(r => String(r.commentaireBiologiste ?? "").trim().length > 10)
      .map(r => ({
        id: r.id, text: r.commentaireBiologiste,
        meta: { test: r.testCode, critique: r.critique ? "oui" : "non", date: r.dateValidation },
      }));
  }
  return [];
}

function importerTextes() {
  return new Promise(resolve => {
    const input = h("input", { type: "file", accept: ".txt,.csv,.md", multiple: true, hidden: true });
    document.body.appendChild(input);
    input.click();
    input.onchange = async () => {
      const fichiers = [...input.files];
      input.remove();
      if (!fichiers.length) return resolve(null);
      const documents = [];
      for (const f of fichiers) {
        const texte = await f.text();
        if (f.name.endsWith(".csv")) {
          const { depuisCSV } = await import("../core/export.js");
          const lu = depuisCSV(texte);
          // La colonne la plus longue en moyenne est retenue comme texte
          const colonneTexte = lu.entetes
            .map(e => ({ e, longueur: lu.objets.reduce((a, o) => a + String(o[e] ?? "").length, 0) }))
            .sort((a, b) => b.longueur - a.longueur)[0]?.e;
          lu.objets.forEach((o, i) => {
            const t = String(o[colonneTexte] ?? "");
            if (t.trim().length > 10) documents.push({ id: `${f.name}#${i + 1}`, text: t, meta: o });
          });
        } else {
          // Un fichier texte : chaque paragraphe séparé par une ligne vide
          // est traité comme un document distinct.
          const blocs = texte.split(/\n\s*\n/).map(b => b.trim()).filter(b => b.length > 10);
          if (blocs.length > 1) {
            blocs.forEach((b, i) => documents.push({ id: `${f.name}#${i + 1}`, text: b, meta: {} }));
          } else {
            documents.push({ id: f.name, text: texte, meta: {} });
          }
        }
      }
      resolve(documents);
    };
  });
}

/* ===================== Analyse d'un corpus ===================== */

async function analyserCorpus(id, { naviguer, rafraichir }) {
  const corpus = (await chargerCorpus()).find(c => c.id === id);
  if (!corpus) return etatVide({ icone: "🔍", titre: "Corpus introuvable",
    action: { libelle: "Retour", action: () => naviguer("qualitatif") } });

  const textes = corpus.documents.map(d => d.text);
  const lexique = qual.wordFrequency(textes, { top: 60 });
  const synthese = corpus.codebook.length
    ? qual.corpusSummary(corpus.documents, corpus.codebook)
    : null;

  const entete = h("div", [
    h("button.btn.btn--fin", { texte: "‹ Retour aux corpus", onclick: () => naviguer("qualitatif") }),
    h("div.page-entete", [
      h("div.page-entete__titre", [
        h("h1", { texte: corpus.nom }),
        h("p.texte-secondaire", {
          texte: `${fmt.nombre(corpus.documents.length)} documents — ` +
            `${fmt.nombre(lexique.totalTokens)} mots pleins — ${corpus.codebook.length} codes`,
        }),
      ]),
      h("div.page-entete__actions", [
        h("button.btn", { texte: "📖 Livre de codes",
          onclick: () => editerLivreDeCodes(corpus, rafraichir) }),
        h("button.btn", { texte: "⬇ Exporter", onclick: () => exporterCorpus(corpus, synthese, lexique) }),
        h("button.btn.btn--danger", { texte: "Supprimer", onclick: async () => {
          if (!(await confirmer(`Supprimer le corpus « ${corpus.nom} » ?`, { danger: true }))) return;
          await store.supprimer("corpus", corpus.id);
          await store.tracer("suppression", "analyse", corpus.id, `Suppression du corpus « ${corpus.nom} »`);
          succes("Corpus supprimé."); naviguer("qualitatif");
        } }),
      ]),
    ]),
    h("div.grille.grille--4", [
      carteStat({ libelle: "Documents", valeur: fmt.nombre(corpus.documents.length), icone: "📄" }),
      carteStat({ libelle: "Mots pleins", valeur: fmt.nombre(lexique.totalTokens), icone: "🔤" }),
      carteStat({ libelle: "Vocabulaire", valeur: fmt.nombre(lexique.uniqueWords), icone: "📚",
        detail: `Indice de Guiraud : ${fmt.nombre(lexique.guiraudIndex, 1)}` }),
      carteStat({ libelle: "Segments codés",
        valeur: synthese ? fmt.nombre(synthese.coding.totalSegments) : "—", icone: "🏷️",
        couleur: COULEURS.accent }),
    ]),
  ]);

  return h("div", [entete, onglets([
    { libelle: "Thèmes et codage", contenu: () => vueCodage(corpus, synthese, rafraichir) },
    { libelle: "Lexique", contenu: () => vueLexique(corpus, lexique, textes) },
    { libelle: "Cooccurrences", contenu: () => vueCooccurrences(synthese) },
    { libelle: "Méthodes mixtes", contenu: () => vueMethodesMixtes(corpus, synthese) },
    { libelle: "Concordancier", contenu: () => vueConcordancier(corpus, lexique) },
    { libelle: "Documents", contenu: () => vueDocuments(corpus, synthese) },
  ])]);
}

/* ===================== Codage thématique ===================== */

function vueCodage(corpus, synthese, rafraichir) {
  if (!corpus.codebook.length) {
    return etatVide({
      icone: "📖", titre: "Aucun code défini",
      message: "Le livre de codes recense les thèmes que vous recherchez dans le corpus. " +
        "Constituez-le d'abord, à partir d'une première lecture des documents.",
      action: { libelle: "Créer le livre de codes",
        action: () => editerLivreDeCodes(corpus, rafraichir) },
    });
  }

  const codage = synthese.coding;
  const themes = synthese.themes;

  return h("div", [
    h("div.grille.grille--2", [
      h("div.graphique-carte", [
        barres(codage.codeStats.slice(0, 15).map(s => ({
          label: s.code, valeur: s.occurrences,
        })), { titre: "Fréquence des codes", libelleY: "Occurrences" }),
      ]),
      h("div.graphique-carte", [
        secteurs(themes.map(t => ({ label: t.theme, valeur: t.occurrences })), {
          titre: "Répartition par thème", anneau: true,
          centre: { valeur: fmt.nombre(codage.totalSegments), libelle: "segments" },
        }),
      ]),
    ]),

    h("div.carte", [
      h("div.carte__entete", [h("h3", { texte: "Codes et couverture" })]),
      h("p.texte-secondaire", {
        texte: "La couverture indique la part des documents dans lesquels le code apparaît. " +
          "Un code présent dans moins de 5 % des documents est marginal ; au-delà de 80 %, " +
          "il est probablement trop général pour être discriminant.",
      }),
      tableau([
        { cle: "code", titre: "Code" },
        { cle: "theme", titre: "Thème", rendu: s => badge(s.theme || "—") },
        { cle: "occurrences", titre: "Occurrences", aligne: "droite",
          valeur: s => fmt.nombre(s.occurrences) },
        { cle: "documents", titre: "Documents", aligne: "droite", valeur: s => fmt.nombre(s.documents) },
        { cle: "couverture", titre: "Couverture", aligne: "droite",
          rendu: s => h("span", {
            style: { color: s.coverage > 0.8 ? "var(--alerte)"
              : s.coverage < 0.05 ? "var(--texte-3)" : "var(--texte)" },
            texte: fmt.pourcent(s.coverage * 100),
          }),
          triSur: s => s.coverage },
      ], codage.codeStats, { parPage: 25, compact: true }),
    ]),

    h("div.carte", [
      h("div.carte__entete", [h("h3", { texte: "Synthèse par thème" })]),
      tableau([
        { cle: "theme", titre: "Thème" },
        { cle: "codes", titre: "Codes rattachés", valeur: t => t.codes.join(", ") },
        { cle: "occurrences", titre: "Occurrences", aligne: "droite", valeur: t => fmt.nombre(t.occurrences) },
        { cle: "documents", titre: "Documents", aligne: "droite", valeur: t => fmt.nombre(t.documents) },
      ], themes, { compact: true, parPage: 20 }),
    ]),

    // Saturation : critère méthodologique majeur en recherche qualitative
    h("div.carte", [
      h("div.carte__entete", [h("h3", { texte: "Courbe de saturation" })]),
      h("div.graphique-carte", [
        graphLignes([{
          nom: "Codes cumulés",
          points: codage.saturation.curve.map(c => ({ x: c.document, y: c.cumulativeCodes })),
        }], {
          titre: "Codes nouveaux au fil du recueil",
          libelleX: "Document", libelleY: "Nombre de codes distincts",
          points: codage.saturation.curve.length <= 60,
          hauteur: 300,
        }),
      ]),
      h("div", {
        class: codage.saturation.reached ? "interpretation" : "avertissement",
        texte: codage.saturation.interpretation,
      }),
      h("p.texte-secondaire", {
        texte: "La saturation théorique est atteinte lorsque la courbe s'aplatit : les documents " +
          "supplémentaires n'apportent plus de thème inédit. C'est le critère qui justifie " +
          "méthodologiquement l'arrêt du recueil.",
      }),
    ]),

    // Analyse de sentiment
    h("div.carte", [
      h("div.carte__entete", [h("h3", { texte: "Tonalité des documents" })]),
      h("div.grille.grille--2", [
        h("div.graphique-carte", [
          secteurs([
            { label: "Positif", valeur: synthese.sentiment.positive, couleur: COULEURS.normal },
            { label: "Neutre", valeur: synthese.sentiment.neutral, couleur: COULEURS.neutre },
            { label: "Négatif", valeur: synthese.sentiment.negative, couleur: COULEURS.critique },
          ].filter(s => s.valeur > 0), { titre: "Répartition de la tonalité" }),
        ]),
        h("div", [
          h("div.resultat-test__stat", [
            h("div.stat-bloc", [
              h("span.stat-bloc__libelle", { texte: "Tonalité moyenne" }),
              h("span.stat-bloc__valeur", {
                style: { color: synthese.sentiment.mean > 0 ? "var(--succes)" : "var(--danger)" },
                texte: fmt.nombre(synthese.sentiment.mean, 3),
              }),
            ]),
          ]),
          h("p.texte-secondaire", {
            texte: "La tonalité est estimée par un lexique de polarité tenant compte des négations " +
              "et des intensificateurs. Elle donne une tendance générale, à confirmer par la lecture : " +
              "l'ironie et l'implicite lui échappent, comme à toute analyse automatique.",
          }),
        ]),
      ]),
    ]),
  ]);
}

/* ===================== Lexique ===================== */

function vueLexique(corpus, lexique, textes) {
  const bigrammes = qual.ngrams(textes, 2, { minCount: 2, top: 30 });
  const trigrammes = qual.ngrams(textes, 3, { minCount: 2, top: 20 });

  return h("div", [
    h("div.graphique-carte", [
      barres(lexique.rows.slice(0, 25).map(r => ({ label: r.word, valeur: r.count })), {
        titre: "Mots les plus fréquents", libelleY: "Occurrences", hauteur: 380,
      }),
    ]),

    h("div.carte", [
      h("div.carte__entete", [h("h3", { texte: "Richesse lexicale" })]),
      h("div.resultat-test__stat", [
        h("div.stat-bloc", [h("span.stat-bloc__libelle", { texte: "Mots pleins" }),
          h("span.stat-bloc__valeur", { texte: fmt.nombre(lexique.totalTokens) })]),
        h("div.stat-bloc", [h("span.stat-bloc__libelle", { texte: "Vocabulaire distinct" }),
          h("span.stat-bloc__valeur", { texte: fmt.nombre(lexique.uniqueWords) })]),
        h("div.stat-bloc", [h("span.stat-bloc__libelle", { texte: "Rapport type/token" }),
          h("span.stat-bloc__valeur", { texte: fmt.nombre(lexique.typeTokenRatio, 3) })]),
        h("div.stat-bloc", [h("span.stat-bloc__libelle", { texte: "Indice de Guiraud" }),
          h("span.stat-bloc__valeur", { texte: fmt.nombre(lexique.guiraudIndex, 2) })]),
        h("div.stat-bloc", [h("span.stat-bloc__libelle", { texte: "Hapax (mots uniques)" }),
          h("span.stat-bloc__valeur", { texte: fmt.pourcent(lexique.hapaxRatio * 100) })]),
      ]),
      h("p.texte-secondaire", {
        texte: "Le rapport type/token dépend fortement de la longueur du corpus ; l'indice de Guiraud " +
          "le corrige et permet de comparer des corpus de tailles différentes. Une forte proportion " +
          "d'hapax signale un vocabulaire varié, ou un corpus hétérogène.",
      }),
    ]),

    h("div.carte", [
      h("div.carte__entete", [h("h3", { texte: "Vocabulaire détaillé" })]),
      h("p.texte-secondaire", {
        texte: "Le TF-IDF pondère la fréquence par la rareté : il fait remonter les mots " +
          "caractéristiques plutôt que les mots simplement fréquents.",
      }),
      tableau([
        { cle: "word", titre: "Mot" },
        { cle: "count", titre: "Occurrences", aligne: "droite", valeur: r => fmt.nombre(r.count) },
        { cle: "frequency", titre: "Fréquence", aligne: "droite", valeur: r => fmt.pourcent(r.frequency * 100) },
        { cle: "documents", titre: "Documents", aligne: "droite", valeur: r => fmt.nombre(r.documents) },
        { cle: "tfidf", titre: "TF-IDF", aligne: "droite", valeur: r => fmt.nombre(r.tfidf * 1000, 3) },
      ], lexique.allRows.slice(0, 300), { parPage: 25, compact: true,
        triInitial: { colonne: "count", sens: "desc" } }),
    ]),

    bigrammes.length ? h("div.grille.grille--2", [
      h("div.carte", [
        h("div.carte__entete", [h("h3", { texte: "Expressions de deux mots" })]),
        tableau([
          { cle: "ngram", titre: "Expression" },
          { cle: "count", titre: "Occurrences", aligne: "droite" },
        ], bigrammes, { compact: true, parPage: 15 }),
      ]),
      trigrammes.length ? h("div.carte", [
        h("div.carte__entete", [h("h3", { texte: "Expressions de trois mots" })]),
        tableau([
          { cle: "ngram", titre: "Expression" },
          { cle: "count", titre: "Occurrences", aligne: "droite" },
        ], trigrammes, { compact: true, parPage: 15 }),
      ]) : null,
    ]) : null,
  ]);
}

/* ===================== Cooccurrences ===================== */

function vueCooccurrences(synthese) {
  if (!synthese) {
    return etatVide({ icone: "🕸️", titre: "Codage requis",
      message: "Définissez d'abord un livre de codes pour analyser les cooccurrences." });
  }
  const co = synthese.cooccurrence;
  if (!co.links.length) {
    return etatVide({ icone: "🕸️", titre: "Aucune cooccurrence",
      message: "Aucun document ne porte simultanément deux codes différents." });
  }

  return h("div", [
    h("div.graphique-carte", [
      carteChaleur(co.matrix, co.labels, co.labels, {
        titre: "Matrice de cooccurrence des codes",
      }),
    ]),
    h("p.texte-secondaire", {
      texte: "La diagonale indique le nombre de documents portant chaque code ; " +
        "les cases hors diagonale, le nombre de documents portant les deux codes.",
    }),

    h("div.carte", [
      h("div.carte__entete", [h("h3", { texte: "Associations entre codes" })]),
      h("p.texte-secondaire", {
        texte: "L'indice de Jaccard mesure le recouvrement de deux codes (de 0 à 1). " +
          "L'information mutuelle (PMI) est positive lorsque deux codes apparaissent ensemble " +
          "plus souvent que le hasard ne le prédirait.",
      }),
      tableau([
        { cle: "source", titre: "Code A" },
        { cle: "target", titre: "Code B" },
        { cle: "count", titre: "Documents communs", aligne: "droite", valeur: l => fmt.nombre(l.count) },
        { cle: "jaccard", titre: "Jaccard", aligne: "droite", valeur: l => fmt.nombre(l.jaccard, 3) },
        { cle: "pmi", titre: "PMI", aligne: "droite",
          rendu: l => h("span", {
            style: { color: l.pmi > 0.3 ? "var(--succes)" : l.pmi < -0.3 ? "var(--danger)" : "inherit" },
            texte: fmt.nombre(l.pmi, 3),
          }) },
        { cle: "phi", titre: "φ", aligne: "droite", valeur: l => fmt.nombre(l.phi, 3) },
      ], co.links, { parPage: 25, compact: true }),
    ]),

    h("div.carte", [
      h("div.carte__entete", [h("h3", { texte: "Centralité des codes" })]),
      h("p.texte-secondaire", {
        texte: "Un code fortement connecté structure le discours : il se retrouve associé à " +
          "de nombreux autres thèmes, et constitue souvent un point d'entrée pertinent pour l'action.",
      }),
      tableau([
        { cle: "code", titre: "Code" },
        { cle: "frequency", titre: "Documents", aligne: "droite", valeur: c => fmt.nombre(c.frequency) },
        { cle: "degree", titre: "Liens", aligne: "droite", valeur: c => fmt.nombre(c.degree) },
        { cle: "strength", titre: "Force des liens", aligne: "droite", valeur: c => fmt.nombre(c.strength, 3) },
      ], co.centrality, { compact: true, parPage: 20 }),
    ]),
  ]);
}

/* ===================== Méthodes mixtes ===================== */

// C'est le point où qualitatif et quantitatif se rejoignent : un thème est-il
// plus fréquent dans un service, chez les femmes, pour un diagnostic donné ?
function vueMethodesMixtes(corpus, synthese) {
  if (!synthese) {
    return etatVide({ icone: "🔀", titre: "Codage requis",
      message: "Définissez un livre de codes pour croiser les thèmes avec vos variables." });
  }

  const clesMeta = [...new Set(corpus.documents.flatMap(d => Object.keys(d.meta || {})))]
    .filter(k => {
      const valeurs = corpus.documents.map(d => String(d.meta?.[k] ?? "").trim()).filter(Boolean);
      const distinctes = new Set(valeurs).size;
      return valeurs.length >= corpus.documents.length * 0.5 && distinctes >= 2 && distinctes <= 15;
    });

  if (!clesMeta.length) {
    return etatVide({
      icone: "🔀", titre: "Aucune variable de croisement",
      message: "Les documents de ce corpus ne portent pas de métadonnée exploitable " +
        "(service, sexe, diagnostic…). Constituez un corpus depuis les consultations " +
        "pour disposer de ces variables.",
    });
  }

  const select = h("select.champ", { style: { maxWidth: "300px" } },
    clesMeta.map(k => h("option", { value: k, texte: k })));
  const zone = h("div");

  const analyser = () => {
    const variable = corpus.documents.map(d => String(d.meta?.[select.value] ?? "").trim());
    const resultats = synthese.coding.codes.map((code, ci) => {
      const r = qual.codeByVariable(synthese.coding.matrix, ci, variable);
      return r ? { code, ...r } : null;
    }).filter(Boolean).filter(r => r.test)
      .sort((a, b) => (a.test.p ?? 1) - (b.test.p ?? 1));

    if (!resultats.length) {
      return remplacer(zone, h("p.texte-secondaire", { texte: "Croisement impossible pour cette variable." }));
    }

    const niveaux = resultats[0].levels;
    const significatifs = resultats.filter(r => r.test.p < 0.05);

    remplacer(zone, h("div", [
      h("p.texte-secondaire", {
        texte: `Chaque ligne teste si la présence du code dépend de « ${select.value} » (test du χ²). ` +
          `Les valeurs p ne sont pas corrigées pour la multiplicité : avec ${resultats.length} tests, ` +
          `il faut s'attendre à environ ${fmt.nombre(resultats.length * 0.05, 1)} faux positifs au seuil de 5 %.`,
      }),
      h("div.tableau-defilement", [
        h("table.tableau.tableau--compact", [
          h("thead", [h("tr", [
            h("th", "Code"),
            ...niveaux.map(n => h("th", { style: { textAlign: "right" }, texte: n })),
            h("th", { style: { textAlign: "right" }, texte: "p" }),
            h("th", { style: { textAlign: "right" }, texte: "V de Cramér" }),
          ])]),
          h("tbody", resultats.map(r => h("tr", [
            h("td", [h("strong", { texte: r.code })]),
            ...r.proportions.map(p => h("td", { style: { textAlign: "right" } }, [
              h("div", { texte: fmt.pourcent(p.percent) }),
              h("div.texte-secondaire", { style: { fontSize: ".72rem" },
                texte: `${p.withCode}/${p.n}` }),
            ])),
            h("td", { style: { textAlign: "right",
              fontWeight: r.test.p < 0.05 ? "700" : "400",
              color: r.test.p < 0.05 ? "var(--succes)" : "inherit" },
              texte: fmt.valeurP(r.test.p) }),
            h("td", { style: { textAlign: "right" }, texte: fmt.nombre(r.test.effect.value, 3) }),
          ]))),
        ]),
      ]),
      significatifs.length
        ? h("div.interpretation", {
            texte: `${significatifs.length} code(s) présentent une association significative avec ` +
              `« ${select.value} » : ${significatifs.slice(0, 5).map(r => r.code).join(", ")}` +
              `${significatifs.length > 5 ? "…" : ""}. Ces thèmes ne sont pas répartis uniformément : ` +
              `ils caractérisent certaines catégories plutôt que d'autres.`,
          })
        : h("div.interpretation", {
            texte: `Aucun code n'est significativement associé à « ${select.value} » : ` +
              `les thèmes se répartissent de façon comparable entre les catégories.`,
          }),
      h("div.graphique-carte", { style: { marginTop: "12px" } }, [
        carteChaleur(
          resultats.slice(0, 20).map(r => r.proportions.map(p => p.percent)),
          resultats.slice(0, 20).map(r => r.code),
          niveaux,
          { titre: `Fréquence des codes (%) selon ${select.value}` }),
      ]),
    ]));
  };

  select.addEventListener("change", analyser);
  analyser();

  return h("div", [
    h("div.carte", [
      h("div.carte__entete", [
        h("h3", { texte: "Croiser les thèmes avec une variable" }), select,
      ]),
      zone,
    ]),
  ]);
}

/* ===================== Concordancier ===================== */

function vueConcordancier(corpus, lexique) {
  const champ = h("input.champ", { type: "search", placeholder: "Mot ou expression à rechercher…",
    style: { maxWidth: "340px" } });
  const zone = h("div");
  const textes = corpus.documents.map(d => d.text);
  const ids = corpus.documents.map(d => d.id);

  const chercher = () => {
    const terme = champ.value.trim();
    if (terme.length < 2) {
      return remplacer(zone, h("p.texte-secondaire", {
        texte: "Saisissez un mot d'au moins deux caractères pour afficher ses occurrences en contexte.",
      }));
    }
    const c = qual.concordance(textes, terme, { window: 60, ids });
    if (!c.occurrences) {
      return remplacer(zone, h("p.texte-secondaire", { texte: `Aucune occurrence de « ${terme} ».` }));
    }
    remplacer(zone, h("div", [
      h("p.texte-secondaire", {
        texte: `${c.occurrences} occurrence(s) dans ${c.documents} document(s).`,
      }),
      h("div.tableau-defilement", [
        h("table.tableau.tableau--compact", [
          h("thead", [h("tr", [
            h("th", "Document"),
            h("th", { style: { textAlign: "right" } }, "Contexte gauche"),
            h("th", { style: { textAlign: "center" } }, "Terme"),
            h("th", "Contexte droit"),
          ])]),
          h("tbody", c.lines.slice(0, 200).map(l => h("tr", [
            h("td.texte-secondaire", { style: { fontSize: ".76rem" }, texte: String(l.document).slice(0, 18) }),
            h("td", { style: { textAlign: "right", fontSize: ".84rem" }, texte: "…" + l.left }),
            h("td", { style: { textAlign: "center" } }, [
              h("mark", { style: { fontWeight: "700" }, texte: l.match }),
            ]),
            h("td", { style: { fontSize: ".84rem" }, texte: l.right + "…" }),
          ]))),
        ]),
      ]),
    ]));
  };
  champ.addEventListener("input", () => { clearTimeout(champ._t); champ._t = setTimeout(chercher, 250); });
  chercher();

  return h("div", [
    h("div.carte", [
      h("div.carte__entete", [
        h("h3", { texte: "Concordancier (mot en contexte)" }), champ,
      ]),
      h("p.texte-secondaire", {
        texte: "Le concordancier affiche chaque occurrence dans son contexte immédiat. " +
          "C'est l'outil qui permet de vérifier le sens réel d'un terme avant de le coder : " +
          "« pas de douleur » et « douleur intense » contiennent le même mot.",
      }),
      h("div", { style: { display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" } },
        lexique.rows.slice(0, 14).map(r => h("button.btn.btn--petit", {
          texte: r.word, onclick: () => { champ.value = r.word; chercher(); },
        }))),
      zone,
    ]),
  ]);
}

/* ===================== Documents ===================== */

function vueDocuments(corpus, synthese) {
  return tableau([
    { cle: "id", titre: "Identifiant", valeur: d => String(d.id).slice(0, 24) },
    { cle: "codes", titre: "Codes", triable: false,
      rendu: (d) => {
        if (!synthese) return "—";
        const i = corpus.documents.indexOf(d);
        const codes = synthese.coding.codes.filter((_, ci) => synthese.coding.matrix[i]?.[ci] > 0);
        return codes.length
          ? h("div", { style: { display: "flex", gap: "4px", flexWrap: "wrap" } },
              codes.map(c => badge(c, COULEURS.accent)))
          : h("span.texte-secondaire", { texte: "aucun" });
      } },
    { cle: "longueur", titre: "Mots", aligne: "droite",
      valeur: d => fmt.nombre(String(d.text).split(/\s+/).length) },
    { cle: "extrait", titre: "Extrait", valeur: d => String(d.text).slice(0, 90) + "…" },
  ], corpus.documents, {
    parPage: 20,
    surLigne: d => {
      const i = corpus.documents.indexOf(d);
      const codes = synthese
        ? synthese.coding.codes.filter((_, ci) => synthese.coding.matrix[i]?.[ci] > 0) : [];
      const sentiment = qual.sentimentAnalysis(d.text);
      return modale({
        titre: `Document ${d.id}`,
        largeur: "680px",
        contenu: h("div", [
          codes.length ? h("div", { style: { display: "flex", gap: "5px", flexWrap: "wrap", marginBottom: "12px" } },
            codes.map(c => badge(c, COULEURS.accent))) : null,
          h("p", { style: { whiteSpace: "pre-wrap", lineHeight: "1.7" }, texte: d.text }),
          h("div.resultat-test__stat", { style: { marginTop: "12px" } }, [
            h("div.stat-bloc", [h("span.stat-bloc__libelle", { texte: "Tonalité" }),
              h("span.stat-bloc__valeur", {
                style: { color: sentiment.label === "positif" ? "var(--succes)"
                  : sentiment.label === "négatif" ? "var(--danger)" : "inherit" },
                texte: sentiment.label })]),
            h("div.stat-bloc", [h("span.stat-bloc__libelle", { texte: "Score normalisé" }),
              h("span.stat-bloc__valeur", { texte: fmt.nombre(sentiment.normalized, 2) })]),
          ]),
          Object.keys(d.meta || {}).length ? h("div", { style: { marginTop: "12px" } }, [
            h("div.champ-libelle", { texte: "Métadonnées" }),
            h("div.texte-secondaire", Object.entries(d.meta)
              .filter(([, v]) => v !== null && String(v).trim())
              .map(([k, v]) => h("div", { texte: `${k} : ${String(v).slice(0, 60)}` }))),
          ]) : null,
        ]),
        actions: [{ libelle: "Fermer", type: "neutre" }],
      });
    },
  });
}

/* ===================== Livre de codes ===================== */

async function editerLivreDeCodes(corpus, apres) {
  let codes = corpus.codebook.map(c => ({ ...c, patterns: [...c.patterns] }));
  const zone = h("div");

  const rendre = () => {
    remplacer(zone, h("div", [
      codes.length
        ? h("div.tableau-defilement", { style: { maxHeight: "44vh" } }, [
            h("table.tableau.tableau--compact", [
              h("thead", [h("tr", [h("th", "Code"), h("th", "Thème"),
                h("th", "Mots-clés recherchés"), h("th", "")])]),
              h("tbody", codes.map((c, i) => h("tr", [
                h("td", [h("input.champ", { value: c.code, style: { minWidth: "110px" },
                  oninput: e => { c.code = e.target.value.toUpperCase(); } })]),
                h("td", [h("input.champ", { value: c.theme || "", style: { minWidth: "130px" },
                  oninput: e => { c.theme = e.target.value; } })]),
                h("td", [h("input.champ", { value: c.patterns.join(", "), style: { minWidth: "240px" },
                  oninput: e => { c.patterns = e.target.value.split(",").map(s => s.trim()).filter(Boolean); } })]),
                h("td", [h("button.btn.btn--petit.btn--danger", { texte: "✕",
                  onclick: () => { codes.splice(i, 1); rendre(); } })]),
              ]))),
            ]),
          ])
        : h("p.texte-secondaire", { texte: "Aucun code défini pour l'instant." }),
      h("div", { style: { display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap" } }, [
        h("button.btn", { texte: "＋ Ajouter un code",
          onclick: () => { codes.push({ code: "NOUVEAU", theme: "", patterns: [] }); rendre(); } }),
        h("button.btn", { texte: "📋 Charger le livre type",
          onclick: () => { codes = LIVRE_DE_CODES_TYPE.map(c => ({ ...c, patterns: [...c.patterns] })); rendre(); } }),
        h("button.btn", { texte: "💡 Suggérer depuis le vocabulaire",
          onclick: () => {
            // Les mots les plus fréquents, non déjà couverts, sont proposés
            // comme amorces de codes : c'est un point de départ, pas un résultat.
            const lexique = qual.wordFrequency(corpus.documents.map(d => d.text), { top: 40 });
            const dejaVus = new Set(codes.flatMap(c => c.patterns.map(p => String(p).toLowerCase())));
            const suggestions = lexique.rows
              .filter(r => !dejaVus.has(r.word) && r.documents >= Math.max(2, corpus.documents.length * 0.05))
              .slice(0, 8);
            if (!suggestions.length) return alerte("Aucune suggestion supplémentaire.");
            for (const s of suggestions) {
              codes.push({ code: s.word.toUpperCase().slice(0, 14), theme: "À classer", patterns: [s.word] });
            }
            rendre();
            alerte(`${suggestions.length} codes proposés à partir du vocabulaire. Renommez-les et regroupez-les par thème.`);
          } }),
      ]),
    ]));
  };
  rendre();

  const valide = await modale({
    titre: "Livre de codes",
    largeur: "860px",
    contenu: h("div", [
      h("p.texte-secondaire", {
        texte: "Un code regroupe les mots-clés qui signalent un même thème. La recherche ignore " +
          "les accents et la casse. Séparez les mots-clés par des virgules.",
      }),
      zone,
    ]),
    actions: [
      { libelle: "Annuler", type: "neutre", valeur: null },
      { libelle: "Enregistrer", type: "primaire", action: () => {
        const valides = codes.filter(c => c.code.trim() && c.patterns.length);
        if (!valides.length) { erreur("Définissez au moins un code avec ses mots-clés."); return false; }
        return valides;
      } },
    ],
  });
  if (!valide) return;

  await store.ecrire("corpus", { ...corpus, codebook: valide });
  await store.tracer("modification", "analyse", corpus.id,
    `Livre de codes mis à jour : ${valide.length} codes`);
  succes(`Livre de codes enregistré (${valide.length} codes).`);
  apres?.();
}

/* ===================== Export ===================== */

async function exporterCorpus(corpus, synthese, lexique) {
  try {
    const feuilles = [
      { nom: "Documents", entetes: ["Identifiant", "Texte", "Mots"],
        lignes: corpus.documents.map(d => [d.id, d.text, String(d.text).split(/\s+/).length]) },
      { nom: "Lexique", entetes: ["Mot", "Occurrences", "Documents", "TF-IDF"],
        lignes: lexique.allRows.slice(0, 500).map(r => [r.word, r.count, r.documents, r.tfidf]) },
    ];
    if (synthese) {
      feuilles.push({
        nom: "Codes", entetes: ["Code", "Thème", "Occurrences", "Documents", "Couverture (%)"],
        lignes: synthese.coding.codeStats.map(s =>
          [s.code, s.theme || "", s.occurrences, s.documents, Number((s.coverage * 100).toFixed(1))]),
      });
      // Matrice documents × codes : c'est elle qui sert de pont vers R ou SPSS
      feuilles.push({
        nom: "Matrice", entetes: ["Document", ...synthese.coding.codes],
        lignes: corpus.documents.map((d, i) => [d.id, ...synthese.coding.matrix[i]]),
      });
      feuilles.push({
        nom: "Segments", entetes: ["Document", "Code", "Thème", "Extrait"],
        lignes: synthese.coding.segments.map(s => [s.documentId, s.code, s.theme || "", s.context]),
      });
    }
    const base = corpus.nom.replace(/[^\w\-]+/g, "_").toLowerCase().slice(0, 40) || "corpus";
    telecharger(versXLSX(feuilles), `${base}.xlsx`);
    await store.tracer("export", "analyse", corpus.id,
      `Export du corpus « ${corpus.nom} » (${corpus.documents.length} documents)`);
    succes("Corpus exporté au format Excel.");
  } catch (e) { erreur("Export impossible : " + e.message); }
}
