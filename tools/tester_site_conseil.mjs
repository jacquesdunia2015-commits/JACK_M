/* Recette interactive du site (§ 10 du cahier des charges).
 *
 * Contrôle ce qu'un vérificateur statique ne peut pas voir : menu mobile,
 * recherche au fil de la frappe, consentement, formulaire d'inscription,
 * redirection des liens marchands.
 *
 * Prérequis : un serveur statique servant le dossier généré, et Playwright.
 *
 *   python3 tools/generer_site_conseil.py
 *   python3 -m http.server 8099 --directory conseil &
 *   npx playwright install chromium      # une seule fois
 *   node tools/tester_site_conseil.mjs   # ou : BASE=http://.../ node ...
 *
 * Code de sortie 1 si un contrôle échoue.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));   // honore aussi NODE_PATH
} catch (err) {
  console.error("Playwright est introuvable. Installez-le puis relancez :\n" +
                "  npm install --no-save playwright && npx playwright install chromium");
  process.exit(2);
}
const BASE = (process.env.BASE || 'http://127.0.0.1:8099/').replace(/\/?$/, '/');
let echecs = 0;
const b = await chromium.launch();
const ok = (n, v) => { if (!v) echecs++; console.log((v ? '  OK   ' : '  ECHEC ') + n); };

// 1. Menu mobile + accordéon
let ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
let p = await ctx.newPage();
await p.goto(BASE);
await p.click('.cmp [data-action="tout-refuser"]');
ok('bandeau CMP refermé après refus', !(await p.isVisible('.cmp')));
await p.click('.burger');
ok('menu mobile ouvert', await p.isVisible('.nav-principale a:has-text("Enfants")'));
await p.click('.nav-item:has(> a:text-is("Enfants")) .bascule-sous-menu');
ok('sous-menu déployé', await p.isVisible('a:text-is("Sorties & balades")'));
await p.click('.voile', { force: true });
await p.waitForTimeout(300);
ok('menu refermé par le voile', !(await p.isVisible('a:text-is("Sorties & balades")')));

// 2. Recherche : suggestions au fil de la frappe
await p.click('[data-ouvrir-recherche]');
await p.fill('#recherche-rapide', 'gourde');
await p.waitForTimeout(500);
const n = await p.locator('.suggestions li').count();
ok('suggestions de recherche (' + n + ')', n > 0);

// 3. Newsletter : la case de consentement est obligatoire et non pré-cochée
await p.keyboard.press('Escape');
const cochee = await p.locator('form[data-newsletter] input[type=checkbox]').first().isChecked();
ok('case de consentement non pré-cochée', cochee === false);
await p.fill('form[data-newsletter] input[type=email]', 'test@exemple.fr');
await p.click('form[data-newsletter] button[type=submit]');
await p.waitForTimeout(200);
let msg = await p.locator('form[data-newsletter] [data-message]').first().textContent();
ok('refus sans consentement', /cocher la case/.test(msg));
await p.check('form[data-newsletter] input[type=checkbox]');
await p.click('form[data-newsletter] button[type=submit]');
await p.waitForTimeout(200);
msg = await p.locator('form[data-newsletter] [data-message]').first().textContent();
ok('double opt-in annoncé', /confirmation/.test(msg));

// 4. Aucun cookie déposé après refus
const cookies = await ctx.cookies();
ok('aucun cookie déposé (' + cookies.length + ')', cookies.length === 0);
await ctx.close();

// 5. Page de recherche complète
ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
p = await ctx.newPage();
await p.goto(BASE + 'recherche/?q=aspirateur');
await p.waitForTimeout(600);
const res = await p.locator('[data-resultats] article').count();
ok('page de résultats (' + res + ')', res > 0);

// 6. Redirection affiliée
p = await ctx.newPage();
await p.goto(BASE + 'go/gourde-alpage-500/', { waitUntil: 'domcontentloaded' }).catch(() => {});
await p.waitForTimeout(400);
ok('redirection sortante déclenchée', !p.url().includes('/go/'));
await ctx.close();
await b.close();
console.log(echecs ? `\n${echecs} contrôle(s) en échec.` : '\nTous les contrôles interactifs passent.');
process.exit(echecs ? 1 : 0);
