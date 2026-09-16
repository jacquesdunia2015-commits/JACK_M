// Rend les schémas d'aide (assets/schemas/*.html) en images PNG partageables
// (WhatsApp, impression, affichage en salle de formation).
//
// Usage : node tools/faire_schema.js
// Nécessite Playwright + Chromium (déjà utilisés pour les manuels PDF).
const path = require("path");
const fs = require("fs");

const PW = process.env.PLAYWRIGHT_PATH || "playwright";
const { chromium } = require(PW);

const ROOT = path.resolve(__dirname, "..");
const DIR = path.join(ROOT, "assets", "schemas");
const EXEC = process.env.CHROMIUM_PATH || undefined;

(async () => {
  const browser = await chromium.launch({ executablePath: EXEC });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1200 }, deviceScaleFactor: 1 });

  const icone = "data:image/png;base64," +
    fs.readFileSync(path.join(ROOT, "assets", "logo", "qualicode-icon-192.png")).toString("base64");
  const adresse = process.env.QC_URL || "https://jacquesdunia2015-commits.github.io/JACK_M/";

  for (const f of fs.readdirSync(DIR).filter(f => f.endsWith(".html"))) {
    const html = fs.readFileSync(path.join(DIR, f), "utf-8")
      .replace("ICONE", icone)
      .replace("ADRESSE", adresse);
    await page.setContent(html, { waitUntil: "load" });
    const out = path.join(DIR, f.replace(/\.html$/, ".png"));
    await page.screenshot({ path: out, fullPage: true });
    console.log("→", out, Math.round(fs.statSync(out).size / 1024) + " Ko");
  }
  await browser.close();
})();
