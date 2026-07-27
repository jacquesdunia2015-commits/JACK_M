// medistat/js/modules/laboratoire.js
// Module laboratoire — cœur fonctionnel du projet (article 7).
// Prescription, prélèvement, réception, paillasse, saisie, validation,
// signature électronique, rendu au dossier et correction sous contrôle d'audit.

import { h, fmt, tableau, badge, modale, confirmer, erreur, succes, alerte, critique,
  etatVide, formulaire, carteStat, remplacer, demanderMotDePasse, onglets } from "../core/ui.js";
import * as store from "../core/store.js";
import { autorise, utilisateurCourant } from "../core/auth.js";
import { STATUTS_DEMANDE, STATUTS_RESULTAT, TRANSITIONS, transitionAutorisee,
  DROIT_TRANSITION, NIVEAUX_URGENCE, TYPES_ECHANTILLON, CATEGORIES_TESTS,
  interpreterResultat, calculerDelta, calculerAge, genererNumeroDemande,
  genererCodeBarre, delaiHeures, VALIDATEURS } from "../core/model.js";
import { signerResultat, verifierSignature } from "../core/crypto.js";
import { COULEURS } from "../core/charts.js";
import { compteRenduLaboratoire, telecharger } from "../core/export.js";

/* ===================== Points d'entrée ===================== */

export async function vue_demandes(ctx) {
  const [premier, second] = ctx.segments || [];
  if (premier === "nouvelle") return formulaireDemande(second, ctx);
  if (premier) return detailDemande(premier, ctx);
  return listeDemandes(ctx);
}

export async function vue_paillasse(ctx) { return paillasse(ctx); }
export async function vue_validation(ctx) { return fileValidation(ctx); }

/* ===================== Liste des demandes ===================== */

async function listeDemandes({ naviguer, rafraichir, requete }) {
  const [demandes, patients, resultats] = await Promise.all([
    store.depots.demandes.lister({ tri: (a, b) => (a.date < b.date ? 1 : -1) }),
    store.lireTout("patients"),
    store.lireTout("resultats"),
  ]);
  const nomPatient = id => {
    const p = patients.find(x => x.id === id);
    return p ? `${(p.nom || "").toUpperCase()} ${p.prenom || ""}` : "—";
  };

  const filtreCritiques = requete?.get?.("critiques") === "1";
  const idsCritiques = new Set(resultats.filter(r => r.critique && !r.alerteAcquittee).map(r => r.demandeId));
  const visibles = filtreCritiques ? demandes.filter(d => idsCritiques.has(d.id)) : demandes;

  const parStatut = statut => demandes.filter(d => d.statut === statut).length;
  const enCours = demandes.filter(d => !["rendue", "annulee"].includes(d.statut));

  const colonnes = [
    { cle: "numero", titre: "N°",
      rendu: d => h("div", [
        h("strong", { texte: d.numero }),
        idsCritiques.has(d.id) ? h("div", [badge("🚨 critique", COULEURS.critique)]) : null,
      ]) },
    { cle: "patient", titre: "Patient", valeur: d => nomPatient(d.patientId) },
    { cle: "date", titre: "Prescrit le", valeur: d => fmt.date(d.date, { heure: true }),
      triSur: d => new Date(d.date).getTime() },
    { cle: "tests", titre: "Analyses", aligne: "centre", valeur: d => (d.tests || []).length },
    { cle: "urgence", titre: "Urgence", rendu: d => {
      const n = NIVEAUX_URGENCE.find(x => x.code === d.urgence) || NIVEAUX_URGENCE[0];
      return badge(n.label, n.couleur);
    } },
    { cle: "delai", titre: "Délai écoulé", aligne: "droite",
      valeur: d => d.statut === "rendue" ? "—" : fmt.duree(delaiHeures(d.date)),
      triSur: d => delaiHeures(d.date) || 0 },
    { cle: "statut", titre: "Statut", rendu: d => badge(
      STATUTS_DEMANDE[d.statut]?.label || d.statut, STATUTS_DEMANDE[d.statut]?.couleur) },
  ];

  return h("div", [
    h("div.page-entete", [
      h("div.page-entete__titre", [
        h("h1", { texte: "Demandes d'examens" }),
        h("p.texte-secondaire", {
          texte: `${fmt.nombre(demandes.length)} demande(s), dont ${fmt.nombre(enCours.length)} en cours.`,
        }),
      ]),
      h("div.page-entete__actions", [
        filtreCritiques
          ? h("button.btn", { texte: "Voir toutes les demandes", onclick: () => naviguer("demandes") })
          : null,
        autorise("demande", "creation")
          ? h("button.btn.btn--primaire", { texte: "＋ Nouvelle demande",
              onclick: () => naviguer("demandes/nouvelle") })
          : null,
      ]),
    ]),
    h("div.grille.grille--4", { style: { marginBottom: "16px" } }, [
      carteStat({ libelle: "À prélever", valeur: parStatut("enregistree"), icone: "🩸" }),
      carteStat({ libelle: "En analyse", valeur: parStatut("en_analyse") + parStatut("receptionnee"), icone: "🔬" }),
      carteStat({ libelle: "À valider", valeur: parStatut("saisie"), icone: "⏳", couleur: COULEURS.bas }),
      carteStat({ libelle: "Rendues", valeur: parStatut("rendue"), icone: "✅", couleur: COULEURS.normal }),
    ]),
    filtreCritiques
      ? h("div.avertissement", { texte: "Filtre actif : seules les demandes portant une valeur critique non acquittée sont affichées." })
      : null,
    tableau(colonnes, visibles, {
      parPage: 25, surLigne: d => naviguer(`demandes/${d.id}`),
      triInitial: { colonne: "date", sens: "desc" },
      vide: "Aucune demande enregistrée.",
    }),
  ]);
}

/* ===================== Nouvelle demande (article 6.2) ===================== */

async function formulaireDemande(patientId, { naviguer }) {
  const [patients, tests] = await Promise.all([
    store.depots.patients.lister({ filtre: p => !p._supprime && !p.archive }),
    store.depots.testsCatalogue.lister({ filtre: t => t.actif !== false }),
  ]);
  if (!tests.length) {
    return etatVide({ icone: "🧪", titre: "Catalogue vide",
      message: "Aucun test n'est paramétré. Créez d'abord le catalogue des analyses.",
      action: { libelle: "Ouvrir le catalogue", action: () => naviguer("catalogue") } });
  }

  let patientChoisi = patients.find(p => p.id === patientId) || null;
  const selection = new Set();

  const zonePatient = h("div");
  const rendrePatient = () => remplacer(zonePatient, patientChoisi
    ? h("div", { style: { display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" } }, [
        h("div", { style: { flex: "1 1 220px" } }, [
          h("strong", { texte: `${(patientChoisi.nom || "").toUpperCase()} ${patientChoisi.prenom}` }),
          h("div.texte-secondaire", {
            texte: `${patientChoisi.ipp} — ${calculerAge(patientChoisi.dateNaissance)?.label || ""}`,
          }),
          patientChoisi.allergies
            ? h("div", [badge("⚠ Allergies : " + patientChoisi.allergies, COULEURS.critique)])
            : null,
        ]),
        h("button.btn.btn--petit", { texte: "Changer", onclick: choisirPatient }),
      ])
    : h("button.btn", { texte: "🔍 Choisir un patient", onclick: choisirPatient }));

  async function choisirPatient() {
    const recherche = h("input.champ", { type: "search", placeholder: "Nom, prénom ou IPP…" });
    const liste = h("div", { style: { maxHeight: "320px", overflowY: "auto", marginTop: "10px" } });
    const rendre = () => {
      const q = recherche.value.trim().toLowerCase();
      const filtres = q
        ? patients.filter(p => [p.nom, p.prenom, p.ipp].some(v => String(v || "").toLowerCase().includes(q)))
        : patients.slice(0, 40);
      remplacer(liste, filtres.length
        ? filtres.map(p => h("div.recherche-resultat", {
            onclick: () => { patientChoisi = p; rendrePatient();
              document.querySelector(".modale__fond")?.remove(); },
          }, [
            h("div", [
              h("strong", { texte: `${(p.nom || "").toUpperCase()} ${p.prenom}` }),
              h("div.texte-secondaire", {
                texte: `${p.ipp} — ${calculerAge(p.dateNaissance)?.label || ""} — ${p.sexe}` }),
            ]),
          ]))
        : [h("p.texte-secondaire", { texte: "Aucun patient ne correspond." })]);
    };
    recherche.addEventListener("input", rendre);
    rendre();
    await modale({ titre: "Choisir un patient", contenu: h("div", [recherche, liste]),
      largeur: "520px", actions: [{ libelle: "Annuler", type: "neutre", valeur: null }] });
  }
  rendrePatient();

  // Sélection des analyses, groupées par discipline
  const compteur = h("span.texte-secondaire", { texte: "Aucune analyse sélectionnée" });
  const majCompteur = () => {
    compteur.textContent = selection.size
      ? `${selection.size} analyse(s) sélectionnée(s)`
      : "Aucune analyse sélectionnée";
  };
  const zoneTests = h("div", CATEGORIES_TESTS.map(cat => {
    const liste = tests.filter(t => t.categorie === cat.code);
    if (!liste.length) return null;
    return h("details", { open: true, style: { marginBottom: "8px" } }, [
      h("summary", { style: { cursor: "pointer", fontWeight: "600", padding: "6px 0" },
        texte: `${cat.icon} ${cat.label} (${liste.length})` }),
      h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: "4px" } },
        liste.map(t => {
          const case_ = h("input", { type: "checkbox", value: t.code });
          case_.addEventListener("change", () => {
            if (case_.checked) selection.add(t.code); else selection.delete(t.code);
            majCompteur();
          });
          return h("label.champ-groupe.champ-groupe--case", { style: { padding: "3px 0" } }, [
            case_,
            h("span", [
              h("span", { texte: t.nom }),
              t.delaiRenduHeures
                ? h("span.texte-secondaire", { texte: ` — ${t.delaiRenduHeures} h` })
                : null,
            ]),
          ]);
        })),
    ]);
  }).filter(Boolean));

  const form = formulaire([
    { cle: "urgence", libelle: "Niveau d'urgence", type: "radio", defaut: "routine",
      options: NIVEAUX_URGENCE.map(n => ({ valeur: n.code, libelle: `${n.label} (${n.delai} h)` })) },
    { cle: "commentaire", libelle: "Renseignements cliniques", type: "textarea", pleineLargeur: true,
      aide: "Ces informations orientent l'interprétation du biologiste." },
  ]);

  const bouton = h("button.btn.btn--primaire.btn--large", { texte: "Enregistrer la demande" });
  bouton.addEventListener("click", async () => {
    if (!patientChoisi) return erreur("Sélectionnez un patient.");
    if (!selection.size) return erreur("Sélectionnez au moins une analyse.");
    const v = form.valeurs();
    bouton.disabled = true;
    try {
      const sequence = await store.prochaineSequence("demande");
      const demande = await store.depots.demandes.creer({
        numero: genererNumeroDemande(sequence),
        patientId: patientChoisi.id,
        prescripteurId: utilisateurCourant().id,
        prescripteurNom: `${utilisateurCourant().prenom} ${utilisateurCourant().nom}`,
        date: new Date().toISOString(),
        urgence: v.urgence || "routine",
        tests: [...selection],
        commentaire: v.commentaire,
        statut: "enregistree",
      });
      // Un résultat en attente est créé par analyse : la paillasse sait
      // immédiatement ce qui reste à saisir.
      for (const code of selection) {
        const test = tests.find(t => t.code === code);
        await store.depots.resultats.creer({
          demandeId: demande.id, patientId: patientChoisi.id,
          testCode: code, unite: test?.unite || "",
          valeur: null, valeurTexte: null, statut: "en_attente", version: 1,
        });
      }
      succes(`Demande ${demande.numero} enregistrée.`);
      naviguer(`demandes/${demande.id}`);
    } catch (e) { bouton.disabled = false; erreur(e.message); }
  });

  return h("div", [
    h("button.btn.btn--fin", { texte: "‹ Retour", onclick: () => naviguer("demandes") }),
    h("h1", { texte: "Nouvelle demande d'examens" }),
    h("div.carte", [h("div.carte__entete", [h("h3", { texte: "Patient" })]), zonePatient]),
    h("div.carte", [
      h("div.carte__entete", [h("h3", { texte: "Analyses demandées" }), compteur]),
      zoneTests,
    ]),
    h("div.carte", [h("div.carte__entete", [h("h3", { texte: "Contexte" })]), form]),
    bouton,
  ]);
}

/* ===================== Détail d'une demande ===================== */

async function detailDemande(id, { naviguer, rafraichir }) {
  const demande = await store.depots.demandes.obtenir(id);
  if (!demande) return etatVide({ icone: "🔍", titre: "Demande introuvable",
    action: { libelle: "Retour", action: () => naviguer("demandes") } });

  const [patient, resultats, tests, echantillons, utilisateurs, etablissements] = await Promise.all([
    store.depots.patients.obtenir(demande.patientId).catch(() => null),
    store.depots.resultats.parIndex("demandeId", id),
    store.lireTout("testsCatalogue"),
    store.depots.echantillons.parIndex("demandeId", id).catch(() => []),
    store.lireTout("utilisateurs"),
    store.lireTout("etablissements"),
  ]);
  const nomUtilisateur = uid => {
    const u = utilisateurs.find(x => x.id === uid);
    return u ? `${u.prenom} ${u.nom}` : "—";
  };
  const statut = STATUTS_DEMANDE[demande.statut] || {};

  /* --- Progression du cycle de vie (article 7.2) --- */
  const etapes = ["enregistree", "prelevee", "receptionnee", "en_analyse", "saisie", "validee", "rendue"];
  const indiceCourant = etapes.indexOf(demande.statut);
  const fil = h("div", {
    style: { display: "flex", gap: "4px", flexWrap: "wrap", margin: "12px 0" },
  }, etapes.map((e, i) => h("div", {
    style: {
      flex: "1 1 90px", padding: "7px 8px", borderRadius: "6px", textAlign: "center",
      fontSize: ".74rem", fontWeight: i === indiceCourant ? "700" : "500",
      background: i <= indiceCourant ? (STATUTS_DEMANDE[e].couleur + "22") : "var(--surface-3)",
      color: i <= indiceCourant ? STATUTS_DEMANDE[e].couleur : "var(--texte-3)",
      border: i === indiceCourant ? `2px solid ${STATUTS_DEMANDE[e].couleur}` : "2px solid transparent",
    },
    texte: STATUTS_DEMANDE[e].label,
  })));

  /* --- Actions disponibles selon le statut et les droits --- */
  const actions = h("div.page-entete__actions");
  for (const suivant of TRANSITIONS[demande.statut] || []) {
    if (suivant === "annulee") continue;
    const droit = DROIT_TRANSITION[suivant];
    const [ressource, action] = (droit || "").split(":");
    if (droit && !autorise(ressource, action)) continue;
    actions.appendChild(h("button.btn.btn--primaire", {
      texte: libelleTransition(suivant),
      onclick: () => executerTransition(demande, suivant, { resultats, tests, patient, rafraichir, naviguer }),
    }));
  }
  if (["validee", "rendue"].includes(demande.statut) && autorise("resultat", "export")) {
    actions.appendChild(h("button.btn", {
      texte: "📄 Compte rendu PDF",
      onclick: () => produireCompteRendu(demande, patient, resultats, tests, etablissements[0], utilisateurs),
    }));
  }
  if (TRANSITIONS[demande.statut]?.includes("annulee") && autorise("demande", "modification")) {
    actions.appendChild(h("button.btn.btn--danger", {
      texte: "Annuler la demande",
      onclick: async () => {
        const motif = await demanderMotif("Motif d'annulation");
        if (!motif) return;
        await store.depots.demandes.modifier(demande.id, { statut: "annulee", motifAnnulation: motif });
        await store.tracer("modification", "demande", demande.id, `Annulation : ${motif}`);
        succes("Demande annulée."); rafraichir();
      },
    }));
  }

  /* --- Tableau des résultats --- */
  const lignesResultats = resultats.map(r => {
    const test = tests.find(t => t.code === r.testCode);
    return { r, test, interpretation: interpreterResultat(r.valeur, test) };
  });

  const tableauResultats = tableau([
    { cle: "analyse", titre: "Analyse", valeur: x => x.test?.nom || x.r.testCode },
    { cle: "valeur", titre: "Résultat", aligne: "droite",
      rendu: x => x.r.valeur === null && !x.r.valeurTexte
        ? h("span.texte-secondaire", { texte: "en attente" })
        : h("span", {
            class: x.interpretation.critique ? "valeur-critique"
              : x.interpretation.horsNorme ? "valeur-anormale" : "valeur-normale",
            texte: `${x.r.valeurTexte ?? fmt.nombre(x.r.valeur)} ${x.interpretation.symbole || ""}`,
          }) },
    { cle: "unite", titre: "Unité", valeur: x => x.test?.unite || "—" },
    { cle: "reference", titre: "Références", aligne: "centre",
      valeur: x => (Number.isFinite(Number(x.test?.valeurRefMin)) && Number.isFinite(Number(x.test?.valeurRefMax)))
        ? `${fmt.nombre(x.test.valeurRefMin)} – ${fmt.nombre(x.test.valeurRefMax)}` : "—" },
    { cle: "statut", titre: "Statut", rendu: x => badge(
      STATUTS_RESULTAT[x.r.statut]?.label || x.r.statut, STATUTS_RESULTAT[x.r.statut]?.couleur) },
    { cle: "signature", titre: "Signature", rendu: x => x.r.signature
      ? h("span", { style: { color: "var(--succes)" }, texte: "✓ signé" })
      : h("span.texte-secondaire", { texte: "—" }) },
  ], lignesResultats, {
    parPage: 30, compact: true,
    surLigne: x => (autorise("resultat", "creation") && !["valide", "rendu"].includes(x.r.statut))
      || autorise("resultat", "modification")
      ? saisirResultat(x.r, x.test, { resultats, rafraichir })
      : detailResultat(x.r, x.test, nomUtilisateur),
    vide: "Aucun résultat rattaché.",
  });

  const critiques = lignesResultats.filter(x => x.interpretation.critique);

  return h("div", [
    h("button.btn.btn--fin", { texte: "‹ Retour aux demandes", onclick: () => naviguer("demandes") }),
    h("div.page-entete", [
      h("div.page-entete__titre", [
        h("h1", { texte: `Demande ${demande.numero}` }),
        h("p.texte-secondaire", [
          patient
            ? h("a", { href: `#/patients/${patient.id}`,
                texte: `${(patient.nom || "").toUpperCase()} ${patient.prenom} — ${patient.ipp}`,
                onclick: e => { e.preventDefault(); naviguer(`patients/${patient.id}`); } })
            : "Patient inconnu",
          ` — prescrite ${fmt.relatif(demande.date)} par ${demande.prescripteurNom || nomUtilisateur(demande.prescripteurId)}`,
        ]),
      ]),
      actions,
    ]),
    fil,
    critiques.length ? h("div.carte", {
      style: { borderLeft: "4px solid var(--critique)", background: "rgba(220,38,38,.06)" },
    }, [
      h("strong", { texte: `🚨 ${critiques.length} valeur(s) critique(s)` }),
      h("ul", critiques.map(x => h("li", {
        texte: `${x.test?.nom || x.r.testCode} : ${x.r.valeurTexte ?? x.r.valeur} ${x.test?.unite || ""} — ${x.interpretation.message}`,
      }))),
      autorise("resultat", "modification") && critiques.some(x => !x.r.alerteAcquittee)
        ? h("button.btn.btn--danger", {
            texte: "Acquitter : prescripteur alerté",
            onclick: async () => {
              for (const x of critiques) {
                await store.depots.resultats.modifier(x.r.id, {
                  alerteAcquittee: true, dateAcquittement: new Date().toISOString(),
                  acquittePar: utilisateurCourant().id,
                });
              }
              await store.tracer("alerte_critique", "demande", demande.id,
                `Alerte acquittée pour ${critiques.length} valeur(s) critique(s)`);
              succes("Alerte acquittée et tracée."); rafraichir();
            },
          })
        : null,
    ]) : null,
    demande.commentaire ? h("div.carte", [
      h("div.champ-libelle", { texte: "Renseignements cliniques" }),
      h("p", { style: { margin: 0 }, texte: demande.commentaire }),
    ]) : null,
    h("div.carte", [
      h("div.carte__entete", [h("h3", { texte: "Résultats" })]),
      tableauResultats,
    ]),
    echantillons.length ? h("div.carte", [
      h("div.carte__entete", [h("h3", { texte: "Échantillons" })]),
      tableau([
        { cle: "codeBarre", titre: "Code-barres", rendu: e => h("code.texte-mono", { texte: e.codeBarre }) },
        { cle: "type", titre: "Type", valeur: e => TYPES_ECHANTILLON.find(t => t.code === e.type)?.label || e.type },
        { cle: "prelevement", titre: "Prélevé", valeur: e => fmt.date(e.datePrelevement, { heure: true }) },
        { cle: "reception", titre: "Réceptionné", valeur: e => e.dateReception ? fmt.date(e.dateReception, { heure: true }) : "—" },
        { cle: "conformite", titre: "Conformité", rendu: e => e.conformite === "conforme"
          ? badge("Conforme", COULEURS.normal)
          : badge(e.motifNonConformite || "Non conforme", COULEURS.critique) },
      ], echantillons, { compact: true, parPage: 10 }),
    ]) : null,
  ]);
}

function libelleTransition(statut) {
  return {
    prelevee: "🩸 Enregistrer le prélèvement",
    receptionnee: "📥 Réceptionner au laboratoire",
    en_analyse: "🔬 Démarrer l'analyse",
    saisie: "✍️ Saisir les résultats",
    validee: "✅ Valider et signer",
    rendue: "📤 Rendre au dossier patient",
  }[statut] || statut;
}

/* ===================== Transitions du cycle de vie ===================== */

async function executerTransition(demande, vers, { resultats, tests, patient, rafraichir, naviguer }) {
  // La transition est vérifiée côté modèle avant toute écriture : aucune
  // séquence non prévue par le cahier des charges ne peut être enregistrée.
  if (!transitionAutorisee(demande.statut, vers)) {
    return erreur(`Transition impossible de « ${STATUTS_DEMANDE[demande.statut]?.label} » vers « ${STATUTS_DEMANDE[vers]?.label} ».`);
  }

  if (vers === "prelevee") {
    const form = formulaire([
      { cle: "type", libelle: "Type d'échantillon", type: "select", obligatoire: true, vide: false,
        options: TYPES_ECHANTILLON.map(t => ({ valeur: t.code, libelle: t.label })) },
      { cle: "volume", libelle: "Volume (mL)", type: "number", pas: "0.1" },
      { cle: "conservation", libelle: "Conservation", type: "select", vide: false,
        options: ["Température ambiante", "Réfrigéré (4 °C)", "Congelé (−20 °C)"] },
    ]);
    const ok = await modale({
      titre: "Enregistrer le prélèvement", contenu: form, largeur: "480px",
      actions: [{ libelle: "Annuler", type: "neutre", valeur: null },
        { libelle: "Enregistrer", type: "primaire", valeur: true }],
    });
    if (!ok) return;
    const v = form.valeurs();
    const sequence = await store.prochaineSequence("echantillon");
    const echantillon = await store.depots.echantillons.creer({
      codeBarre: genererCodeBarre(sequence),
      demandeId: demande.id, patientId: demande.patientId,
      type: v.type, volume: v.volume, conservation: v.conservation,
      datePrelevement: new Date().toISOString(),
      preleveurId: utilisateurCourant().id,
      statut: "preleve", conformite: "conforme",
    });
    await store.depots.demandes.modifier(demande.id, {
      statut: vers, datePrelevement: echantillon.datePrelevement,
    });
    succes(`Échantillon ${echantillon.codeBarre} enregistré.`);
    return rafraichir();
  }

  if (vers === "receptionnee") {
    const form = formulaire([
      { cle: "conforme", libelle: "Échantillon conforme", type: "checkbox", defaut: true },
      { cle: "motif", libelle: "Motif de non-conformité", type: "select", vide: "— Aucun —",
        options: ["Tube hémolysé", "Volume insuffisant", "Identification incomplète",
          "Tube inadapté", "Délai d'acheminement dépassé", "Échantillon coagulé"] },
    ]);
    const ok = await modale({
      titre: "Réception au laboratoire", contenu: form, largeur: "480px",
      actions: [{ libelle: "Annuler", type: "neutre", valeur: null },
        { libelle: "Réceptionner", type: "primaire", valeur: true }],
    });
    if (!ok) return;
    const v = form.valeurs();
    const echantillons = await store.depots.echantillons.parIndex("demandeId", demande.id);
    for (const e of echantillons) {
      await store.depots.echantillons.modifier(e.id, {
        dateReception: new Date().toISOString(),
        receptionnisteId: utilisateurCourant().id,
        statut: "receptionne",
        conformite: v.conforme && !v.motif ? "conforme" : "non_conforme",
        motifNonConformite: v.conforme && !v.motif ? "" : v.motif,
      });
    }
    if (!v.conforme || v.motif) {
      alerte("Échantillon non conforme : le prescripteur doit être informé avant analyse.", { duree: 9000 });
    }
    await store.depots.demandes.modifier(demande.id, { statut: vers });
    return rafraichir();
  }

  if (vers === "validee") return validerDemande(demande, resultats, tests, rafraichir);

  if (vers === "rendue") {
    await store.depots.demandes.modifier(demande.id, { statut: vers, dateRendu: new Date().toISOString() });
    for (const r of resultats.filter(x => x.statut === "valide")) {
      await store.depots.resultats.modifier(r.id, { statut: "rendu" });
    }
    // Notification au prescripteur (article 13)
    if (demande.prescripteurId) {
      await store.depots.notifications.creer({
        destinataireType: "utilisateur", destinataireId: demande.prescripteurId,
        canal: "in_app", sujet: `Résultats disponibles — ${demande.numero}`,
        message: "Les résultats de votre demande d'examens sont disponibles au dossier du patient.",
        priorite: resultats.some(r => r.critique) ? "critique" : "normale",
        entite: "demande", entiteId: demande.id,
        date: new Date().toISOString(), lue: false, envoyee: true,
      }).catch(() => { /* le rôle courant ne peut pas créer de notification */ });
    }
    succes("Résultats rendus au dossier patient.");
    return rafraichir();
  }

  // Transitions simples : en_analyse, saisie
  await store.depots.demandes.modifier(demande.id, { statut: vers });
  if (vers === "saisie" || vers === "en_analyse") {
    return window.medistatNaviguer?.("paillasse");
  }
  rafraichir();
}

/* ===================== Saisie d'un résultat ===================== */

async function saisirResultat(resultat, test, { rafraichir }) {
  // Antériorité : le delta-check compare au dosage précédent et signale
  // une variation invraisemblable avant que le résultat ne soit validé.
  const anterieurs = (await store.depots.resultats.parIndex("patientId", resultat.patientId))
    .filter(r => r.testCode === resultat.testCode && r.id !== resultat.id && r.valeur !== null)
    .sort((a, b) => new Date(b.dateValidation || b.dateSaisie) - new Date(a.dateValidation || a.dateSaisie));
  const anterieur = anterieurs[0];

  const qualitatif = test?.type === "qualitatif";
  const champValeur = qualitatif
    ? h("input.champ", { value: resultat.valeurTexte || "", placeholder: "Positif, Négatif, ou texte libre" })
    : h("input.champ", { type: "text", inputmode: "decimal",
        value: resultat.valeur ?? "", placeholder: "Valeur numérique" });
  const commentaire = h("textarea.champ", { rows: 2, placeholder: "Commentaire du biologiste (facultatif)" });
  commentaire.value = resultat.commentaireBiologiste || "";

  const apercu = h("div");
  const evaluer = () => {
    const brut = qualitatif ? champValeur.value : champValeur.value;
    const i = qualitatif
      ? { statut: "non_evaluable", label: "Qualitatif", couleur: COULEURS.neutre, horsNorme: false, critique: false }
      : interpreterResultat(brut, test);
    const delta = (!qualitatif && anterieur) ? calculerDelta(Number(String(brut).replace(",", ".")), anterieur.valeur) : null;
    remplacer(apercu, h("div", [
      h("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "8px" } }, [
        badge(i.label, i.couleur),
        i.critique ? badge("⚠ Alerte immédiate requise", COULEURS.critique) : null,
      ]),
      i.message ? h("p.texte-secondaire", { style: { marginTop: "6px" }, texte: i.message }) : null,
      delta ? h("div", {
        class: delta.aVerifier ? "avertissement" : "interpretation",
        style: { marginTop: "8px" },
        texte: `Antériorité du ${fmt.date(anterieur.dateValidation || anterieur.dateSaisie)} : ` +
          `${fmt.nombre(anterieur.valeur)} ${test?.unite || ""} — variation de ${fmt.nombre(delta.pourcentage, 1)} % ` +
          `(${delta.sens})${delta.aVerifier ? ". Écart important : vérifiez la saisie et l'identité de l'échantillon avant validation." : "."}`,
      }) : null,
    ]));
  };
  champValeur.addEventListener("input", evaluer);
  evaluer();

  const enregistre = await modale({
    titre: `Saisie — ${test?.nom || resultat.testCode}`,
    largeur: "540px",
    contenu: h("div.formulaire", [
      (Number.isFinite(Number(test?.valeurRefMin)) && Number.isFinite(Number(test?.valeurRefMax)))
        ? h("p.texte-secondaire", {
            texte: `Valeurs de référence : ${fmt.nombre(test.valeurRefMin)} – ${fmt.nombre(test.valeurRefMax)} ${test.unite || ""}`,
          })
        : null,
      h("div.champ-groupe", [
        h("label.champ-libelle", { texte: `Résultat ${test?.unite ? "(" + test.unite + ")" : ""}` }),
        champValeur,
      ]),
      apercu,
      h("div.champ-groupe", [h("label.champ-libelle", { texte: "Commentaire" }), commentaire]),
    ]),
    actions: [
      { libelle: "Annuler", type: "neutre", valeur: null },
      { libelle: "Enregistrer", type: "primaire", action: async () => {
        const brut = champValeur.value.trim();
        if (!brut) { erreur("Saisissez un résultat."); return false; }
        const erreurs = VALIDATEURS.resultat(
          { testCode: resultat.testCode, valeur: brut }, test);
        if (erreurs.length) { erreur(erreurs.join(" ")); return false; }
        const valeur = qualitatif ? null : Number(brut.replace(",", "."));
        const i = interpreterResultat(valeur, test);
        try {
          await store.depots.resultats.modifier(resultat.id, {
            valeur, valeurTexte: qualitatif ? brut : null,
            unite: test?.unite || "",
            horsNorme: i.horsNorme, critique: i.critique,
            commentaireBiologiste: commentaire.value.trim(),
            saisiPar: utilisateurCourant().id,
            dateSaisie: new Date().toISOString(),
            statut: "saisi",
            anterieur: anterieur ? anterieur.valeur : null,
          });
          return { critique: i.critique };
        } catch (e) { erreur(e.message); return false; }
      } },
    ],
  });

  if (enregistre) {
    if (enregistre.critique) {
      critique("Valeur critique enregistrée : le prescripteur doit être alerté sans délai.");
    } else succes("Résultat enregistré.");
    rafraichir();
  }
}

function detailResultat(resultat, test, nomUtilisateur) {
  const i = interpreterResultat(resultat.valeur, test);
  return modale({
    titre: test?.nom || resultat.testCode,
    largeur: "500px",
    contenu: h("div", [
      h("div.resultat-test__stat", [
        h("div.stat-bloc", [
          h("span.stat-bloc__libelle", { texte: "Résultat" }),
          h("span.stat-bloc__valeur", { texte: `${resultat.valeurTexte ?? fmt.nombre(resultat.valeur)} ${test?.unite || ""}` }),
        ]),
        h("div.stat-bloc", [
          h("span.stat-bloc__libelle", { texte: "Interprétation" }),
          h("span.stat-bloc__valeur", { style: { color: i.couleur }, texte: i.label }),
        ]),
      ]),
      h("div.texte-secondaire", [
        h("div", { texte: `Saisi par ${nomUtilisateur(resultat.saisiPar)} le ${fmt.date(resultat.dateSaisie, { heure: true })}` }),
        resultat.validePar
          ? h("div", { texte: `Validé par ${nomUtilisateur(resultat.validePar)} le ${fmt.date(resultat.dateValidation, { heure: true })}` })
          : null,
        resultat.version > 1 ? h("div", { texte: `Version ${resultat.version} — résultat corrigé` }) : null,
      ]),
      resultat.commentaireBiologiste
        ? h("div.interpretation", { style: { marginTop: "10px" }, texte: resultat.commentaireBiologiste })
        : null,
      resultat.signature ? h("div", { style: { marginTop: "12px" } }, [
        h("div.champ-libelle", { texte: "Signature électronique" }),
        h("div.texte-secondaire", {
          texte: `${resultat.signature.signataireNom} — ${fmt.date(resultat.signature.date, { heure: true })}`,
        }),
        h("code.texte-mono", { style: { fontSize: ".68rem", wordBreak: "break-all" },
          texte: resultat.signature.empreinteContenu }),
      ]) : null,
    ]),
    actions: [{ libelle: "Fermer", type: "neutre" }],
  });
}

/* ===================== Validation et signature (article 6.3) ===================== */

async function validerDemande(demande, resultats, tests, rafraichir) {
  const aValider = resultats.filter(r => r.statut === "saisi");
  if (!aValider.length) return alerte("Aucun résultat saisi n'est en attente de validation.");

  const recapitulatif = aValider.map(r => {
    const test = tests.find(t => t.code === r.testCode);
    const i = interpreterResultat(r.valeur, test);
    return h("tr", [
      h("td", { texte: test?.nom || r.testCode }),
      h("td", { style: { textAlign: "right", fontWeight: "600", color: i.couleur },
        texte: `${r.valeurTexte ?? fmt.nombre(r.valeur)} ${test?.unite || ""} ${i.symbole || ""}` }),
      h("td", { texte: i.label }),
    ]);
  });
  const critiques = aValider.filter(r => r.critique);

  const motDePasse = await modale({
    titre: "Valider et signer les résultats",
    largeur: "620px",
    contenu: h("div", [
      h("p", {
        texte: "La validation engage votre responsabilité de biologiste. Les résultats seront " +
          "signés électroniquement : toute modification ultérieure invalidera la signature.",
      }),
      critiques.length ? h("div.avertissement", {
        texte: `${critiques.length} valeur(s) critique(s) : assurez-vous que le prescripteur a été alerté.`,
      }) : null,
      h("div.tableau-defilement", { style: { margin: "12px 0" } }, [
        h("table.tableau.tableau--compact", [
          h("thead", [h("tr", [h("th", "Analyse"), h("th", { style: { textAlign: "right" } }, "Résultat"), h("th", "Statut")])]),
          h("tbody", recapitulatif),
        ]),
      ]),
      h("div.champ-groupe", [
        h("label.champ-libelle", { texte: "Confirmez votre identité (mot de passe)" }),
        h("input.champ#champSignature", { type: "password", autocomplete: "current-password" }),
      ]),
    ]),
    actions: [
      { libelle: "Annuler", type: "neutre", valeur: null },
      { libelle: `Valider et signer ${aValider.length} résultat(s)`, type: "succes",
        action: () => document.querySelector("#champSignature")?.value || false },
    ],
  });
  if (!motDePasse) return;

  const utilisateur = utilisateurCourant();
  let signes = 0;
  for (const r of aValider) {
    const signature = await signerResultat(r, utilisateur, motDePasse);
    await store.depots.resultats.modifier(r.id, {
      statut: "valide", validePar: utilisateur.id,
      dateValidation: new Date().toISOString(), signature,
    });
    await store.tracer("signature", "resultat", r.id,
      `Signature électronique du résultat ${r.testCode}`);
    signes++;
  }
  await store.depots.demandes.modifier(demande.id, { statut: "validee" });
  succes(`${signes} résultat(s) validés et signés.`);
  rafraichir();
}

/* ===================== Paillasse ===================== */

async function paillasse({ naviguer, rafraichir }) {
  const [resultats, demandes, patients, tests] = await Promise.all([
    store.depots.resultats.lister({ filtre: r => r.statut === "en_attente" || r.statut === "saisi" }),
    store.lireTout("demandes"), store.lireTout("patients"), store.lireTout("testsCatalogue"),
  ]);

  const lignes = resultats.map(r => {
    const demande = demandes.find(d => d.id === r.demandeId);
    const patient = patients.find(p => p.id === r.patientId);
    const test = tests.find(t => t.code === r.testCode);
    return { r, demande, patient, test };
  }).filter(x => x.demande && !["annulee"].includes(x.demande.statut))
    .sort((a, b) => {
      // Les urgences vitales d'abord, puis par ancienneté : c'est l'ordre
      // dans lequel un technicien doit traiter sa paillasse.
      const rang = u => (u === "vital" ? 0 : u === "urgent" ? 1 : 2);
      const diff = rang(a.demande.urgence) - rang(b.demande.urgence);
      return diff || new Date(a.demande.date) - new Date(b.demande.date);
    });

  return h("div", [
    h("div.page-entete", [
      h("div.page-entete__titre", [
        h("h1", { texte: "Paillasse" }),
        h("p.texte-secondaire", {
          texte: `${lignes.filter(x => x.r.statut === "en_attente").length} analyse(s) à saisir, ` +
            `${lignes.filter(x => x.r.statut === "saisi").length} en attente de validation.`,
        }),
      ]),
    ]),
    h("p.texte-secondaire", {
      texte: "Les analyses sont classées par degré d'urgence puis par ancienneté. " +
        "Cliquez sur une ligne pour saisir le résultat.",
    }),
    tableau([
      { cle: "urgence", titre: "", aligne: "centre",
        rendu: x => {
          const n = NIVEAUX_URGENCE.find(u => u.code === x.demande.urgence) || NIVEAUX_URGENCE[0];
          return badge(n.code === "vital" ? "🔴" : n.code === "urgent" ? "🟠" : "🟢", n.couleur);
        },
        triSur: x => x.demande.urgence === "vital" ? 0 : x.demande.urgence === "urgent" ? 1 : 2 },
      { cle: "numero", titre: "Demande", valeur: x => x.demande.numero },
      { cle: "patient", titre: "Patient",
        valeur: x => x.patient ? `${(x.patient.nom || "").toUpperCase()} ${x.patient.prenom}` : "—" },
      { cle: "analyse", titre: "Analyse", valeur: x => x.test?.nom || x.r.testCode },
      { cle: "attente", titre: "Attente", aligne: "droite",
        valeur: x => fmt.duree(delaiHeures(x.demande.date)),
        triSur: x => delaiHeures(x.demande.date) || 0 },
      { cle: "statut", titre: "Statut", rendu: x => badge(
        STATUTS_RESULTAT[x.r.statut]?.label || x.r.statut, STATUTS_RESULTAT[x.r.statut]?.couleur) },
    ], lignes, {
      parPage: 30,
      surLigne: x => saisirResultat(x.r, x.test, { rafraichir }),
      vide: "Aucune analyse en attente. La paillasse est à jour.",
    }),
  ]);
}

/* ===================== File de validation ===================== */

async function fileValidation({ naviguer, rafraichir }) {
  const [resultats, demandes, patients, tests] = await Promise.all([
    store.depots.resultats.lister({ filtre: r => r.statut === "saisi" }),
    store.lireTout("demandes"), store.lireTout("patients"), store.lireTout("testsCatalogue"),
  ]);

  const parDemande = new Map();
  for (const r of resultats) {
    if (!parDemande.has(r.demandeId)) parDemande.set(r.demandeId, []);
    parDemande.get(r.demandeId).push(r);
  }

  const lignes = [...parDemande.entries()].map(([demandeId, liste]) => {
    const demande = demandes.find(d => d.id === demandeId);
    const patient = patients.find(p => p.id === demande?.patientId);
    return {
      demande, patient, resultats: liste,
      anomalies: liste.filter(r => r.horsNorme).length,
      critiques: liste.filter(r => r.critique).length,
    };
  }).filter(x => x.demande).sort((a, b) => b.critiques - a.critiques ||
    new Date(a.demande.date) - new Date(b.demande.date));

  if (!lignes.length) {
    return h("div", [
      h("h1", { texte: "Validation des résultats" }),
      etatVide({ icone: "✅", titre: "Aucun résultat en attente",
        message: "Tous les résultats saisis ont été validés." }),
    ]);
  }

  return h("div", [
    h("div.page-entete", [
      h("div.page-entete__titre", [
        h("h1", { texte: "Validation des résultats" }),
        h("p.texte-secondaire", {
          texte: `${resultats.length} résultat(s) répartis sur ${lignes.length} demande(s).`,
        }),
      ]),
    ]),
    tableau([
      { cle: "numero", titre: "Demande", valeur: x => x.demande.numero },
      { cle: "patient", titre: "Patient",
        valeur: x => x.patient ? `${(x.patient.nom || "").toUpperCase()} ${x.patient.prenom}` : "—" },
      { cle: "nombre", titre: "Résultats", aligne: "centre", valeur: x => x.resultats.length },
      { cle: "anomalies", titre: "Anomalies", aligne: "centre",
        rendu: x => x.anomalies ? badge(String(x.anomalies), COULEURS.bas) : "—" },
      { cle: "critiques", titre: "Critiques", aligne: "centre",
        rendu: x => x.critiques ? badge(String(x.critiques), COULEURS.critique) : "—" },
      { cle: "attente", titre: "Attente", aligne: "droite",
        valeur: x => fmt.duree(delaiHeures(x.demande.date)),
        triSur: x => delaiHeures(x.demande.date) || 0 },
      { cle: "action", titre: "", triable: false,
        rendu: x => h("button.btn.btn--petit.btn--succes", {
          texte: "Valider",
          onclick: e => {
            e.stopPropagation();
            validerDemande(x.demande, x.resultats, tests, rafraichir);
          },
        }) },
    ], lignes, {
      parPage: 25,
      surLigne: x => naviguer(`demandes/${x.demande.id}`),
    }),
  ]);
}

/* ===================== Compte rendu ===================== */

async function produireCompteRendu(demande, patient, resultats, tests, etablissement, utilisateurs) {
  try {
    const rendus = resultats.filter(r => ["valide", "rendu"].includes(r.statut));
    if (!rendus.length) return alerte("Aucun résultat validé à imprimer.");
    const signature = rendus.find(r => r.signature)?.signature || null;

    // Contrôle d'intégrité avant impression : un résultat modifié après
    // signature ne doit pas être diffusé comme s'il était validé.
    for (const r of rendus.filter(x => x.signature)) {
      const v = await verifierSignature(r);
      if (!v.valide) {
        return erreur(`Impression bloquée : la signature du résultat ${r.testCode} est invalide. ${v.motif}`);
      }
    }

    const { blob, critiques } = compteRenduLaboratoire({
      etablissement, patient, demande, resultats: rendus, tests, signature,
    });
    telecharger(blob, `compte-rendu-${demande.numero}.pdf`);
    await store.tracer("impression", "demande", demande.id,
      `Compte rendu imprimé (${rendus.length} résultats, ${critiques} critique(s))`);
    succes("Compte rendu produit.");
  } catch (e) { erreur("Production impossible : " + e.message); }
}

async function demanderMotif(titre) {
  const champ = h("textarea.champ", { rows: 3, placeholder: "Motif (obligatoire)" });
  return modale({
    titre, largeur: "440px",
    contenu: h("div.formulaire", [champ]),
    actions: [
      { libelle: "Annuler", type: "neutre", valeur: null },
      { libelle: "Confirmer", type: "danger", action: () => champ.value.trim() || false },
    ],
  });
}
