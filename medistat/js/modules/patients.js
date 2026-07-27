// medistat/js/modules/patients.js
// Gestion des patients (article 6.1) et dossier médical consolidé :
// identité, antécédents, allergies, contacts d'urgence, historique des
// consultations et des résultats, courbes d'évolution biologique, archivage.

import { h, fmt, tableau, badge, modale, confirmer, erreur, succes, etatVide,
  formulaire, carteStat, onglets, remplacer } from "../core/ui.js";
import * as store from "../core/store.js";
import { autorise, utilisateurCourant } from "../core/auth.js";
import { VALIDATEURS, calculerAge, genererIPP, interpreterResultat,
  STATUTS_DEMANDE, CATEGORIES_TESTS } from "../core/model.js";
import { lignes as graphLignes, COULEURS } from "../core/charts.js";
import { telecharger, versCSV, dossierPatientFHIR, DocumentPDF } from "../core/export.js";

export async function vue_patients({ segments, naviguer, rafraichir }) {
  if (segments?.[0]) return dossierPatient(segments[0], { naviguer, rafraichir });
  return listePatients({ naviguer, rafraichir });
}

/* ===================== Liste ===================== */

async function listePatients({ naviguer, rafraichir }) {
  const patients = await store.depots.patients.lister({
    filtre: p => !p._supprime,
    tri: (a, b) => (a.nom || "").localeCompare(b.nom || "", "fr"),
  });
  const actifs = patients.filter(p => !p.archive);
  const archives = patients.filter(p => p.archive);

  const colonnes = [
    { cle: "ipp", titre: "IPP", valeur: p => p.ipp },
    { cle: "nom", titre: "Patient",
      rendu: p => h("div", [
        h("strong", { texte: `${(p.nom || "").toUpperCase()} ${p.prenom || ""}` }),
        p.allergies ? h("div", [badge("⚠ " + p.allergies, COULEURS.bas)]) : null,
      ]),
      triSur: p => p.nom },
    { cle: "sexe", titre: "Sexe", aligne: "centre",
      valeur: p => p.sexe === "F" ? "F" : p.sexe === "M" ? "M" : "—" },
    { cle: "age", titre: "Âge", aligne: "droite",
      valeur: p => calculerAge(p.dateNaissance)?.label || "—",
      triSur: p => calculerAge(p.dateNaissance)?.mois || 0 },
    { cle: "naissance", titre: "Naissance", valeur: p => fmt.date(p.dateNaissance) },
    { cle: "telephone", titre: "Téléphone", valeur: p => p.telephone || "—" },
    { cle: "ville", titre: "Ville", valeur: p => p.ville || "—" },
  ];

  const rendreListe = liste => tableau(colonnes, liste, {
    parPage: 25,
    surLigne: p => naviguer(`patients/${p.id}`),
    vide: "Aucun patient enregistré.",
    triInitial: { colonne: "nom", sens: "asc" },
  });

  return h("div", [
    h("div.page-entete", [
      h("div.page-entete__titre", [
        h("h1", { texte: "Patients" }),
        h("p.texte-secondaire", {
          texte: `${fmt.nombre(actifs.length)} dossier(s) actif(s)` +
            (archives.length ? `, ${fmt.nombre(archives.length)} archivé(s)` : ""),
        }),
      ]),
      h("div.page-entete__actions", [
        autorise("patient", "export")
          ? h("button.btn", { texte: "⬇ Exporter", onclick: () => exporterPatients(patients) })
          : null,
        autorise("patient", "creation")
          ? h("button.btn.btn--primaire", { texte: "＋ Nouveau patient",
              onclick: () => formulairePatient(null, rafraichir) })
          : null,
      ]),
    ]),
    archives.length
      ? onglets([
          { libelle: `Dossiers actifs (${actifs.length})`, contenu: () => rendreListe(actifs) },
          { libelle: `Archivés (${archives.length})`, contenu: () => rendreListe(archives) },
        ])
      : rendreListe(actifs),
  ]);
}

function exporterPatients(patients) {
  const lignes = patients.map(p => ({
    IPP: p.ipp, Nom: p.nom, Prenom: p.prenom,
    DateNaissance: p.dateNaissance, Sexe: p.sexe,
    Age: calculerAge(p.dateNaissance)?.annees ?? "",
    Ville: p.ville || "", GroupeSanguin: p.groupeSanguin || "",
    Archive: p.archive ? "oui" : "non",
  }));
  telecharger(versCSV(lignes), `patients-${new Date().toISOString().slice(0, 10)}.csv`, "text/csv");
  store.tracer("export", "patient", null, `Export de ${patients.length} dossiers patients`);
  succes(`${patients.length} dossiers exportés.`);
}

/* ===================== Création et modification ===================== */

async function formulairePatient(patient, apres) {
  const modification = !!patient;
  const form = formulaire([
    { type: "separateur", libelle: "Identité" },
    { cle: "nom", libelle: "Nom", obligatoire: true },
    { cle: "prenom", libelle: "Prénom", obligatoire: true },
    { cle: "dateNaissance", libelle: "Date de naissance", type: "date", obligatoire: true },
    { cle: "sexe", libelle: "Sexe", type: "select", obligatoire: true, vide: "— Choisir —",
      options: [{ valeur: "F", libelle: "Féminin" }, { valeur: "M", libelle: "Masculin" },
        { valeur: "A", libelle: "Autre / non précisé" }] },
    { type: "separateur", libelle: "Coordonnées" },
    { cle: "telephone", libelle: "Téléphone", type: "tel" },
    { cle: "email", libelle: "Adresse électronique", type: "email" },
    { cle: "adresse", libelle: "Adresse", pleineLargeur: true },
    { cle: "ville", libelle: "Ville" },
    { cle: "pays", libelle: "Pays" },
    { type: "separateur", libelle: "Données cliniques" },
    { cle: "groupeSanguin", libelle: "Groupe sanguin", type: "select", vide: "— Inconnu —",
      options: ["O+", "O−", "A+", "A−", "B+", "B−", "AB+", "AB−"] },
    { cle: "assurance", libelle: "Assurance ou mutuelle" },
    { cle: "allergies", libelle: "Allergies connues", type: "textarea", pleineLargeur: true,
      aide: "Signalées en évidence sur chaque écran du dossier." },
    { cle: "antecedents", libelle: "Antécédents médicaux et chirurgicaux", type: "textarea",
      pleineLargeur: true, lignes: 4 },
    { cle: "contactUrgence", libelle: "Contact d'urgence", pleineLargeur: true,
      placeholder: "Nom, lien de parenté et téléphone" },
  ], patient || {});
  form.classList.add("formulaire--grille");

  const resultat = await modale({
    titre: modification ? "Modifier le dossier patient" : "Nouveau patient",
    contenu: form,
    largeur: "760px",
    actions: [
      { libelle: "Annuler", type: "neutre", valeur: null },
      { libelle: modification ? "Enregistrer" : "Créer le dossier", type: "primaire",
        action: async () => {
          const v = form.valeurs();
          const erreurs = VALIDATEURS.patient(v);
          if (erreurs.length) { erreur(erreurs.join(" ")); return false; }
          try {
            if (modification) {
              return await store.depots.patients.modifier(patient.id, v);
            }
            const etablissements = await store.lireTout("etablissements");
            const code = etablissements[0]?.code || "ETS";
            const sequence = await store.prochaineSequence("patient");
            return await store.depots.patients.creer({ ...v, ipp: genererIPP(code, sequence), archive: false });
          } catch (e) { erreur(e.message); return false; }
        } },
    ],
  });

  if (resultat) {
    succes(modification ? "Dossier mis à jour." : `Dossier créé — IPP ${resultat.ipp}.`);
    apres?.();
  }
  return resultat;
}

/* ===================== Dossier médical ===================== */

async function dossierPatient(id, { naviguer, rafraichir }) {
  // La consultation d'un dossier est elle-même un événement tracé (article 16)
  const patient = await store.depots.patients.obtenir(id, { tracerConsultation: true });
  if (!patient) return etatVide({ icone: "🔍", titre: "Dossier introuvable",
    message: "Ce patient n'existe pas ou a été supprimé.",
    action: { libelle: "Retour à la liste", action: () => naviguer("patients") } });

  const [consultations, demandes, resultats, tests, documents, utilisateurs] = await Promise.all([
    store.depots.consultations.parIndex("patientId", id).catch(() => []),
    store.depots.demandes.parIndex("patientId", id).catch(() => []),
    store.depots.resultats.parIndex("patientId", id).catch(() => []),
    store.lireTout("testsCatalogue"),
    store.depots.documents.parIndex("patientId", id).catch(() => []),
    store.lireTout("utilisateurs"),
  ]);
  consultations.sort((a, b) => (a.date < b.date ? 1 : -1));
  demandes.sort((a, b) => (a.date < b.date ? 1 : -1));

  const age = calculerAge(patient.dateNaissance);
  const nomUtilisateur = uid => {
    const u = utilisateurs.find(x => x.id === uid);
    return u ? `${u.prenom} ${u.nom}` : "—";
  };

  /* ---------- En-tête d'identité ---------- */
  const entete = h("div.carte", [
    h("div", { style: { display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "flex-start" } }, [
      h("div", { style: { flex: "1 1 280px" } }, [
        h("h1", { style: { marginBottom: "4px" },
          texte: `${(patient.nom || "").toUpperCase()} ${patient.prenom || ""}` }),
        h("div.texte-secondaire", {
          texte: `IPP ${patient.ipp} — ${patient.sexe === "F" ? "Féminin" : patient.sexe === "M" ? "Masculin" : "Non précisé"}` +
            ` — ${age?.label || "âge inconnu"} (né${patient.sexe === "F" ? "e" : ""} le ${fmt.date(patient.dateNaissance)})`,
        }),
        h("div", { style: { marginTop: "8px", display: "flex", gap: "6px", flexWrap: "wrap" } }, [
          patient.groupeSanguin ? badge("🩸 " + patient.groupeSanguin, COULEURS.critique) : null,
          patient.telephone ? badge("📞 " + patient.telephone) : null,
          patient.ville ? badge("📍 " + patient.ville) : null,
          patient.assurance ? badge("🏷 " + patient.assurance) : null,
          patient.archive ? badge("Dossier archivé", COULEURS.neutre) : null,
        ]),
      ]),
      h("div.page-entete__actions", [
        autorise("patient", "modification")
          ? h("button.btn", { texte: "✏️ Modifier", onclick: () => formulairePatient(patient, rafraichir) })
          : null,
        autorise("demande", "creation")
          ? h("button.btn.btn--primaire", { texte: "🧪 Prescrire des examens",
              onclick: () => naviguer(`demandes/nouvelle/${patient.id}`) })
          : null,
        h("button.btn", { texte: "⬇ Dossier", onclick: () => menuExportDossier(patient, demandes, resultats, tests) }),
      ]),
    ]),
    // Les allergies sont l'information la plus critique d'un dossier :
    // elles doivent être visibles avant toute prescription.
    patient.allergies
      ? h("div", {
          style: { marginTop: "12px", padding: "10px 13px", borderRadius: "8px",
            background: "rgba(220,38,38,.08)", borderLeft: "4px solid var(--danger)" },
        }, [
          h("strong", { texte: "⚠ Allergies : " }),
          h("span", { texte: patient.allergies }),
        ])
      : null,
  ]);

  /* ---------- Indicateurs du dossier ---------- */
  const anomalies = resultats.filter(r => r.horsNorme).length;
  const critiques = resultats.filter(r => r.critique).length;
  const indicateurs = h("div.grille.grille--4", [
    carteStat({ libelle: "Consultations", valeur: consultations.length, icone: "🩺" }),
    carteStat({ libelle: "Demandes d'examens", valeur: demandes.length, icone: "📋" }),
    carteStat({ libelle: "Résultats", valeur: resultats.length, icone: "📊",
      detail: anomalies ? `${anomalies} hors normes` : "Tous dans les normes" }),
    carteStat({ libelle: "Valeurs critiques", valeur: critiques, icone: "🚨",
      couleur: critiques ? COULEURS.critique : COULEURS.normal }),
  ]);

  /* ---------- Onglets du dossier ---------- */
  const vueSynthese = () => h("div", [
    h("div.grille.grille--2", [
      h("div.carte", [
        h("div.carte__entete", [h("h3", { texte: "Antécédents" })]),
        patient.antecedents
          ? h("p", { style: { whiteSpace: "pre-wrap" }, texte: patient.antecedents })
          : h("p.texte-secondaire", { texte: "Aucun antécédent renseigné." }),
      ]),
      h("div.carte", [
        h("div.carte__entete", [h("h3", { texte: "Contact d'urgence" })]),
        patient.contactUrgence
          ? h("p", { texte: patient.contactUrgence })
          : h("p.texte-secondaire", { texte: "Aucun contact d'urgence renseigné." }),
        h("div.champ-libelle", { style: { marginTop: "10px" }, texte: "Adresse" }),
        h("p.texte-secondaire", { texte: [patient.adresse, patient.ville, patient.pays].filter(Boolean).join(", ") || "—" }),
      ]),
    ]),
    h("div.carte", [
      h("div.carte__entete", [h("h3", { texte: "Chronologie du dossier" })]),
      chronologie(consultations, demandes, resultats, tests, naviguer),
    ]),
  ]);

  const vueResultats = () => vueResultatsBiologiques(resultats, tests, demandes);

  const vueConsultations = () => consultations.length
    ? tableau([
        { cle: "date", titre: "Date", valeur: c => fmt.date(c.date, { heure: true }),
          triSur: c => new Date(c.date).getTime() },
        { cle: "service", titre: "Service", valeur: c => c.service || "—" },
        { cle: "medecin", titre: "Praticien", valeur: c => nomUtilisateur(c.medecinId) },
        { cle: "motif", titre: "Motif", valeur: c => c.motif || "—" },
        { cle: "diagnostic", titre: "Diagnostic",
          rendu: c => h("div", [
            h("div", { texte: c.diagnostic || "—" }),
            c.cim10 ? h("span.texte-secondaire", { texte: "CIM-10 : " + c.cim10 }) : null,
          ]) },
      ], consultations, {
        parPage: 15,
        surLigne: c => detailConsultation(c, nomUtilisateur),
        triInitial: { colonne: "date", sens: "desc" },
      })
    : etatVide({ icone: "🩺", titre: "Aucune consultation", message: "Ce patient n'a pas encore été reçu." });

  const vueDemandes = () => demandes.length
    ? tableau([
        { cle: "numero", titre: "N°" },
        { cle: "date", titre: "Date", valeur: d => fmt.date(d.date, { heure: true }),
          triSur: d => new Date(d.date).getTime() },
        { cle: "tests", titre: "Analyses", valeur: d => (d.tests || []).length + " analyse(s)" },
        { cle: "urgence", titre: "Urgence", rendu: d => badge(d.urgence || "routine",
          d.urgence === "vital" ? COULEURS.critique : d.urgence === "urgent" ? COULEURS.bas : null) },
        { cle: "statut", titre: "Statut", rendu: d => badge(
          STATUTS_DEMANDE[d.statut]?.label || d.statut, STATUTS_DEMANDE[d.statut]?.couleur) },
      ], demandes, {
        parPage: 15, surLigne: d => naviguer(`demandes/${d.id}`),
        triInitial: { colonne: "date", sens: "desc" },
      })
    : etatVide({ icone: "📋", titre: "Aucune demande d'examen" });

  return h("div", [
    h("button.btn.btn--fin", { texte: "‹ Retour aux patients", onclick: () => naviguer("patients"),
      style: { marginBottom: "10px" } }),
    entete,
    indicateurs,
    onglets([
      { libelle: "Synthèse", contenu: vueSynthese },
      { libelle: `Résultats (${resultats.length})`, contenu: vueResultats },
      { libelle: `Consultations (${consultations.length})`, contenu: vueConsultations },
      { libelle: `Examens (${demandes.length})`, contenu: vueDemandes },
    ]),
  ]);
}

/* ===================== Chronologie ===================== */

function chronologie(consultations, demandes, resultats, tests, naviguer) {
  const evenements = [
    ...consultations.map(c => ({
      date: c.date, type: "consultation", icone: "🩺",
      titre: c.diagnostic || c.motif || "Consultation",
      detail: c.service || "",
    })),
    ...demandes.map(d => ({
      date: d.date, type: "demande", icone: "📋",
      titre: `Demande ${d.numero} — ${(d.tests || []).length} analyse(s)`,
      detail: STATUTS_DEMANDE[d.statut]?.label || d.statut,
      aller: () => naviguer(`demandes/${d.id}`),
    })),
    ...resultats.filter(r => r.critique).map(r => {
      const test = tests.find(t => t.code === r.testCode);
      return {
        date: r.dateValidation || r.dateSaisie, type: "critique", icone: "🚨",
        titre: `Valeur critique — ${test?.nom || r.testCode}`,
        detail: `${r.valeurTexte ?? r.valeur} ${r.unite || ""}`,
      };
    }),
  ].filter(e => e.date).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 40);

  if (!evenements.length) return h("p.texte-secondaire", { texte: "Aucun événement enregistré." });

  return h("div.chronologie", evenements.map(e => {
    const item = h("div.chrono-item", [
      h("div.chrono-item__date", { texte: `${fmt.date(e.date, { heure: true })} — ${fmt.relatif(e.date)}` }),
      h("div.chrono-item__titre", {
        texte: `${e.icone}  ${e.titre}`,
        style: e.type === "critique" ? { color: "var(--critique)" } : {},
      }),
      e.detail ? h("div.texte-secondaire", { texte: e.detail }) : null,
    ]);
    if (e.aller) { item.style.cursor = "pointer"; item.addEventListener("click", e.aller); }
    return item;
  }));
}

/* ===================== Résultats biologiques ===================== */

// Vue longitudinale : c'est elle qui donne toute sa valeur au dossier —
// une valeur isolée informe peu, son évolution informe beaucoup.
function vueResultatsBiologiques(resultats, tests, demandes) {
  if (!resultats.length) {
    return etatVide({ icone: "📊", titre: "Aucun résultat",
      message: "Aucune analyse n'a encore été rendue pour ce patient." });
  }

  const parTest = new Map();
  for (const r of resultats) {
    if (!parTest.has(r.testCode)) parTest.set(r.testCode, []);
    parTest.get(r.testCode).push(r);
  }
  for (const liste of parTest.values()) {
    liste.sort((a, b) => new Date(a.dateValidation || a.dateSaisie) - new Date(b.dateValidation || b.dateSaisie));
  }

  const conteneur = h("div");

  // Sélecteur de paramètre à suivre dans le temps
  const suivis = [...parTest.entries()]
    .filter(([code, liste]) => liste.length >= 2 && tests.find(t => t.code === code)?.type !== "qualitatif");

  if (suivis.length) {
    const select = h("select.champ", { style: { maxWidth: "340px" } },
      suivis.map(([code]) => {
        const test = tests.find(t => t.code === code);
        return h("option", { value: code, texte: `${test?.nom || code} (${parTest.get(code).length} mesures)` });
      }));
    const zoneGraphique = h("div.graphique-carte");

    const tracer = () => {
      const code = select.value;
      const test = tests.find(t => t.code === code);
      const serie = parTest.get(code);
      const points = serie.map(r => ({
        x: new Date(r.dateValidation || r.dateSaisie).getTime(),
        y: Number(r.valeur),
        label: fmt.date(r.dateValidation || r.dateSaisie),
      })).filter(p => Number.isFinite(p.y));

      const min = Number(test?.valeurRefMin), max = Number(test?.valeurRefMax);
      remplacer(zoneGraphique, graphLignes([{ nom: test?.nom || code, points }], {
        titre: `Évolution — ${test?.nom || code}`,
        xCategories: serie.map(r => fmt.date(r.dateValidation || r.dateSaisie)),
        libelleY: test?.unite || "Valeur",
        hauteur: 320,
        zoneNormale: Number.isFinite(min) && Number.isFinite(max) ? { min, max } : null,
        references: [
          Number.isFinite(min) ? { valeur: min, label: `norme basse ${min}`, couleur: COULEURS.bas } : null,
          Number.isFinite(max) ? { valeur: max, label: `norme haute ${max}`, couleur: COULEURS.bas } : null,
          Number.isFinite(Number(test?.seuilCritiqueMax))
            ? { valeur: Number(test.seuilCritiqueMax), label: "seuil critique", couleur: COULEURS.critique } : null,
        ].filter(Boolean),
      }));
    };
    select.addEventListener("change", tracer);
    conteneur.appendChild(h("div.carte", [
      h("div.carte__entete", [
        h("h3", { texte: "Évolution d'un paramètre" }), select,
      ]),
      zoneGraphique,
    ]));
    tracer();
  }

  // Tableau complet, groupé par discipline
  const parCategorie = new Map();
  for (const [code, liste] of parTest) {
    const test = tests.find(t => t.code === code);
    const cat = CATEGORIES_TESTS.find(c => c.code === test?.categorie);
    const nom = cat ? `${cat.icon} ${cat.label}` : "Autres";
    if (!parCategorie.has(nom)) parCategorie.set(nom, []);
    parCategorie.get(nom).push({ test, liste, code });
  }

  for (const [categorie, entrees] of parCategorie) {
    const lignesTableau = entrees.flatMap(({ test, liste, code }) =>
      liste.slice().reverse().map(r => {
        const interpretation = interpreterResultat(r.valeur, test);
        const demande = demandes.find(d => d.id === r.demandeId);
        return { r, test, code, interpretation, demande };
      }));

    conteneur.appendChild(h("div.carte", [
      h("div.carte__entete", [h("h3", { texte: categorie })]),
      tableau([
        { cle: "analyse", titre: "Analyse", valeur: x => x.test?.nom || x.code },
        { cle: "date", titre: "Date", valeur: x => fmt.date(x.r.dateValidation || x.r.dateSaisie),
          triSur: x => new Date(x.r.dateValidation || x.r.dateSaisie).getTime() },
        { cle: "valeur", titre: "Résultat", aligne: "droite",
          rendu: x => h("span", {
            class: x.interpretation.critique ? "valeur-critique"
              : x.interpretation.horsNorme ? "valeur-anormale" : "valeur-normale",
            texte: `${x.r.valeurTexte ?? fmt.nombre(x.r.valeur)} ${x.interpretation.symbole || ""}`,
          }) },
        { cle: "unite", titre: "Unité", valeur: x => x.test?.unite || "—" },
        { cle: "reference", titre: "Références", aligne: "centre",
          valeur: x => (Number.isFinite(Number(x.test?.valeurRefMin)) && Number.isFinite(Number(x.test?.valeurRefMax)))
            ? `${fmt.nombre(x.test.valeurRefMin)} – ${fmt.nombre(x.test.valeurRefMax)}` : "—" },
        { cle: "commentaire", titre: "Commentaire",
          valeur: x => x.r.commentaireBiologiste || "—" },
      ], lignesTableau, {
        parPage: 20, compact: true,
        triInitial: { colonne: "date", sens: "desc" },
      }),
    ]));
  }

  return conteneur;
}

/* ===================== Détail d'une consultation ===================== */

function detailConsultation(c, nomUtilisateur) {
  const cst = c.constantes || {};
  const ligne = (libelle, valeur, unite = "") =>
    valeur === null || valeur === undefined || valeur === "" ? null
      : h("div.stat-bloc", [
          h("span.stat-bloc__libelle", { texte: libelle }),
          h("span.stat-bloc__valeur", { texte: `${fmt.nombre(valeur)} ${unite}`.trim() }),
        ]);

  return modale({
    titre: `Consultation du ${fmt.date(c.date, { heure: true })}`,
    largeur: "680px",
    contenu: h("div", [
      h("div.texte-secondaire", {
        texte: `${c.service || "Service non précisé"} — ${nomUtilisateur(c.medecinId)}`,
      }),
      Object.keys(cst).length ? h("div.resultat-test__stat", { style: { marginTop: "12px" } }, [
        ligne("Température", cst.temperature, "°C"),
        cst.tensionSystolique ? h("div.stat-bloc", [
          h("span.stat-bloc__libelle", { texte: "Tension" }),
          h("span.stat-bloc__valeur", { texte: `${cst.tensionSystolique}/${cst.tensionDiastolique}` }),
        ]) : null,
        ligne("Pouls", cst.pouls, "/min"),
        ligne("Poids", cst.poids, "kg"),
        ligne("Taille", cst.taille, "cm"),
        ligne("Saturation", cst.saturation, "%"),
        cst.poids && cst.taille ? h("div.stat-bloc", [
          h("span.stat-bloc__libelle", { texte: "IMC" }),
          h("span.stat-bloc__valeur", { texte: fmt.nombre(cst.poids / ((cst.taille / 100) ** 2), 1) }),
        ]) : null,
      ]) : null,
      ...[
        ["Motif", c.motif], ["Symptômes", c.symptomes], ["Examen clinique", c.examenClinique],
        ["Diagnostic", c.diagnostic + (c.cim10 ? ` (CIM-10 : ${c.cim10})` : "")],
        ["Conduite à tenir", c.conduite],
      ].filter(([, v]) => v && String(v).trim()).map(([libelle, valeur]) => h("div", { style: { marginTop: "12px" } }, [
        h("div.champ-libelle", { texte: libelle }),
        h("p", { style: { whiteSpace: "pre-wrap", margin: "2px 0 0" }, texte: String(valeur) }),
      ])),
      c.commentairePatient ? h("div", { style: { marginTop: "14px" } }, [
        h("div.champ-libelle", { texte: "Retour du patient" }),
        h("div.interpretation", { texte: c.commentairePatient }),
      ]) : null,
    ]),
    actions: [{ libelle: "Fermer", type: "neutre" }],
  });
}

/* ===================== Export du dossier ===================== */

async function menuExportDossier(patient, demandes, resultats, tests) {
  const choix = await modale({
    titre: "Exporter le dossier",
    largeur: "440px",
    contenu: h("div", [
      h("p.texte-secondaire", {
        texte: "L'export d'un dossier médical est une action tracée dans le journal d'audit.",
      }),
      h("div", { style: { display: "flex", flexDirection: "column", gap: "8px" } }, [
        h("button.btn", { texte: "📄  Synthèse PDF du dossier", onclick: () => choisir("pdf") }),
        h("button.btn", { texte: "📊  Résultats au format CSV", onclick: () => choisir("csv") }),
        h("button.btn", { texte: "🔗  Lot HL7 FHIR (interopérabilité)", onclick: () => choisir("fhir") }),
      ]),
    ]),
    actions: [{ libelle: "Annuler", type: "neutre", valeur: null }],
  });
  function choisir(type) {
    document.querySelector(".modale__fond")?.remove();
    exporterDossier(type, patient, demandes, resultats, tests);
  }
  return choix;
}

async function exporterDossier(type, patient, demandes, resultats, tests) {
  const base = `dossier-${patient.ipp}`;
  try {
    if (type === "csv") {
      const lignes = resultats.map(r => {
        const test = tests.find(t => t.code === r.testCode);
        return {
          Date: fmt.date(r.dateValidation || r.dateSaisie),
          Code: r.testCode, Analyse: test?.nom || r.testCode,
          Valeur: r.valeurTexte ?? r.valeur, Unite: test?.unite || "",
          RefMin: test?.valeurRefMin ?? "", RefMax: test?.valeurRefMax ?? "",
          HorsNorme: r.horsNorme ? "oui" : "non", Critique: r.critique ? "oui" : "non",
          Commentaire: r.commentaireBiologiste || "",
        };
      });
      telecharger(versCSV(lignes), `${base}.csv`, "text/csv");
    } else if (type === "fhir") {
      const etablissements = await store.lireTout("etablissements");
      const lot = dossierPatientFHIR(patient, etablissements[0], demandes, resultats, tests);
      telecharger(JSON.stringify(lot, null, 2), `${base}-fhir.json`, "application/fhir+json");
    } else {
      const pdf = new DocumentPDF({ titre: `Dossier ${patient.nom} ${patient.prenom}` });
      pdf.ligne(`DOSSIER MÉDICAL — ${(patient.nom || "").toUpperCase()} ${patient.prenom}`,
        { taille: 14, gras: true });
      pdf.ligne(`IPP ${patient.ipp} — ${calculerAge(patient.dateNaissance)?.label || ""} — ` +
        `né${patient.sexe === "F" ? "e" : ""} le ${fmt.date(patient.dateNaissance)}`, { taille: 9 });
      pdf.trait();
      if (patient.allergies) {
        pdf.espace(6);
        pdf.ligne("ALLERGIES : " + patient.allergies, { taille: 10, gras: true, couleur: [0.8, 0.1, 0.1] });
      }
      if (patient.antecedents) {
        pdf.espace(8);
        pdf.ligne("ANTÉCÉDENTS", { taille: 10, gras: true });
        pdf.paragraphe(patient.antecedents, { taille: 9 });
      }
      pdf.espace(10);
      pdf.ligne("RÉSULTATS D'ANALYSES", { taille: 11, gras: true });
      pdf.tableau(["Date", "Analyse", "Résultat", "Unité", "Réf."],
        resultats.slice().sort((a, b) =>
          new Date(b.dateValidation || b.dateSaisie) - new Date(a.dateValidation || a.dateSaisie))
          .map(r => {
            const test = tests.find(t => t.code === r.testCode);
            const i = interpreterResultat(r.valeur, test);
            return [
              fmt.date(r.dateValidation || r.dateSaisie),
              test?.nom || r.testCode,
              { texte: `${r.valeurTexte ?? fmt.nombre(r.valeur)} ${i.symbole || ""}`,
                gras: i.horsNorme,
                couleur: i.critique ? [0.86, 0.15, 0.15] : i.horsNorme ? [0.85, 0.5, 0.05] : null },
              test?.unite || "",
              (Number.isFinite(Number(test?.valeurRefMin)) && Number.isFinite(Number(test?.valeurRefMax)))
                ? `${test.valeurRefMin}–${test.valeurRefMax}` : "—",
            ];
          }),
        { largeurs: [72, 180, 92, 62, 90], alignements: ["gauche", "gauche", "droite", "gauche", "centre"] });
      telecharger(pdf.produire(), `${base}.pdf`);
    }
    await store.tracer("export", "patient", patient.id, `Export du dossier au format ${type.toUpperCase()}`);
    succes("Dossier exporté.");
  } catch (e) { erreur("Export impossible : " + e.message); }
}
