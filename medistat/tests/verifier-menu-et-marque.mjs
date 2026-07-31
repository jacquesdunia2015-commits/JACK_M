// medistat/tests/verifier-menu-et-marque.mjs
// Contrôle du bouton de menu et de la signature de l'organisation porteuse.
//
// Ce fichier existe à cause d'un défaut réel : le bouton à trois traits était
// déclaré « display: none », mais une règle plus tardive et de spécificité
// égale le rétablissait. Il restait donc visible sur ordinateur — et sans
// effet, puisque la classe qu'il bascule n'agissait que sous 1000 px. Un
// bouton visible qui ne fait rien est pire qu'un bouton absent.
//
//   node outils/construire-autonome.mjs --fragment
//   (préparer une page hôte, puis la servir sur le port 8811)
//   node tests/verifier-menu-et-marque.mjs

const CHEMIN_PLAYWRIGHT = process.env.PLAYWRIGHT_MODULE || "playwright-core";
const pw = (await import(CHEMIN_PLAYWRIGHT)).default;
const { chromium } = pw;
const U = process.argv[2] || "http://localhost:8811/apercu-hote.html";
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args:["--no-sandbox"] });
const page = await (await nav.newContext({viewport:{width:1440,height:900}})).newPage();
const erreurs = []; page.on("pageerror", e=>erreurs.push(e.message));
page.on("console", m=>{ if(m.type()==="error") erreurs.push(m.text()); });
const ok=[],ko=[];
const dire=(n,c,d="")=>{(c?ok:ko).push(n);console.log(`  ${c?"\x1b[32m✓\x1b[0m":"\x1b[31m✗\x1b[0m"} ${n}${d?" — "+d:""}`);};

await page.goto(U,{waitUntil:"load"}); await page.waitForTimeout(2500);
dire("logo APSA sur l'écran de configuration", (await page.locator(".apsa-pied img").count())===1);
await page.fill("#champ_nom","Centre médical Espoir"); await page.fill("#champ_code","CME");
await page.fill("#champ_prenom","Awa"); await page.fill("#champ_nomAdmin","Nkosi");
await page.fill("#champ_identifiant","admin");
await page.fill("#champ_motDePasse","DemoFort2026!"); await page.fill("#champ_motDePasse2","DemoFort2026!");
await page.uncheck("#champ_demonstration").catch(()=>{});
await page.getByRole("button",{name:/Créer l'établissement/}).click();
await page.waitForTimeout(5000);

dire("logo APSA sous la marque MediStat", (await page.locator(".marque-apsa img").count())===1);
const rectMarque = await page.locator(".marque").boundingBox();
const rectApsa = await page.locator(".marque-apsa").boundingBox();
dire("le logo APSA est bien en dessous de celui de MediStat",
  rectApsa && rectMarque && rectApsa.y > rectMarque.y + rectMarque.height/2,
  `MediStat y=${Math.round(rectMarque.y)} · APSA y=${Math.round(rectApsa.y)}`);
dire("le logo APSA s'affiche vraiment (pas d'image cassée)",
  await page.locator(".marque-apsa img").evaluate(i => i.complete && i.naturalWidth > 0));

console.log("\n  Menu à trois traits, sur ordinateur :");
const btn = page.locator("#btnMenu");
dire("le bouton est visible", await btn.isVisible());
const l0 = (await page.locator("#navigation").boundingBox()).width;
await btn.click(); await page.waitForTimeout(500);
const l1 = (await page.locator("#navigation").boundingBox()).width;
dire("un clic replie la barre latérale", l1 < l0 - 100, `${Math.round(l0)} px → ${Math.round(l1)} px`);
dire("l'état est annoncé aux technologies d'assistance",
  (await btn.getAttribute("aria-expanded")) === "false");
await btn.click(); await page.waitForTimeout(500);
const l2 = (await page.locator("#navigation").boundingBox()).width;
dire("un second clic la rétablit", Math.abs(l2 - l0) < 3, `${Math.round(l2)} px`);

await btn.click(); await page.waitForTimeout(400);
await page.reload({waitUntil:"load"}); await page.waitForTimeout(2500);
// Le rechargement ferme la session : on se reconnecte pour retrouver la
// barre latérale et vérifier que la préférence de repli a bien survécu.
await page.getByPlaceholder("Identifiant").first().fill("admin");
await page.locator('input[autocomplete="current-password"]').first().fill("DemoFort2026!");
await page.getByRole("button",{name:/Se connecter/i}).first().click();
await page.waitForTimeout(3500);
const apresRechargement = await page.locator("#navigation").boundingBox();
dire("le repli est mémorisé après rechargement",
  apresRechargement && apresRechargement.width < 40,
  apresRechargement ? Math.round(apresRechargement.width) + " px" : "barre absente");
// On rétablit avant les contrôles sur téléphone.
await page.locator("#btnMenu").click(); await page.waitForTimeout(500);

console.log("\n  Sur téléphone :");
await page.setViewportSize({width:390,height:844}); await page.waitForTimeout(700);
const nav390 = await page.locator("#navigation").boundingBox();
dire("la barre latérale n'occupe pas l'écran", !nav390 || nav390.x < 0 || nav390.width > 100);
await page.locator("#btnMenu").click(); await page.waitForTimeout(600);
dire("le menu s'ouvre au clic",
  (await page.locator("#navigation").boundingBox()).x >= 0);
await page.screenshot({path:"/tmp/menu-mobile.png"});

console.log(`\nBILAN : ${ok.length} réussis, ${ko.length} en échec`);
console.log("erreurs de console :", erreurs.length);
erreurs.slice(0,5).forEach(e=>console.log("  ⚠", e.slice(0,150)));
await nav.close();
process.exit(ko.length||erreurs.length?1:0);
