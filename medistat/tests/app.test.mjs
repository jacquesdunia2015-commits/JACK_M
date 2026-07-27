#!/usr/bin/env node
// medistat/tests/app.test.mjs
// Contrôles de la couche applicative : sécurité, droits, cloisonnement
// multi-établissement, chiffrement au repos et intégrité du journal d'audit.
//
// Sous Node, IndexedDB n'existe pas : la couche de stockage bascule
// automatiquement en mémoire, ce qui rend ces contrôles exécutables hors
// navigateur. Lancement :  node tests/app.test.mjs

import * as crypto2 from "../js/core/crypto.js";
import * as model from "../js/core/model.js";
import * as store from "../js/core/store.js";
import * as auth from "../js/core/auth.js";

let passed = 0, failed = 0;
const failures = [];

const t = (nom, condition, detail = "") => {
  if (condition) passed++;
  else { failed++; failures.push(nom + (detail ? `\n     ${detail}` : "")); }
};
const check = (nom, got, exp) => t(nom, got === exp, `obtenu ${got}, attendu ${exp}`);
const section = titre => console.log(`\n\x1b[1m── ${titre}\x1b[0m`);
const doitEchouer = async (nom, fn, motif = "") => {
  try { await fn(); failed++; failures.push(`${nom} — l'opération aurait dû être refusée`); }
  catch (e) { t(nom, motif ? e.message.includes(motif) || e.name === motif : true, e.message); }
};

/* ===================================================================== */
section("Cryptographie");

{
  const clair = "Résultat : glycémie 1,26 g/L — patient Tshibangu";
  const env = await crypto2.encrypt(clair, "MotDePasseFort2026!");
  check("chiffrement/déchiffrement", await crypto2.decrypt(env, "MotDePasseFort2026!"), clair);
  await doitEchouer("mauvais mot de passe rejeté",
    () => crypto2.decrypt(env, "autre"), "Déchiffrement impossible");
  // AES-GCM authentifie : toute altération du cryptogramme est détectée
  await doitEchouer("altération du cryptogramme détectée",
    () => crypto2.decrypt({ ...env, donnees: env.donnees.slice(0, -4) + "AAAA" }, "MotDePasseFort2026!"));
  t("le cryptogramme ne laisse rien filtrer", !env.donnees.includes("glyc"));
}
{
  const h = await crypto2.hashPassword("Secret2026!");
  t("mot de passe vérifié", await crypto2.verifyPassword("Secret2026!", h));
  t("mot de passe erroné rejeté", !(await crypto2.verifyPassword("Secret2026", h)));
  t("le mot de passe n'est jamais stocké en clair", !JSON.stringify(h).includes("Secret2026"));
  check("nombre d'itérations PBKDF2", h.iterations, 250000);
}
{
  const j = await crypto2.signerJeton({ sub: "u1", role: "biologiste" }, "cle-serveur");
  check("jeton valide décodé", (await crypto2.verifierJeton(j, "cle-serveur")).role, "biologiste");
  check("jeton signé d'une autre clé rejeté", await crypto2.verifierJeton(j, "autre-cle"), null);
  const expire = await crypto2.signerJeton({ sub: "u1" }, "cle", -10);
  check("jeton expiré rejeté", await crypto2.verifierJeton(expire, "cle"), null);
}
{
  // Politique de mots de passe
  t("mot de passe robuste accepté", crypto2.evaluerMotDePasse("AdminFort2026!").acceptable);
  t("« password » refusé", !crypto2.evaluerMotDePasse("password").acceptable);
  t("« Password2026! » refusé (noyau courant)", !crypto2.evaluerMotDePasse("Password2026!").acceptable);
  t("suite de chiffres refusée", !crypto2.evaluerMotDePasse("12345678").acceptable);
  t("caractère répété refusé", !crypto2.evaluerMotDePasse("aaaaaaaaA1").acceptable);
}

/* ===================================================================== */
section("Signature électronique des résultats (article 6.3)");

{
  const r = { demandeId: "D1", patientId: "P1", testCode: "GLY", valeur: 1.26, unite: "g/L" };
  r.signature = await crypto2.signerResultat(
    r, { id: "u1", nom: "Ilunga", prenom: "Marie", role: "biologiste" }, "mdp");
  t("signature valide", (await crypto2.verifierSignature(r)).valide);
  // Falsification du résultat après signature
  const falsifie = { ...r, valeur: 0.9 };
  const v = await crypto2.verifierSignature(falsifie);
  t("modification après signature détectée", !v.valide);
  t("message d'alerte explicite", v.motif.includes("INVALIDE"));
  t("résultat non signé signalé",
    !(await crypto2.verifierSignature({ valeur: 1 })).valide);
}

/* ===================================================================== */
section("Chaîne d'audit inviolable (article 16)");

{
  const chaine = [];
  let prev = null;
  for (const action of ["connexion", "creation", "validation", "export"]) {
    const e = await crypto2.chainerAudit({
      date: new Date().toISOString(), utilisateurId: "u1",
      action, entite: "resultat", entiteId: "r1",
    }, prev);
    chaine.push(e); prev = e.empreinte;
  }
  t("chaîne intègre", (await crypto2.verifierChaineAudit(chaine)).valide);
  // Modification d'une entrée
  const modifiee = chaine.map((e, i) => (i === 1 ? { ...e, action: "suppression" } : e));
  const v1 = await crypto2.verifierChaineAudit(modifiee);
  t("modification d'une entrée détectée", !v1.valide);
  // Suppression d'une entrée
  const amputee = chaine.filter((_, i) => i !== 1);
  t("suppression d'une entrée détectée",
    !(await crypto2.verifierChaineAudit(amputee)).valide);
}

/* ===================================================================== */
section("Modèle : droits et cycle de vie");

t("biologiste peut valider", model.hasPermission("biologiste", "resultat", "validation"));
t("biologiste peut signer", model.hasPermission("biologiste", "resultat", "signature"));
t("laborantin ne peut PAS valider", !model.hasPermission("laborantin", "resultat", "validation"));
t("laborantin peut saisir", model.hasPermission("laborantin", "resultat", "creation"));
t("médecin peut prescrire", model.hasPermission("medecin", "prescription", "creation"));
t("médecin ne peut PAS valider un résultat", !model.hasPermission("medecin", "resultat", "validation"));
t("réceptionniste ne voit PAS les résultats", !model.hasPermission("receptionniste", "resultat", "lecture"));
t("comptable ne voit PAS les résultats", !model.hasPermission("comptable", "resultat", "lecture"));
t("qualité lit l'audit", model.hasPermission("qualite", "audit", "lecture"));
t("qualité ne modifie PAS les résultats", !model.hasPermission("qualite", "resultat", "modification"));
t("admin système a tous les droits", model.hasPermission("admin_systeme", "facture", "suppression"));
t("patient limité au portail", !model.hasPermission("patient", "patient", "lecture"));
t("patient accède à son portail", model.hasPermission("patient", "portail", "lecture"));

t("transition saisie → validée autorisée", model.transitionAutorisee("saisie", "validee"));
t("transition brouillon → validée INTERDITE", !model.transitionAutorisee("brouillon", "validee"));
t("correction d'un résultat rendu possible", model.transitionAutorisee("rendue", "en_analyse"));
t("aucune transition depuis annulée", !model.transitionAutorisee("annulee", "enregistree"));

/* ===================================================================== */
section("Modèle : identifiants et interprétation biologique");

{
  const cb = model.genererCodeBarre(42);
  t("code-barres valide (clé de Luhn)", model.verifierCodeBarre(cb));
  const altere = cb.slice(0, -1) + ((Number(cb.slice(-1)) + 1) % 10);
  t("code-barres altéré rejeté", !model.verifierCodeBarre(altere));
  t("code-barres mal formé rejeté", !model.verifierCodeBarre("ABC"));
}
{
  const test = { valeurRefMin: 0.7, valeurRefMax: 1.1, seuilCritiqueMin: 0.4,
    seuilCritiqueMax: 3, unite: "g/L", type: "numerique" };
  check("valeur normale", model.interpreterResultat(0.9, test).statut, "normal");
  check("valeur basse", model.interpreterResultat(0.6, test).statut, "bas");
  check("valeur haute", model.interpreterResultat(1.5, test).statut, "haut");
  check("valeur critique haute", model.interpreterResultat(3.5, test).statut, "critique_haut");
  check("valeur critique basse", model.interpreterResultat(0.3, test).statut, "critique_bas");
  t("alerte critique déclenchée", model.interpreterResultat(3.5, test).critique);
  t("valeur normale sans alerte", !model.interpreterResultat(0.9, test).critique);
  t("valeur non numérique gérée", model.interpreterResultat("indosable", test).statut === "non_evaluable");
}
{
  check("âge en années", model.calculerAge("2000-01-15", new Date("2026-07-27")).annees, 26);
  t("nourrisson exprimé en mois",
    model.calculerAge("2025-10-27", new Date("2026-07-27")).label.includes("mois"));
  const d = model.calculerDelta(2.0, 1.0);
  check("variation en pourcentage", d.pourcentage, 100);
  t("variation forte signalée", d.aVerifier);
  t("variation faible non signalée", !model.calculerDelta(1.05, 1.0).aVerifier);
}
{
  const err = model.VALIDATEURS.patient({ nom: "", prenom: "A", dateNaissance: "2050-01-01", sexe: "X" });
  t("validation patient : nom manquant détecté", err.some(e => e.includes("nom")));
  t("validation patient : date future détectée", err.some(e => e.includes("postérieure")));
  t("validation patient : sexe invalide détecté", err.some(e => e.includes("sexe")));
  check("patient valide sans erreur",
    model.VALIDATEURS.patient({ nom: "A", prenom: "B", dateNaissance: "1990-01-01", sexe: "F" }).length, 0);
}

/* ===================================================================== */
section("Session, droits et cloisonnement");

t("initialisation requise au premier lancement", await auth.besoinInitialisation());
const init = await auth.initialiser({
  etablissement: { code: "CHU", nom: "CHU de Kinshasa", ville: "Kinshasa", pays: "RDC" },
  administrateur: { identifiant: "admin", nom: "Mukendi", prenom: "Jean",
    motDePasse: "AdminFort2026!", email: "admin@chu.cd" },
});
check("établissement créé", init.etablissement.nom, "CHU de Kinshasa");
t("initialisation non répétable", !(await auth.besoinInitialisation()));
await doitEchouer("double initialisation refusée",
  () => auth.initialiser({ etablissement: { nom: "X" }, administrateur: { identifiant: "y", motDePasse: "Aa1!aaaaaaa" } }));

await doitEchouer("mot de passe erroné rejeté",
  () => auth.connexion("admin", "mauvais"), "incorrect");
await doitEchouer("identifiant inconnu rejeté (même message)",
  () => auth.connexion("inexistant", "x"), "incorrect");

await auth.connexion("admin", "AdminFort2026!");
t("session ouverte", auth.estConnecte());
check("rôle attribué", auth.utilisateurCourant().role, "admin_etablissement");

const bio = await auth.creerUtilisateur({ identifiant: "biologiste1", nom: "Ilunga", prenom: "Marie", role: "biologiste" });
const lab = await auth.creerUtilisateur({ identifiant: "labo1", nom: "Kasongo", prenom: "Paul", role: "laborantin" });
check("mot de passe temporaire généré", bio.motDePasseTemporaire.length, 12);
await doitEchouer("identifiant en double refusé",
  () => auth.creerUtilisateur({ identifiant: "labo1", nom: "X", role: "medecin" }), "déjà utilisé");
await doitEchouer("escalade de privilèges refusée",
  () => auth.creerUtilisateur({ identifiant: "root", nom: "Y", role: "admin_systeme" }), "administrateur système");
await doitEchouer("auto-désactivation refusée",
  () => auth.activerUtilisateur(auth.utilisateurCourant().id, false), "votre propre compte");
await doitEchouer("auto-modification de rôle refusée",
  () => auth.modifierRole(auth.utilisateurCourant().id, "medecin"), "votre propre rôle");

/* ===================================================================== */
section("Chiffrement des données de santé au repos (article 9)");

const patient = await store.depots.patients.creer({
  ipp: "CHU26000001", nom: "Tshibangu", prenom: "Alice", dateNaissance: "1990-05-12",
  sexe: "F", telephone: "+243900000000", antecedents: "Diabète de type 2",
  allergies: "Pénicilline",
});
t("patient enregistré", !!patient.id);
{
  const relu = await store.depots.patients.obtenir(patient.id);
  check("antécédents déchiffrés à la lecture", relu.antecedents, "Diabète de type 2");
  check("allergies déchiffrées à la lecture", relu.allergies, "Pénicilline");
  // Lecture brute, sans passer par le dépôt : les champs doivent être chiffrés
  const brut = await store.lire("patients", patient.id);
  t("antécédents absents en clair", brut.antecedents === undefined);
  t("enveloppe chiffrée présente", !!brut._chiffre?.antecedents);
  t("aucune donnée de santé lisible au repos",
    !JSON.stringify(brut).includes("Diabète") && !JSON.stringify(brut).includes("Pénicilline"));
  // Le nom reste en clair : il est indispensable à la recherche
  check("nom conservé en clair pour la recherche", brut.nom, "Tshibangu");
  check("recherche opérationnelle",
    (await store.depots.patients.rechercher("tshibangu", ["nom"])).length, 1);
}

/* ===================================================================== */
section("Contrôle d'accès effectif");

await auth.deconnexion();
await auth.connexion("labo1", lab.motDePasseTemporaire);
t("laborantin peut saisir un résultat", auth.autorise("resultat", "creation"));
t("laborantin ne peut PAS valider", !auth.autorise("resultat", "validation"));
await doitEchouer("création d'utilisateur refusée au laborantin",
  () => store.depots.utilisateurs.creer({ nom: "X" }), "ErreurPermission");
await doitEchouer("suppression de patient refusée au laborantin",
  () => store.depots.patients.supprimer(patient.id), "ErreurPermission");

await auth.deconnexion();
await auth.connexion("biologiste1", bio.motDePasseTemporaire);
t("biologiste peut valider", auth.autorise("resultat", "validation"));
t("biologiste peut signer", auth.autorise("resultat", "signature"));

/* ===================================================================== */
section("Blocage après tentatives répétées");

await auth.deconnexion();
for (let i = 0; i < 5; i++) {
  try { await auth.connexion("labo1", "faux"); } catch { /* attendu */ }
}
await doitEchouer("compte bloqué après 5 échecs",
  () => auth.connexion("labo1", lab.motDePasseTemporaire), "bloqué");

/* ===================================================================== */
section("Journal d'audit en conditions réelles");

await auth.connexion("admin", "AdminFort2026!");
{
  const v = await store.verifierAudit();
  t("journal intègre après un scénario complet", v.valide, v.message);
  const entrees = await store.lireTout("audit");
  t("volume d'événements tracés", entrees.length > 15, `${entrees.length} entrées`);
  t("connexions tracées", entrees.some(e => e.action === "connexion"));
  t("échecs de connexion tracés", entrees.some(e => e.action === "connexion_echec"));
  t("refus d'accès tracés", entrees.some(e => e.action === "acces_refuse"));
  t("créations tracées", entrees.some(e => e.action === "creation"));
  t("aucune donnée de santé en clair dans l'audit",
    !JSON.stringify(entrees).includes("Diabète"));

  // Falsification directe de la base : elle doit être détectée
  const cible = entrees.find(e => e.action === "creation");
  await store.ecrire("audit", { ...cible, details: "FALSIFIÉ" });
  const v2 = await store.verifierAudit();
  t("falsification du journal détectée", !v2.valide && v2.ruptures.length > 0, v2.message);
  t("rupture localisée précisément", Number.isInteger(v2.ruptures[0].index));
}

/* ===================================================================== */
section("Double authentification (RFC 6238)");

{
  const secret = auth.genererSecretTOTP();
  const code = await auth.calculerTOTP(secret);
  t("code à 6 chiffres", /^\d{6}$/.test(code));
  t("code courant accepté", await auth.verifierTOTP(secret, code));
  // Tolérance d'une fenêtre de 30 secondes de part et d'autre
  const pas = Math.floor(Date.now() / 30000);
  t("fenêtre précédente tolérée", await auth.verifierTOTP(secret, await auth.calculerTOTP(secret, pas - 1)));
  t("fenêtre trop ancienne rejetée", !(await auth.verifierTOTP(secret, await auth.calculerTOTP(secret, pas - 5))));
  t("URL d'appairage conforme", auth.urlTOTP(secret, "admin", "CHU").startsWith("otpauth://totp/"));
}

/* ===================================================================== */
section("Sauvegarde et restauration (article 20)");

{
  const sauvegarde = await store.exporterBase();
  check("format de sauvegarde", sauvegarde.format, "medistat-sauvegarde");
  t("patients inclus", sauvegarde.donnees.patients.length >= 1);
  t("statistiques fournies", typeof sauvegarde.statistiques.patients === "number");
  await store.vider("patients");
  check("base vidée", (await store.lireTout("patients")).length, 0);
  const rapport = await store.restaurerBase(sauvegarde);
  t("patients restaurés", rapport.patients >= 1);
  check("données récupérées", (await store.lireTout("patients")).length, rapport.patients);
  await doitEchouer("fichier étranger refusé",
    () => store.restaurerBase({ format: "autre" }), "non reconnu");
}

/* ===================================================================== */
console.log(`\n${"═".repeat(62)}`);
if (failed === 0) {
  console.log(`\x1b[32m✓ ${passed} contrôles réussis, aucun échec.\x1b[0m`);
} else {
  console.log(`\x1b[31m✗ ${failed} échec(s) sur ${passed + failed} contrôles :\x1b[0m`);
  failures.forEach((f, i) => console.log(`\n  ${i + 1}. ${f}`));
}
console.log(`${"═".repeat(62)}\n`);
process.exit(failed === 0 ? 0 : 1);
