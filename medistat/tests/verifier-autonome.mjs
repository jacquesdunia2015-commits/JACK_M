// medistat/tests/verifier-autonome.mjs
// Contrôle de la version en fichier unique produite par
// outils/construire-autonome.mjs.
//
// Deux exigences y sont vérifiées et ne le sont nulle part ailleurs :
// la page ne doit émettre AUCUNE requête vers l'extérieur — c'est ce qui
// permet de la déposer sur n'importe quel hébergement, ou de l'ouvrir sans
// réseau — et le circuit doit rester complet une fois les modules
// concaténés.
//
//   node outils/construire-autonome.mjs
//   (cd dist && python3 -m http.server 8811 &)
//   node tests/verifier-autonome.mjs

const CHEMIN_PLAYWRIGHT = process.env.PLAYWRIGHT_MODULE || "playwright-core";
const pw = (await import(CHEMIN_PLAYWRIGHT)).default;
const { chromium } = pw;
// Le fichier est contrôlé tel qu'il sera servi : sur une origine HTTP.
// Ouvert directement depuis le disque, le navigateur refuse IndexedDB —
// l'application fonctionne mais ne conserve rien d'une visite à l'autre.
const BASE = process.argv[2] || "http://localhost:8811/medistat-autonome.html";

const nav = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--allow-file-access-from-files"] });
const page = await (await nav.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
const erreurs = [];
page.on("console", m => { if (m.type() === "error") erreurs.push(m.text()); });
page.on("pageerror", e => erreurs.push("EXCEPTION: " + e.message));
// Aucune requête réseau ne doit partir : le fichier doit être autosuffisant.
const reseau = [];
const origine = new URL(BASE).origin;
page.on("request", r => {
  if (!r.url().startsWith(origine) && !r.url().startsWith("data:") && !r.url().startsWith("blob:")) {
    reseau.push(r.url());
  }
});

const ok = [], ko = [];
const dire = (nom, cond, d = "") => { (cond ? ok : ko).push(nom);
  console.log(`  ${cond ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${nom}${d ? " — " + d : ""}`); };

await page.goto(BASE, { waitUntil: "load" });
await page.waitForTimeout(3000);

dire("la page s'ouvre", (await page.title()).length > 0, await page.title());
dire("aucune requête vers l'extérieur", reseau.length === 0, reseau.slice(0, 3).join(" "));
dire("écran de démarrage retiré", (await page.locator("#demarrage").count()) === 0);
dire("écran de première configuration", (await page.locator("#champ_nom").count()) === 1);
dire("feuille de style appliquée",
  (await page.evaluate(() => getComputedStyle(document.body).fontFamily)).length > 5);

await page.fill("#champ_nom", "Clinique de démonstration");
await page.fill("#champ_code", "DEMO");
await page.fill("#champ_prenom", "Awa");
await page.fill("#champ_nomAdmin", "Nkosi");
await page.fill("#champ_identifiant", "admin");
await page.fill("#champ_motDePasse", "DemoFort2026!");
await page.fill("#champ_motDePasse2", "DemoFort2026!");
await page.getByRole("button", { name: /Créer l'établissement/ }).click();
await page.waitForTimeout(8000);
dire("établissement créé", (await page.locator("#nomCompte").textContent().catch(() => ""))?.includes("Nkosi"));
dire("jeu de démonstration chargé",
  /patient|Patients/.test(await page.locator("#vue").textContent()));

for (const vue of ["patients", "demandes", "statistiques", "qualitatif", "rapports", "aide", "messages"]) {
  await page.goto(`${BASE}#/${vue}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  const titre = (await page.locator("#vue h1, #vue h2, #vue h3").first().textContent().catch(() => ""))?.trim() || "";
  dire(`écran ${vue}`, titre.length > 0, titre.slice(0, 40));
}

dire("sélecteur de langue présent", (await page.locator("#selecteurLangue option").count()) > 40);
await page.selectOption("#selecteurLangue", "ar");
await page.waitForTimeout(900);
dire("bascule en arabe", (await page.getAttribute("html", "dir")) === "rtl");
await page.selectOption("#selecteurLangue", "fr");
await page.waitForTimeout(600);

await page.screenshot({ path: "/tmp/autonome.png", fullPage: false });
console.log(`\nBILAN : ${ok.length} réussis, ${ko.length} en échec`);
console.log("erreurs de console :", erreurs.length);
erreurs.slice(0, 8).forEach(e => console.log("  ⚠", e.slice(0, 200)));
await nav.close();
process.exit(ko.length || erreurs.length ? 1 : 0);
