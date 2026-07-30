// medistat/js/app.js
// Coquille applicative : démarrage, authentification, routage, navigation,
// recherche globale, notifications et installation.

import { h, $, $$, remplacer, vider, fmt, notifier, succes, erreur, alerte, critique,
  modale, confirmer, chargement, etatVide, etatErreur, initiales, couleurDepuisTexte,
  antirebond, formulaire } from "./core/ui.js";
import * as auth from "./core/auth.js";
import * as store from "./core/store.js";
import { ROLES, hasPermission, calculerAge } from "./core/model.js";
import { evaluerMotDePasse } from "./core/crypto.js";
import * as i18n from "./core/i18n.js";

/* ===================== Registre des vues ===================== */

// Les vues sont chargées à la demande : le démarrage reste rapide même sur un
// téléphone d'entrée de gamme, et seul le code réellement utilisé est évalué.
const VUES = {
  "tableau-de-bord": () => import("./modules/tableau-bord.js"),
  "patients": () => import("./modules/patients.js"),
  "consultations": () => import("./modules/consultations.js"),
  "rendez-vous": () => import("./modules/consultations.js"),
  "demandes": () => import("./modules/laboratoire.js"),
  "paillasse": () => import("./modules/laboratoire.js"),
  "validation": () => import("./modules/laboratoire.js"),
  "messages": () => import("./modules/laboratoire.js"),
  "catalogue": () => import("./modules/catalogue.js"),
  "jeux-donnees": () => import("./modules/donnees.js"),
  "statistiques": () => import("./modules/statistiques.js"),
  "qualitatif": () => import("./modules/qualitatif.js"),
  "rapports": () => import("./modules/rapports.js"),
  "utilisateurs": () => import("./modules/administration.js"),
  "etablissement": () => import("./modules/administration.js"),
  "audit": () => import("./modules/administration.js"),
  "facturation": () => import("./modules/administration.js"),
  "aide": () => import("./modules/aide.js"),
};

const etat = {
  vueCourante: null,
  parametres: {},
  invitationInstallation: null,
};

/* ===================== Démarrage ===================== */

async function demarrer() {
  const etatDemarrage = $("#demarrageEtat");
  const dire = m => { if (etatDemarrage) etatDemarrage.textContent = m; };

  appliquerTheme(localStorage.getItem("medistat-theme") || "clair");
  // La langue est posée avant tout affichage : l'écran de premier lancement
  // doit déjà s'ouvrir dans la langue du poste, et non en français par défaut.
  i18n.initialiserLangue();

  try {
    dire("Ouverture de la base locale…");
    const diagnostic = await store.diagnosticStockage();
    if (diagnostic.avertissement) {
      setTimeout(() => alerte(diagnostic.avertissement, { duree: 12000 }), 1200);
    }

    dire("Vérification de la configuration…");
    if (await auth.besoinInitialisation()) {
      masquerDemarrage();
      return ecranInitialisation();
    }

    masquerDemarrage();
    ecranConnexion();
  } catch (e) {
    console.error(e);
    dire("Le démarrage a échoué : " + e.message);
  }
}

function masquerDemarrage() {
  const d = $("#demarrage");
  if (d) d.remove();
}

/* ===================== Premier lancement ===================== */

async function ecranInitialisation() {
  const app = $("#application");
  app.hidden = false;
  $("#navigation").hidden = true;
  $(".barre-haut__actions").hidden = true;
  $(".barre-haut__recherche").hidden = true;

  const form = formulaire([
    { type: "separateur", libelle: "Établissement" },
    { cle: "nom", libelle: "Nom de l'établissement", obligatoire: true, pleineLargeur: true,
      placeholder: "Centre hospitalier universitaire de…" },
    { cle: "code", libelle: "Code court", obligatoire: true, placeholder: "CHU",
      aide: "3 à 4 lettres, utilisées dans les numéros de dossier." },
    { cle: "type", libelle: "Type", type: "select", vide: false,
      options: [
        { valeur: "hopital", libelle: "Hôpital" },
        { valeur: "clinique", libelle: "Clinique" },
        { valeur: "centre", libelle: "Centre de santé" },
        { valeur: "laboratoire", libelle: "Laboratoire indépendant" },
      ] },
    { cle: "ville", libelle: "Ville" },
    { cle: "pays", libelle: "Pays" },
    { type: "separateur", libelle: "Compte administrateur" },
    { cle: "prenom", libelle: "Prénom", obligatoire: true },
    { cle: "nomAdmin", libelle: "Nom", obligatoire: true },
    { cle: "identifiant", libelle: "Identifiant de connexion", obligatoire: true,
      placeholder: "admin", aide: "Sans espace ni accent." },
    { cle: "email", libelle: "Adresse électronique", type: "email" },
    { cle: "motDePasse", libelle: "Mot de passe", type: "password", obligatoire: true,
      aide: "12 caractères minimum recommandés, avec majuscules, minuscules et chiffres." },
    { cle: "motDePasse2", libelle: "Confirmation du mot de passe", type: "password", obligatoire: true },
    { type: "separateur", libelle: "Modules à activer" },
    { cle: "facturation", libelle: "Module de facturation", type: "checkbox",
      aide: "Activez-le si votre structure facture les actes." },
    { cle: "portailPatient", libelle: "Portail patient", type: "checkbox", defaut: true,
      aide: "Permet aux patients de consulter leurs résultats." },
    { cle: "demonstration", libelle: "Charger un jeu de données de démonstration", type: "checkbox", defaut: true,
      aide: "Patients, examens et résultats fictifs, pour découvrir la Solution. Supprimables à tout moment." },
  ]);
  form.classList.add("formulaire--grille");

  const jauge = h("div");
  form.controles.motDePasse.addEventListener("input", e => {
    const f = evaluerMotDePasse(e.target.value);
    remplacer(jauge, h("div", [
      h("div.progression", [h("div.progression__barre", {
        style: {
          width: Math.min(100, (f.entropie / 100) * 100) + "%",
          backgroundColor: f.acceptable ? "var(--succes)" : "var(--alerte)",
        },
      })]),
      h("span.champ-aide", { texte: `Robustesse : ${f.niveau}. ${f.conseil}` }),
    ]));
  });

  const bouton = h("button.btn.btn--primaire.btn--large", { texte: "Créer l'établissement et démarrer" });

  remplacer($("#vue"), h("div.carte", { style: { maxWidth: "860px", margin: "24px auto" } }, [
    h("h1", { texte: "Bienvenue dans MediStat" }),
    h("p.texte-secondaire", {
      texte: "Cette première configuration crée votre établissement et son compte administrateur. " +
        "Toutes les données restent sur cet appareil tant que vous ne connectez pas de serveur.",
    }),
    form, jauge, h("div", { style: { marginTop: "16px" } }, [bouton]),
  ]));

  bouton.addEventListener("click", async () => {
    const v = form.valeurs();
    const manquants = ["nom", "code", "prenom", "nomAdmin", "identifiant", "motDePasse"]
      .filter(c => !v[c]);
    if (manquants.length) {
      form.marquerErreurs(manquants);
      return erreur("Veuillez renseigner tous les champs obligatoires.");
    }
    if (v.motDePasse !== v.motDePasse2) {
      form.marquerErreurs(["motDePasse2"]);
      return erreur("Les deux mots de passe ne correspondent pas.");
    }
    bouton.disabled = true;
    bouton.textContent = "Création en cours…";
    try {
      await auth.initialiser({
        etablissement: {
          nom: v.nom, code: v.code, type: v.type, ville: v.ville, pays: v.pays,
          facturation: v.facturation, portailPatient: v.portailPatient,
        },
        administrateur: {
          identifiant: v.identifiant, nom: v.nomAdmin, prenom: v.prenom,
          email: v.email, motDePasse: v.motDePasse,
        },
      });
      await auth.connexion(v.identifiant, v.motDePasse);
      if (v.demonstration) {
        const demo = await import("./modules/demonstration.js");
        await demo.chargerDemonstration();
      }
      succes("Établissement créé. Bienvenue !");
      await ouvrirApplication();
    } catch (e) {
      bouton.disabled = false;
      bouton.textContent = "Créer l'établissement et démarrer";
      erreur(e.message);
    }
  });
}

/* ===================== Connexion ===================== */

function ecranConnexion() {
  const app = $("#application");
  app.hidden = false;
  $("#navigation").hidden = true;
  $(".barre-haut__actions").hidden = true;
  $(".barre-haut__recherche").hidden = true;

  const identifiant = h("input.champ", { type: "text", placeholder: "Identifiant",
    autocomplete: "username", autocapitalize: "none" });
  const motDePasse = h("input.champ", { type: "password", placeholder: "Mot de passe",
    autocomplete: "current-password" });
  const champTOTP = h("input.champ", { type: "text", placeholder: "Code à 6 chiffres",
    inputmode: "numeric", maxlength: 6, autocomplete: "one-time-code" });
  const blocTOTP = h("div.champ-groupe", { hidden: true }, [
    h("span.champ-libelle", { texte: "Code de vérification" }), champTOTP,
  ]);
  const bouton = h("button.btn.btn--primaire.btn--large", { type: "submit", texte: "Se connecter" });
  const message = h("div");

  const connecter = async ev => {
    ev?.preventDefault();
    if (!identifiant.value.trim() || !motDePasse.value) {
      return erreur("Renseignez votre identifiant et votre mot de passe.");
    }
    bouton.disabled = true;
    bouton.textContent = "Connexion…";
    try {
      const r = await auth.connexion(identifiant.value, motDePasse.value, {
        codeTOTP: blocTOTP.hidden ? null : champTOTP.value,
      });
      for (const a of r.avertissements) alerte(a, { duree: 9000 });
      await ouvrirApplication();
    } catch (e) {
      if (e.code === "TOTP_REQUIS") {
        blocTOTP.hidden = false;
        champTOTP.focus();
        remplacer(message, h("p.champ-aide", { texte: "Saisissez le code affiché par votre application d'authentification." }));
      } else {
        remplacer(message, h("div.avertissement", { texte: e.message }));
      }
      bouton.disabled = false;
      bouton.textContent = "Se connecter";
    }
  };

  const form = h("form.formulaire", { onsubmit: connecter }, [
    h("div.champ-groupe", [h("label.champ-libelle", { texte: "Identifiant" }), identifiant]),
    h("div.champ-groupe", [h("label.champ-libelle", { texte: "Mot de passe" }), motDePasse]),
    blocTOTP, message, bouton,
  ]);

  remplacer($("#vue"), h("div", { style: { maxWidth: "380px", margin: "6vh auto" } }, [
    h("div.carte", { style: { textAlign: "center" } }, [
      h("div", { style: { fontSize: "2.4rem", marginBottom: "6px" } }, ["🏥"]),
      h("h1", { texte: "MediStat" }),
      h("p.texte-secondaire", { texte: "Dossiers médicaux, laboratoire et analyse de données" }),
      form,
    ]),
    h("p.texte-secondaire", { style: { textAlign: "center", fontSize: ".8rem" } }, [
      "Vos données restent sur cet appareil, chiffrées. ",
      h("a", { href: "#/aide", texte: "En savoir plus", onclick: e => e.preventDefault() }),
    ]),
  ]));
  setTimeout(() => identifiant.focus(), 100);
}

/* ===================== Ouverture de l'application ===================== */

async function ouvrirApplication() {
  const session = auth.sessionCourante();
  if (!session) return ecranConnexion();

  $("#navigation").hidden = false;
  $(".barre-haut__actions").hidden = false;
  $(".barre-haut__recherche").hidden = false;

  const u = session.utilisateur;
  $("#nomEtablissement").textContent = session.etablissement?.nom || "";
  $("#nomCompte").textContent = `${u.prenom} ${u.nom}`.trim();
  const avatar = $("#avatarCompte");
  avatar.textContent = initiales(u.nom, u.prenom);
  avatar.style.backgroundColor = couleurDepuisTexte(u.id);

  appliquerDroitsNavigation();
  brancherInterface();
  await rafraichirIndicateurs();

  // Reprise de la file de messages aux patients : un message mis en file
  // hors ligne part de lui-même dès que le réseau revient, sans que personne
  // ait à rouvrir l'écran des messages.
  import("./core/notifications.js")
    .then(n => n.demarrerReprise())
    .catch(() => { /* module indisponible : la file reste consultable */ });

  // Route initiale : celle de l'URL, ou le tableau de bord
  const route = location.hash.replace(/^#\//, "") || "tableau-de-bord";
  naviguer(route, true);
}

// Masque les entrées de menu auxquelles le rôle n'a pas accès (article 10) :
// l'utilisateur ne voit que ce qu'il peut réellement faire.
function appliquerDroitsNavigation() {
  const u = auth.utilisateurCourant();
  if (!u) return;
  const modules = auth.sessionCourante()?.etablissement?.modules || {};
  for (const lien of $$(".nav-lien[data-droit]")) {
    const [ressource, droit] = lien.dataset.droit.split(":");
    let visible = hasPermission(u.role, ressource, droit);
    // Les modules désactivés au niveau de l'établissement disparaissent aussi
    if (lien.dataset.vue === "facturation" && !modules.facturation) visible = false;
    lien.hidden = !visible;
  }
}

/* ===================== Routage ===================== */

async function naviguer(vue, remplacerHistorique = false) {
  const [nom, ...reste] = String(vue).split("/");
  const cible = VUES[nom] ? nom : "tableau-de-bord";
  etat.parametres = { segments: reste, requete: new URLSearchParams(location.search) };

  const url = `#/${vue}`;
  if (remplacerHistorique) history.replaceState(null, "", url);
  else if (location.hash !== url) history.pushState(null, "", url);

  for (const lien of $$(".nav-lien[data-vue], .barre-mobile__lien[data-vue]")) {
    const actif = lien.dataset.vue === cible;
    lien.classList.toggle("nav-lien--actif", actif && lien.classList.contains("nav-lien"));
    lien.classList.toggle("barre-mobile__lien--actif", actif && lien.classList.contains("barre-mobile__lien"));
  }
  $("#navigation").classList.remove("navigation--ouverte");

  const conteneur = $("#vue");
  remplacer(conteneur, chargement());
  conteneur.scrollTop = 0;

  try {
    const module = await VUES[cible]();
    const rendu = module[`vue_${cible.replace(/-/g, "_")}`] || module.vue || module.default;
    if (typeof rendu !== "function") throw new Error(`La vue « ${cible} » est indisponible.`);
    const contenu = await rendu({ ...etat.parametres, naviguer, rafraichir: () => naviguer(vue, true) });
    remplacer(conteneur, contenu);
    etat.vueCourante = cible;
    conteneur.focus({ preventScroll: true });
  } catch (e) {
    console.error(e);
    if (e.name === "ErreurPermission") {
      remplacer(conteneur, etatVide({
        icone: "🚫", titre: "Accès refusé",
        message: e.message + " Cette tentative a été consignée dans le journal d'audit.",
      }));
    } else {
      remplacer(conteneur, etatErreur(e.message, () => naviguer(vue, true)));
    }
  }
  await rafraichirIndicateurs();
}

// Exposé aux modules pour la navigation interne
window.medistatNaviguer = naviguer;

/* ===================== Interface ===================== */

function brancherInterface() {
  const nav = $("#navigation");

  brancherLangue();

  $("#btnMenu").onclick = () => nav.classList.toggle("navigation--ouverte");
  $("#btnMenuMobile").onclick = () => nav.classList.toggle("navigation--ouverte");
  document.addEventListener("click", e => {
    if (window.innerWidth <= 1000 && nav.classList.contains("navigation--ouverte") &&
        !nav.contains(e.target) && !e.target.closest("#btnMenu, #btnMenuMobile")) {
      nav.classList.remove("navigation--ouverte");
    }
  });

  for (const lien of $$('a[href^="#/"]')) {
    lien.addEventListener("click", e => {
      e.preventDefault();
      naviguer(lien.getAttribute("href").replace(/^#\//, ""));
    });
  }
  window.addEventListener("popstate", () => {
    naviguer(location.hash.replace(/^#\//, "") || "tableau-de-bord", true);
  });

  $("#btnTheme").onclick = () => {
    const nouveau = document.documentElement.dataset.theme === "sombre" ? "clair" : "sombre";
    appliquerTheme(nouveau);
    localStorage.setItem("medistat-theme", nouveau);
  };

  $("#btnVerrouiller").onclick = () => auth.verrouiller("Verrouillage demandé par l'utilisateur");
  $("#btnCompte").onclick = menuCompte;
  $("#btnNotifications").onclick = panneauNotifications;

  // Recherche globale
  const recherche = $("#rechercheGlobale");
  recherche.addEventListener("input", antirebond(() => rechercherPartout(recherche.value), 260));
  recherche.addEventListener("focus", () => { if (recherche.value) rechercherPartout(recherche.value); });
  document.addEventListener("click", e => {
    if (!e.target.closest(".barre-haut__recherche")) $("#resultatsRecherche").hidden = true;
  });

  // Verrouillage automatique : toute activité repousse l'échéance
  for (const ev of ["click", "keydown", "touchstart", "mousemove"]) {
    document.addEventListener(ev, auth.signalerActivite, { passive: true });
  }
  auth.surChangementSession(evenement => {
    if (evenement === "verrouillage") afficherVerrou();
    if (evenement === "deverrouillage") $("#verrou").hidden = true;
    if (evenement === "deconnexion") location.reload();
  });

  // Raccourcis clavier
  document.addEventListener("keydown", e => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === "k") { e.preventDefault(); recherche.focus(); recherche.select(); }
      if (e.key === "l") { e.preventDefault(); auth.verrouiller("Raccourci clavier"); }
    }
    if (e.key === "Escape") $("#resultatsRecherche").hidden = true;
  });

  // État du réseau
  const majReseau = () => {
    const ind = $("#indicateurReseau");
    ind.classList.toggle("indicateur--hors-ligne", !navigator.onLine);
    ind.title = navigator.onLine
      ? "En ligne — les données se synchronisent"
      : "Hors ligne — les modifications seront envoyées au retour du réseau";
  };
  window.addEventListener("online", () => { majReseau(); succes("Connexion rétablie."); });
  window.addEventListener("offline", () => { majReseau(); alerte("Mode hors ligne : vous pouvez continuer à travailler."); });
  majReseau();

  // Installation sur l'appareil
  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();
    etat.invitationInstallation = e;
    const btn = $("#btnInstaller");
    btn.hidden = false;
    btn.onclick = async () => {
      etat.invitationInstallation.prompt();
      const { outcome } = await etat.invitationInstallation.userChoice;
      if (outcome === "accepted") { succes("MediStat est installé sur cet appareil."); btn.hidden = true; }
      etat.invitationInstallation = null;
    };
  });

  // Verrou : formulaire de déverrouillage
  $("#formVerrou").onsubmit = async e => {
    e.preventDefault();
    const champ = $("#verrouMotDePasse");
    try {
      await auth.deverrouiller(champ.value);
      champ.value = "";
    } catch (err) { erreur(err.message); champ.select(); }
  };
  $("#btnQuitterSession").onclick = () => auth.deconnexion();
}

/* ===================== Langue de l'interface ===================== */

function brancherLangue() {
  const zone = $("#zoneLangue");
  if (!zone) return;
  vider(zone);
  zone.appendChild(i18n.construireSelecteur(document));

  // Les écrans sont rendus en JavaScript : traduire les attributs data-i18n
  // ne suffit pas, il faut redessiner la vue en cours. Le routeur sait le
  // faire ; on lui redemande la même vue plutôt que de recharger la page,
  // ce qui préserverait mal un formulaire à demi rempli mais garde la
  // session, la position dans la navigation et l'état hors ligne.
  i18n.surChangementLangue(() => {
    i18n.appliquer();
    if (etat.vueCourante) naviguer(etat.vueCourante, true);
  });

  i18n.appliquer();
}

function appliquerTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme === "sombre" ? "#101a2c" : "#17334f";
}

function afficherVerrou() {
  const s = auth.sessionCourante();
  $("#verrou").hidden = false;
  $("#verrouMotif").textContent = s?.motifVerrouillage || "";
  $("#verrouUtilisateur").textContent = s ? `${s.utilisateur.prenom} ${s.utilisateur.nom}` : "";
  setTimeout(() => $("#verrouMotDePasse").focus(), 100);
}

/* ===================== Recherche globale ===================== */

async function rechercherPartout(requete) {
  const boite = $("#resultatsRecherche");
  const q = String(requete || "").trim();
  if (q.length < 2) { boite.hidden = true; return; }

  const groupes = [];
  try {
    if (auth.autorise("patient", "lecture")) {
      const patients = await store.depots.patients.rechercher(q, ["nom", "prenom", "ipp", "telephone"]);
      if (patients.length) {
        groupes.push({ titre: "Patients", elements: patients.slice(0, 6).map(p => ({
          icone: "🧑‍⚕️",
          titre: `${p.nom.toUpperCase()} ${p.prenom}`,
          detail: `${p.ipp} — ${calculerAge(p.dateNaissance)?.label || ""}`,
          aller: () => naviguer(`patients/${p.id}`),
        })) });
      }
    }
    if (auth.autorise("demande", "lecture")) {
      const demandes = await store.depots.demandes.rechercher(q, ["numero"]);
      if (demandes.length) {
        groupes.push({ titre: "Demandes d'examens", elements: demandes.slice(0, 5).map(d => ({
          icone: "📋", titre: d.numero, detail: fmt.date(d.date, { heure: true }),
          aller: () => naviguer(`demandes/${d.id}`),
        })) });
      }
      const echantillons = await store.depots.echantillons.rechercher(q, ["codeBarre"]);
      if (echantillons.length) {
        groupes.push({ titre: "Échantillons", elements: echantillons.slice(0, 5).map(e => ({
          icone: "🩸", titre: e.codeBarre, detail: e.type,
          aller: () => naviguer(`demandes/${e.demandeId}`),
        })) });
      }
    }
  } catch (e) { console.warn(e); }

  if (!groupes.length) {
    remplacer(boite, h("div.recherche-resultat", { texte: `Aucun résultat pour « ${q} ».` }));
    boite.hidden = false;
    return;
  }

  remplacer(boite, groupes.flatMap(g => [
    h("div.recherche-groupe", { texte: g.titre }),
    ...g.elements.map(el => h("div.recherche-resultat", {
      onclick: () => { boite.hidden = true; $("#rechercheGlobale").value = ""; el.aller(); },
    }, [
      h("span", { texte: el.icone }),
      h("div", [h("div", { texte: el.titre }), h("div.texte-secondaire", { texte: el.detail })]),
    ])),
  ]));
  boite.hidden = false;
}

/* ===================== Menu du compte ===================== */

async function menuCompte() {
  const s = auth.sessionCourante();
  const u = s.utilisateur;
  const diagnostic = await store.diagnosticStockage();

  await modale({
    titre: "Mon compte",
    largeur: "460px",
    contenu: h("div", [
      h("div", { style: { display: "flex", gap: "13px", alignItems: "center", marginBottom: "16px" } }, [
        h("span.avatar", { texte: initiales(u.nom, u.prenom),
          style: { width: "48px", height: "48px", fontSize: "1.05rem",
            backgroundColor: couleurDepuisTexte(u.id) } }),
        h("div", [
          h("strong", { texte: `${u.prenom} ${u.nom}` }),
          h("div.texte-secondaire", { texte: ROLES[u.role]?.label || u.role }),
          h("div.texte-secondaire", { texte: u.email || u.identifiant }),
        ]),
      ]),
      h("div.texte-secondaire", { style: { marginBottom: "14px" } }, [
        h("div", { texte: `Établissement : ${s.etablissement?.nom || "—"}` }),
        h("div", { texte: `Session ouverte ${fmt.relatif(s.debut)}` }),
        h("div", { texte: `Stockage : ${diagnostic.moteur}, ${diagnostic.total} enregistrements` }),
      ]),
      h("div", { style: { display: "flex", flexDirection: "column", gap: "8px" } }, [
        h("button.btn", { texte: "🔑  Changer mon mot de passe", onclick: changerMotDePasse }),
        h("button.btn", { texte: "🛡️  Double authentification", onclick: configurerTOTP }),
        h("button.btn", { texte: "💾  Sauvegarder les données", onclick: sauvegarder }),
        h("button.btn", { texte: "♻️  Restaurer une sauvegarde", onclick: restaurer }),
        h("button.btn.btn--danger", { texte: "↩️  Fermer la session", onclick: () => auth.deconnexion() }),
      ]),
    ]),
    actions: [{ libelle: "Fermer", type: "neutre" }],
  });
}

async function changerMotDePasse() {
  const form = formulaire([
    { cle: "ancien", libelle: "Mot de passe actuel", type: "password", obligatoire: true },
    { cle: "nouveau", libelle: "Nouveau mot de passe", type: "password", obligatoire: true },
    { cle: "confirmation", libelle: "Confirmation", type: "password", obligatoire: true },
  ]);
  const r = await modale({
    titre: "Changer mon mot de passe",
    contenu: form,
    largeur: "420px",
    actions: [
      { libelle: "Annuler", type: "neutre", valeur: null },
      { libelle: "Enregistrer", type: "primaire", action: async () => {
        const v = form.valeurs();
        if (v.nouveau !== v.confirmation) { erreur("Les deux saisies diffèrent."); return false; }
        try {
          await auth.changerMotDePasse(v.ancien, v.nouveau);
          return true;
        } catch (e) { erreur(e.message); return false; }
      } },
    ],
  });
  if (r) succes("Mot de passe modifié.");
}

async function configurerTOTP() {
  const secret = auth.genererSecretTOTP();
  const s = auth.sessionCourante();
  const url = auth.urlTOTP(secret, s.utilisateur.identifiant, s.etablissement?.nom);
  const champ = h("input.champ", { placeholder: "Code à 6 chiffres", inputmode: "numeric", maxlength: 6 });

  const r = await modale({
    titre: "Double authentification",
    largeur: "460px",
    contenu: h("div", [
      h("p", { texte: "Ajoutez ce compte dans votre application d'authentification " +
        "(Google Authenticator, FreeOTP, Aegis), puis saisissez le code affiché." }),
      h("div.carte", { style: { background: "var(--surface-2)", wordBreak: "break-all" } }, [
        h("div.champ-libelle", { texte: "Clé de configuration" }),
        h("code.texte-mono", { texte: secret }),
      ]),
      h("details", [
        h("summary", { texte: "Adresse d'appairage complète" }),
        h("code.texte-mono", { style: { wordBreak: "break-all", fontSize: ".72rem" }, texte: url }),
      ]),
      h("div.champ-groupe", [h("span.champ-libelle", { texte: "Code de vérification" }), champ]),
    ]),
    actions: [
      { libelle: "Annuler", type: "neutre", valeur: null },
      { libelle: "Activer", type: "primaire", action: async () => {
        try { await auth.activerTOTP(champ.value, secret); return true; }
        catch (e) { erreur(e.message); return false; }
      } },
    ],
  });
  if (r) succes("Double authentification activée. Conservez la clé en lieu sûr.");
}

async function sauvegarder() {
  try {
    const sauvegarde = await store.exporterBase();
    const { telecharger } = await import("./core/export.js");
    const nom = `medistat-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
    telecharger(JSON.stringify(sauvegarde, null, 1), nom, "application/json");
    succes(`Sauvegarde produite : ${Object.values(sauvegarde.statistiques).reduce((a, b) => a + b, 0)} enregistrements.`);
  } catch (e) { erreur(e.message); }
}

async function restaurer() {
  const input = h("input", { type: "file", accept: ".json", hidden: true });
  document.body.appendChild(input);
  input.click();
  input.onchange = async () => {
    const fichier = input.files[0];
    input.remove();
    if (!fichier) return;
    if (!(await confirmer(
      "La restauration ajoutera les enregistrements de cette sauvegarde à la base actuelle.",
      { titre: "Restaurer une sauvegarde", detail: "Les enregistrements portant le même identifiant seront remplacés." }
    ))) return;
    try {
      const rapport = await store.restaurerBase(JSON.parse(await fichier.text()));
      succes(`Restauration : ${Object.values(rapport).reduce((a, b) => a + b, 0)} enregistrements.`);
      naviguer(etat.vueCourante || "tableau-de-bord", true);
    } catch (e) { erreur("Restauration impossible : " + e.message); }
  };
}

/* ===================== Notifications ===================== */

async function panneauNotifications() {
  let liste = [];
  try {
    liste = await store.depots.notifications.lister({
      filtre: n => !n._supprime && n.destinataireId === auth.utilisateurCourant()?.id,
      tri: (a, b) => (a.date < b.date ? 1 : -1),
      limite: 40,
    });
  } catch { /* le rôle n'a pas accès aux notifications */ }

  await modale({
    titre: "Notifications",
    largeur: "520px",
    contenu: liste.length
      ? h("div", liste.map(n => h("div.carte", {
          style: { marginBottom: "8px", padding: "11px",
            borderLeft: `3px solid ${n.priorite === "critique" ? "var(--critique)" : "var(--accent)"}` },
        }, [
          h("div", { style: { display: "flex", justifyContent: "space-between", gap: "10px" } }, [
            h("strong", { texte: n.sujet }),
            h("span.texte-secondaire", { texte: fmt.relatif(n.date) }),
          ]),
          h("div.texte-secondaire", { texte: n.message }),
        ])))
      : etatVide({ icone: "🔕", titre: "Aucune notification", message: "Vous êtes à jour." }),
    actions: [{ libelle: "Fermer", type: "neutre" }],
  });

  for (const n of liste.filter(x => !x.lue)) {
    try { await store.depots.notifications.modifier(n.id, { lue: true, dateLecture: new Date().toISOString() }); }
    catch { /* sans conséquence */ }
  }
  await rafraichirIndicateurs();
}

// Compteurs affichés dans la barre et la navigation
async function rafraichirIndicateurs() {
  const u = auth.utilisateurCourant();
  if (!u) return;
  try {
    const notifs = (await store.lireTout("notifications"))
      .filter(n => n.destinataireId === u.id && !n.lue && !n._supprime);
    const compteur = $("#compteurNotifications");
    compteur.textContent = String(notifs.length);
    compteur.hidden = notifs.length === 0;

    if (hasPermission(u.role, "resultat", "validation")) {
      const attente = (await store.lireTout("resultats"))
        .filter(r => r.statut === "saisi" && !r._supprime &&
          (!r.etablissementId || r.etablissementId === u.etablissementId));
      const badge = $("#badgeValidation");
      badge.textContent = String(attente.length);
      badge.hidden = attente.length === 0;
    }

    // Alerte immédiate sur les valeurs critiques non acquittées (article 13)
    const critiques = (await store.lireTout("resultats")).filter(r =>
      r.critique && !r.alerteAcquittee && !r._supprime &&
      (r.statut === "valide" || r.statut === "rendu") &&
      (!r.etablissementId || r.etablissementId === u.etablissementId));
    if (critiques.length && !etat.alerteCritiqueAffichee) {
      etat.alerteCritiqueAffichee = true;
      critique(
        `${critiques.length} résultat(s) à valeur critique nécessitent une alerte au prescripteur.`,
        { action: { libelle: "Voir les résultats", action: () => naviguer("demandes?critiques=1") } });
    }
  } catch { /* droits insuffisants : les compteurs restent masqués */ }
}

window.medistatRafraichirIndicateurs = rafraichirIndicateurs;

/* ===================== Service worker ===================== */

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // L'enregistrement échoue en file:// : l'application reste utilisable,
      // simplement sans fonctionnement hors ligne ni installation.
    });
  });
}

demarrer();
