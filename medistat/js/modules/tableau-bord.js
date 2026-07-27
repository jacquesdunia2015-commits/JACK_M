// medistat/js/modules/tableau-bord.js
// Tableau de bord — indicateurs de l'article 6.5 : patients actifs, volume de
// tests, taux de positivité, délais de rendu, activité par utilisateur et par
// site, et statistiques financières lorsque la facturation est activée.

import { h, fmt, carteStat, tableau, etatVide, badge } from "../core/ui.js";
import * as store from "../core/store.js";
import { utilisateurCourant, autorise, sessionCourante } from "../core/auth.js";
import { STATUTS_DEMANDE, CATEGORIES_TESTS, calculerAge, delaiHeures, respectDelai } from "../core/model.js";
import { barres, lignes, secteurs, pareto, jauge, miniCourbe, COULEURS, PALETTE } from "../core/charts.js";
import * as desc from "../stats/descriptive.js";

const JOUR = 86400000;

export async function vue_tableau_de_bord({ naviguer }) {
  const u = utilisateurCourant();
  const session = sessionCourante();
  const modules = session?.etablissement?.modules || {};

  // Chargement direct des magasins : sur un tableau de bord, on agrège
  // l'ensemble des données plutôt que de multiplier les requêtes filtrées.
  const [patients, demandes, resultats, tests, consultations, utilisateurs] = await Promise.all([
    store.lireTout("patients"), store.lireTout("demandes"), store.lireTout("resultats"),
    store.lireTout("testsCatalogue"), store.lireTout("consultations"), store.lireTout("utilisateurs"),
  ]);
  const vivants = liste => liste.filter(x => !x._supprime &&
    (!x.etablissementId || x.etablissementId === u.etablissementId));
  const P = vivants(patients), D = vivants(demandes), R = vivants(resultats);
  const C = vivants(consultations), T = vivants(tests);

  const maintenant = Date.now();
  const depuis = jours => maintenant - jours * JOUR;
  const dans = (liste, jours, champ = "date") =>
    liste.filter(x => new Date(x[champ]).getTime() >= depuis(jours));

  /* ---------- Indicateurs clés ---------- */
  const patientsActifs = new Set(C.filter(c => new Date(c.date).getTime() >= depuis(365))
    .map(c => c.patientId)).size;
  const demandes30 = dans(D, 30);
  const resultats30 = R.filter(r => new Date(r.dateValidation || r.dateSaisie).getTime() >= depuis(30));
  const enAttente = R.filter(r => r.statut === "saisi").length;
  const critiquesNonAcquittes = R.filter(r => r.critique && !r.alerteAcquittee).length;

  // Délai de rendu : de la demande à la validation
  const delais = D.filter(d => d.statut === "rendue").map(d => {
    const rs = R.filter(r => r.demandeId === d.id && r.dateValidation);
    if (!rs.length) return null;
    const dernier = Math.max(...rs.map(r => new Date(r.dateValidation).getTime()));
    return delaiHeures(d.date, new Date(dernier));
  }).filter(v => Number.isFinite(v) && v >= 0);
  const delaiMedian = delais.length ? desc.median(delais) : null;
  const delaiP90 = delais.length ? desc.quantile(delais, 0.9) : null;

  const cartes = h("div.grille.grille--4", { style: { marginBottom: "20px" } }, [
    carteStat({ libelle: "Patients actifs (12 mois)", valeur: fmt.nombre(patientsActifs),
      detail: `${fmt.nombre(P.length)} dossiers au total`, icone: "🧑‍⚕️", couleur: COULEURS.accent,
      onclick: () => naviguer("patients") }),
    carteStat({ libelle: "Examens sur 30 jours", valeur: fmt.nombre(demandes30.length),
      detail: `${fmt.nombre(resultats30.length)} résultats rendus`, icone: "📋", couleur: "#7c3aed",
      onclick: () => naviguer("demandes") }),
    carteStat({ libelle: "En attente de validation", valeur: fmt.nombre(enAttente),
      detail: enAttente ? "Action requise" : "Aucun retard", icone: "⏳",
      couleur: enAttente ? COULEURS.bas : COULEURS.normal,
      onclick: () => autorise("resultat", "validation") ? naviguer("validation") : null }),
    carteStat({ libelle: "Délai médian de rendu", valeur: delaiMedian ? fmt.duree(delaiMedian) : "—",
      detail: delaiP90 ? `90 % en moins de ${fmt.duree(delaiP90)}` : "Données insuffisantes",
      icone: "⏱️", couleur: COULEURS.accent }),
  ]);

  const contenu = [
    h("div.page-entete", [
      h("div.page-entete__titre", [
        h("h1", { texte: `Bonjour ${u.prenom || u.nom}` }),
        h("p.texte-secondaire", {
          texte: `${session?.etablissement?.nom || ""} — ${fmt.date(new Date(), { longue: true })}`,
        }),
      ]),
    ]),
  ];

  // Alerte prioritaire sur les valeurs critiques non traitées (article 13)
  if (critiquesNonAcquittes > 0 && autorise("resultat", "lecture")) {
    contenu.push(h("div.carte", {
      style: { borderLeft: "4px solid var(--critique)", background: "rgba(220,38,38,.05)" },
    }, [
      h("div", { style: { display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" } }, [
        h("span", { style: { fontSize: "1.6rem" }, texte: "🚨" }),
        h("div", { style: { flex: "1 1 240px" } }, [
          h("strong", { texte: `${critiquesNonAcquittes} résultat(s) à valeur critique en attente d'alerte` }),
          h("div.texte-secondaire", { texte: "Le prescripteur doit être joint sans délai." }),
        ]),
        h("button.btn.btn--danger", { texte: "Traiter maintenant",
          onclick: () => naviguer("demandes") }),
      ]),
    ]));
  }

  contenu.push(cartes);

  /* ---------- Activité sur 12 semaines ---------- */
  const semaines = [];
  for (let s = 11; s >= 0; s--) {
    const debut = maintenant - (s + 1) * 7 * JOUR;
    const fin = maintenant - s * 7 * JOUR;
    const dSem = D.filter(x => { const t = new Date(x.date).getTime(); return t >= debut && t < fin; });
    const cSem = C.filter(x => { const t = new Date(x.date).getTime(); return t >= debut && t < fin; });
    semaines.push({
      label: `S−${s}`,
      demandes: dSem.length,
      consultations: cSem.length,
      date: new Date(fin),
    });
  }

  const grilleGraphiques = h("div.grille.grille--2");

  grilleGraphiques.appendChild(h("div.graphique-carte", [
    lignes([
      { nom: "Consultations", points: semaines.map((s, i) => ({ x: i, y: s.consultations, label: s.label })) },
      { nom: "Demandes d'examens", points: semaines.map((s, i) => ({ x: i, y: s.demandes, label: s.label })) },
    ], {
      titre: "Activité des 12 dernières semaines",
      xCategories: semaines.map(s => s.label),
      libelleY: "Nombre", hauteur: 300,
    }),
  ]));

  /* ---------- Répartition par catégorie d'examen ---------- */
  const parCategorie = new Map();
  for (const r of R) {
    const test = T.find(t => t.code === r.testCode);
    const cat = CATEGORIES_TESTS.find(c => c.code === test?.categorie);
    const nom = cat ? cat.label : "Autres";
    parCategorie.set(nom, (parCategorie.get(nom) || 0) + 1);
  }
  if (parCategorie.size) {
    grilleGraphiques.appendChild(h("div.graphique-carte", [
      secteurs([...parCategorie.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([label, valeur]) => ({ label, valeur })), {
        titre: "Répartition des analyses par discipline",
        anneau: true,
        centre: { valeur: fmt.nombre(R.length), libelle: "analyses" },
      }),
    ]));
  }

  /* ---------- Taux de positivité et d'anomalie (article 6.5) ---------- */
  const positivite = [];
  for (const test of T) {
    const rs = R.filter(r => r.testCode === test.code);
    if (rs.length < 5) continue;
    let positifs;
    if (test.type === "qualitatif") {
      positifs = rs.filter(r => /positif|culture positive/i.test(String(r.valeurTexte || ""))).length;
    } else {
      positifs = rs.filter(r => r.horsNorme).length;
    }
    positivite.push({
      test: test.nom, code: test.code, type: test.type,
      total: rs.length, positifs,
      taux: (positifs / rs.length) * 100,
      critiques: rs.filter(r => r.critique).length,
    });
  }
  positivite.sort((a, b) => b.taux - a.taux);

  if (positivite.length) {
    grilleGraphiques.appendChild(h("div.graphique-carte", [
      barres(positivite.slice(0, 10).map(p => ({
        label: p.code, valeur: Number(p.taux.toFixed(1)),
        couleur: p.taux > 50 ? COULEURS.critique : p.taux > 25 ? COULEURS.bas : COULEURS.accent,
      })), {
        titre: "Taux de positivité ou d'anomalie (10 premiers)",
        libelleY: "Pourcentage", unite: "%", hauteur: 300,
      }),
    ]));
  }

  /* ---------- Respect des délais ---------- */
  if (delais.length >= 5) {
    const conformes = D.filter(d => d.statut === "rendue").filter(d => {
      const rs = R.filter(r => r.demandeId === d.id && r.dateValidation);
      if (!rs.length) return false;
      const dernier = Math.max(...rs.map(r => new Date(r.dateValidation).getTime()));
      const test = T.find(t => t.code === d.tests?.[0]);
      const r = respectDelai({ ...d, date: d.date, urgence: d.urgence }, test);
      return delaiHeures(d.date, new Date(dernier)) <= (r?.attendu ?? 24);
    }).length;
    const totalRendues = D.filter(d => d.statut === "rendue").length;
    const tauxConformite = totalRendues ? (conformes / totalRendues) * 100 : 0;

    grilleGraphiques.appendChild(h("div.graphique-carte", [
      h("h3", { texte: "Respect des délais contractuels" }),
      jauge(tauxConformite, {
        min: 0, max: 100, unite: "%", titre: "Taux de conformité",
        seuils: [
          { jusqua: 70, couleur: COULEURS.critique },
          { jusqua: 90, couleur: COULEURS.bas },
          { jusqua: 100, couleur: COULEURS.normal },
        ],
      }),
      h("p.texte-secondaire", { style: { textAlign: "center" },
        texte: `${fmt.nombre(conformes)} demandes rendues dans les délais sur ${fmt.nombre(totalRendues)}.` }),
    ]));
  }

  contenu.push(grilleGraphiques);

  /* ---------- Diagnostics les plus fréquents ---------- */
  const diagnostics = new Map();
  for (const c of C) {
    if (!c.diagnostic) continue;
    diagnostics.set(c.diagnostic, (diagnostics.get(c.diagnostic) || 0) + 1);
  }
  if (diagnostics.size >= 3) {
    contenu.push(h("div.graphique-carte", { style: { marginTop: "16px" } }, [
      pareto([...diagnostics.entries()].slice(0, 12).map(([label, valeur]) => ({ label, valeur })), {
        titre: "Diagramme de Pareto des diagnostics",
        libelleY: "Nombre de consultations", hauteur: 330,
      }),
      h("p.texte-secondaire", {
        texte: "La courbe cumulée identifie les pathologies qui concentrent l'essentiel de l'activité : " +
          "c'est sur elles que porte le plus grand potentiel d'amélioration.",
      }),
    ]));
  }

  /* ---------- Activité par utilisateur (article 6.5) ---------- */
  if (autorise("statistiques", "lecture")) {
    const activite = utilisateurs
      .filter(x => x.etablissementId === u.etablissementId && x.actif)
      .map(x => {
        const saisis = R.filter(r => r.saisiPar === x.id).length;
        const valides = R.filter(r => r.validePar === x.id).length;
        const cons = C.filter(c => c.medecinId === x.id).length;
        // Tendance sur 8 semaines pour la mini-courbe
        const serie = [];
        for (let s = 7; s >= 0; s--) {
          const debut = maintenant - (s + 1) * 7 * JOUR, fin = maintenant - s * 7 * JOUR;
          serie.push(R.filter(r => (r.saisiPar === x.id || r.validePar === x.id) &&
            new Date(r.dateSaisie).getTime() >= debut &&
            new Date(r.dateSaisie).getTime() < fin).length +
            C.filter(c => c.medecinId === x.id &&
              new Date(c.date).getTime() >= debut && new Date(c.date).getTime() < fin).length);
        }
        return { utilisateur: x, saisis, valides, consultations: cons, total: saisis + valides + cons, serie };
      })
      .filter(a => a.total > 0)
      .sort((a, b) => b.total - a.total);

    if (activite.length) {
      contenu.push(h("div.carte", { style: { marginTop: "16px" } }, [
        h("div.carte__entete", [h("h2", { texte: "Volume d'activité par utilisateur" })]),
        tableau([
          { cle: "nom", titre: "Utilisateur",
            valeur: a => `${a.utilisateur.prenom} ${a.utilisateur.nom}` },
          { cle: "role", titre: "Rôle", rendu: a => badge(a.utilisateur.role.replace(/_/g, " ")) },
          { cle: "service", titre: "Service", valeur: a => a.utilisateur.service || "—" },
          { cle: "consultations", titre: "Consultations", aligne: "droite", valeur: a => fmt.nombre(a.consultations) },
          { cle: "saisis", titre: "Résultats saisis", aligne: "droite", valeur: a => fmt.nombre(a.saisis) },
          { cle: "valides", titre: "Résultats validés", aligne: "droite", valeur: a => fmt.nombre(a.valides) },
          { cle: "tendance", titre: "Tendance (8 sem.)", triable: false,
            rendu: a => miniCourbe(a.serie) },
        ], activite, { parPage: 10, vide: "Aucune activité enregistrée." }),
      ]));
    }
  }

  /* ---------- Demandes en cours ---------- */
  const enCours = D.filter(d => !["rendue", "annulee"].includes(d.statut))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  if (enCours.length) {
    contenu.push(h("div.carte", [
      h("div.carte__entete", [
        h("h2", { texte: "Demandes en cours" }),
        h("button.btn.btn--petit", { texte: "Tout voir", onclick: () => naviguer("demandes") }),
      ]),
      tableau([
        { cle: "numero", titre: "N°" },
        { cle: "patient", titre: "Patient", valeur: d => {
          const p = P.find(x => x.id === d.patientId);
          return p ? `${p.nom.toUpperCase()} ${p.prenom}` : "—";
        } },
        { cle: "date", titre: "Prescrit", valeur: d => fmt.relatif(d.date),
          triSur: d => new Date(d.date).getTime() },
        { cle: "urgence", titre: "Urgence", rendu: d => badge(
          d.urgence === "vital" ? "Urgence vitale" : d.urgence === "urgent" ? "Urgent" : "Routine",
          d.urgence === "vital" ? COULEURS.critique : d.urgence === "urgent" ? COULEURS.bas : COULEURS.neutre) },
        { cle: "statut", titre: "Statut", rendu: d => badge(
          STATUTS_DEMANDE[d.statut]?.label || d.statut, STATUTS_DEMANDE[d.statut]?.couleur) },
      ], enCours.slice(0, 40), {
        parPage: 8, surLigne: d => naviguer(`demandes/${d.id}`),
        vide: "Aucune demande en cours.",
      }),
    ]));
  }

  /* ---------- Facturation, si le module est activé (article 15) ---------- */
  if (modules.facturation && autorise("facture", "lecture")) {
    const factures = vivants(await store.lireTout("factures"));
    const ca = factures.reduce((a, f) => a + (Number(f.montantTTC) || 0), 0);
    const impayees = factures.filter(f => f.statut !== "payee");
    contenu.push(h("div.grille.grille--3", { style: { marginTop: "16px" } }, [
      carteStat({ libelle: "Chiffre d'affaires", valeur: fmt.nombre(ca), icone: "💶", couleur: COULEURS.normal }),
      carteStat({ libelle: "Factures impayées", valeur: fmt.nombre(impayees.length),
        detail: fmt.nombre(impayees.reduce((a, f) => a + (Number(f.montantTTC) || 0), 0)),
        icone: "⏳", couleur: COULEURS.bas }),
      carteStat({ libelle: "Panier moyen", valeur: factures.length ? fmt.nombre(ca / factures.length) : "—",
        icone: "📊", couleur: COULEURS.accent }),
    ]));
  }

  if (!P.length) {
    contenu.push(etatVide({
      icone: "🚀", titre: "Votre base est vide",
      message: "Créez un premier patient, ou chargez le jeu de démonstration depuis la page d'aide " +
        "pour découvrir la Solution avec des données fictives.",
      action: { libelle: "Créer un patient", action: () => naviguer("patients") },
    }));
  }

  return h("div", contenu);
}
