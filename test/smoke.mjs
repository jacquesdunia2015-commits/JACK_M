#!/usr/bin/env node
/**
 * Test de recette automatisé — critères de réception de l'Article 23 :
 *  1. un patient peut être créé et suivi dans le temps ;
 *  2. un examen peut être prescrit ;
 *  3. un résultat peut être saisi, validé et consulté ;
 *  4. un document PDF peut être généré ;
 *  5. l'audit trail est complet ;
 *  6. les rôles et permissions fonctionnent ;
 *  7. étanchéité des données entre Établissements.
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
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'medilab-test-'));

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
  if (r.status !== 200) throw new Error(`login ${l} : ${r.status}`);
  return r.data.token;
}

const serveur = spawn(process.execPath, [path.join(__dirname, '..', 'server.mjs')], {
  env: { ...process.env, PORT: String(PORT), MEDILAB_DATA: dataDir },
  stdio: 'pipe',
});

async function attendre() {
  for (let i = 0; i < 50; i++) {
    try { await fetch(`http://127.0.0.1:${PORT}/`); return; } catch { await new Promise((r) => setTimeout(r, 100)); }
  }
  throw new Error('serveur injoignable');
}

try {
  await attendre();
  console.log('\n— Authentification —');
  const mauvais = await call(null, 'POST', '/login', { login: 'dr.mukendi', password: 'faux' });
  check('mot de passe invalide refusé (401)', mauvais.status === 401);
  const anonyme = await call(null, 'GET', '/patients');
  check('accès anonyme refusé (401)', anonyme.status === 401);
  const tMedecin = await login('dr.mukendi', 'demo1234');
  const tAccueil = await login('accueil', 'demo1234');
  const tLabo = await login('lab.kanya', 'demo1234');
  const tBio = await login('bio.ilunga', 'demo1234');
  const tQualite = await login('qualite', 'demo1234');
  const tEtab2 = await login('dr.amani', 'demo1234');
  check('connexion des 6 profils de démonstration', true);

  console.log('\n— Critère 1 : création et suivi du patient —');
  const patient = await call(tAccueil, 'POST', '/patients', {
    nom: 'Kabongo', prenom: 'Marie', sexe: 'F', dateNaissance: '1988-03-14',
    telephone: '+243 810 000 000', allergies: 'Pénicilline',
  });
  check('patient créé par la réceptionniste (201)', patient.status === 201 && patient.data.numero.startsWith('PAT-'));
  const pid = patient.data.id;
  const maj = await call(tMedecin, 'PUT', `/patients/${pid}`, { antecedents: 'Diabète de type 2' });
  check('dossier mis à jour par le médecin', maj.status === 200 && maj.data.antecedents.includes('Diabète'));

  console.log('\n— Critère 2 : prescription d’un examen —');
  const consult = await call(tMedecin, 'POST', '/consultations', {
    patientId: pid, motif: 'Contrôle glycémie', symptomes: 'Polyurie, fatigue', diagnostic: 'Suspicion de déséquilibre glycémique',
  });
  check('consultation ouverte', consult.status === 201);
  const tests = (await call(tMedecin, 'GET', '/tests')).data;
  const gly = tests.find((t) => t.code === 'GLY');
  const crp = tests.find((t) => t.code === 'CRP');
  const demande = await call(tMedecin, 'POST', '/demandes', {
    patientId: pid, consultationId: consult.data.id, priorite: 'urgent', testIds: [gly.id, crp.id],
  });
  check('demande de laboratoire créée', demande.status === 201 && demande.data.statut === 'demandee');
  const did = demande.data.id;
  const refusAccueil = await call(tAccueil, 'POST', '/demandes', { patientId: pid, testIds: [gly.id] });
  check('la réceptionniste ne peut pas prescrire (403)', refusAccueil.status === 403);

  console.log('\n— Critère 3 : cycle de vie, saisie et validation —');
  check('prélèvement (échantillon numéroté)',
    (await call(tLabo, 'POST', `/demandes/${did}/statut`, { statut: 'prelevee', typeEchantillon: 'Sang veineux' })).data.echantillon?.numero.startsWith('ECH-'));
  check('réception au laboratoire', (await call(tLabo, 'POST', `/demandes/${did}/statut`, { statut: 'recue' })).status === 200);
  check('passage en analyse', (await call(tLabo, 'POST', `/demandes/${did}/statut`, { statut: 'en_analyse' })).status === 200);
  const sautInterdit = await call(tLabo, 'POST', `/demandes/${did}/statut`, { statut: 'validee' });
  check('transition non séquentielle refusée (409)', sautInterdit.status === 409);
  const incomplet = await call(tLabo, 'POST', `/demandes/${did}/statut`, { statut: 'saisie' });
  check('soumission refusée tant que les résultats manquent (409)', incomplet.status === 409);
  const saisie = await call(tLabo, 'PUT', `/demandes/${did}/resultats`, {
    valeurs: {
      [gly.id]: { valeur: '21.5', commentaire: 'Contrôlé deux fois' },
      [crp.id]: { valeur: '3.1' },
    },
  });
  const ligneGly = saisie.data.lignes.find((l) => l.code === 'GLY');
  const ligneCrp = saisie.data.lignes.find((l) => l.code === 'CRP');
  check('valeur hors seuil critique détectée (GLY 21.5 → critique)', ligneGly.flag === 'critique');
  check('valeur normale détectée (CRP 3.1 → normal)', ligneCrp.flag === 'normal');
  check('soumission des résultats', (await call(tLabo, 'POST', `/demandes/${did}/statut`, { statut: 'saisie' })).status === 200);
  const refusValidLabo = await call(tLabo, 'POST', `/demandes/${did}/statut`, { statut: 'validee' });
  check('le laborantin ne peut pas valider (403)', refusValidLabo.status === 403);
  const validation = await call(tBio, 'POST', `/demandes/${did}/statut`, { statut: 'validee' });
  check('validation et signature par la biologiste', validation.status === 200 && validation.data.validation.par.includes('Ilunga'));
  check('publication au dossier patient', (await call(tBio, 'POST', `/demandes/${did}/statut`, { statut: 'publiee' })).status === 200);
  const dossier = await call(tMedecin, 'GET', `/patients/${pid}`);
  check('le médecin consulte le résultat publié depuis le dossier',
    dossier.data.demandes.some((d) => d.id === did && d.statut === 'publiee'));
  const correction = await call(tBio, 'PUT', `/demandes/${did}/resultats`, {
    valeurs: { [gly.id]: { valeur: '20.9' } }, commentaireBiologiste: 'Correction après recalibrage.',
  });
  check('correction post-validation par la biologiste (sous audit)', correction.status === 200);
  const refusCorrectionLabo = await call(tLabo, 'PUT', `/demandes/${did}/resultats`, { valeurs: { [gly.id]: { valeur: '5' } } });
  check('correction post-validation refusée au laborantin (403)', refusCorrectionLabo.status === 403);

  console.log('\n— Critère 4 : génération PDF —');
  const pdf = await call(tMedecin, 'GET', `/demandes/${did}/pdf`);
  check('PDF généré (en-tête %PDF, > 1 Ko)',
    pdf.status === 200 && Buffer.isBuffer(pdf.data) && pdf.data.subarray(0, 5).toString() === '%PDF-' && pdf.data.length > 1000);
  check('PDF terminé par %%EOF', pdf.data.toString('latin1').trimEnd().endsWith('%%EOF'));

  console.log('\n— Critère 5 : audit trail —');
  const journal = await call(tQualite, 'GET', '/audit');
  const actions = journal.data.map((a) => a.action);
  for (const attendu of ['connexion', 'creation', 'changement_statut', 'saisie_resultat', 'validation', 'publication', 'correction_resultat', 'export_pdf']) {
    check(`audit contient « ${attendu} »`, actions.includes(attendu));
  }
  const refusAuditLabo = await call(tLabo, 'GET', '/audit');
  check('le laborantin n’accède pas au journal (403)', refusAuditLabo.status === 403);

  console.log('\n— Critère 7 : étanchéité multi-établissement —');
  const fuite = await call(tEtab2, 'GET', `/patients/${pid}`);
  check('un médecin de l’Établissement 2 ne voit pas le patient de l’Établissement 1 (404)', fuite.status === 404);
  const listeEtab2 = await call(tEtab2, 'GET', '/patients');
  check('la liste des patients de l’Établissement 2 est vide', listeEtab2.data.length === 0);
  const fuiteDemande = await call(tEtab2, 'GET', `/demandes/${did}`);
  check('la demande de l’Établissement 1 est invisible depuis l’Établissement 2 (404)', fuiteDemande.status === 404);

  console.log(`\nRésultat : ${nbOk} réussis, ${nbKo} échoués.`);
  process.exitCode = nbKo ? 1 : 0;
} catch (e) {
  console.error('ERREUR FATALE :', e);
  process.exitCode = 1;
} finally {
  serveur.kill();
  fs.rmSync(dataDir, { recursive: true, force: true });
}
