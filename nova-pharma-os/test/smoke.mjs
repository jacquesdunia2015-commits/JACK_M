#!/usr/bin/env node
/**
 * Test de recette automatisé — critères d'acceptation de l'Article 94
 * du cahier des charges NOVA PHARMA OS.
 *
 * Usage : node test/smoke.mjs
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 18642;
const BASE = `http://127.0.0.1:${PORT}/api`;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nova-pharma-test-'));

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
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('pdf') ? Buffer.from(await res.arrayBuffer()) : await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function login(l, p) {
  const r = await call(null, 'POST', '/login', { login: l, password: p });
  if (r.status !== 200) throw new Error(`login ${l} : ${r.status} ${JSON.stringify(r.data)}`);
  return r.data.token;
}

const serveur = spawn(process.execPath, [path.join(__dirname, '..', 'server.mjs')], {
  env: { ...process.env, PORT: String(PORT), NOVA_DATA: dataDir },
  stdio: 'pipe',
});
let serverLog = '';
serveur.stdout.on('data', (d) => { serverLog += d; });
serveur.stderr.on('data', (d) => { serverLog += d; });

async function attendre() {
  for (let i = 0; i < 50; i++) {
    try { await fetch(`http://127.0.0.1:${PORT}/`); return; } catch { await new Promise((r) => setTimeout(r, 100)); }
  }
  throw new Error('serveur injoignable\n' + serverLog);
}

try {
  await attendre();

  console.log('\n— Authentification & rôles —');
  const anonyme = await call(null, 'GET', '/products');
  check('accès anonyme refusé (401)', anonyme.status === 401);
  const mauvais = await call(null, 'POST', '/login', { login: 'gestionnaire', password: 'faux' });
  check('mot de passe invalide refusé (401)', mauvais.status === 401);

  const tGestion = await login('gestionnaire', 'demo1234');
  const tMagasin = await login('magasinier', 'demo1234');
  const tVendeur = await login('vendeur', 'demo1234');
  const tPharma = await login('pharmacien', 'demo1234');
  const tCompta = await login('comptable', 'demo1234');
  const tProprio = await login('proprietaire', 'demo1234');
  check('connexion des 6 profils de démonstration', true);

  console.log('\n— Critère : catalogue produits (§10) —');
  const produits = (await call(tGestion, 'GET', '/products')).data;
  check('catalogue pré-chargé (8 produits pilote)', produits.length === 8);
  const nouveauProduit = await call(tGestion, 'POST', '/products', {
    code: 'IBU400', nom: 'Ibuprofène 400 mg', categorie: 'Antalgiques', unite: 'boîte de 100',
    prixAchat: 1.5, prixDetail: 3.0, prixPro: 2.7, prixSemiGros: 2.4, prixMin: 2.0, stockMin: 10, stockMax: 100, seuilAlerte: 12,
  });
  check('création d’un produit', nouveauProduit.status === 201);
  const refusVendeurCatalogue = await call(tVendeur, 'POST', '/products', { code: 'X', nom: 'X' });
  check('le vendeur ne peut pas créer de produit (403)', refusVendeurCatalogue.status === 403);

  console.log('\n— Critère : fournisseurs et achats (§18, §19) —');
  const fournisseurs = (await call(tGestion, 'GET', '/suppliers')).data;
  check('fournisseurs pré-chargés', fournisseurs.length === 3);
  const ibuprofene = nouveauProduit.data;
  const po = await call(tGestion, 'POST', '/purchase-orders', {
    fournisseurId: fournisseurs[0].id,
    lignes: [{ productId: ibuprofene.id, quantiteCommandee: 100, prixUnitaire: 1.5 }],
  });
  check('commande d’achat créée (brouillon)', po.status === 201 && po.data.statut === 'brouillon');
  const poId = po.data.id;
  await call(tGestion, 'POST', `/purchase-orders/${poId}/envoyer`);

  console.log('\n— Critère : réception, lots et FEFO (§11, §12, §19) —');
  const dansUnAn = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
  const reception = await call(tMagasin, 'POST', `/purchase-orders/${poId}/receptionner`, {
    lignes: [{ productId: ibuprofene.id, quantiteRecue: 100, numeroLot: 'IBU-L1', dateExpiration: dansUnAn, prixUnitaire: 1.5 }],
  });
  check('réception crée un lot traçable', reception.status === 200 && reception.data.lots.length === 1);
  check('commande d’achat passe au statut « reçue »', reception.data.commande.statut === 'recue');
  const lotId = reception.data.lots[0].id;
  const lotDetail = await call(tGestion, 'GET', `/batches/${lotId}`);
  check('traçabilité « où est le lot X ? » (§11)', lotDetail.status === 200 && lotDetail.data.lot.numeroLot === 'IBU-L1');

  console.log('\n— Critère : caisse et vente comptoir avec calcul de marge (§21, §35, §38) —');
  const venteAvantCaisse = await call(tVendeur, 'POST', '/sales', { lignes: [{ productId: ibuprofene.id, quantite: 2 }] });
  check('vente refusée sans session de caisse ouverte', venteAvantCaisse.status === 409);
  const ouverture = await call(tVendeur, 'POST', '/cash-sessions/open', { montantOuverture: 50 });
  check('ouverture de caisse', ouverture.status === 201);
  const vente = await call(tVendeur, 'POST', '/sales', { lignes: [{ productId: ibuprofene.id, quantite: 10 }], paiementMode: 'especes' });
  check('vente comptoir enregistrée', vente.status === 201);
  check('la marge est calculée (10 × (3.0 - 1.5) = 15)', Math.abs(vente.data.margeTotal - 15) < 0.01);
  const stockApresVente = (await call(tGestion, 'GET', `/products/${ibuprofene.id}`)).data.produit;
  check('la vente réduit le stock disponible (100 → 90)', stockApresVente.stockDisponible === 90);
  const pdfVente = await call(tVendeur, 'GET', `/sales/${vente.data.id}/pdf`);
  check('reçu PDF généré', pdfVente.status === 200 && Buffer.isBuffer(pdfVente.data) && pdfVente.data.subarray(0, 5).toString() === '%PDF-');

  console.log('\n— Règle métier : aucune vente sous le prix minimum sans habilitation (§92 règle 4) —');
  const venteSousMinimum = await call(tVendeur, 'POST', '/sales', { lignes: [{ productId: ibuprofene.id, quantite: 1, prixUnitaire: 1.0 }] });
  check('vente sous le prix minimum refusée (403)', venteSousMinimum.status === 403);

  console.log('\n— Règle métier : aucun ajustement de stock sans motif (§92 règle 3) —');
  const ajustementSansMotif = await call(tMagasin, 'POST', '/stock/adjustment', { batchId: lotId, delta: -5, type: 'casse' });
  check('ajustement sans motif refusé (400)', ajustementSansMotif.status === 400);
  const ajustementAvecMotif = await call(tMagasin, 'POST', '/stock/adjustment', { batchId: lotId, delta: -5, type: 'casse', motif: 'Casse au transport' });
  check('ajustement avec motif accepté', ajustementAvecMotif.status === 200 && ajustementAvecMotif.data.quantite === 85);

  console.log('\n— Critère : clients B2B, commande et crédit (§8, §9, §26, §33) —');
  const clients = (await call(tGestion, 'GET', '/customers')).data;
  const clinique = clients.find((c) => c.type === 'professionnel');
  check('client B2B pré-chargé', !!clinique);
  const commandeB2B = await call(tVendeur, 'POST', '/customer-orders', {
    customerId: clinique.id, lignes: [{ productId: ibuprofene.id, quantite: 20 }], moyenPaiement: 'credit',
  });
  check('commande B2B créée', commandeB2B.status === 201);
  const orderId = commandeB2B.data.id;
  await call(tVendeur, 'POST', `/customer-orders/${orderId}/statut`, { statut: 'en_attente' });
  const confirmation = await call(tVendeur, 'POST', `/customer-orders/${orderId}/statut`, { statut: 'confirmee' });
  check('confirmation de commande met à jour l’encours client', confirmation.status === 200);
  const clientApres = (await call(tGestion, 'GET', `/customers/${clinique.id}`)).data.client;
  check('encours client mis à jour (§33)', clientApres.encours > 0);

  const commandeTropGrosse = await call(tVendeur, 'POST', '/customer-orders', {
    customerId: clinique.id, lignes: [{ productId: ibuprofene.id, quantite: 1000 }], moyenPaiement: 'credit',
  });
  await call(tVendeur, 'POST', `/customer-orders/${commandeTropGrosse.data.id}/statut`, { statut: 'en_attente' });
  const refusPlafond = await call(tVendeur, 'POST', `/customer-orders/${commandeTropGrosse.data.id}/statut`, { statut: 'confirmee' });
  check('dépassement du plafond de crédit bloqué sans validation (§33)', refusPlafond.status === 403);
  const validationProprio = await call(tProprio, 'POST', `/customer-orders/${commandeTropGrosse.data.id}/statut`, { statut: 'confirmee' });
  check('le propriétaire peut valider le dépassement de crédit', validationProprio.status === 200);

  console.log('\n— Critère : préparation (décrément FEFO), livraison et preuve (§29 à §31) —');
  const preparation = await call(tMagasin, 'POST', `/customer-orders/${orderId}/statut`, { statut: 'en_preparation' });
  check('préparation décrémente le stock via FEFO', preparation.status === 200);
  await call(tMagasin, 'POST', `/customer-orders/${orderId}/statut`, { statut: 'prete' });
  const livraison = await call(tMagasin, 'POST', '/deliveries', { orderId });
  check('livraison créée', livraison.status === 201);
  const deliveryId = livraison.data.id;
  await call(tMagasin, 'POST', `/deliveries/${deliveryId}/statut`, { statut: 'en_route' });
  const preuveManquante = await call(tMagasin, 'POST', `/deliveries/${deliveryId}/statut`, { statut: 'livree' });
  check('livraison refusée sans preuve (§30)', preuveManquante.status === 400);
  const livree = await call(tMagasin, 'POST', `/deliveries/${deliveryId}/statut`, {
    statut: 'livree', preuve: { nomReceptionnaire: 'Dr Alain Muhindo' },
  });
  check('livraison confirmée avec preuve', livree.status === 200);
  const orderApresLivraison = await call(tGestion, 'GET', `/customer-orders/${orderId}`);
  check('la commande passe au statut « livrée »', orderApresLivraison.data.statut === 'livree');

  console.log('\n— Critère : suivi client sans authentification (§25) —');
  const suivi = await call(null, 'GET', `/portal/commande/${commandeB2B.data.numero}?telephone=${encodeURIComponent(clinique.telephone)}`);
  check('le client peut suivre sa commande avec son numéro de téléphone', suivi.status === 200 && suivi.data.statut === 'livree');
  const suiviRefuse = await call(null, 'GET', `/portal/commande/${commandeB2B.data.numero}?telephone=+000000`);
  check('suivi refusé avec un mauvais numéro de téléphone', suiviRefuse.status === 403);

  console.log('\n— Critère : paiement et créances (§32, §33) —');
  const paiement = await call(tCompta, 'POST', '/payments', { customerId: clinique.id, montant: 20, mode: 'mobile_money' });
  check('paiement enregistré', paiement.status === 201);
  const creances = await call(tCompta, 'GET', '/creances');
  check('les créances clients sont visibles', creances.status === 200 && creances.data.some((c) => c.clientId === clinique.id));

  console.log('\n— Critère : inventaire (§15) —');
  const lotAvantComptage = (await call(tGestion, 'GET', `/batches/${lotId}`)).data.lot;
  const comptage = await call(tMagasin, 'POST', '/inventory/count', { batchId: lotId, quantiteReelle: 80 });
  check('comptage d’inventaire enregistré (écart détecté)', comptage.status === 201 && comptage.data.ecart === 80 - lotAvantComptage.quantite);
  const validationComptage = await call(tMagasin, 'POST', `/inventory/count/${comptage.data.id}/valider`);
  check('validation du comptage corrige le stock', validationComptage.status === 200);
  const lotApresInventaire = await call(tGestion, 'GET', `/batches/${lotId}`);
  check('le stock reflète le comptage réel (80)', lotApresInventaire.data.lot.quantite === 80);

  console.log('\n— Critère : alertes rupture et péremption (§16) —');
  const alertes = await call(tGestion, 'GET', '/stock/alerts');
  check('rupture détectée (compresses sous seuil)', alertes.data.ruptures.some((r) => r.code === 'COMPR'));
  check('péremption à risque détectée (< 90 jours)', alertes.data.peremptions.some((p) => p.code === 'PARA500'));

  console.log('\n— Critère : tableau de bord et KPI (§37, §38) —');
  const dashboard = await call(tProprio, 'GET', '/dashboard');
  check('le dashboard affiche le CA du jour', dashboard.status === 200 && dashboard.data.aujourdhui.chiffreAffaires > 0);
  check('le dashboard calcule la valeur du stock', dashboard.data.valeurStock > 0);
  check('le dashboard détecte les ruptures et péremptions', dashboard.data.produitsEnRupture >= 1 && dashboard.data.produitsARisqueExpiration >= 1);

  console.log('\n— Critère : journal d’audit (§64, §92 règle 7) —');
  const journal = await call(tProprio, 'GET', '/audit');
  const actions = journal.data.map((a) => a.action);
  for (const attendu of ['connexion', 'creation', 'vente', 'ajustement_stock', 'changement_statut', 'paiement']) {
    check(`audit contient « ${attendu} »`, actions.includes(attendu));
  }
  const refusAuditVendeur = await call(tVendeur, 'GET', '/audit');
  check('le vendeur n’a pas accès au journal d’audit', refusAuditVendeur.status === 403);

  console.log('\n— Critère : étanchéité multi-organisation (§5) —');
  const tAdmin = await login('admin', 'admin123');
  const nouvelleOrg = await call(tAdmin, 'POST', '/users', {
    login: 'gestion.goma', password: 'demo1234', nom: 'Test Goma', role: 'admin_pharmacie', organizationId: 'org-inexistante-isolee',
  });
  check('un second compte peut être créé dans une autre organisation', nouvelleOrg.status === 201);
  const tGoma = await login('gestion.goma', 'demo1234');
  const produitsGoma = await call(tGoma, 'GET', '/products');
  check('la nouvelle organisation ne voit aucun produit de NOVA SANTÉ PHARMA', produitsGoma.data.length === 0);
  const clientsGoma = await call(tGoma, 'GET', '/customers');
  check('la nouvelle organisation ne voit aucun client de NOVA SANTÉ PHARMA', clientsGoma.data.length === 0);

  console.log(`\nRésultat : ${nbOk} réussis, ${nbKo} échoués.`);
  process.exitCode = nbKo ? 1 : 0;
} catch (e) {
  console.error('ERREUR FATALE :', e);
  process.exitCode = 1;
} finally {
  serveur.kill();
  fs.rmSync(dataDir, { recursive: true, force: true });
}
