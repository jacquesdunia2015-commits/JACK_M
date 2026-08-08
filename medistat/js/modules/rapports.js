// medistat/js/modules/rapports.js
// Reporting (article 6.5) : rapports d'activité prêts à imprimer, indicateurs
// qualité du laboratoire et export vers les formats attendus (PDF, Excel, CSV).

import { h, fmt, tableau, badge, modale, erreur, succes, alerte, etatVide,
  formulaire, carteStat, remplacer } from "../core/ui.js";
import * as store from "../core/store.js";
import { autorise, sessionCourante } from "../core/auth.js";
import { CATEGORIES_TESTS, delaiHeures, calculerAge, interpreterResultat,
  NIVEAUX_URGENCE } from "../core/model.js";
import * as desc from "../stats/descriptive.js";
import { westgardRules, referenceInterval } from "../stats/diagnostic.js";
import { barres, lignes as graphLignes, secteurs, boites, pareto, COULEURS } from "../core/charts.js";
import { telecharger, versCSV, versXLSX, DocumentPDF } from "../core/export.js";

const JOUR = 86400000;

export async function vue_rapports({ naviguer }) {
  const zone = h("div");

  const periodes = [
    { valeur: 7, libelle: "7 derniers jours" },
    { valeur: 30, libelle: "30 derniers jours" },
    { valeur: 90, libelle: "3 derniers mois" },
    { valeur: 365, libelle: "12 derniers mois" },
    { valeur: 3650, libelle: "Toute la période" },
  ];
  const selectPeriode = h("select.champ", { style: { maxWidth: "220px" } },
    periodes.map(p => h("option", { value: p.valeur, texte: p.libelle, selected: p.valeur === 30 })));

  const rapports = [
    { cle: "activite", nom: "Rapport d'activité", icone: "📊",
      aide: "Volumes, répartition par discipline et par service, évolution." },
    { cle: "delais", nom: "Délais de rendu", icone: "⏱️",
      aide: "Respect des délais contractuels par degré d'urgence et par analyse." },
    { cle: "positivite", nom: "Taux de positivité", icone: "🦠",
      aide: "Positivité et anomalies par analyse, avec intervalles de confiance." },
    { cle: "qualite", nom: "Indicateurs qualité", icone: "🛡️",
      aide: "Non-conformités, corrections, valeurs critiques et traçabilité." },
    { cle: "epidemio", nom: "Profil épidémiologique", icone: "🌍",
      aide: "Diagnostics, âges, sexes, répartition géographique." },
    { cle: "references", nom: "Intervalles de référence", icone: "📐",
      aide: "Recalcul des valeurs de référence sur votre population (norme CLSI)." },
  ];
  const selectRapport = h("select.champ", { style: { maxWidth: "280px" } },
    rapports.map(r => h("option", { value: r.cle, texte: `${r.icone}  ${r.nom}` })));

  const produire = async () => {
    const rapport = rapports.find(r => r.cle === selectRapport.value);
    remplacer(zone, h("div.carte", [h("p", { texte: "Calcul en cours…" })]));
    try {
      const contenu = await construire(rapport.cle, Number(selectPeriode.value));
      remplacer(zone, contenu);
    } catch (e) {
      console.error(e);
      remplacer(zone, h("div.carte", [h("div.avertissement", { texte: e.message })]));
    }
  };
  selectRapport.addEventListener("change", produire);
  selectPeriode.addEventListener("change", produire);

  const aide = h("p.texte-secondaire");
  const majAide = () => {
    aide.textContent = rapports.find(r => r.cle === selectRapport.value)?.aide || "";
  };
  selectRapport.addEventListener("change", majAide);
  majAide();

  await produire();

  return h("div", [
    h("div.page-entete", [
      h("div.page-entete__titre", [
        h("h1", { texte: "Rapports" }),
        h("p.texte-secondaire", {
          texte: "Rapports d'activité et indicateurs qualité, imprimables et exportables.",
        }),
      ]),
      h("div.page-entete__actions", [
        h("button.btn", { texte: "🖨️ Imprimer", onclick: () => window.print() }),
      ]),
    ]),
    h("div.carte", [
      h("div.formulaire--grille", { style: { display: "grid" } }, [
        h("div.champ-groupe", [h("label.champ-libelle", { texte: "Rapport" }), selectRapport]),
        h("div.champ-groupe", [h("label.champ-libelle", { texte: "Période" }), selectPeriode]),
      ]),
      aide,
    ]),
    zone,
  ]);
}

/* ===================== Construction des rapports ===================== */

async function charger(jours) {
  const [demandes, resultats, tests, consultations, patients, echantillons, utilisateurs] =
    await Promise.all([
      store.lireTout("demandes"), store.lireTout("resultats"), store.lireTout("testsCatalogue"),
      store.lireTout("consultations"), store.lireTout("patients"),
      store.lireTout("echantillons"), store.lireTout("utilisateurs"),
    ]);
  const session = sessionCourante();
  const ets = session?.utilisateur?.etablissementId;
  const vivants = liste => liste.filter(x => !x._supprime && (!x.etablissementId || x.etablissementId === ets));
  const depuis = Date.now() - jours * JOUR;
  const dansPeriode = (liste, champ = "date") =>
    liste.filter(x => new Date(x[champ]).getTime() >= depuis);

  return {
    demandes: dansPeriode(vivants(demandes)),
    toutesDemandes: vivants(demandes),
    resultats: vivants(resultats).filter(r =>
      new Date(r.dateValidation || r.dateSaisie || 0).getTime() >= depuis),
    tousResultats: vivants(resultats),
    tests: vivants(tests),
    consultations: dansPeriode(vivants(consultations)),
    patients: vivants(patients),
    echantillons: vivants(echantillons),
    utilisateurs,
    jours, depuis, session,
  };
}

async function construire(type, jours) {
  const d = await charger(jours);
  if (type === "activite") return rapportActivite(d);
  if (type === "delais") return rapportDelais(d);
  if (type === "positivite") return rapportPositivite(d);
  if (type === "qualite") return rapportQualite(d);
  if (type === "epidemio") return rapportEpidemio(d);
  if (type === "references") return rapportReferences(d);
  throw new Error("Rapport inconnu.");
}

/* ---------- Activité ---------- */

function rapportActivite(d) {
  const parCategorie = new Map();
  for (const r of d.resultats) {
    const t = d.tests.find(x => x.code === r.testCode);
    const c = CATEGORIES_TESTS.find(x => x.code === t?.categorie);
    const nom = c ? c.label : "Autres";
    parCategorie.set(nom, (parCategorie.get(nom) || 0) + 1);
  }

  const parService = new Map();
  for (const c of d.consultations) {
    const s = c.service || "Non précisé";
    parService.set(s, (parService.get(s) || 0) + 1);
  }

  // Évolution hebdomadaire sur la période
  const semaines = Math.min(26, Math.max(4, Math.ceil(d.jours / 7)));
  const evolution = [];
  for (let s = semaines - 1; s >= 0; s--) {
    const debut = Date.now() - (s + 1) * 7 * JOUR, fin = Date.now() - s * 7 * JOUR;
    evolution.push({
      label: new Date(fin).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
      demandes: d.demandes.filter(x => {
        const t = new Date(x.date).getTime(); return t >= debut && t < fin;
      }).length,
      consultations: d.consultations.filter(x => {
        const t = new Date(x.date).getTime(); return t >= debut && t < fin;
      }).length,
    });
  }

  const parUrgence = NIVEAUX_URGENCE.map(n => ({
    label: n.label, valeur: d.demandes.filter(x => (x.urgence || "routine") === n.code).length,
    couleur: n.couleur,
  })).filter(x => x.valeur > 0);

  const lignesExport = [...parCategorie.entries()].map(([Discipline, Analyses]) => ({ Discipline, Analyses }));

  return h("div", [
    enteteRapport("Rapport d'activité", d, () => exporterTableur("activite", [
      { nom: "Par discipline", entetes: ["Discipline", "Analyses"],
        lignes: lignesExport.map(l => [l.Discipline, l.Analyses]) },
      { nom: "Par service", entetes: ["Service", "Consultations"],
        lignes: [...parService.entries()] },
      { nom: "Évolution", entetes: ["Semaine", "Demandes", "Consultations"],
        lignes: evolution.map(e => [e.label, e.demandes, e.consultations]) },
    ])),

    h("div.grille.grille--4", [
      carteStat({ libelle: "Consultations", valeur: fmt.nombre(d.consultations.length), icone: "🩺" }),
      carteStat({ libelle: "Demandes d'examens", valeur: fmt.nombre(d.demandes.length), icone: "📋" }),
      carteStat({ libelle: "Analyses rendues", valeur: fmt.nombre(d.resultats.length), icone: "📊" }),
      carteStat({ libelle: "Patients distincts",
        valeur: fmt.nombre(new Set(d.demandes.map(x => x.patientId)).size), icone: "🧑‍⚕️" }),
    ]),

    h("div.graphique-carte", [
      graphLignes([
        { nom: "Consultations", points: evolution.map((e, i) => ({ x: i, y: e.consultations })) },
        { nom: "Demandes", points: evolution.map((e, i) => ({ x: i, y: e.demandes })) },
      ], { titre: "Évolution hebdomadaire", xCategories: evolution.map(e => e.label),
        libelleY: "Nombre", hauteur: 320 }),
    ]),

    h("div.grille.grille--2", [
      parCategorie.size ? h("div.graphique-carte", [
        secteurs([...parCategorie.entries()].sort((a, b) => b[1] - a[1])
          .map(([label, valeur]) => ({ label, valeur })),
          { titre: "Analyses par discipline", anneau: true,
            centre: { valeur: fmt.nombre(d.resultats.length), libelle: "analyses" } }),
      ]) : null,
      parUrgence.length ? h("div.graphique-carte", [
        secteurs(parUrgence, { titre: "Demandes par degré d'urgence" }),
      ]) : null,
    ]),

    parService.size ? h("div.graphique-carte", [
      barres([...parService.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)
        .map(([label, valeur]) => ({ label, valeur })),
        { titre: "Consultations par service", libelleY: "Nombre" }),
    ]) : null,
  ]);
}

/* ---------- Délais ---------- */

function rapportDelais(d) {
  const rendues = d.toutesDemandes.filter(x => x.statut === "rendue");
  const mesures = rendues.map(dem => {
    const rs = d.tousResultats.filter(r => r.demandeId === dem.id && r.dateValidation);
    if (!rs.length) return null;
    const dernier = Math.max(...rs.map(r => new Date(r.dateValidation).getTime()));
    const delai = delaiHeures(dem.date, new Date(dernier));
    const attendu = NIVEAUX_URGENCE.find(u => u.code === (dem.urgence || "routine"))?.delai || 24;
    return { demande: dem, delai, attendu, conforme: delai <= attendu, urgence: dem.urgence || "routine" };
  }).filter(m => m && Number.isFinite(m.delai) && m.delai >= 0);

  if (!mesures.length) {
    return h("div", [enteteRapport("Délais de rendu", d),
      etatVide({ icone: "⏱️", titre: "Aucune donnée de délai",
        message: "Aucune demande n'a encore été rendue sur cette période." })]);
  }

  const delais = mesures.map(m => m.delai);
  const stats = desc.describe(delais);
  const conformite = (mesures.filter(m => m.conforme).length / mesures.length) * 100;

  const parUrgence = NIVEAUX_URGENCE.map(n => {
    const sous = mesures.filter(m => m.urgence === n.code);
    if (!sous.length) return null;
    const ds = sous.map(m => m.delai);
    return {
      urgence: n.label, attendu: n.delai, n: sous.length,
      median: desc.median(ds), p90: desc.quantile(ds, 0.9),
      conformite: (sous.filter(m => m.conforme).length / sous.length) * 100,
    };
  }).filter(Boolean);

  return h("div", [
    enteteRapport("Délais de rendu", d, () => exporterTableur("delais", [
      { nom: "Par urgence", entetes: ["Urgence", "Attendu (h)", "Effectif", "Médiane (h)", "P90 (h)", "Conformité (%)"],
        lignes: parUrgence.map(u => [u.urgence, u.attendu, u.n,
          Number(u.median.toFixed(2)), Number(u.p90.toFixed(2)), Number(u.conformite.toFixed(1))]) },
    ])),

    h("div.grille.grille--4", [
      carteStat({ libelle: "Demandes rendues", valeur: fmt.nombre(mesures.length), icone: "📤" }),
      carteStat({ libelle: "Délai médian", valeur: fmt.duree(stats.median), icone: "⏱️" }),
      carteStat({ libelle: "90e centile", valeur: fmt.duree(desc.quantile(delais, 0.9)), icone: "📈" }),
      carteStat({ libelle: "Taux de conformité", valeur: fmt.pourcent(conformite), icone: "✅",
        couleur: conformite >= 90 ? COULEURS.normal : conformite >= 70 ? COULEURS.bas : COULEURS.critique }),
    ]),

    h("div.carte", [
      h("div.carte__entete", [h("h3", { texte: "Conformité par degré d'urgence" })]),
      tableau([
        { cle: "urgence", titre: "Urgence" },
        { cle: "attendu", titre: "Délai contractuel", aligne: "droite", valeur: u => `${u.attendu} h` },
        { cle: "n", titre: "Effectif", aligne: "droite", valeur: u => fmt.nombre(u.n) },
        { cle: "median", titre: "Délai médian", aligne: "droite", valeur: u => fmt.duree(u.median) },
        { cle: "p90", titre: "90e centile", aligne: "droite", valeur: u => fmt.duree(u.p90) },
        { cle: "conformite", titre: "Conformité", aligne: "droite",
          rendu: u => h("span", {
            style: { fontWeight: "700",
              color: u.conformite >= 90 ? "var(--succes)" : u.conformite >= 70 ? "var(--alerte)" : "var(--danger)" },
            texte: fmt.pourcent(u.conformite),
          }) },
      ], parUrgence, { compact: true }),
      h("p.texte-secondaire", {
        texte: "Le délai médian résiste mieux aux valeurs extrêmes que la moyenne. " +
          "Le 90e centile décrit l'expérience des cas les plus lents : c'est lui qui reflète " +
          "ce que perçoivent les prescripteurs mécontents.",
      }),
    ]),

    h("div.grille.grille--2", [
      h("div.graphique-carte", [
        (() => {
          const bins = desc.histogram(delais.filter(x => x < desc.quantile(delais, 0.98)));
          return h("div", [barresHisto(bins)]);
        })(),
      ]),
      h("div.graphique-carte", [
        boites(parUrgence.map(u => {
          const sous = mesures.filter(m => m.urgence ===
            NIVEAUX_URGENCE.find(n => n.label === u.urgence)?.code).map(m => m.delai);
          return { label: u.urgence, ...desc.boxplotData(sous) };
        }), { titre: "Distribution des délais par urgence", libelleY: "Heures" }),
      ]),
    ]),
  ]);
}

function barresHisto(h2) {
  return barres(h2.bins.map(b => ({
    label: `${fmt.nombre(b.from, 0)}–${fmt.nombre(b.to, 0)}`, valeur: b.count,
  })), { titre: "Distribution des délais (heures)", libelleY: "Demandes", valeursAffichees: false });
}

/* ---------- Positivité ---------- */

function rapportPositivite(d) {
  const lignesRapport = [];
  for (const test of d.tests) {
    const rs = d.tousResultats.filter(r => r.testCode === test.code &&
      (r.valeur !== null || r.valeurTexte));
    if (rs.length < 5) continue;
    const positifs = test.type === "qualitatif"
      ? rs.filter(r => /positif|culture positive/i.test(String(r.valeurTexte || ""))).length
      : rs.filter(r => r.horsNorme).length;
    const ic = desc.ciProportion(positifs, rs.length);
    lignesRapport.push({
      test, n: rs.length, positifs,
      taux: (positifs / rs.length) * 100,
      icBas: ic.lower * 100, icHaut: ic.upper * 100,
      critiques: rs.filter(r => r.critique).length,
    });
  }
  lignesRapport.sort((a, b) => b.taux - a.taux);

  if (!lignesRapport.length) {
    return h("div", [enteteRapport("Taux de positivité", d),
      etatVide({ icone: "🦠", titre: "Effectifs insuffisants",
        message: "Au moins 5 résultats par analyse sont nécessaires pour estimer un taux." })]);
  }

  return h("div", [
    enteteRapport("Taux de positivité et d'anomalie", d, () => exporterTableur("positivite", [
      { nom: "Positivité",
        entetes: ["Code", "Analyse", "Effectif", "Positifs", "Taux (%)", "IC bas", "IC haut", "Critiques"],
        lignes: lignesRapport.map(l => [l.test.code, l.test.nom, l.n, l.positifs,
          Number(l.taux.toFixed(1)), Number(l.icBas.toFixed(1)), Number(l.icHaut.toFixed(1)), l.critiques]) },
    ])),

    h("div.carte", [
      h("p.texte-secondaire", {
        texte: "Pour les analyses qualitatives, le taux est celui des résultats positifs ; " +
          "pour les analyses quantitatives, celui des valeurs hors normes. " +
          "L'intervalle de confiance à 95 % (méthode de Wilson) traduit la précision de l'estimation : " +
          "plus l'effectif est faible, plus il est large.",
      }),
      tableau([
        { cle: "code", titre: "Code", valeur: l => l.test.code },
        { cle: "nom", titre: "Analyse", valeur: l => l.test.nom },
        { cle: "n", titre: "Effectif", aligne: "droite", valeur: l => fmt.nombre(l.n) },
        { cle: "positifs", titre: "Positifs", aligne: "droite", valeur: l => fmt.nombre(l.positifs) },
        { cle: "taux", titre: "Taux", aligne: "droite",
          rendu: l => h("span", {
            style: { fontWeight: "600",
              color: l.taux > 50 ? "var(--danger)" : l.taux > 25 ? "var(--alerte)" : "inherit" },
            texte: fmt.pourcent(l.taux),
          }), triSur: l => l.taux },
        { cle: "ic", titre: "IC 95 %", aligne: "centre",
          valeur: l => `${fmt.nombre(l.icBas, 1)} – ${fmt.nombre(l.icHaut, 1)} %` },
        { cle: "critiques", titre: "Valeurs critiques", aligne: "droite",
          rendu: l => l.critiques ? badge(String(l.critiques), COULEURS.critique) : "—" },
      ], lignesRapport, { parPage: 30, compact: true }),
    ]),

    h("div.graphique-carte", [
      barres(lignesRapport.slice(0, 15).map(l => ({
        label: l.test.code, valeur: Number(l.taux.toFixed(1)),
        erreur: (l.icHaut - l.icBas) / 2,
        couleur: l.taux > 50 ? COULEURS.critique : l.taux > 25 ? COULEURS.bas : COULEURS.accent,
      })), { titre: "Taux de positivité avec intervalles de confiance",
        libelleY: "Pourcentage", unite: "%", hauteur: 340 }),
    ]),
  ]);
}

/* ---------- Qualité ---------- */

function rapportQualite(d) {
  const nonConformes = d.echantillons.filter(e => e.conformite === "non_conforme");
  const corrections = d.tousResultats.filter(r => (r.version || 1) > 1);
  const critiques = d.tousResultats.filter(r => r.critique);
  const critiquesNonAcquittes = critiques.filter(r => !r.alerteAcquittee);
  const signes = d.tousResultats.filter(r => r.signature);
  const valides = d.tousResultats.filter(r => ["valide", "rendu"].includes(r.statut));

  const motifs = new Map();
  for (const e of nonConformes) {
    const m = e.motifNonConformite || "Non précisé";
    motifs.set(m, (motifs.get(m) || 0) + 1);
  }

  const tauxNonConformite = d.echantillons.length
    ? (nonConformes.length / d.echantillons.length) * 100 : 0;
  const tauxSignature = valides.length ? (signes.length / valides.length) * 100 : 0;

  return h("div", [
    enteteRapport("Indicateurs qualité", d, () => exporterTableur("qualite", [
      { nom: "Non-conformités", entetes: ["Motif", "Nombre"], lignes: [...motifs.entries()] },
      { nom: "Synthèse", entetes: ["Indicateur", "Valeur"],
        lignes: [
          ["Échantillons non conformes", nonConformes.length],
          ["Taux de non-conformité (%)", Number(tauxNonConformite.toFixed(2))],
          ["Résultats corrigés", corrections.length],
          ["Valeurs critiques", critiques.length],
          ["Valeurs critiques non acquittées", critiquesNonAcquittes.length],
          ["Taux de signature (%)", Number(tauxSignature.toFixed(1))],
        ] },
    ])),

    h("div.grille.grille--4", [
      carteStat({ libelle: "Taux de non-conformité", valeur: fmt.pourcent(tauxNonConformite),
        detail: `${nonConformes.length} échantillon(s)`, icone: "⚠️",
        couleur: tauxNonConformite > 5 ? COULEURS.critique : tauxNonConformite > 2 ? COULEURS.bas : COULEURS.normal }),
      carteStat({ libelle: "Résultats corrigés", valeur: fmt.nombre(corrections.length),
        detail: "après validation", icone: "✏️",
        couleur: corrections.length ? COULEURS.bas : COULEURS.normal }),
      carteStat({ libelle: "Valeurs critiques", valeur: fmt.nombre(critiques.length),
        detail: critiquesNonAcquittes.length ? `${critiquesNonAcquittes.length} non acquittée(s)` : "toutes acquittées",
        icone: "🚨", couleur: critiquesNonAcquittes.length ? COULEURS.critique : COULEURS.normal }),
      carteStat({ libelle: "Taux de signature", valeur: fmt.pourcent(tauxSignature),
        detail: `${signes.length} / ${valides.length} résultats`, icone: "✍️",
        couleur: tauxSignature >= 99 ? COULEURS.normal : COULEURS.bas }),
    ]),

    critiquesNonAcquittes.length ? h("div.carte", {
      style: { borderLeft: "4px solid var(--critique)", background: "rgba(220,38,38,.05)" },
    }, [
      h("strong", { texte: `🚨 ${critiquesNonAcquittes.length} valeur(s) critique(s) sans trace d'alerte au prescripteur` }),
      h("p.texte-secondaire", {
        texte: "En contexte médical, une valeur critique impose une alerte immédiate et tracée. " +
          "L'absence d'acquittement constitue une non-conformité majeure.",
      }),
    ]) : null,

    motifs.size ? h("div.graphique-carte", [
      pareto([...motifs.entries()].map(([label, valeur]) => ({ label, valeur })),
        { titre: "Motifs de non-conformité des échantillons", libelleY: "Nombre" }),
    ]) : null,

    corrections.length ? h("div.carte", [
      h("div.carte__entete", [h("h3", { texte: "Résultats corrigés après validation" })]),
      h("p.texte-secondaire", {
        texte: "Toute correction d'un résultat validé est tracée au journal d'audit et invalide " +
          "la signature électronique antérieure.",
      }),
      tableau([
        { cle: "test", titre: "Analyse", valeur: r =>
          d.tests.find(t => t.code === r.testCode)?.nom || r.testCode },
        { cle: "version", titre: "Version", aligne: "centre", valeur: r => r.version || 1 },
        { cle: "date", titre: "Dernière modification",
          valeur: r => fmt.date(r.dateModification || r.dateValidation, { heure: true }) },
        { cle: "commentaire", titre: "Commentaire", valeur: r => r.commentaireBiologiste || "—" },
      ], corrections, { compact: true, parPage: 15 }),
    ]) : null,
  ]);
}

/* ---------- Épidémiologie ---------- */

function rapportEpidemio(d) {
  const diagnostics = new Map();
  for (const c of d.consultations) {
    if (!c.diagnostic) continue;
    diagnostics.set(c.diagnostic, (diagnostics.get(c.diagnostic) || 0) + 1);
  }

  const ages = d.patients.map(p => calculerAge(p.dateNaissance)?.annees)
    .filter(a => Number.isFinite(a));
  const tranches = [
    { label: "0–4 ans", min: 0, max: 4 }, { label: "5–14 ans", min: 5, max: 14 },
    { label: "15–29 ans", min: 15, max: 29 }, { label: "30–44 ans", min: 30, max: 44 },
    { label: "45–59 ans", min: 45, max: 59 }, { label: "60–74 ans", min: 60, max: 74 },
    { label: "75 ans et plus", min: 75, max: 200 },
  ].map(t => ({ label: t.label, valeur: ages.filter(a => a >= t.min && a <= t.max).length }));

  const sexes = [
    { label: "Féminin", valeur: d.patients.filter(p => p.sexe === "F").length, couleur: "#d53f8c" },
    { label: "Masculin", valeur: d.patients.filter(p => p.sexe === "M").length, couleur: "#2b6cb0" },
  ].filter(s => s.valeur > 0);

  const villes = new Map();
  for (const p of d.patients) {
    if (!p.ville) continue;
    villes.set(p.ville, (villes.get(p.ville) || 0) + 1);
  }

  const statsAge = ages.length ? desc.describe(ages) : null;

  return h("div", [
    enteteRapport("Profil épidémiologique", d, () => exporterTableur("epidemio", [
      { nom: "Diagnostics", entetes: ["Diagnostic", "Cas"],
        lignes: [...diagnostics.entries()].sort((a, b) => b[1] - a[1]) },
      { nom: "Pyramide des âges", entetes: ["Tranche", "Patients"],
        lignes: tranches.map(t => [t.label, t.valeur]) },
      { nom: "Répartition géographique", entetes: ["Ville", "Patients"],
        lignes: [...villes.entries()].sort((a, b) => b[1] - a[1]) },
    ])),

    h("div.grille.grille--4", [
      carteStat({ libelle: "Patients", valeur: fmt.nombre(d.patients.length), icone: "🧑‍⚕️" }),
      statsAge ? carteStat({ libelle: "Âge médian", valeur: `${fmt.nombre(statsAge.median, 0)} ans`,
        detail: `moyenne ${fmt.nombre(statsAge.mean, 1)} ans`, icone: "📅" }) : null,
      carteStat({ libelle: "Diagnostics distincts", valeur: fmt.nombre(diagnostics.size), icone: "🩺" }),
      carteStat({ libelle: "Localités", valeur: fmt.nombre(villes.size), icone: "📍" }),
    ].filter(Boolean)),

    h("div.grille.grille--2", [
      h("div.graphique-carte", [
        barres(tranches, { titre: "Pyramide des âges", libelleY: "Patients" }),
      ]),
      sexes.length ? h("div.graphique-carte", [
        secteurs(sexes, { titre: "Répartition par sexe", anneau: true,
          centre: { valeur: fmt.nombre(d.patients.length), libelle: "patients" } }),
      ]) : null,
    ]),

    diagnostics.size ? h("div.graphique-carte", [
      pareto([...diagnostics.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)
        .map(([label, valeur]) => ({ label, valeur })),
        { titre: "Diagnostics les plus fréquents", libelleY: "Cas", hauteur: 340 }),
    ]) : null,

    villes.size ? h("div.carte", [
      h("div.carte__entete", [h("h3", { texte: "Répartition géographique" })]),
      tableau([
        { cle: "ville", titre: "Localité" },
        { cle: "patients", titre: "Patients", aligne: "droite", valeur: v => fmt.nombre(v.patients) },
        { cle: "part", titre: "Part", aligne: "droite",
          valeur: v => fmt.pourcent(v.patients * 100 / d.patients.length) },
      ], [...villes.entries()].sort((a, b) => b[1] - a[1])
          .map(([ville, patients]) => ({ ville, patients })),
        { compact: true, parPage: 20 }),
    ]) : null,
  ]);
}

/* ---------- Intervalles de référence ---------- */

// Recalcule les valeurs de référence sur la population réellement suivie :
// les normes publiées proviennent souvent d'autres populations, et peuvent
// être inadaptées localement.
function rapportReferences(d) {
  const analyses = [];
  for (const test of d.tests.filter(t => t.type !== "qualitatif")) {
    // On ne retient que les résultats jugés normaux, pour estimer la norme
    // sur une population de référence approchée.
    const valeurs = d.tousResultats
      .filter(r => r.testCode === test.code && Number.isFinite(Number(r.valeur)))
      .map(r => Number(r.valeur));
    if (valeurs.length < 20) continue;
    const ri = referenceInterval(valeurs);
    if (ri.error) continue;
    analyses.push({ test, ri, n: valeurs.length, valeurs });
  }

  if (!analyses.length) {
    return h("div", [enteteRapport("Intervalles de référence", d),
      etatVide({ icone: "📐", titre: "Effectifs insuffisants",
        message: "Au moins 20 résultats par analyse sont nécessaires (120 recommandés par la norme CLSI C28-A3)." })]);
  }

  return h("div", [
    enteteRapport("Intervalles de référence observés", d, () => exporterTableur("references", [
      { nom: "Références",
        entetes: ["Code", "Analyse", "Unité", "Effectif", "Réf. basse catalogue", "Réf. haute catalogue",
          "P2,5 observé", "P97,5 observé", "Médiane"],
        lignes: analyses.map(a => [a.test.code, a.test.nom, a.test.unite || "", a.n,
          a.test.valeurRefMin ?? "", a.test.valeurRefMax ?? "",
          Number(a.ri.lower.toFixed(3)), Number(a.ri.upper.toFixed(3)),
          Number(a.ri.median.toFixed(3))]) },
    ])),

    h("div.carte", [
      h("div.avertissement", {
        texte: "Ces intervalles sont calculés sur l'ensemble des résultats enregistrés, malades compris. " +
          "Ils ne remplacent pas une étude de valeurs de référence menée sur une population saine " +
          "sélectionnée, telle que l'exige la norme CLSI C28-A3. Ils servent à repérer les écarts " +
          "manifestes entre les normes paramétrées et la réalité observée localement.",
      }),
      tableau([
        { cle: "code", titre: "Code", valeur: a => a.test.code },
        { cle: "nom", titre: "Analyse", valeur: a => a.test.nom },
        { cle: "n", titre: "Effectif", aligne: "droite", valeur: a => fmt.nombre(a.n) },
        { cle: "catalogue", titre: "Normes au catalogue", aligne: "centre",
          valeur: a => (Number.isFinite(Number(a.test.valeurRefMin)) && Number.isFinite(Number(a.test.valeurRefMax)))
            ? `${fmt.nombre(a.test.valeurRefMin)} – ${fmt.nombre(a.test.valeurRefMax)}` : "—" },
        { cle: "observe", titre: "Observé (P2,5 – P97,5)", aligne: "centre",
          valeur: a => `${fmt.nombre(a.ri.lower, 2)} – ${fmt.nombre(a.ri.upper, 2)}` },
        { cle: "mediane", titre: "Médiane", aligne: "droite", valeur: a => fmt.nombre(a.ri.median, 2) },
        { cle: "ecart", titre: "Écart", aligne: "centre",
          rendu: a => {
            const min = Number(a.test.valeurRefMin), max = Number(a.test.valeurRefMax);
            if (!Number.isFinite(min) || !Number.isFinite(max)) return "—";
            const etendue = max - min || 1;
            const ecartBas = Math.abs(a.ri.lower - min) / etendue;
            const ecartHaut = Math.abs(a.ri.upper - max) / etendue;
            const ecart = Math.max(ecartBas, ecartHaut);
            return badge(ecart > 0.5 ? "important" : ecart > 0.25 ? "modéré" : "faible",
              ecart > 0.5 ? COULEURS.critique : ecart > 0.25 ? COULEURS.bas : COULEURS.normal);
          } },
        { cle: "conforme", titre: "Effectif CLSI", aligne: "centre",
          rendu: a => a.n >= 120 ? badge("≥ 120", COULEURS.normal) : badge("< 120", COULEURS.bas) },
      ], analyses, { parPage: 30, compact: true }),
    ]),
  ]);
}

/* ===================== Utilitaires ===================== */

function enteteRapport(titre, d, exporter = null) {
  const session = d.session;
  return h("div.carte", [
    h("div", { style: { display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" } }, [
      h("div", [
        h("h2", { style: { margin: 0 }, texte: titre }),
        h("div.texte-secondaire", {
          texte: `${session?.etablissement?.nom || ""} — période de ${d.jours >= 3650 ? "l'ensemble des données"
            : `${d.jours} jours`}, arrêtée au ${fmt.date(new Date(), { heure: true })}`,
        }),
      ]),
      exporter ? h("button.btn", { texte: "⬇ Exporter (Excel)", onclick: exporter }) : null,
    ]),
  ]);
}

async function exporterTableur(nom, feuilles) {
  try {
    telecharger(versXLSX(feuilles),
      `rapport-${nom}-${new Date().toISOString().slice(0, 10)}.xlsx`);
    await store.tracer("export", "statistiques", null, `Export du rapport « ${nom} »`);
    succes("Rapport exporté.");
  } catch (e) { erreur("Export impossible : " + e.message); }
}
