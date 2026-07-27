// medistat/js/modules/consultations.js
// Consultations (article 6.2) et rendez-vous : ouverture d'un épisode de soins,
// saisie des constantes, des symptômes et du diagnostic, prescription
// d'examens et lien vers le laboratoire.

import { h, fmt, tableau, badge, modale, confirmer, erreur, succes, etatVide,
  formulaire, carteStat, remplacer } from "../core/ui.js";
import * as store from "../core/store.js";
import { autorise, utilisateurCourant } from "../core/auth.js";
import { calculerAge } from "../core/model.js";
import { COULEURS } from "../core/charts.js";

/* ===================== Consultations ===================== */

export async function vue_consultations({ naviguer, rafraichir }) {
  const [consultations, patients, utilisateurs] = await Promise.all([
    store.depots.consultations.lister({ tri: (a, b) => (a.date < b.date ? 1 : -1) }),
    store.lireTout("patients"),
    store.lireTout("utilisateurs"),
  ]);
  const nomPatient = id => {
    const p = patients.find(x => x.id === id);
    return p ? `${(p.nom || "").toUpperCase()} ${p.prenom || ""}` : "—";
  };
  const nomPraticien = id => {
    const u = utilisateurs.find(x => x.id === id);
    return u ? `${u.prenom} ${u.nom}` : "—";
  };

  const aujourdhui = consultations.filter(c =>
    new Date(c.date).toDateString() === new Date().toDateString()).length;

  return h("div", [
    h("div.page-entete", [
      h("div.page-entete__titre", [
        h("h1", { texte: "Consultations" }),
        h("p.texte-secondaire", {
          texte: `${fmt.nombre(consultations.length)} consultation(s) enregistrée(s), ` +
            `dont ${fmt.nombre(aujourdhui)} aujourd'hui.`,
        }),
      ]),
      h("div.page-entete__actions", [
        autorise("consultation", "creation")
          ? h("button.btn.btn--primaire", { texte: "＋ Nouvelle consultation",
              onclick: () => formulaireConsultation(null, patients, rafraichir, naviguer) })
          : null,
      ]),
    ]),

    tableau([
      { cle: "date", titre: "Date", valeur: c => fmt.date(c.date, { heure: true }),
        triSur: c => new Date(c.date).getTime() },
      { cle: "patient", titre: "Patient", valeur: c => nomPatient(c.patientId) },
      { cle: "service", titre: "Service", valeur: c => c.service || "—" },
      { cle: "praticien", titre: "Praticien", valeur: c => nomPraticien(c.medecinId) },
      { cle: "motif", titre: "Motif", valeur: c => c.motif || "—" },
      { cle: "diagnostic", titre: "Diagnostic",
        rendu: c => c.diagnostic
          ? h("div", [h("div", { texte: c.diagnostic }),
              c.cim10 ? h("span.texte-secondaire", { texte: "CIM-10 " + c.cim10 }) : null])
          : h("span.texte-secondaire", { texte: "—" }) },
    ], consultations, {
      parPage: 25,
      surLigne: c => naviguer(`patients/${c.patientId}`),
      triInitial: { colonne: "date", sens: "desc" },
      vide: "Aucune consultation enregistrée.",
    }),
  ]);
}

async function formulaireConsultation(consultation, patients, apres, naviguer) {
  const actifs = patients.filter(p => !p._supprime && !p.archive);
  if (!actifs.length) {
    return erreur("Créez d'abord un dossier patient.");
  }

  const form = formulaire([
    { cle: "patientId", libelle: "Patient", type: "select", obligatoire: true, vide: "— Choisir —",
      pleineLargeur: true,
      options: actifs.slice(0, 500).map(p => ({
        valeur: p.id,
        libelle: `${(p.nom || "").toUpperCase()} ${p.prenom} — ${p.ipp} (${calculerAge(p.dateNaissance)?.label || ""})`,
      })) },
    { cle: "service", libelle: "Service", type: "select", vide: "— Choisir —",
      options: ["Médecine interne", "Pédiatrie", "Gynécologie", "Chirurgie", "Urgences",
        "Cardiologie", "Consultation externe", "Autre"] },
    { cle: "motif", libelle: "Motif de consultation", pleineLargeur: true },
    { type: "separateur", libelle: "Constantes" },
    { cle: "temperature", libelle: "Température (°C)", type: "number", pas: "0.1", min: 30, max: 45 },
    { cle: "tensionSystolique", libelle: "Tension systolique (mmHg)", type: "number", min: 40, max: 300 },
    { cle: "tensionDiastolique", libelle: "Tension diastolique (mmHg)", type: "number", min: 20, max: 200 },
    { cle: "pouls", libelle: "Pouls (/min)", type: "number", min: 20, max: 250 },
    { cle: "poids", libelle: "Poids (kg)", type: "number", pas: "0.1", min: 0, max: 400 },
    { cle: "taille", libelle: "Taille (cm)", type: "number", min: 20, max: 250 },
    { cle: "saturation", libelle: "Saturation en oxygène (%)", type: "number", min: 50, max: 100 },
    { type: "separateur", libelle: "Examen" },
    { cle: "symptomes", libelle: "Symptômes rapportés", type: "textarea", pleineLargeur: true, lignes: 3 },
    { cle: "examenClinique", libelle: "Examen clinique", type: "textarea", pleineLargeur: true, lignes: 3 },
    { cle: "diagnostic", libelle: "Diagnostic retenu", pleineLargeur: true },
    { cle: "cim10", libelle: "Code CIM-10", placeholder: "B54" },
    { cle: "conduite", libelle: "Conduite à tenir", type: "textarea", pleineLargeur: true, lignes: 2 },
  ], consultation || {});
  form.classList.add("formulaire--grille");

  // Alerte sur constantes anormales : c'est le rôle premier d'un logiciel
  // clinique que de signaler ce qui sort des limites physiologiques.
  const alerteConstantes = h("div");
  const verifier = () => {
    const v = form.valeurs();
    const messages = [];
    if (v.temperature >= 39) messages.push(`Fièvre élevée (${v.temperature} °C).`);
    if (v.temperature && v.temperature <= 35) messages.push(`Hypothermie (${v.temperature} °C).`);
    if (v.tensionSystolique >= 180 || v.tensionDiastolique >= 110) {
      messages.push(`Tension artérielle très élevée (${v.tensionSystolique}/${v.tensionDiastolique} mmHg).`);
    }
    if (v.tensionSystolique && v.tensionSystolique <= 90) {
      messages.push(`Hypotension (${v.tensionSystolique} mmHg systolique).`);
    }
    if (v.pouls >= 120) messages.push(`Tachycardie (${v.pouls} /min).`);
    if (v.pouls && v.pouls <= 45) messages.push(`Bradycardie (${v.pouls} /min).`);
    if (v.saturation && v.saturation < 92) messages.push(`Désaturation (${v.saturation} %).`);
    remplacer(alerteConstantes, messages.length
      ? h("div.avertissement", [
          h("strong", { texte: "⚠ Constantes anormales : " }),
          h("ul", { style: { margin: "5px 0 0", paddingLeft: "18px" } },
            messages.map(m => h("li", { texte: m }))),
        ])
      : null);
  };
  for (const cle of ["temperature", "tensionSystolique", "tensionDiastolique", "pouls", "saturation"]) {
    form.controles[cle]?.addEventListener("input", verifier);
  }

  const resultat = await modale({
    titre: consultation ? "Modifier la consultation" : "Nouvelle consultation",
    contenu: h("div", [form, alerteConstantes]),
    largeur: "820px",
    actions: [
      { libelle: "Annuler", type: "neutre", valeur: null },
      { libelle: "Enregistrer", type: "primaire", action: async () => {
        const v = form.valeurs();
        if (!v.patientId) { erreur("Sélectionnez un patient."); return false; }
        const donnees = {
          patientId: v.patientId,
          date: consultation?.date || new Date().toISOString(),
          medecinId: utilisateurCourant().id,
          service: v.service, motif: v.motif,
          symptomes: v.symptomes, examenClinique: v.examenClinique,
          diagnostic: v.diagnostic, cim10: v.cim10, conduite: v.conduite,
          constantes: {
            temperature: v.temperature, tensionSystolique: v.tensionSystolique,
            tensionDiastolique: v.tensionDiastolique, pouls: v.pouls,
            poids: v.poids, taille: v.taille, saturation: v.saturation,
          },
          statut: "cloturee",
        };
        try {
          return consultation
            ? await store.depots.consultations.modifier(consultation.id, donnees)
            : await store.depots.consultations.creer(donnees);
        } catch (e) { erreur(e.message); return false; }
      } },
    ],
  });

  if (resultat) {
    succes("Consultation enregistrée.");
    apres?.();
    // Enchaînement naturel : prescrire des examens dans la foulée
    if (!consultation && autorise("demande", "creation")) {
      const prescrire = await confirmer("Souhaitez-vous prescrire des examens de laboratoire ?",
        { titre: "Prescription" });
      if (prescrire) naviguer(`demandes/nouvelle/${resultat.patientId}`);
    }
  }
}

/* ===================== Rendez-vous ===================== */

export async function vue_rendez_vous({ naviguer, rafraichir }) {
  const [rdv, patients, utilisateurs] = await Promise.all([
    store.depots.rendezVous.lister({ tri: (a, b) => (a.date > b.date ? 1 : -1) }).catch(() => []),
    store.lireTout("patients"),
    store.lireTout("utilisateurs"),
  ]);
  const nomPatient = id => {
    const p = patients.find(x => x.id === id);
    return p ? `${(p.nom || "").toUpperCase()} ${p.prenom || ""}` : "—";
  };

  const maintenant = Date.now();
  const aVenir = rdv.filter(r => new Date(r.date).getTime() >= maintenant - 86400000
    && r.statut !== "annule");
  const passes = rdv.filter(r => new Date(r.date).getTime() < maintenant - 86400000
    || r.statut === "annule");

  const colonnes = [
    { cle: "date", titre: "Date et heure",
      valeur: r => `${fmt.date(r.date)}${r.heure ? " à " + r.heure : ""}`,
      triSur: r => new Date(r.date).getTime() },
    { cle: "patient", titre: "Patient", valeur: r => nomPatient(r.patientId) },
    { cle: "type", titre: "Type", rendu: r => badge(r.type || "consultation") },
    { cle: "service", titre: "Service", valeur: r => r.service || "—" },
    { cle: "motif", titre: "Motif", valeur: r => r.motif || "—" },
    { cle: "statut", titre: "Statut", rendu: r => badge(
      { prevu: "Prévu", honore: "Honoré", absent: "Absent", annule: "Annulé" }[r.statut] || "Prévu",
      r.statut === "honore" ? COULEURS.normal : r.statut === "absent" || r.statut === "annule"
        ? COULEURS.critique : COULEURS.accent) },
  ];

  return h("div", [
    h("div.page-entete", [
      h("div.page-entete__titre", [
        h("h1", { texte: "Rendez-vous" }),
        h("p.texte-secondaire", {
          texte: `${fmt.nombre(aVenir.length)} rendez-vous à venir.`,
        }),
      ]),
      h("div.page-entete__actions", [
        autorise("rendezVous", "creation")
          ? h("button.btn.btn--primaire", { texte: "＋ Nouveau rendez-vous",
              onclick: () => formulaireRendezVous(patients, rafraichir) })
          : null,
      ]),
    ]),

    aVenir.length
      ? h("div.carte", [
          h("div.carte__entete", [h("h3", { texte: "À venir" })]),
          tableau(colonnes, aVenir, {
            parPage: 20, triInitial: { colonne: "date", sens: "asc" },
            surLigne: r => marquerRendezVous(r, rafraichir),
          }),
        ])
      : etatVide({ icone: "📅", titre: "Aucun rendez-vous à venir",
          action: autorise("rendezVous", "creation")
            ? { libelle: "Planifier un rendez-vous",
                action: () => formulaireRendezVous(patients, rafraichir) } : null }),

    passes.length ? h("div.carte", [
      h("div.carte__entete", [h("h3", { texte: "Historique" })]),
      tableau(colonnes, passes, { parPage: 15, triInitial: { colonne: "date", sens: "desc" } }),
    ]) : null,
  ]);
}

async function formulaireRendezVous(patients, apres) {
  const actifs = patients.filter(p => !p._supprime && !p.archive);
  const form = formulaire([
    { cle: "patientId", libelle: "Patient", type: "select", obligatoire: true, vide: "— Choisir —",
      pleineLargeur: true,
      options: actifs.slice(0, 500).map(p => ({
        valeur: p.id, libelle: `${(p.nom || "").toUpperCase()} ${p.prenom} — ${p.ipp}` })) },
    { cle: "date", libelle: "Date", type: "date", obligatoire: true,
      defaut: new Date(Date.now() + 86400000).toISOString().slice(0, 10) },
    { cle: "heure", libelle: "Heure", type: "time", defaut: "09:00" },
    { cle: "type", libelle: "Type", type: "select", vide: false,
      options: [{ valeur: "consultation", libelle: "Consultation" },
        { valeur: "prelevement", libelle: "Prélèvement" },
        { valeur: "controle", libelle: "Contrôle" }] },
    { cle: "service", libelle: "Service" },
    { cle: "motif", libelle: "Motif", pleineLargeur: true },
  ]);
  form.classList.add("formulaire--grille");

  const r = await modale({
    titre: "Nouveau rendez-vous", contenu: form, largeur: "620px",
    actions: [
      { libelle: "Annuler", type: "neutre", valeur: null },
      { libelle: "Planifier", type: "primaire", action: async () => {
        const v = form.valeurs();
        if (!v.patientId || !v.date) { erreur("Patient et date sont obligatoires."); return false; }
        try {
          return await store.depots.rendezVous.creer({
            ...v, praticienId: utilisateurCourant().id, statut: "prevu", rappelEnvoye: false,
          });
        } catch (e) { erreur(e.message); return false; }
      } },
    ],
  });
  if (r) { succes("Rendez-vous planifié."); apres?.(); }
}

async function marquerRendezVous(rdv, apres) {
  if (!autorise("rendezVous", "modification")) return;
  const choix = await modale({
    titre: "Suivi du rendez-vous",
    largeur: "400px",
    contenu: h("p.texte-secondaire", { texte: "Indiquez ce qu'il est advenu de ce rendez-vous." }),
    actions: [
      { libelle: "Annuler", type: "neutre", valeur: null },
      { libelle: "Patient absent", type: "danger", valeur: "absent" },
      { libelle: "Rendez-vous honoré", type: "succes", valeur: "honore" },
    ],
  });
  if (!choix) return;
  await store.depots.rendezVous.modifier(rdv.id, { statut: choix });
  succes("Rendez-vous mis à jour.");
  apres?.();
}
