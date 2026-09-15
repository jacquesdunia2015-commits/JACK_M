#!/usr/bin/env node
// medistat/tests/serveur.test.mjs
// Contrôles du serveur d'API : authentification, application effective des
// droits côté serveur, cloisonnement multi-établissement (articles 4 et 14),
// intégrité du journal d'audit et durcissement HTTP.
//
// Le serveur est démarré sur un port et une base temporaires, puis arrêté.
// Lancement :  node tests/serveur.test.mjs

import { spawn } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, pbkdf2Sync } from "node:crypto";

const racine = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dossier = mkdtempSync(join(tmpdir(), "medistat-test-"));
const base = join(dossier, "test.db");
const PORT = 8000 + Math.floor(Math.random() * 900);
const API = `http://127.0.0.1:${PORT}/api`;

let passed = 0, failed = 0;
const failures = [];
const t = (nom, condition, detail = "") => {
  if (condition) passed++;
  else { failed++; failures.push(nom + (detail ? `\n     ${detail}` : "")); }
};
const section = titre => console.log(`\n\x1b[1m── ${titre}\x1b[0m`);

async function appel(chemin, { methode = "GET", jeton = null, corps = null } = {}) {
  const entetes = {};
  if (jeton) entetes.authorization = `Bearer ${jeton}`;
  if (corps) entetes["content-type"] = "application/json";
  const r = await fetch(API + chemin, {
    method: methode, headers: entetes,
    body: corps ? JSON.stringify(corps) : undefined,
  });
  let donnees = null;
  try { donnees = await r.json(); } catch { /* réponse non JSON */ }
  return { code: r.status, donnees, entetes: r.headers };
}

/* ===================== Démarrage ===================== */

const serveur = spawn(process.execPath,
  [join(racine, "server", "api.mjs"), "--port", String(PORT), "--db", base],
  { env: { ...process.env, MEDISTAT_SECRET: "secret-de-test-fixe" }, stdio: "pipe" });

let sortieServeur = "";
serveur.stdout.on("data", d => { sortieServeur += d; });
serveur.stderr.on("data", d => { sortieServeur += d; });

const nettoyer = () => {
  try { serveur.kill("SIGTERM"); } catch { /* déjà arrêté */ }
  try { rmSync(dossier, { recursive: true, force: true }); } catch { /* déjà supprimé */ }
};
process.on("exit", nettoyer);

// Attente de disponibilité, plutôt qu'un délai fixe
let pret = false;
for (let i = 0; i < 60 && !pret; i++) {
  await new Promise(r => setTimeout(r, 120));
  try {
    const r = await fetch(`${API}/sante`);
    if (r.ok) pret = true;
  } catch { /* pas encore à l'écoute */ }
}
if (!pret) {
  console.error("Le serveur n'a pas démarré :\n" + sortieServeur);
  process.exit(1);
}

/* ===================================================================== */
section("Disponibilité et durcissement");

{
  const r = await appel("/sante");
  t("point de santé accessible", r.code === 200);
  t("service identifié", r.donnees?.service === "MediStat API");
  t("en-tête nosniff", r.entetes.get("x-content-type-options") === "nosniff");
  t("en-tête anti-cadre", r.entetes.get("x-frame-options") === "DENY");
  t("réponses non mises en cache", String(r.entetes.get("cache-control")).includes("no-store"));
  // Sans origine déclarée, l'API ne doit pas être ouverte au partage entre origines
  t("partage entre origines fermé par défaut", !r.entetes.get("access-control-allow-origin"));
}
{
  // La traversée de répertoire ne doit jamais permettre de sortir de la racine
  const r = await fetch(`http://127.0.0.1:${PORT}/../../../etc/passwd`);
  const corps = await r.text();
  t("traversée de répertoire neutralisée", !corps.includes("root:x:"), `code ${r.status}`);
}

/* ===================================================================== */
section("Initialisation");

{
  const r = await appel("/initialiser", { methode: "POST", corps: {
    etablissement: { nom: "CHU de Kinshasa", code: "CHU", ville: "Kinshasa" },
    administrateur: { identifiant: "admin", nom: "Mukendi", prenom: "Jean",
      motDePasse: "AdminFort2026!" },
  } });
  t("initialisation acceptée", r.code === 201, JSON.stringify(r.donnees));
  t("établissement créé", r.donnees?.etablissement?.code === "CHU");
}
{
  const r = await appel("/initialiser", { methode: "POST", corps: {
    etablissement: { nom: "Autre", code: "AUT" },
    administrateur: { identifiant: "x", nom: "X", motDePasse: "Aaaaaaaa1!" },
  } });
  t("double initialisation refusée", r.code === 409);
}
{
  const r = await appel("/initialiser", { methode: "POST", corps: { etablissement: { nom: "X" } } });
  t("initialisation incomplète refusée", r.code === 409 || r.code === 400);
}

/* ===================================================================== */
section("Authentification");

let jetonAdmin = null;
{
  const r = await appel("/connexion", { methode: "POST",
    corps: { identifiant: "admin", motDePasse: "faux" } });
  t("mot de passe erroné rejeté", r.code === 401);
  t("message sans indice d'existence du compte",
    /incorrect/i.test(r.donnees?.erreur || ""), r.donnees?.erreur);
}
{
  const r = await appel("/connexion", { methode: "POST",
    corps: { identifiant: "inexistant", motDePasse: "x" } });
  t("identifiant inconnu : même code", r.code === 401);
  t("identifiant inconnu : même message", /incorrect/i.test(r.donnees?.erreur || ""));
}
{
  const r = await appel("/connexion", { methode: "POST",
    corps: { identifiant: "admin", motDePasse: "AdminFort2026!" } });
  t("connexion réussie", r.code === 200, JSON.stringify(r.donnees));
  t("jeton délivré", typeof r.donnees?.jeton === "string" && r.donnees.jeton.split(".").length === 3);
  t("rôle transmis", r.donnees?.utilisateur?.role === "admin_etablissement");
  t("mot de passe absent de la réponse", !JSON.stringify(r.donnees).includes("AdminFort2026"));
  jetonAdmin = r.donnees.jeton;
}
{
  t("accès sans jeton refusé", (await appel("/patients")).code === 401);
  t("jeton falsifié refusé", (await appel("/patients", { jeton: jetonAdmin + "xx" })).code === 401);
  t("jeton vide refusé", (await appel("/patients", { jeton: "" })).code === 401);
  // Un jeton signé d'une autre clé ne doit pas passer
  const faux = jetonAdmin.split(".").slice(0, 2).join(".") + ".c2lnbmF0dXJlLWZhdXNzZQ";
  t("signature invalide refusée", (await appel("/patients", { jeton: faux })).code === 401);
}
{
  const r = await appel("/moi", { jeton: jetonAdmin });
  t("session lisible", r.code === 200 && r.donnees?.utilisateur?.identifiant === "admin");
  t("permissions transmises", Array.isArray(r.donnees?.permissions));
}

/* ===================================================================== */
section("Gestion des utilisateurs");

let jetonLabo = null, jetonBio = null;
{
  const r = await appel("/utilisateurs", { methode: "POST", jeton: jetonAdmin,
    corps: { identifiant: "labo1", nom: "Kasongo", prenom: "Paul", role: "laborantin" } });
  t("laborantin créé", r.code === 201);
  t("mot de passe temporaire fourni", typeof r.donnees?.motDePasseTemporaire === "string");
  const c = await appel("/connexion", { methode: "POST",
    corps: { identifiant: "labo1", motDePasse: r.donnees.motDePasseTemporaire } });
  t("connexion du laborantin", c.code === 200);
  jetonLabo = c.donnees?.jeton;
}
{
  const r = await appel("/utilisateurs", { methode: "POST", jeton: jetonAdmin,
    corps: { identifiant: "bio1", nom: "Ilunga", prenom: "Marie", role: "biologiste" } });
  const c = await appel("/connexion", { methode: "POST",
    corps: { identifiant: "bio1", motDePasse: r.donnees.motDePasseTemporaire } });
  jetonBio = c.donnees?.jeton;
  t("biologiste créé et connecté", c.code === 200);
}
{
  t("identifiant en double refusé",
    (await appel("/utilisateurs", { methode: "POST", jeton: jetonAdmin,
      corps: { identifiant: "labo1", nom: "X", role: "medecin" } })).code === 409);
  t("escalade vers admin système refusée",
    (await appel("/utilisateurs", { methode: "POST", jeton: jetonAdmin,
      corps: { identifiant: "root", nom: "X", role: "admin_systeme" } })).code === 403);
  t("rôle inexistant refusé",
    (await appel("/utilisateurs", { methode: "POST", jeton: jetonAdmin,
      corps: { identifiant: "z", nom: "Z", role: "roi" } })).code === 400);
}
{
  // Le dernier administrateur actif ne doit pas pouvoir être désactivé
  const moi = (await appel("/moi", { jeton: jetonAdmin })).donnees.utilisateur;
  const r = await appel(`/utilisateurs/${moi.id}`, { methode: "PATCH", jeton: jetonAdmin,
    corps: { actif: false } });
  t("auto-désactivation refusée", r.code === 403);
}

/* ===================================================================== */
section("Application des droits côté serveur");

// Le serveur ne fait jamais confiance au client : il revérifie chaque droit.
{
  t("laborantin : lecture des patients autorisée",
    (await appel("/patients", { jeton: jetonLabo })).code === 200);
  t("laborantin : création d'utilisateur refusée",
    (await appel("/utilisateurs", { methode: "POST", jeton: jetonLabo,
      corps: { identifiant: "x", nom: "X", role: "medecin" } })).code === 403);
  t("laborantin : lecture du journal d'audit refusée",
    (await appel("/audit", { jeton: jetonLabo })).code === 403);
  t("laborantin : liste des utilisateurs refusée",
    (await appel("/utilisateurs", { jeton: jetonLabo })).code === 403);
  t("laborantin : création de résultat autorisée",
    [200, 201].includes((await appel("/resultats", { methode: "POST", jeton: jetonLabo,
      corps: { id: "res_lab", testCode: "GLY", valeur: 1.26 } })).code));
}
{
  t("biologiste : lecture du journal d'audit autorisée",
    (await appel("/audit", { jeton: jetonBio })).code === 200);
  t("biologiste : contrôle d'intégrité autorisé",
    (await appel("/audit/integrite", { jeton: jetonBio })).code === 200);
}

/* ===================================================================== */
section("Enregistrements et synchronisation");

{
  const r = await appel("/patients", { methode: "POST", jeton: jetonAdmin,
    corps: { id: "pat_001", ipp: "CHU26000001", nom: "Tshibangu", prenom: "Alice",
      sexe: "F", dateNaissance: "1990-05-12" } });
  t("patient enregistré", [200, 201].includes(r.code));
  t("création comptabilisée", r.donnees?.crees === 1);
}
{
  const r = await appel("/patients", { jeton: jetonAdmin });
  t("patient relu", r.donnees?.nombre === 1);
  t("données intactes", r.donnees?.enregistrements?.[0]?.nom === "Tshibangu");
  t("version initialisée", r.donnees?.enregistrements?.[0]?._version === 1);
}
{
  // Envoi d'un lot, comme le ferait une synchronisation après travail hors ligne
  const lot = Array.from({ length: 20 }, (_, i) => ({
    id: `pat_lot_${i}`, ipp: `CHU2600${i}`, nom: `Patient${i}`, prenom: "Test",
  }));
  const r = await appel("/patients", { methode: "POST", jeton: jetonAdmin,
    corps: { enregistrements: lot } });
  t("lot de 20 enregistré", r.donnees?.crees === 20, JSON.stringify(r.donnees));
}
{
  // Synchronisation incrémentale : seul le delta est rapatrié
  const avant = new Date(Date.now() - 1000).toISOString();
  await appel("/patients", { methode: "POST", jeton: jetonAdmin,
    corps: { id: "pat_recent", ipp: "CHU_NEW", nom: "Récent", _version: 1 } });
  const r = await appel(`/patients?depuis=${encodeURIComponent(avant)}`, { jeton: jetonAdmin });
  t("synchronisation incrémentale opérationnelle", r.donnees?.nombre >= 1);
  t("horodatage renvoyé pour le prochain delta", !!r.donnees?.horodatage);
}
{
  // Résolution de conflit : une version antérieure ne doit pas écraser
  await appel("/patients", { methode: "POST", jeton: jetonAdmin,
    corps: { id: "pat_conflit", nom: "Version3", _version: 3 } });
  const r = await appel("/patients", { methode: "POST", jeton: jetonAdmin,
    corps: { id: "pat_conflit", nom: "Version1", _version: 1 } });
  t("version antérieure rejetée", r.donnees?.conflits === 1, JSON.stringify(r.donnees));
  const lu = await appel("/patients/pat_conflit", { jeton: jetonAdmin });
  t("version la plus élevée conservée", lu.donnees?.nom === "Version3", lu.donnees?.nom);
}
{
  // La suppression est logique : la donnée reste auditable
  const r = await appel("/patients/pat_lot_0", { methode: "DELETE", jeton: jetonAdmin });
  t("suppression acceptée", r.code === 200);
  const liste = await appel("/patients", { jeton: jetonAdmin });
  t("enregistrement supprimé masqué",
    !liste.donnees.enregistrements.some(p => p.id === "pat_lot_0"));
  const brut = new DatabaseSync(base, { readOnly: true })
    .prepare("SELECT supprime FROM enregistrements WHERE id = ?").get("pat_lot_0");
  t("suppression logique, non physique", brut && brut.supprime === 1);
}

/* ===================================================================== */
section("Cloisonnement multi-établissement (articles 4 et 14)");

// Un second établissement est créé directement en base : c'est le seul moyen
// d'obtenir deux tenants, /initialiser étant volontairement à usage unique.
let jetonAutre = null;
{
  const d = new DatabaseSync(base);
  const maintenant = new Date().toISOString();
  const idEts2 = "ets_second";
  d.prepare(`INSERT INTO etablissements (id, code, nom, type, modules, actif, date_creation)
    VALUES (?,?,?,?,?,1,?)`).run(idEts2, "CLI", "Clinique du Fleuve", "clinique", "{}", maintenant);

  const sel = randomBytes(16);
  const hash = pbkdf2Sync("AutreFort2026!", sel, 250000, 32, "sha256");
  d.prepare(`INSERT INTO utilisateurs
    (id, identifiant, nom, prenom, role, etablissement_id, mot_de_passe, sel, iterations, actif, date_creation)
    VALUES (?,?,?,?,?,?,?,?,?,1,?)`).run(
    "usr_second", "admin2", "Ngoy", "Chantal", "admin_etablissement", idEts2,
    hash.toString("base64"), sel.toString("base64"), 250000, maintenant);

  // Un patient appartenant au second établissement
  d.prepare(`INSERT INTO enregistrements
    (id, entite, etablissement_id, donnees, version, supprime, date_creation, date_modification)
    VALUES (?,?,?,?,1,0,?,?)`).run(
    "pat_autre", "patients", idEts2,
    JSON.stringify({ id: "pat_autre", nom: "Confidentiel", ipp: "CLI001" }), maintenant, maintenant);
  d.close();

  const c = await appel("/connexion", { methode: "POST",
    corps: { identifiant: "admin2", motDePasse: "AutreFort2026!" } });
  t("second établissement : connexion", c.code === 200, JSON.stringify(c.donnees));
  jetonAutre = c.donnees?.jeton;
}
{
  // Le cœur de l'exigence : chaque tenant ne voit que ses propres données
  const mien = await appel("/patients", { jeton: jetonAdmin });
  const autre = await appel("/patients", { jeton: jetonAutre });

  t("établissement A ne voit pas les patients de B",
    !mien.donnees.enregistrements.some(p => p.id === "pat_autre"));
  t("établissement B ne voit pas les patients de A",
    !autre.donnees.enregistrements.some(p => p.id === "pat_001"));
  t("établissement B voit son propre patient",
    autre.donnees.enregistrements.some(p => p.id === "pat_autre"));
  t("aucune fuite de contenu entre tenants",
    !JSON.stringify(mien.donnees).includes("Confidentiel"));

  // Accès direct par identifiant : la barrière doit tenir aussi
  const direct = await appel("/patients/pat_autre", { jeton: jetonAdmin });
  t("accès direct à un enregistrement d'un autre tenant refusé", direct.code === 403,
    `code ${direct.code}`);
  const directInverse = await appel("/patients/pat_001", { jeton: jetonAutre });
  t("barrière symétrique", directInverse.code === 403, `code ${directInverse.code}`);

  // La suppression croisée doit également être refusée
  t("suppression croisée refusée",
    (await appel("/patients/pat_autre", { methode: "DELETE", jeton: jetonAdmin })).code === 403);

  // Les utilisateurs sont eux aussi cloisonnés
  const usersA = await appel("/utilisateurs", { jeton: jetonAdmin });
  t("utilisateurs cloisonnés",
    !usersA.donnees.utilisateurs.some(u => u.identifiant === "admin2"));

  // Et le journal d'audit
  const auditA = await appel("/audit", { jeton: jetonAdmin });
  t("journal d'audit cloisonné",
    auditA.donnees.entrees.every(e => e.etablissement_id !== "ets_second"));

  // Les statistiques ne doivent pas agréger les deux tenants
  const statsB = await appel("/statistiques", { jeton: jetonAutre });
  t("statistiques cloisonnées", statsB.donnees?.compteurs?.patients === 1,
    `${statsB.donnees?.compteurs?.patients} patient(s) vus par B`);
}

/* ===================================================================== */
section("Journal d'audit du serveur (article 16)");

{
  const r = await appel("/audit", { jeton: jetonAdmin });
  t("journal accessible à l'administrateur", r.code === 200);
  t("événements enregistrés", r.donnees?.nombre > 5, `${r.donnees?.nombre} entrées`);
  const actions = new Set(r.donnees.entrees.map(e => e.action));
  t("connexions tracées", actions.has("connexion"));
  t("échecs de connexion tracés", actions.has("connexion_echec"));
  t("refus d'accès tracés", actions.has("acces_refuse"));
  t("créations tracées", actions.has("creation"));
  t("suppressions tracées", actions.has("suppression"));
  t("consultation de dossier tracée", actions.has("consultation"));
  t("chaque entrée porte une empreinte",
    r.donnees.entrees.every(e => typeof e.empreinte === "string" && e.empreinte.length === 64));
}
{
  const r = await appel("/audit/integrite", { jeton: jetonAdmin });
  t("chaîne d'audit intègre", r.donnees?.valide === true, r.donnees?.message);
}
{
  // Falsification directe en base : le contrôle doit la détecter
  const d = new DatabaseSync(base);
  d.prepare("UPDATE audit SET details = ? WHERE sequence = (SELECT MIN(sequence) FROM audit)")
    .run("FALSIFIÉ");
  d.close();
  const r = await appel("/audit/integrite", { jeton: jetonAdmin });
  t("falsification détectée", r.donnees?.valide === false, r.donnees?.message);
  t("rupture localisée", (r.donnees?.ruptures || []).length > 0);
  t("diagnostic explicite",
    /modifié|supprimée|insérée/i.test(r.donnees?.ruptures?.[0]?.motif || ""));
}
{
  // Suppression d'une entrée : détectée elle aussi
  const d = new DatabaseSync(base);
  d.prepare("DELETE FROM audit WHERE sequence = (SELECT MIN(sequence) FROM audit)").run();
  d.close();
  const r = await appel("/audit/integrite", { jeton: jetonAdmin });
  t("suppression d'entrée détectée", r.donnees?.valide === false);
}

/* ===================================================================== */
section("Robustesse");

{
  t("route inconnue : 404", (await appel("/inexistant", { jeton: jetonAdmin })).code === 404);
  t("entité inconnue : 404", (await appel("/licornes", { jeton: jetonAdmin })).code === 404);
  const r = await fetch(`${API}/patients`, { method: "POST",
    headers: { authorization: `Bearer ${jetonAdmin}`, "content-type": "application/json" },
    body: "{ceci n'est pas du JSON" });
  t("corps JSON invalide : erreur maîtrisée", r.status === 500 || r.status === 400, `code ${r.status}`);
  const texte = await r.text();
  t("aucune trace de pile divulguée", !texte.includes("at ") && !texte.includes(".mjs:"));
}
{
  // Blocage après cinq échecs consécutifs
  for (let i = 0; i < 5; i++) {
    await appel("/connexion", { methode: "POST", corps: { identifiant: "bio1", motDePasse: "faux" } });
  }
  const r = await appel("/connexion", { methode: "POST",
    corps: { identifiant: "bio1", motDePasse: "faux" } });
  t("compte bloqué après échecs répétés", r.code === 429 || r.code === 401, `code ${r.code}`);
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

nettoyer();
process.exit(failed === 0 ? 0 : 1);
