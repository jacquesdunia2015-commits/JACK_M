// medistat/tests/verifier-depannage.mjs
// Contrôle de l'écran de dépannage de la connexion.
//
// Il reproduit le cas réel qui a motivé cet écran : un utilisateur au bon mot
// de passe, mais au mauvais identifiant, sans aucun moyen de s'en apercevoir.
// L'écran doit lui révéler l'identifiant réellement enregistré, l'état de son
// compte et celui du stockage — puis, en dernier recours seulement, lui
// permettre de repartir d'une base vide sous confirmation écrite.
//
//   node outils/construire-autonome.mjs --fragment
//   (préparer une page hôte, puis la servir sur le port 8811)
//   node tests/verifier-depannage.mjs

const CHEMIN_PLAYWRIGHT = process.env.PLAYWRIGHT_MODULE || "playwright-core";
const pw = (await import(CHEMIN_PLAYWRIGHT)).default;
const { chromium } = pw;
const U = process.argv[2] || "http://localhost:8811/apercu-hote.html";
const nav = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args:["--no-sandbox"] });
const page = await (await nav.newContext({viewport:{width:1300,height:950}})).newPage();
const erreurs=[]; page.on("pageerror",e=>erreurs.push(e.message));
page.on("console",m=>{if(m.type()==="error")erreurs.push(m.text());});
const ok=[],ko=[];
const dire=(n,c,d="")=>{(c?ok:ko).push(n);console.log(`  ${c?"\x1b[32m✓\x1b[0m":"\x1b[31m✗\x1b[0m"} ${n}${d?" — "+d:""}`);};

await page.goto(U,{waitUntil:"load"}); await page.waitForTimeout(2500);
// On crée l'établissement avec un identifiant volontairement inhabituel :
// c'est le cas que l'écran doit rendre évident.
await page.fill("#champ_nom","Centre Dunia"); await page.fill("#champ_code","CDU");
await page.fill("#champ_prenom","Jacques"); await page.fill("#champ_nomAdmin","Dunia");
await page.fill("#champ_identifiant","j.dunia");
await page.fill("#champ_motDePasse","Duniya2026"); await page.fill("#champ_motDePasse2","Duniya2026");
await page.uncheck("#champ_demonstration").catch(()=>{});
await page.getByRole("button",{name:/Créer l'établissement/}).click();
await page.waitForTimeout(5000);

await page.reload({waitUntil:"load"}); await page.waitForTimeout(2500);
dire("l'écran de connexion s'affiche", await page.getByPlaceholder("Identifiant").count() > 0);
dire("le repère nomme l'établissement",
  (await page.locator("#vue").textContent()).includes("Centre Dunia"));

// L'utilisateur tente « admin » alors que son identifiant est « j.dunia ».
await page.getByPlaceholder("Identifiant").first().fill("admin");
await page.locator('input[autocomplete="current-password"]').first().fill("Duniya2026");
await page.getByRole("button",{name:/Se connecter/i}).first().click();
await page.waitForTimeout(2500);
dire("le bon mot de passe avec le mauvais identifiant est refusé",
  (await page.locator("#vue .avertissement").first().textContent().catch(()=>"")).includes("incorrect"));

const lien = page.getByRole("button",{name:/Je n'arrive pas à me connecter/});
dire("le lien de dépannage est présent", await lien.count() > 0);
await lien.first().click(); await page.waitForTimeout(1500);
const panneau = await page.locator(".modale").textContent();
dire("le vrai identifiant est révélé", panneau.includes("j.dunia"), "j.dunia");
dire("l'établissement est nommé", panneau.includes("Centre Dunia"));
dire("l'état du compte est indiqué", panneau.includes("actif"));
dire("le moteur de stockage est indiqué", panneau.includes("IndexedDB"));
dire("la conduite à tenir est expliquée", panneau.includes("mauvais nom"));
dire("l'option de remise à zéro existe",
  await page.locator(".modale").getByRole("button",{name:/Repartir d'une base vide/}).count() > 0);
await page.screenshot({path:"/tmp/depannage.png"});

// La remise à zéro doit exiger une saisie explicite.
await page.locator(".modale").getByRole("button",{name:/Repartir d'une base vide/}).click();
await page.waitForTimeout(1200);
const conf = await page.locator(".modale").textContent();
dire("la confirmation nomme l'établissement et prévient", conf.includes("irréversible"));
await page.locator(".modale").getByRole("button",{name:/Effacer définitivement/}).click();
await page.waitForTimeout(1000);
dire("effacer sans écrire EFFACER est refusé",
  await page.locator(".modale").count() > 0);
await page.locator(".modale input.champ").last().fill("EFFACER");
await page.locator(".modale").getByRole("button",{name:/Effacer définitivement/}).click();
await page.waitForTimeout(4000);
dire("après effacement, MediStat repart sur une configuration neuve",
  await page.locator("#champ_nom").count() > 0);

console.log(`\nBILAN : ${ok.length} réussis, ${ko.length} en échec`);
console.log("erreurs de console :", erreurs.length);
erreurs.slice(0,4).forEach(e=>console.log("  ⚠",e.slice(0,140)));
await nav.close();
process.exit(ko.length?1:0);
