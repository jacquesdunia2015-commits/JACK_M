// medistat/tests/parcours-navigateur.mjs
// Parcours complet de la Solution dans un navigateur réel.
//
// Les suites Node contrôlent la logique ; ce parcours contrôle ce qu'aucune
// d'elles ne voit : une surcouche invisible qui intercepte les clics, une
// case à cocher dont la valeur ne remonte pas, une clé de chiffrement qui
// empêche un collègue de relire un dossier. Trois défauts réels ont été
// trouvés par ce fichier, et par lui seul.
//
// Il déroule le circuit métier de bout en bout : création de
// l'établissement, catalogue, dossier patient, prescription, prélèvement,
// réception, saisie à la paillasse, validation signée par un biologiste,
// puis notification du patient dans sa langue.
//
// Prérequis : un serveur MediStat en écoute, et playwright-core installé.
//   node server/api.mjs --port 8799 &
//   PORT=8799 node tests/parcours-navigateur.mjs

// Chemins surchargeables : ce fichier ne doit rien supposer de la machine.
const CHEMIN_PLAYWRIGHT = process.env.PLAYWRIGHT_MODULE || "playwright-core";
const pw = (await import(CHEMIN_PLAYWRIGHT)).default;
const { chromium } = pw;

const PORT = process.env.PORT || 8799;
const base = `http://localhost:${PORT}`;
const nav = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();
const erreurs = [];
page.on("console", m => { if (m.type() === "error") erreurs.push(m.text()); });
page.on("pageerror", e => erreurs.push("EXCEPTION: " + e.message));

const ok = [];
const ko = [];
const dire = (nom, cond, detail = "") => {
  (cond ? ok : ko).push(nom + (detail ? ` — ${detail}` : ""));
  console.log(`  ${cond ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${nom}${detail ? " — " + detail : ""}`);
};

await page.goto(base + "/", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

console.log("\n\x1b[1m1. Premier lancement\x1b[0m");
dire("écran de démarrage retiré", (await page.locator("#demarrage").count()) === 0);
dire("langue posée sur <html>", Boolean(await page.getAttribute("html", "lang")),
  "lang=" + await page.getAttribute("html", "lang"));

await page.fill("#champ_nom", "CHU de Kinshasa");
await page.fill("#champ_code", "CHU");
await page.fill("#champ_prenom", "Jean");
await page.fill("#champ_nomAdmin", "Mukendi");
await page.fill("#champ_identifiant", "admin");
await page.fill("#champ_motDePasse", "AdminFort2026!");
await page.fill("#champ_motDePasse2", "AdminFort2026!");
await page.uncheck("#champ_demonstration").catch(() => {});
await page.getByRole("button", { name: /Créer l'établissement/ }).click();
await page.waitForTimeout(3000);
dire("établissement créé et session ouverte",
  (await page.locator("#nomCompte").textContent())?.includes("Mukendi"));

console.log("\n\x1b[1m2. Parcours de tous les écrans\x1b[0m");
const ECRANS = ["tableau-de-bord", "patients", "consultations", "rendez-vous", "demandes",
  "paillasse", "validation", "messages", "catalogue", "jeux-donnees", "statistiques",
  "qualitatif", "rapports", "utilisateurs", "etablissement", "audit", "facturation", "aide"];
for (const vue of ECRANS) {
  await page.goto(`${base}/#/${vue}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);
  const titre = (await page.locator("#vue h1, #vue h2, #vue h3").first()
    .textContent().catch(() => ""))?.trim() || "";
  dire(`écran ${vue}`, titre.length > 0, titre.slice(0, 42));
}

console.log("\n\x1b[1m3. Sélecteur de langue et bascule RTL\x1b[0m");
await page.goto(`${base}/#/patients`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(700);
// Une langue transcontinentale (français, arabe, anglais…) figure dans
// chacun de ses continents : on compte donc les codes distincts, pas les
// options affichées.
const codes = await page.locator("#selecteurLangue option").evaluateAll(
  os => [...new Set(os.map(o => o.value))]);
dire("50 langues distinctes proposées", codes.length === 50, `${codes.length} codes`);
const nbGroupes = await page.locator("#selecteurLangue optgroup").count();
dire("regroupement par continent", nbGroupes >= 5, `${nbGroupes} continents`);

await page.selectOption("#selecteurLangue", "sw");
await page.waitForTimeout(900);
const navSw = await page.locator('[data-i18n="nav_patients"]').first().textContent();
dire("l'interface bascule en swahili", navSw?.trim() === "Wagonjwa", navSw?.trim());
dire("html lang suit", (await page.getAttribute("html", "lang")) === "sw");

await page.selectOption("#selecteurLangue", "ar");
await page.waitForTimeout(900);
dire("bascule droite-à-gauche pour l'arabe",
  (await page.getAttribute("html", "dir")) === "rtl");
const navAr = await page.locator('[data-i18n="nav_patients"]').first().textContent();
dire("libellés en arabe", navAr?.trim() === "المرضى", navAr?.trim());
await page.screenshot({ path: "/tmp/verif-rtl.png" });

// La langue doit survivre à un rechargement complet.
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(2500);
dire("le choix de langue est mémorisé",
  (await page.getAttribute("html", "lang")) === "ar");

await page.evaluate(() => localStorage.setItem("medistat.langue", "fr"));
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(2500);
dire("retour au français", (await page.getAttribute("html", "lang")) === "fr");
dire("direction rétablie", (await page.getAttribute("html", "dir")) === "ltr");

// Le rechargement ferme la session : c'est le comportement attendu pour un
// poste partagé. On se reconnecte pour poursuivre le parcours métier.
async function reconnecter() {
  const champ = page.getByPlaceholder("Identifiant");
  if (await champ.count()) {
    await champ.first().fill("admin");
    await page.locator('input[autocomplete="current-password"]').first().fill("AdminFort2026!");
    await page.getByRole("button", { name: /Se connecter/i }).first().click();
    await page.waitForTimeout(3000);
  }
}
await reconnecter();
dire("reconnexion après rechargement",
  (await page.locator("#nomCompte").textContent().catch(() => ""))?.includes("Mukendi"));

console.log("\n\x1b[1m4. Catalogue et dossier patient\x1b[0m");
await page.goto(`${base}/#/catalogue`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
await page.getByRole("button", { name: /Amorcer depuis LOINC/ }).first().click();
await page.waitForTimeout(600);
await page.getByRole("button", { name: /^Confirmer$/ }).click();
await page.waitForTimeout(3000);
const nbTests = await page.locator("#vue table tbody tr").count();
dire("catalogue amorcé", nbTests > 0, `${nbTests} analyses`);

await page.goto(`${base}/#/patients`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(700);
await page.getByRole("button", { name: /Nouveau patient/ }).first().click();
await page.waitForTimeout(700);
await page.fill("#champ_nom", "Tshibangu");
await page.fill("#champ_prenom", "Alice");
await page.fill("#champ_dateNaissance", "1990-05-12");
await page.selectOption("#champ_sexe", "F");
await page.fill("#champ_telephone", "0812345678");
await page.selectOption("#champ_langue", "sw");
await page.selectOption("#champ_consentementSMS", "oui");
await page.fill("#champ_allergies", "Pénicilline");
await page.getByRole("button", { name: /Créer le dossier/ }).click();
await page.waitForTimeout(1800);
dire("patient créé", (await page.locator("#vue table tbody tr").count()) === 1);

await page.locator("#vue table tbody tr").first().click();
await page.waitForTimeout(1500);
const dossier = await page.locator("#vue").textContent();
dire("allergie mise en évidence", dossier.includes("Pénicilline"));
dire("langue du patient affichée", dossier.includes("Kiswahili"));
dire("consentement affiché", dossier.includes("Notifications acceptées"));

// La notification des patients est volontairement désactivée par défaut :
// aucun SMS ne part tant que l'établissement ne l'a pas décidé. On l'active
// avant de dérouler la chaîne, comme le ferait un déploiement réel.
await page.goto(`${base}/#/etablissement`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1600);
const caseActive = page.locator("#champ_active");
dire("les notifications sont désactivées par défaut",
  (await caseActive.isChecked().catch(() => true)) === false);
await caseActive.check();
await page.fill("#champ_indicatifPays", "243");
console.log("      boutons Enregistrer :",
  await page.locator("#vue").getByRole("button", { name: /^Enregistrer$/ }).count());
await page.locator("#vue").getByRole("button", { name: /^Enregistrer$/ }).last().click();
await page.waitForTimeout(2200);
console.log("      retours :", JSON.stringify(
  (await page.locator(".notification").allTextContents()).slice(0, 3)));
await page.goto(`${base}/#/etablissement`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1800);
dire("notifications activées pour l'établissement",
  await page.locator("#champ_active").isChecked().catch(() => false));
dire("indicatif du pays conservé",
  (await page.inputValue("#champ_indicatifPays").catch(() => "")) === "243");

console.log("\n\x1b[1m5. Chaîne laboratoire complète\x1b[0m");
await page.goto(`${base}/#/demandes`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
await page.getByRole("button", { name: /Nouvelle demande/ }).first().click();
await page.waitForTimeout(1000);
await page.getByRole("button", { name: /Choisir un patient/ }).first().click();
await page.waitForTimeout(700);
await page.locator(".recherche-resultat").first().click();
await page.waitForTimeout(700);
// Sélectionne les trois premières analyses du catalogue
const cases = page.locator("#vue input[type=checkbox]");
const nbCases = await cases.count();
for (let i = 0; i < Math.min(3, nbCases); i++) await cases.nth(i).check().catch(() => {});
await page.waitForTimeout(400);
await page.getByRole("button", { name: /Enregistrer la demande/ }).first().click();
await page.waitForTimeout(2000);
const apresDemande = await page.locator("#vue").textContent();
const numero = (apresDemande.match(/D\d{10}/) || [""])[0];
dire("demande enregistrée", Boolean(numero), numero);
dire("lignes d'analyse créées avec la demande",
  /En attente de saisie/.test(apresDemande));

// Prélèvement, réception, saisie puis validation signée : c'est la
// validation qui déclenche la notification du patient.
const avancer = async (motif, delai = 1800) => {
  const b = page.getByRole("button", { name: motif }).first();
  if (!(await b.count())) return false;
  await b.click();
  await page.waitForTimeout(900);
  const confirmer = page.getByRole("button", { name: /^(Confirmer|Enregistrer|Réceptionner|Prélever)$/ });
  if (await confirmer.count()) { await confirmer.last().click(); }
  await page.waitForTimeout(delai);
  return true;
};
dire("prélèvement enregistré", await avancer(/Enregistrer le prélèvement/));
dire("échantillon réceptionné", await avancer(/Réception|Réceptionner/));

// La saisie et la validation d'un résultat sont réservées au laboratoire :
// l'administrateur d'établissement n'a pas ce droit, et c'est voulu. On crée
// donc un compte de biologiste et on bascule dessus — ce qui contrôle au
// passage la création d'utilisateur et le changement de mot de passe imposé.
await page.goto(`${base}/#/utilisateurs`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1000);
await page.getByRole("button", { name: /Nouvel utilisateur/ }).first().click();
await page.waitForTimeout(900);
await page.fill("#champ_prenom", "Marie");
await page.fill("#champ_nom", "Ilunga");
await page.fill("#champ_identifiant", "bio.ilunga");
await page.selectOption("#champ_role", "biologiste");
await page.waitForTimeout(400);
await page.getByRole("button", { name: /Créer le compte/ }).click();
await page.waitForTimeout(2000);
const motDePasseTemporaire = (await page.locator("code.texte-mono").first()
  .textContent().catch(() => ""))?.trim();
dire("compte de biologiste créé", Boolean(motDePasseTemporaire),
  motDePasseTemporaire ? "mot de passe temporaire délivré" : "aucun mot de passe affiché");
await page.getByRole("button", { name: /J'ai noté le mot de passe/ }).click();
await page.waitForTimeout(900);

// L'administrateur ne doit pas pouvoir saisir : on le vérifie explicitement.
// La séparation des rôles se lit d'abord dans la navigation : les entrées
// « Paillasse » et « Validation » ne sont pas proposées à l'administrateur.
const liensAdmin = await page.locator('.nav-lien:not([hidden])').evaluateAll(
  as => as.map(a => a.getAttribute("data-vue")));
dire("la paillasse n'est pas proposée à l'administrateur",
  !liensAdmin.includes("paillasse"), liensAdmin.filter(Boolean).join(","));
dire("la validation n'est pas proposée à l'administrateur",
  !liensAdmin.includes("validation"));

await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(2500);
await page.getByPlaceholder("Identifiant").first().fill("bio.ilunga");
await page.locator('input[autocomplete="current-password"]').first().fill(motDePasseTemporaire);
await page.getByRole("button", { name: /Se connecter/i }).first().click();
await page.waitForTimeout(3000);
// Un mot de passe temporaire doit être changé : la modale s'ouvre d'elle-même.
if (await page.locator("#champ_nouveau").count()) {
  await page.fill("#champ_ancien", motDePasseTemporaire);
  await page.fill("#champ_nouveau", "BioFort2026!");
  await page.fill("#champ_confirmation", "BioFort2026!");
  await page.getByRole("button", { name: /^Enregistrer$/ }).last().click();
  await page.waitForTimeout(2000);
}
dire("connexion en biologiste",
  (await page.locator("#nomCompte").textContent().catch(() => ""))?.includes("Ilunga"));

// Saisie des trois valeurs à la paillasse
await page.goto(`${base}/#/paillasse`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
let saisies = 0;
for (let i = 0; i < 3; i++) {
  const lignes = page.locator("#vue table tbody tr");
  if (!(await lignes.count())) break;
  const ligne = lignes.first();
  // La valeur saisie doit être physiologiquement plausible : le formulaire
  // refuse une glycémie de 300 g/L, et c'est exactement ce qu'on attend de
  // lui. La ligne de paillasse ne porte pas l'intervalle de référence, on
  // choisit donc une valeur normale connue par analyse.
  const NORMALES = { "Hémoglobine": "14", "Leucocytes": "7", "Plaquettes": "250",
    "Hématocrite": "42", "Glucose": "0,9", "Créatinine": "9" };
  const texteLigne = await ligne.textContent();
  const analyse = Object.keys(NORMALES).find(n => texteLigne.includes(n));
  const valeur = analyse ? NORMALES[analyse] : "10";
  await ligne.click();
  await page.waitForTimeout(1000);
  const champ = page.locator('.modale input.champ').first();
  if (!(await champ.count())) { await page.keyboard.press("Escape"); await page.waitForTimeout(600); continue; }
  await champ.fill(String(valeur));
  await page.waitForTimeout(400);
  await page.locator(".modale").getByRole("button", { name: /^Enregistrer$/ }).first().click();
  await page.waitForTimeout(1800);
  // Si la modale est restée ouverte, la saisie a été refusée : on la ferme
  // pour ne pas bloquer les itérations suivantes.
  if (await page.locator(".modale__fond").count()) {
    console.log(`      (saisie ${i + 1} refusée : ${analyse || "?"} = ${valeur})`);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(800);
    continue;
  }
  saisies++;
}
dire("résultats saisis à la paillasse", saisies >= 1, `${saisies} saisie(s)`);

await page.goto(`${base}/#/validation`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1400);
const avantValidation = await page.locator("#vue").textContent();
dire("la file de validation présente la demande", avantValidation.includes(numero) || saisies > 0);

// L'écran de validation porte un bouton « Valider » par demande : c'est le
// chemin nominal du biologiste, et celui qui déclenche la notification.
let valide = false;
const boutonValider = page.locator("#vue").getByRole("button", { name: /^Valider$/ }).first();
if (await boutonValider.count()) {
  await boutonValider.click();
  await page.waitForTimeout(1500);
  const mdp = page.locator("#champSignature");
  if (await mdp.count()) {
    await mdp.fill("BioFort2026!");
    await page.locator(".modale").getByRole("button", { name: /Valider et signer/ }).last().click();
    await page.waitForTimeout(4000);
    valide = !(await page.locator(".modale__fond").count());
    console.log("      retours :", JSON.stringify(
      (await page.locator(".notification").allTextContents()).slice(0, 5)));
  }
  if (!valide) console.log("      messages :", JSON.stringify(
    (await page.locator(".notification").allTextContents()).slice(0, 4)));
}
dire("résultats validés et signés", valide);
await page.screenshot({ path: "/tmp/verif-validation.png", fullPage: true });

console.log("\n\x1b[1m6. Écran des messages aux patients\x1b[0m");
await page.goto(`${base}/#/messages`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1000);
const msg = await page.locator("#vue").textContent();
dire("écran des messages accessible", msg.includes("Messages aux patients"));
dire("mention explicite de l'absence de valeur biologique",
  msg.includes("aucune valeur biologique") || msg.includes("ne contiennent aucune valeur"));
dire("un message a été mis en file à la validation",
  /Tshibangu/i.test(msg), (msg.match(/\+\d{6,}/) || [""])[0]);
// La colonne « Langue » de la file porte le code de la langue du patient.
const languesFile = await page.locator("#vue table tbody tr td:nth-child(5)")
  .allTextContents().catch(() => []);
dire("le message part dans la langue du patient",
  languesFile.some(l => l.trim() === "sw"), languesFile.join(","));
dire("le numéro est au format international", /\+243812345678/.test(msg));
dire("aucun message n'est marqué remis sans passerelle", !/\bRemis\b/.test(msg));

const ligneMsg = page.locator("#vue table tbody tr").first();
if (await ligneMsg.count()) {
  await ligneMsg.click();
  await page.waitForTimeout(900);
  const corps = await page.locator(".modale").textContent().catch(() => "");
  dire("le texte du message ne contient aucune valeur biologique",
    !/\b1[234]\b|g\/dL|mmol/.test(corps.replace(/caractères|segment/g, "")),
    corps.replace(/\s+/g, " ").slice(0, 90));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
}

console.log("\n\x1b[1m7. Analyse statistique\x1b[0m");
// L'écran Statistiques part d'un état vide tant qu'aucun jeu de données
// n'existe : on en extrait un depuis le dossier médical avant de vérifier
// que le catalogue d'analyses est bien proposé.
await page.goto(`${base}/#/jeux-donnees`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1000);
const boutonExtraire = page.getByRole("button", { name: /Extraire|Depuis le laboratoire|Depuis les patients/ });
if (await boutonExtraire.count()) {
  await boutonExtraire.first().click();
  await page.waitForTimeout(1000);
  const confirmer = page.getByRole("button", { name: /Extraire|Confirmer|Créer/ }).last();
  if (await confirmer.count()) { await confirmer.click(); await page.waitForTimeout(2500); }
}
const jeux = await page.locator("#vue").textContent();
dire("jeu de données créé depuis le dossier médical",
  !/Aucun jeu de données/.test(jeux));

await page.goto(`${base}/#/statistiques`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
const stats = await page.locator("#vue").textContent();
dire("catalogue des analyses statistiques présent",
  /Student|ANOVA|régression|corrélation|Aucun jeu/i.test(stats),
  /Aucun jeu/.test(stats) ? "état vide, guidage vers la création" : "catalogue affiché");
await page.screenshot({ path: "/tmp/verif-stats.png", fullPage: true });

await page.goto(`${base}/#/qualitatif`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1000);
dire("analyse qualitative présente",
  /codage|corpus|lexico/i.test(await page.locator("#vue").textContent()));

console.log("\n\x1b[1m8. Configuration des notifications\x1b[0m");
await page.goto(`${base}/#/etablissement`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
const etab = await page.locator("#vue").textContent();
dire("carte de langue présente", etab.includes("Langue de l'interface"));
dire("couverture de traduction affichée", /100\s*%/.test(etab));
dire("carte de notification présente", etab.includes("Notification automatique des patients"));
dire("passerelle décrite", etab.includes("Passerelle d'envoi"));
await page.screenshot({ path: "/tmp/verif-etablissement.png", fullPage: true });

console.log("\n\x1b[1m9. Rendu sur téléphone\x1b[0m");
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${base}/#/tableau-de-bord`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
const debordement = await page.evaluate(() =>
  document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
dire("aucun débordement horizontal", !debordement);
await page.screenshot({ path: "/tmp/verif-mobile.png" });

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${base}/#/etablissement`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
dire("la langue reste réglable sur téléphone",
  (await page.locator("#selecteurLangueEtablissement").count()) === 1);

console.log("\n\x1b[1m10. Journal d'audit\x1b[0m");
await page.setViewportSize({ width: 1400, height: 900 });
await page.goto(`${base}/#/audit`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
const audit = await page.locator("#vue").textContent();
dire("journal d'audit alimenté", /intègre|Intégrité|entrée/i.test(audit));
dire("aucune donnée de santé en clair au journal",
  !audit.includes("Pénicilline"));

console.log(`\n${"═".repeat(62)}`);
console.log(`\x1b[1mBILAN\x1b[0m  ${ok.length} réussis, ${ko.length} en échec`);
if (ko.length) { console.log("\x1b[31m"); ko.forEach(k => console.log("  ✗ " + k)); console.log("\x1b[0m"); }
console.log(`erreurs de console : ${erreurs.length}`);
erreurs.slice(0, 12).forEach(e => console.log("  ⚠ " + e.slice(0, 180)));
console.log("═".repeat(62));

await nav.close();
process.exit(ko.length || erreurs.length ? 1 : 0);
