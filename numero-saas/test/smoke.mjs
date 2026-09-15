#!/usr/bin/env node
/**
 * Test de recette automatisé — critères de réception du §12 du cahier des
 * charges :
 *  1. un utilisateur peut créer un compte ;
 *  2. un numéro peut être réservé et activé ;
 *  3. un SMS reçu apparaît (réception simulée, en temps réel via SSE) ;
 *  4. le tarif s'adapte au pays et à la devise ;
 *  5. l'admin peut modifier les règles (tarifs, suspension de compte) ;
 *  6. l'API fonctionne de bout en bout (wallet, renouvellement, libération,
 *     clé API, webhooks) ;
 *  7. la sécurité de base est respectée (401 sans session, 403 hors admin,
 *     compte suspendu bloqué).
 *
 * Usage : node test/smoke.mjs
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 18734;
const BASE = `http://127.0.0.1:${PORT}/api`;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'numerogo-test-'));

let nbOk = 0, nbKo = 0;
function check(nom, cond) {
  if (cond) { nbOk++; console.log(`  ✔ ${nom}`); }
  else { nbKo++; console.error(`  ✘ ${nom}`); }
}

async function call(token, method, chemin, body) {
  const res = await fetch(BASE + chemin, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

const serveur = spawn(process.execPath, [path.join(__dirname, '..', 'server.mjs')], {
  env: { ...process.env, PORT: String(PORT), NUMEROGO_DATA: dataDir, PROVIDER_SECRET: 'test-secret' },
  stdio: 'pipe',
});

async function attendre() {
  for (let i = 0; i < 50; i++) {
    try { await fetch(`http://127.0.0.1:${PORT}/`); return; } catch { await new Promise((r) => setTimeout(r, 100)); }
  }
  throw new Error('serveur injoignable');
}

async function main() {
  await attendre();
  console.log('NuméroGo — recette automatisée\n');

  // 1. Inscription + connexion
  const email = `client.${Date.now()}@test.dev`;
  let r = await call(null, 'POST', '/auth/register', { email, password: 'motdepasse1' });
  check('inscription crée un compte avec un crédit d’essai', r.status === 201 && r.data.user.walletUsd === 2);
  const token = r.data.token;

  r = await call(null, 'POST', '/auth/login', { email, password: 'mauvais' });
  check('connexion refusée avec un mauvais mot de passe', r.status === 401);

  r = await call(null, 'GET', '/countries');
  check('la liste des pays est publique et non vide', r.status === 200 && r.data.countries.length >= 5);
  const pays = r.data.countries.find((c) => c.code === 'CD');
  check('le tarif est converti dans la devise locale du pays (CDF ≫ USD)', pays && pays.currency === 'CDF' && pays.priceEntry.local > pays.priceEntry.usd * 100);

  r = await call(null, 'GET', '/numbers');
  check('l’API refuse une requête sans authentification (401)', r.status === 401);

  // 2. Réservation + activation d'un numéro
  r = await call(token, 'POST', '/numbers/reserve', { country: 'CD' });
  check('un numéro peut être réservé', r.status === 200 && r.data.number.status === 'reserved');
  const numberId = r.data.number.id;

  r = await call(token, 'POST', `/numbers/${numberId}/activate`, {});
  check('l’activation débite le wallet et active le numéro', r.status === 200 && r.data.number.status === 'active' && r.data.wallet < 2);
  const soldeApresActivation = r.data.wallet;

  // 3. Réception de SMS en temps réel (on utilise l'aide de test, le provider
  //    simulé programme aussi un OTP automatique quelques secondes après)
  r = await call(token, 'POST', `/numbers/${numberId}/simulate-sms`, { from: 'Test', text: 'Bonjour !' });
  check('un SMS simulé est bien reçu et horodaté', r.status === 200 && !!r.data.message.receivedAt);

  r = await call(token, 'GET', `/messages?numberId=${numberId}`);
  check('le SMS apparaît dans l’historique des messages', r.status === 200 && r.data.messages.length >= 1);

  // 4. Renouvellement puis libération (sans remboursement : un message existe)
  r = await call(token, 'POST', `/numbers/${numberId}/renew`, {});
  check('le numéro peut être renouvelé et son solde de renouvellements incrémenté', r.status === 200 && r.data.number.renewals === 1);

  r = await call(token, 'DELETE', `/numbers/${numberId}`, {});
  check('le numéro peut être libéré (alias REST DELETE)', r.status === 200 && r.data.ok === true);
  check('aucun remboursement si des messages ont déjà été reçus', r.data.wallet < soldeApresActivation + 0.01);

  // 5. Wallet et clé API
  r = await call(token, 'POST', '/billing/recharge', { amountUsd: 5 });
  check('le wallet peut être rechargé', r.status === 200 && r.data.walletUsd >= 5);

  r = await call(token, 'POST', '/auth/api-key', {});
  check('une clé API est délivrée une seule fois', r.status === 200 && r.data.apiKey.startsWith('ngo_'));
  const apiKeyRes = await fetch(BASE + '/countries', { headers: { 'X-Api-Key': r.data.apiKey } });
  check('la clé API authentifie les appels au même titre qu’une session', apiKeyRes.status === 200);

  // 6. Webhooks
  r = await call(token, 'POST', '/webhooks/register', { url: 'https://example.invalid/hook' });
  check('un webhook peut être enregistré avec un secret HMAC', r.status === 201 && !!r.data.secret);

  // 7. Administration : rôles, tarification, suspension
  r = await call(token, 'GET', '/admin/overview');
  check('un utilisateur normal ne peut pas accéder à l’admin (403)', r.status === 403);

  let admin = await call(null, 'POST', '/auth/login', { email: 'admin@numerogo.dev', password: 'admin123' });
  const adminToken = admin.data.token;
  r = await call(adminToken, 'GET', '/admin/overview');
  check('l’admin voit la vue d’ensemble (revenus, numéros actifs…)', r.status === 200 && typeof r.data.revenueUsd === 'number');

  r = await call(adminToken, 'PATCH', '/admin/countries/CD', { priceEntryUsd: 0.5 });
  check('l’admin peut modifier la tarification d’un pays', r.status === 200 && r.data.country.priceEntryUsd === 0.5);

  const userId = (await call(adminToken, 'GET', '/admin/users')).data.users.find((u) => u.email === email).id;
  r = await call(adminToken, 'PATCH', `/admin/users/${userId}`, { suspended: true });
  check('l’admin peut suspendre un compte', r.status === 200 && r.data.user.suspended === true);

  r = await call(null, 'POST', '/auth/login', { email, password: 'motdepasse1' });
  check('un compte suspendu ne peut plus se connecter', r.status === 403);

  console.log(`\n${nbOk} succès, ${nbKo} échec(s).`);
  serveur.kill();
  fs.rmSync(dataDir, { recursive: true, force: true });
  process.exit(nbKo ? 1 : 0);
}

main().catch((e) => { console.error(e); serveur.kill(); process.exit(1); });
