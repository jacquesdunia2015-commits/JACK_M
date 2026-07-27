// medistat/js/modules/administration.js
// Interface d'administration (article 11.3) : utilisateurs et droits,
// paramétrage de l'établissement, journal d'audit (article 16) et facturation
// (article 15). Regroupe les quatre écrans d'administration de la Solution.

import { h, fmt, tableau, badge, modale, confirmer, erreur, succes, alerte, copier,
  etatVide, formulaire, carteStat, onglets, remplacer, initiales, couleurDepuisTexte } from "../core/ui.js";
import * as store from "../core/store.js";
import * as auth from "../core/auth.js";
import { ROLES, DROITS, describePermissions, ACTIONS_AUDITEES, hasPermission } from "../core/model.js";
import { COULEURS } from "../core/charts.js";
import { barres, secteurs, lignes as graphLignes } from "../core/charts.js";
import { telecharger, versCSV, versXLSX } from "../core/export.js";

/* ===================== Utilisateurs ===================== */

export async function vue_utilisateurs({ rafraichir }) {
  const utilisateurs = await store.depots.utilisateurs.lister({
    tri: (a, b) => (a.nom || "").localeCompare(b.nom || "", "fr"),
  });
  const moi = auth.utilisateurCourant();
  const actifs = utilisateurs.filter(u => u.actif);

  const colonnes = [
    { cle: "utilisateur", titre: "Utilisateur",
      rendu: u => h("div", { style: { display: "flex", alignItems: "center", gap: "9px" } }, [
        h("span.avatar", { texte: initiales(u.nom, u.prenom),
          style: { backgroundColor: couleurDepuisTexte(u.id) } }),
        h("div", [
          h("strong", { texte: `${u.prenom || ""} ${u.nom}`.trim() }),
          h("div.texte-secondaire", { texte: u.identifiant }),
        ]),
      ]),
      triSur: u => u.nom },
    { cle: "role", titre: "Rôle", rendu: u => badge(ROLES[u.role]?.label || u.role,
      ROLES[u.role]?.niveau >= 90 ? COULEURS.critique : ROLES[u.role]?.niveau >= 70 ? COULEURS.accent : null) },
    { cle: "service", titre: "Service", valeur: u => u.service || "—" },
    { cle: "email", titre: "Courriel", valeur: u => u.email || "—" },
    { cle: "connexion", titre: "Dernière connexion",
      valeur: u => u.derniereConnexion ? fmt.relatif(u.derniereConnexion) : "jamais",
      triSur: u => u.derniereConnexion ? new Date(u.derniereConnexion).getTime() : 0 },
    { cle: "securite", titre: "Sécurité", triable: false,
      rendu: u => h("div", { style: { display: "flex", gap: "4px", flexWrap: "wrap" } }, [
        u.totpSecret ? badge("2FA", COULEURS.normal) : null,
        u.motDePasseTemporaire ? badge("mot de passe temporaire", COULEURS.bas) : null,
        u.bloqueJusqua && new Date(u.bloqueJusqua) > new Date() ? badge("bloqué", COULEURS.critique) : null,
      ].filter(Boolean)) },
    { cle: "etat", titre: "État", rendu: u => u.actif
      ? badge("actif", COULEURS.normal) : badge("désactivé", COULEURS.neutre) },
  ];

  return h("div", [
    h("div.page-entete", [
      h("div.page-entete__titre", [
        h("h1", { texte: "Utilisateurs" }),
        h("p.texte-secondaire", {
          texte: `${fmt.nombre(actifs.length)} compte(s) actif(s) sur ${fmt.nombre(utilisateurs.length)}.`,
        }),
      ]),
      h("div.page-entete__actions", [
        h("button.btn", { texte: "🛡️ Matrice des droits", onclick: matriceDroits }),
        hasPermission(moi.role, "utilisateur", "creation")
          ? h("button.btn.btn--primaire", { texte: "＋ Nouvel utilisateur",
              onclick: () => formulaireUtilisateur(rafraichir) })
          : null,
      ].filter(Boolean)),
    ]),

    h("div.grille.grille--4", { style: { marginBottom: "16px" } },
      Object.entries(ROLES)
        .map(([cle, def]) => {
          const n = actifs.filter(u => u.role === cle).length;
          return n ? carteStat({ libelle: def.label, valeur: n, icone: "👤" }) : null;
        }).filter(Boolean).slice(0, 8)),

    tableau(colonnes, utilisateurs, {
      parPage: 25,
      surLigne: u => gererUtilisateur(u, rafraichir),
      vide: "Aucun utilisateur.",
    }),
  ]);
}

async function formulaireUtilisateur(apres) {
  const moi = auth.utilisateurCourant();
  const rolesDisponibles = Object.entries(ROLES)
    .filter(([cle]) => cle !== "admin_systeme" || moi.role === "admin_systeme")
    .filter(([cle]) => cle !== "patient");

  const form = formulaire([
    { cle: "prenom", libelle: "Prénom", obligatoire: true },
    { cle: "nom", libelle: "Nom", obligatoire: true },
    { cle: "identifiant", libelle: "Identifiant de connexion", obligatoire: true,
      aide: "Sans espace ni accent, par exemple « dr.mukendi »." },
    { cle: "email", libelle: "Adresse électronique", type: "email" },
    { cle: "telephone", libelle: "Téléphone", type: "tel" },
    { cle: "service", libelle: "Service" },
    { cle: "role", libelle: "Rôle", type: "select", obligatoire: true, vide: "— Choisir —",
      pleineLargeur: true,
      options: rolesDisponibles.map(([cle, def]) => ({ valeur: cle, libelle: `${def.label} — ${def.description}` })) },
  ]);
  form.classList.add("formulaire--grille");

  const apercuDroits = h("div");
  form.controles.role.addEventListener("change", e => {
    const def = ROLES[e.target.value];
    remplacer(apercuDroits, def ? h("div.interpretation", [
      h("strong", { texte: def.label + " — " }),
      h("span", { texte: def.description }),
      h("div", { style: { marginTop: "6px", display: "flex", gap: "4px", flexWrap: "wrap" } },
        describePermissions(e.target.value).slice(0, 10)
          .map(p => badge(`${p.label} : ${p.droits.length} droit(s)`))),
    ]) : null);
  });

  const resultat = await modale({
    titre: "Nouvel utilisateur",
    contenu: h("div", [form, apercuDroits]),
    largeur: "760px",
    actions: [
      { libelle: "Annuler", type: "neutre", valeur: null },
      { libelle: "Créer le compte", type: "primaire", action: async () => {
        try { return await auth.creerUtilisateur(form.valeurs()); }
        catch (e) { erreur(e.message); return false; }
      } },
    ],
  });

  if (resultat) {
    // Le mot de passe temporaire n'est montré qu'une fois : il n'est stocké
    // nulle part en clair, y compris dans le journal d'audit.
    await modale({
      titre: "Compte créé",
      largeur: "460px",
      contenu: h("div", [
        h("p", { texte: `Le compte de ${resultat.utilisateur.prenom} ${resultat.utilisateur.nom} est créé.` }),
        resultat.motDePasseTemporaire ? h("div", [
          h("div.champ-libelle", { texte: "Mot de passe temporaire" }),
          h("div.carte", { style: { background: "var(--surface-2)", textAlign: "center" } }, [
            h("code.texte-mono", { style: { fontSize: "1.15rem", letterSpacing: "1px" },
              texte: resultat.motDePasseTemporaire }),
          ]),
          h("button.btn", { texte: "📋 Copier",
            onclick: () => copier(resultat.motDePasseTemporaire) }),
          h("div.avertissement", { style: { marginTop: "10px" },
            texte: "Ce mot de passe ne sera plus affiché. Communiquez-le par un canal sûr : " +
              "l'utilisateur devra le changer à sa première connexion." }),
        ]) : null,
      ]),
      actions: [{ libelle: "J'ai noté le mot de passe", type: "primaire" }],
      fermable: false,
    });
    apres?.();
  }
}

async function gererUtilisateur(utilisateur, apres) {
  const moi = auth.utilisateurCourant();
  const estMoi = utilisateur.id === moi.id;
  const peutAdministrer = hasPermission(moi.role, "utilisateur", "administration");

  const selectRole = h("select.champ", Object.entries(ROLES)
    .filter(([cle]) => cle !== "patient")
    .filter(([cle]) => cle !== "admin_systeme" || moi.role === "admin_systeme")
    .map(([cle, def]) => h("option", { value: cle, texte: def.label, selected: cle === utilisateur.role })));

  const action = await modale({
    titre: `${utilisateur.prenom || ""} ${utilisateur.nom}`.trim(),
    largeur: "560px",
    contenu: h("div", [
      h("div", { style: { display: "flex", gap: "13px", alignItems: "center", marginBottom: "14px" } }, [
        h("span.avatar", { texte: initiales(utilisateur.nom, utilisateur.prenom),
          style: { width: "46px", height: "46px", fontSize: "1rem",
            backgroundColor: couleurDepuisTexte(utilisateur.id) } }),
        h("div", [
          h("div.texte-secondaire", { texte: `Identifiant : ${utilisateur.identifiant}` }),
          h("div.texte-secondaire", { texte: utilisateur.email || "aucune adresse" }),
          h("div.texte-secondaire", {
            texte: utilisateur.derniereConnexion
              ? `Dernière connexion ${fmt.relatif(utilisateur.derniereConnexion)}`
              : "Ne s'est jamais connecté" }),
        ]),
      ]),

      peutAdministrer && !estMoi ? h("div.champ-groupe", [
        h("label.champ-libelle", { texte: "Rôle" }), selectRole,
      ]) : h("div", [
        h("div.champ-libelle", { texte: "Rôle" }),
        h("p", { texte: ROLES[utilisateur.role]?.label || utilisateur.role }),
      ]),

      h("div", { style: { marginTop: "12px" } }, [
        h("div.champ-libelle", { texte: "Droits accordés" }),
        h("div", { style: { display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "5px" } },
          describePermissions(utilisateur.role).map(p =>
            badge(`${p.label} (${p.droits.join(", ")})`))),
      ]),

      estMoi ? h("div.avertissement", { style: { marginTop: "12px" },
        texte: "Il s'agit de votre propre compte : vous ne pouvez ni modifier votre rôle, " +
          "ni désactiver votre accès. Cette règle évite qu'un établissement se retrouve " +
          "sans administrateur." }) : null,
    ]),
    actions: [
      { libelle: "Fermer", type: "neutre", valeur: null },
      peutAdministrer && !estMoi
        ? { libelle: "Réinitialiser le mot de passe", type: "neutre", valeur: "reinitialiser" }
        : null,
      peutAdministrer && !estMoi
        ? { libelle: utilisateur.actif ? "Désactiver" : "Réactiver",
            type: utilisateur.actif ? "danger" : "succes",
            valeur: utilisateur.actif ? "desactiver" : "activer" }
        : null,
      peutAdministrer && !estMoi && selectRole.value !== utilisateur.role
        ? { libelle: "Enregistrer le rôle", type: "primaire", valeur: "role" }
        : null,
    ].filter(Boolean),
  });

  try {
    if (action === "role") {
      await auth.modifierRole(utilisateur.id, selectRole.value);
      succes("Rôle modifié. Le changement est consigné au journal d'audit.");
      apres?.();
    } else if (action === "desactiver" || action === "activer") {
      await auth.activerUtilisateur(utilisateur.id, action === "activer");
      succes(action === "activer" ? "Compte réactivé." : "Compte désactivé.");
      apres?.();
    } else if (action === "reinitialiser") {
      const ok = await confirmer(
        `Réinitialiser le mot de passe de ${utilisateur.prenom} ${utilisateur.nom} ?`,
        { danger: true,
          detail: "Un mot de passe temporaire sera engendré. Attention : les données " +
            "chiffrées avec l'ancienne clé de cet utilisateur ne lui seront plus accessibles." });
      if (!ok) return;
      const r = await auth.reinitialiserMotDePasse(utilisateur.id);
      await modale({
        titre: "Mot de passe réinitialisé",
        largeur: "440px",
        contenu: h("div", [
          h("div.carte", { style: { background: "var(--surface-2)", textAlign: "center" } }, [
            h("code.texte-mono", { style: { fontSize: "1.15rem" }, texte: r.motDePasseTemporaire }),
          ]),
          h("button.btn", { texte: "📋 Copier", onclick: () => copier(r.motDePasseTemporaire) }),
          h("div.avertissement", { texte: r.avertissement }),
        ]),
        actions: [{ libelle: "J'ai noté", type: "primaire" }],
        fermable: false,
      });
      apres?.();
    }
  } catch (e) { erreur(e.message); }
}

// Matrice des droits : synthèse visuelle de l'article 10
function matriceDroits() {
  const roles = Object.entries(ROLES).filter(([cle]) => cle !== "patient");
  const ressources = ["patient", "consultation", "prescription", "demande", "echantillon",
    "resultat", "document", "utilisateur", "testCatalogue", "facture", "audit", "analyse"];
  const libelles = {
    patient: "Patients", consultation: "Consultations", prescription: "Prescriptions",
    demande: "Demandes", echantillon: "Échantillons", resultat: "Résultats",
    document: "Documents", utilisateur: "Utilisateurs", testCatalogue: "Catalogue",
    facture: "Facturation", audit: "Audit", analyse: "Analyses",
  };

  return modale({
    titre: "Matrice des droits par rôle",
    largeur: "1000px",
    contenu: h("div", [
      h("p.texte-secondaire", {
        texte: "L : lecture — C : création — M : modification — V : validation — " +
          "S : suppression — E : export — G : administration — √ : signature.",
      }),
      h("div.tableau-defilement", { style: { maxHeight: "62vh" } }, [
        h("table.tableau.tableau--compact", [
          h("thead", [h("tr", [
            h("th", "Rôle"),
            ...ressources.map(r => h("th", { style: { textAlign: "center", fontSize: ".68rem" },
              texte: libelles[r] })),
          ])]),
          h("tbody", roles.map(([cle, def]) => h("tr", [
            h("td", [h("strong", { texte: def.label })]),
            ...ressources.map(r => {
              const droits = [
                hasPermission(cle, r, "lecture") ? "L" : "",
                hasPermission(cle, r, "creation") ? "C" : "",
                hasPermission(cle, r, "modification") ? "M" : "",
                hasPermission(cle, r, "validation") ? "V" : "",
                hasPermission(cle, r, "suppression") ? "S" : "",
                hasPermission(cle, r, "export") ? "E" : "",
                hasPermission(cle, r, "administration") ? "G" : "",
                hasPermission(cle, r, "signature") ? "√" : "",
              ].filter(Boolean).join("");
              return h("td", {
                style: { textAlign: "center", fontFamily: "var(--mono)", fontSize: ".76rem",
                  color: droits ? "var(--accent)" : "var(--texte-3)",
                  fontWeight: droits.length > 3 ? "700" : "400" },
                texte: droits || "—",
              });
            }),
          ]))),
        ]),
      ]),
    ]),
    actions: [{ libelle: "Fermer", type: "neutre" }],
  });
}

/* ===================== Établissement ===================== */

export async function vue_etablissement({ rafraichir }) {
  const etablissements = await store.lireTout("etablissements");
  const session = auth.sessionCourante();
  const etablissement = etablissements.find(e => e.id === session.utilisateur.etablissementId)
    || etablissements[0];
  if (!etablissement) return etatVide({ icone: "🏥", titre: "Aucun établissement configuré" });

  const modifiable = auth.autorise("etablissement", "modification");
  const modules = etablissement.modules || {};

  const form = formulaire([
    { type: "separateur", libelle: "Identification" },
    { cle: "nom", libelle: "Raison sociale", obligatoire: true, pleineLargeur: true },
    { cle: "code", libelle: "Code court" },
    { cle: "type", libelle: "Type d'établissement", type: "select", vide: false,
      options: [{ valeur: "hopital", libelle: "Hôpital" }, { valeur: "clinique", libelle: "Clinique" },
        { valeur: "centre", libelle: "Centre de santé" },
        { valeur: "laboratoire", libelle: "Laboratoire indépendant" }] },
    { cle: "responsable", libelle: "Responsable" },
    { type: "separateur", libelle: "Coordonnées" },
    { cle: "adresse", libelle: "Adresse", pleineLargeur: true },
    { cle: "ville", libelle: "Ville" },
    { cle: "pays", libelle: "Pays" },
    { cle: "telephone", libelle: "Téléphone", type: "tel" },
    { cle: "email", libelle: "Adresse électronique", type: "email" },
  ], etablissement);
  form.classList.add("formulaire--grille");

  const casesModules = [
    ["laboratoire", "Module laboratoire", "Demandes, échantillons, résultats et validation."],
    ["consultations", "Module consultations", "Dossier clinique et prescriptions."],
    ["facturation", "Module de facturation", "Article 15 : à activer selon le statut de la structure."],
    ["portailPatient", "Portail patient", "Article 12 : consultation des résultats par le patient."],
    ["analyses", "Analyse de données", "Statistiques descriptives, inférentielles et qualitatives."],
  ].map(([cle, libelle, aide]) => {
    const case_ = h("input", { type: "checkbox", checked: modules[cle] !== false, disabled: !modifiable });
    case_.dataset.module = cle;
    return h("label.champ-groupe.champ-groupe--case", { style: { alignItems: "flex-start" } }, [
      case_,
      h("div", [h("span.champ-libelle", { texte: libelle }), h("div.champ-aide", { texte: aide })]),
    ]);
  });

  const diagnostic = await store.diagnosticStockage();

  return h("div", [
    h("div.page-entete", [
      h("div.page-entete__titre", [
        h("h1", { texte: "Établissement" }),
        h("p.texte-secondaire", { texte: "Paramétrage général et modules activés." }),
      ]),
    ]),

    h("div.carte", [
      h("div.carte__entete", [h("h3", { texte: "Informations générales" })]),
      form,
      modifiable ? h("button.btn.btn--primaire", { texte: "Enregistrer", style: { marginTop: "12px" },
        onclick: async () => {
          try {
            const v = form.valeurs();
            const nouveauxModules = { ...modules };
            for (const case_ of document.querySelectorAll("input[data-module]")) {
              nouveauxModules[case_.dataset.module] = case_.checked;
            }
            await store.ecrire("etablissements", { ...etablissement, ...v, modules: nouveauxModules });
            await store.tracer("parametrage", "etablissement", etablissement.id,
              "Modification du paramétrage de l'établissement");
            succes("Paramétrage enregistré. Rechargez la page pour appliquer les modules.");
            rafraichir?.();
          } catch (e) { erreur(e.message); }
        } }) : null,
    ]),

    h("div.carte", [
      h("div.carte__entete", [h("h3", { texte: "Modules activés" })]),
      h("p.texte-secondaire", {
        texte: "Désactiver un module masque les écrans correspondants sans supprimer les données.",
      }),
      h("div.formulaire", casesModules),
    ]),

    h("div.carte", [
      h("div.carte__entete", [h("h3", { texte: "Stockage local" })]),
      h("div.resultat-test__stat", [
        h("div.stat-bloc", [h("span.stat-bloc__libelle", { texte: "Moteur" }),
          h("span.stat-bloc__valeur", { texte: diagnostic.moteur })]),
        h("div.stat-bloc", [h("span.stat-bloc__libelle", { texte: "Enregistrements" }),
          h("span.stat-bloc__valeur", { texte: fmt.nombre(diagnostic.total) })]),
        diagnostic.quota ? h("div.stat-bloc", [
          h("span.stat-bloc__libelle", { texte: "Espace utilisé" }),
          h("span.stat-bloc__valeur", { texte: fmt.octets(diagnostic.quota.utilise) })]) : null,
      ].filter(Boolean)),
      diagnostic.avertissement ? h("div.avertissement", { texte: diagnostic.avertissement }) : null,
      tableau([
        { cle: "magasin", titre: "Entité" },
        { cle: "nombre", titre: "Enregistrements", aligne: "droite", valeur: r => fmt.nombre(r.nombre) },
      ], Object.entries(diagnostic.compteurs)
          .filter(([, n]) => n > 0)
          .map(([magasin, nombre]) => ({ magasin, nombre })),
        { compact: true, parPage: 20 }),
    ]),
  ]);
}

/* ===================== Journal d'audit (article 16) ===================== */

export async function vue_audit({ rafraichir }) {
  const [entrees, utilisateurs] = await Promise.all([
    store.lireTout("audit"), store.lireTout("utilisateurs"),
  ]);
  entrees.sort((a, b) => (a.date < b.date ? 1 : -1));

  const integrite = await store.verifierAudit();

  const parAction = new Map();
  for (const e of entrees) parAction.set(e.action, (parAction.get(e.action) || 0) + 1);

  const parUtilisateur = new Map();
  for (const e of entrees) {
    const cle = e.utilisateurNom || e.utilisateurId;
    parUtilisateur.set(cle, (parUtilisateur.get(cle) || 0) + 1);
  }

  // Activité sur 14 jours : détecte les pics d'accès inhabituels
  const JOUR = 86400000;
  const jours = [];
  for (let j = 13; j >= 0; j--) {
    const debut = Date.now() - (j + 1) * JOUR, fin = Date.now() - j * JOUR;
    jours.push({
      label: new Date(fin).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
      valeur: entrees.filter(e => {
        const t = new Date(e.date).getTime();
        return t >= debut && t < fin;
      }).length,
    });
  }

  const colonnes = [
    { cle: "date", titre: "Horodatage", valeur: e => fmt.date(e.date, { heure: true }),
      triSur: e => new Date(e.date).getTime() },
    { cle: "utilisateur", titre: "Utilisateur", valeur: e => e.utilisateurNom || "—" },
    { cle: "role", titre: "Rôle", rendu: e => e.role ? badge(ROLES[e.role]?.label || e.role) : "—" },
    { cle: "action", titre: "Action", rendu: e => {
      const critique = ["suppression", "changement_droits", "acces_refuse", "connexion_echec"]
        .includes(e.action);
      return badge(ACTIONS_AUDITEES[e.action] || e.action,
        critique ? COULEURS.critique : e.action === "signature" ? COULEURS.normal : null);
    } },
    { cle: "entite", titre: "Objet", valeur: e => e.entite || "—" },
    { cle: "details", titre: "Détail", valeur: e => e.details || "—" },
  ];

  return h("div", [
    h("div.page-entete", [
      h("div.page-entete__titre", [
        h("h1", { texte: "Journal d'audit" }),
        h("p.texte-secondaire", {
          texte: `${fmt.nombre(entrees.length)} événement(s) tracé(s). ` +
            `Le journal est chaîné par empreintes cryptographiques : toute modification est détectable.`,
        }),
      ]),
      h("div.page-entete__actions", [
        h("button.btn", { texte: "🔍 Contrôler l'intégrité", onclick: () => detailIntegrite(integrite) }),
        auth.autorise("audit", "export")
          ? h("button.btn", { texte: "⬇ Exporter", onclick: () => exporterAudit(entrees) })
          : null,
      ].filter(Boolean)),
    ]),

    // Le contrôle d'intégrité est l'information la plus importante de cet écran
    h("div.carte", {
      style: { borderLeft: `4px solid ${integrite.valide ? "var(--succes)" : "var(--critique)"}`,
        background: integrite.valide ? "rgba(22,163,74,.05)" : "rgba(220,38,38,.06)" },
    }, [
      h("div", { style: { display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" } }, [
        h("span", { style: { fontSize: "1.7rem" }, texte: integrite.valide ? "🛡️" : "🚨" }),
        h("div", { style: { flex: "1 1 260px" } }, [
          h("strong", { texte: integrite.valide
            ? "Intégrité du journal vérifiée" : "INTÉGRITÉ COMPROMISE" }),
          h("div.texte-secondaire", { texte: integrite.message }),
        ]),
      ]),
    ]),

    h("div.grille.grille--4", [
      carteStat({ libelle: "Événements", valeur: fmt.nombre(entrees.length), icone: "📜" }),
      carteStat({ libelle: "Connexions", valeur: fmt.nombre(parAction.get("connexion") || 0), icone: "🔑" }),
      carteStat({ libelle: "Échecs de connexion", valeur: fmt.nombre(parAction.get("connexion_echec") || 0),
        icone: "⛔", couleur: (parAction.get("connexion_echec") || 0) > 10 ? COULEURS.critique : null }),
      carteStat({ libelle: "Accès refusés", valeur: fmt.nombre(parAction.get("acces_refuse") || 0),
        icone: "🚫", couleur: (parAction.get("acces_refuse") || 0) > 0 ? COULEURS.bas : null }),
    ]),

    h("div.grille.grille--2", [
      h("div.graphique-carte", [
        graphLignes([{ nom: "Événements", points: jours.map((j, i) => ({ x: i, y: j.valeur })) }], {
          titre: "Activité des 14 derniers jours",
          xCategories: jours.map(j => j.label), libelleY: "Événements", hauteur: 280,
        }),
      ]),
      h("div.graphique-carte", [
        barres([...parAction.entries()]
          .sort((a, b) => b[1] - a[1]).slice(0, 10)
          .map(([action, n]) => ({
            label: (ACTIONS_AUDITEES[action] || action).slice(0, 18),
            valeur: n,
            couleur: ["suppression", "changement_droits", "acces_refuse", "connexion_echec"]
              .includes(action) ? COULEURS.critique : COULEURS.accent,
          })),
          { titre: "Types d'événements", libelleY: "Nombre", hauteur: 280 }),
      ]),
    ]),

    h("div.carte", [
      h("div.carte__entete", [h("h3", { texte: "Événements" })]),
      h("p.texte-secondaire", {
        texte: "Le journal ne contient aucune donnée de santé en clair : les champs sensibles y sont " +
          "remplacés par une mention de présence. Il enregistre qui a fait quoi, quand, et sur quel objet.",
      }),
      tableau(colonnes, entrees.slice(0, 3000), {
        parPage: 30, compact: true,
        triInitial: { colonne: "date", sens: "desc" },
        surLigne: e => detailEvenement(e),
      }),
    ]),
  ]);
}

function detailEvenement(e) {
  return modale({
    titre: ACTIONS_AUDITEES[e.action] || e.action,
    largeur: "560px",
    contenu: h("div", [
      h("div.texte-secondaire", [
        h("div", { texte: `Horodatage : ${fmt.date(e.date, { heure: true })}` }),
        h("div", { texte: `Utilisateur : ${e.utilisateurNom || "—"} (${ROLES[e.role]?.label || e.role || "—"})` }),
        h("div", { texte: `Objet : ${e.entite || "—"}${e.entiteId ? " / " + e.entiteId : ""}` }),
        e.appareil ? h("div", { texte: `Appareil : ${e.appareil}` }) : null,
      ]),
      e.details ? h("div.interpretation", { style: { marginTop: "10px" }, texte: e.details }) : null,
      e.avant || e.apres ? h("div", { style: { marginTop: "12px" } }, [
        h("div.champ-libelle", { texte: "Valeurs" }),
        h("pre.texte-mono", {
          style: { fontSize: ".74rem", background: "var(--surface-2)", padding: "9px",
            borderRadius: "7px", overflowX: "auto", whiteSpace: "pre-wrap" },
          texte: JSON.stringify({ avant: e.avant, apres: e.apres }, null, 1),
        }),
      ]) : null,
      h("div", { style: { marginTop: "12px" } }, [
        h("div.champ-libelle", { texte: "Empreinte de chaînage (SHA-256)" }),
        h("code.texte-mono", { style: { fontSize: ".68rem", wordBreak: "break-all" }, texte: e.empreinte }),
      ]),
    ]),
    actions: [{ libelle: "Fermer", type: "neutre" }],
  });
}

function detailIntegrite(integrite) {
  return modale({
    titre: "Contrôle d'intégrité du journal",
    largeur: "620px",
    contenu: h("div", [
      h("div", { class: integrite.valide ? "interpretation" : "avertissement",
        texte: integrite.message }),
      h("p.texte-secondaire", {
        texte: "Chaque entrée du journal contient l'empreinte de la précédente. Supprimer, insérer " +
          "ou modifier une entrée rompt cette chaîne — y compris pour un administrateur disposant " +
          "d'un accès direct à la base. C'est ce qui rend le journal non modifiable au sens de " +
          "l'article 16 du cahier des charges.",
      }),
      integrite.ruptures.length ? h("div", [
        h("h3", { texte: "Ruptures détectées" }),
        tableau([
          { cle: "index", titre: "Position", valeur: r => `#${r.index + 1}` },
          { cle: "date", titre: "Horodatage", valeur: r => fmt.date(r.date, { heure: true }) },
          { cle: "action", titre: "Action" },
          { cle: "motif", titre: "Diagnostic" },
        ], integrite.ruptures, { compact: true, parPage: 15 }),
      ]) : null,
    ]),
    actions: [{ libelle: "Fermer", type: "neutre" }],
  });
}

async function exporterAudit(entrees) {
  const lignes = entrees.map(e => ({
    Horodatage: e.date, Utilisateur: e.utilisateurNom || "", Role: e.role || "",
    Action: ACTIONS_AUDITEES[e.action] || e.action, Entite: e.entite || "",
    Identifiant: e.entiteId || "", Detail: e.details || "",
    Appareil: e.appareil || "", Empreinte: e.empreinte,
  }));
  telecharger(versCSV(lignes), `journal-audit-${new Date().toISOString().slice(0, 10)}.csv`, "text/csv");
  await store.tracer("export", "audit", null, `Export du journal d'audit (${entrees.length} entrées)`);
  succes(`${entrees.length} événements exportés.`);
}

/* ===================== Facturation (article 15) ===================== */

export async function vue_facturation({ rafraichir }) {
  const session = auth.sessionCourante();
  if (session?.etablissement?.modules?.facturation === false) {
    return etatVide({
      icone: "💶", titre: "Module de facturation désactivé",
      message: "Ce module est facultatif (article 15). Activez-le dans le paramétrage de " +
        "l'établissement si votre structure facture les actes.",
    });
  }

  const [factures, patients, demandes, tests] = await Promise.all([
    store.depots.factures.lister({ tri: (a, b) => (a.date < b.date ? 1 : -1) }).catch(() => []),
    store.lireTout("patients"), store.lireTout("demandes"), store.lireTout("testsCatalogue"),
  ]);
  const nomPatient = id => {
    const p = patients.find(x => x.id === id);
    return p ? `${(p.nom || "").toUpperCase()} ${p.prenom || ""}` : "—";
  };

  const ca = factures.reduce((a, f) => a + (Number(f.montantTTC) || 0), 0);
  const payees = factures.filter(f => f.statut === "payee");
  const impayees = factures.filter(f => f.statut !== "payee");

  return h("div", [
    h("div.page-entete", [
      h("div.page-entete__titre", [
        h("h1", { texte: "Facturation" }),
        h("p.texte-secondaire", { texte: `${fmt.nombre(factures.length)} facture(s) émise(s).` }),
      ]),
      h("div.page-entete__actions", [
        auth.autorise("facture", "creation")
          ? h("button.btn.btn--primaire", { texte: "＋ Nouvelle facture",
              onclick: () => formulaireFacture(patients, demandes, tests, rafraichir) })
          : null,
      ].filter(Boolean)),
    ]),

    h("div.grille.grille--4", [
      carteStat({ libelle: "Chiffre d'affaires", valeur: fmt.nombre(ca), icone: "💶",
        couleur: COULEURS.normal }),
      carteStat({ libelle: "Encaissé", valeur: fmt.nombre(payees.reduce((a, f) => a + (Number(f.montantTTC) || 0), 0)),
        detail: `${payees.length} facture(s)`, icone: "✅" }),
      carteStat({ libelle: "En attente",
        valeur: fmt.nombre(impayees.reduce((a, f) => a + (Number(f.montantTTC) || 0), 0)),
        detail: `${impayees.length} facture(s)`, icone: "⏳", couleur: COULEURS.bas }),
      carteStat({ libelle: "Panier moyen",
        valeur: factures.length ? fmt.nombre(ca / factures.length) : "—", icone: "📊" }),
    ]),

    factures.length
      ? tableau([
          { cle: "numero", titre: "N°" },
          { cle: "date", titre: "Date", valeur: f => fmt.date(f.date),
            triSur: f => new Date(f.date).getTime() },
          { cle: "patient", titre: "Patient", valeur: f => nomPatient(f.patientId) },
          { cle: "lignes", titre: "Actes", aligne: "centre", valeur: f => (f.lignes || []).length },
          { cle: "montant", titre: "Montant", aligne: "droite", valeur: f => fmt.nombre(f.montantTTC) },
          { cle: "statut", titre: "Statut", rendu: f => badge(
            { payee: "Payée", partielle: "Paiement partiel", impayee: "Impayée" }[f.statut] || "Impayée",
            f.statut === "payee" ? COULEURS.normal : COULEURS.bas) },
        ], factures, {
          parPage: 25,
          surLigne: f => auth.autorise("facture", "modification") ? reglerFacture(f, rafraichir) : null,
        })
      : etatVide({ icone: "💶", titre: "Aucune facture",
          message: "Les factures peuvent être établies à partir des demandes d'examens." }),
  ]);
}

async function formulaireFacture(patients, demandes, tests, apres) {
  const actifs = patients.filter(p => !p._supprime);
  const selectPatient = h("select.champ", [
    h("option", { value: "", texte: "— Choisir —" }),
    ...actifs.slice(0, 500).map(p => h("option", { value: p.id,
      texte: `${(p.nom || "").toUpperCase()} ${p.prenom} — ${p.ipp}` })),
  ]);
  const zoneDemandes = h("div");
  const selection = new Set();
  const total = h("strong", { texte: "0" });

  const calculer = () => {
    let somme = 0;
    for (const id of selection) {
      const d = demandes.find(x => x.id === id);
      for (const code of d?.tests || []) {
        somme += Number(tests.find(t => t.code === code)?.prix) || 0;
      }
    }
    total.textContent = fmt.nombre(somme);
    return somme;
  };

  selectPatient.addEventListener("change", () => {
    selection.clear();
    const siennes = demandes.filter(d => d.patientId === selectPatient.value && d.statut === "rendue");
    remplacer(zoneDemandes, siennes.length
      ? h("div", siennes.map(d => {
          const montant = (d.tests || []).reduce((a, code) =>
            a + (Number(tests.find(t => t.code === code)?.prix) || 0), 0);
          const case_ = h("input", { type: "checkbox" });
          case_.addEventListener("change", () => {
            if (case_.checked) selection.add(d.id); else selection.delete(d.id);
            calculer();
          });
          return h("label.champ-groupe.champ-groupe--case", [
            case_,
            h("span", { texte: `${d.numero} — ${(d.tests || []).length} analyse(s) — ${fmt.nombre(montant)}` }),
          ]);
        }))
      : h("p.texte-secondaire", { texte: "Aucune demande facturable pour ce patient." }));
    calculer();
  });

  const r = await modale({
    titre: "Nouvelle facture",
    largeur: "620px",
    contenu: h("div.formulaire", [
      h("div.champ-groupe", [h("label.champ-libelle", { texte: "Patient" }), selectPatient]),
      h("div.champ-groupe", [h("label.champ-libelle", { texte: "Demandes à facturer" }), zoneDemandes]),
      h("div.resultat-test__stat", [
        h("div.stat-bloc", [h("span.stat-bloc__libelle", { texte: "Total" }),
          h("span.stat-bloc__valeur", [total])]),
      ]),
    ]),
    actions: [
      { libelle: "Annuler", type: "neutre", valeur: null },
      { libelle: "Établir la facture", type: "primaire", action: async () => {
        if (!selectPatient.value) { erreur("Sélectionnez un patient."); return false; }
        if (!selection.size) { erreur("Sélectionnez au moins une demande."); return false; }
        const montant = calculer();
        const sequence = await store.prochaineSequence("facture");
        const lignesFacture = [];
        for (const id of selection) {
          const d = demandes.find(x => x.id === id);
          for (const code of d?.tests || []) {
            const t = tests.find(x => x.code === code);
            lignesFacture.push({ code, libelle: t?.nom || code, prix: Number(t?.prix) || 0 });
          }
        }
        try {
          return await store.depots.factures.creer({
            numero: `F${new Date().getFullYear()}${String(sequence).padStart(5, "0")}`,
            patientId: selectPatient.value,
            date: new Date().toISOString(),
            lignes: lignesFacture,
            montantHT: montant, montantTTC: montant,
            statut: "impayee",
          });
        } catch (e) { erreur(e.message); return false; }
      } },
    ],
  });
  if (r) { succes(`Facture ${r.numero} établie.`); apres?.(); }
}

async function reglerFacture(facture, apres) {
  const choix = await modale({
    titre: `Facture ${facture.numero}`,
    largeur: "520px",
    contenu: h("div", [
      h("div.resultat-test__stat", [
        h("div.stat-bloc", [h("span.stat-bloc__libelle", { texte: "Montant" }),
          h("span.stat-bloc__valeur", { texte: fmt.nombre(facture.montantTTC) })]),
        h("div.stat-bloc", [h("span.stat-bloc__libelle", { texte: "Date" }),
          h("span.stat-bloc__valeur", { texte: fmt.date(facture.date) })]),
      ]),
      tableau([
        { cle: "libelle", titre: "Acte" },
        { cle: "prix", titre: "Prix", aligne: "droite", valeur: l => fmt.nombre(l.prix) },
      ], facture.lignes || [], { compact: true, parPage: 20 }),
    ]),
    actions: [
      { libelle: "Fermer", type: "neutre", valeur: null },
      facture.statut !== "payee"
        ? { libelle: "Marquer comme payée", type: "succes", valeur: "payee" } : null,
    ].filter(Boolean),
  });
  if (choix === "payee") {
    await store.depots.factures.modifier(facture.id, {
      statut: "payee", datePaiement: new Date().toISOString(),
    });
    succes("Facture réglée.");
    apres?.();
  }
}
