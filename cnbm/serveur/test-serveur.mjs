// Test automatique du serveur CNBM-RDC : démarre un serveur temporaire avec une clé
// de créateur de TEST (générée à la volée) et vérifie l'API de bout en bout.
//   node cnbm/serveur/test-serveur.mjs
import assert from 'assert/strict';
import { spawn } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const { subtle } = globalThis.crypto;
const paire = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const cle = paire.privateKey, pub = await subtle.exportKey('jwk', paire.publicKey);
const PORT = 18000 + Math.floor(Math.random() * 1000), U = 'http://127.0.0.1:' + PORT;
const DONNEES = mkdtempSync(join(tmpdir(), 'cnbm-test-'));
const srv = spawn(process.execPath, ['--no-warnings', join(dirname(fileURLToPath(import.meta.url)), 'serveur.mjs')],
  { env: { ...process.env, PORT: String(PORT), DONNEES, CLES_PUBLIQUES: JSON.stringify([{ kty: pub.kty, crv: pub.crv, x: pub.x, y: pub.y }]) }, stdio: 'inherit' });
const fin = code => { srv.kill(); rmSync(DONNEES, { recursive: true, force: true }); process.exit(code); };
process.on('uncaughtException', e => { console.error('❌', e.message); fin(1); });
process.on('unhandledRejection', e => { console.error('❌', e.message); fin(1); });
for (let i = 0; i < 40; i++) { try { if ((await fetch(U + '/api/sante')).ok) break; } catch {} await new Promise(r => setTimeout(r, 150)); }
const b64u = b => Buffer.from(b).toString('base64url');
const signer = async p => { const c = b64u(JSON.stringify(p)); const s = await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, cle, new TextEncoder().encode(c)); return 'CNBM1.' + c + '.' + b64u(s); };
const abo = async (province, id, expire = '2027-12-31') => { const base = { v: 1, id, province, conseil: 'Conseil ' + province, email: 'c@x.cd', debut: '2026-01-01', expire };
  const m = await signer({ ...base, type: 'membre' }); return { m, a: await signer({ ...base, type: 'admin', formule: 'Annuel', membres: m }) }; };
const api = async (m, chemin, corps, jeton, extra = {}) => {
  const r = await fetch(U + chemin, { method: m, headers: { ...(corps && !(corps instanceof Buffer) ? { 'content-type': 'application/json' } : {}), ...(jeton ? { authorization: 'Bearer ' + jeton } : {}), ...extra },
    body: corps instanceof Buffer ? corps : corps ? JSON.stringify(corps) : undefined });
  const t = r.headers.get('content-type') || ''; return { s: r.status, j: t.includes('json') ? await r.json() : await r.arrayBuffer() };
};
const ok = (cond, msg) => { assert.ok(cond, msg); console.log('✅', msg); };
const suffixe = Date.now().toString().slice(-6);

const NK = await abo('Nord-Kivu', 'ABO-NOR-T' + suffixe), SK = await abo('Sud-Kivu', 'ABO-SUD-T' + suffixe), NAT = await abo('National (toutes les provinces)', 'ABO-NAT-T' + suffixe);
const EXP = await abo('Kinshasa', 'ABO-KIN-T' + suffixe, '2025-01-31');

let r = await api('POST', '/api/admin/inscription', { nom: 'Admin NK', ident: '+24399' + suffixe + '1', mdp: 'motdepasse', cle: NK.a });
ok(r.s === 200 && r.j.compte.role === 'admin' && r.j.codeRecup, 'admin Nord-Kivu créé avec la clé');
const aNK = r.j.jeton;
r = await api('POST', '/api/admin/inscription', { nom: 'X', ident: 'x' + suffixe + '@y.cd', mdp: 'motdepasse', cle: NK.a.slice(0, -4) + 'AAAA' });
ok(r.s === 400, 'clé falsifiée refusée');
r = await api('POST', '/api/admin/inscription', { nom: 'X', ident: 'x' + suffixe + '@y.cd', mdp: 'motdepasse', cle: EXP.a });
ok(r.s === 400 && /expir/.test(r.j.erreur), 'clé expirée refusée');
r = await api('POST', '/api/admin/inscription', { nom: 'Admin SK', ident: '+24399' + suffixe + '2', mdp: 'motdepasse', cle: SK.a }); const aSK = r.j.jeton;
r = await api('POST', '/api/admin/inscription', { nom: 'Bureau national', ident: 'national' + suffixe + '@cnbm.cd', mdp: 'motdepasse', cle: NAT.a }); const aNAT = r.j.jeton;

r = await api('POST', '/api/inscription', { nom: 'Membre NK', ident: '09' + suffixe + '99', mdp: 'abc123', jetonConseil: NK.m });
ok(r.s === 200 && r.j.compte.province === 'Nord-Kivu', 'membre inscrit via le lien du Nord-Kivu');
const mNK = r.j.jeton, codeM = r.j.codeRecup, identM = r.j.compte.id;
r = await api('POST', '/api/inscription', { nom: 'Doublon', ident: '09' + suffixe + '99', mdp: 'abc123' }); ok(r.s === 409, 'doublon refusé');
r = await api('POST', '/api/connexion', { ident: identM, mdp: 'faux' }); ok(r.s === 401, 'mauvais mot de passe refusé');
r = await api('POST', '/api/connexion', { ident: identM, mdp: 'abc123' }); ok(r.s === 200 && r.j.conseil.province === 'Nord-Kivu', 'connexion depuis un autre appareil');

const id = 'CNBM-20261127-' + ('A' + suffixe).slice(0, 6).toUpperCase().replace(/[^A-Z0-9]/g, 'Z');
const fid = id.replace(/\d{6}$/, m => m);
const meta = { format: 'cnbm-fiche', id: fid, data: { nom: 'Kavira', prenom: 'Esther', adhMembre: 'Non', adhDemande: 'Oui, je demande mon adhésion' }, lieux: [{ etablissement: 'HGR Goma', province: 'Nord-Kivu' }],
  modifie: Date.now(), fichiers: [fid + '_KAVIRA_photo.jpg', fid + '_KAVIRA_doc1_diplome.pdf'] };
r = await api('PUT', '/api/fiches/' + fid, meta, mNK); ok(r.s === 200, 'fiche envoyée au serveur');
r = await api('PUT', `/api/fiches/${fid}/fichiers/${fid}_KAVIRA_photo.jpg`, Buffer.from('JPEGDATA'), mNK, { 'content-type': 'application/octet-stream', 'x-fichier-mime': 'image/jpeg' }); ok(r.s === 200, 'photo téléversée');
r = await api('PUT', `/api/fiches/${fid}/fichiers/${fid}_KAVIRA_doc1_diplome.pdf`, Buffer.from('%PDF-1.4 test'), mNK, { 'x-fichier-mime': 'application/pdf' }); ok(r.s === 200, 'document téléversé');
r = await api('PUT', `/api/fiches/${fid}/fichiers/../../etc_passwd`, Buffer.from('x'), mNK); ok(r.s === 400 || r.s === 404, 'nom de fichier piégé refusé');
r = await api('GET', '/api/mes-fiches', null, mNK); ok(r.j.fiches.length === 1 && r.j.fiches[0].fichiersServeur.length === 2, 'le membre retrouve sa fiche et ses 2 fichiers');

r = await api('GET', '/api/registre', null, aNK); ok(r.j.fiches.some(f => f.id === fid), 'admin Nord-Kivu voit la fiche');
r = await api('GET', '/api/registre', null, aSK); ok(!r.j.fiches.some(f => f.id === fid), 'admin Sud-Kivu ne la voit PAS');
r = await api('GET', `/api/fiches/${fid}/fichiers/${fid}_KAVIRA_photo.jpg`, null, aSK); ok(r.s === 404, 'admin Sud-Kivu ne peut pas lire la photo');
r = await api('GET', '/api/registre', null, aNAT); ok(r.j.fiches.some(f => f.id === fid), 'bureau national voit la fiche');
r = await api('GET', `/api/fiches/${fid}/fichiers/${fid}_KAVIRA_photo.jpg`, null, aNK); ok(r.s === 200 && Buffer.from(r.j).toString() === 'JPEGDATA', 'admin Nord-Kivu télécharge la photo');
r = await api('GET', '/api/registre', null, mNK); ok(r.s === 403, 'un membre n\'accède pas au registre');
r = await api('GET', '/api/registre'); ok(r.s === 401, 'sans connexion : refusé');

r = await api('POST', `/api/fiches/${fid}/adhesion`, { numero: 'NK-0999' }, aNK); ok(r.s === 200, 'adhésion acceptée');
r = await api('GET', '/api/mes-fiches', null, mNK); ok(r.j.fiches[0].data.adhMembre === 'Oui' && r.j.fiches[0].data.numeroOrdre === 'NK-0999', 'le membre voit son adhésion acceptée');
meta.fichiers = [fid + '_KAVIRA_photo.jpg']; r = await api('PUT', '/api/fiches/' + fid, meta, mNK); ok(r.j.fichiers.length === 1, 'document retiré par le membre supprimé du serveur');

r = await api('GET', '/api/comptes', null, aNK); ok(r.j.comptes.some(c => c.id === identM) && !r.j.comptes.some(c => c.nom === 'Admin SK'), 'comptes : seulement ceux du Nord-Kivu');
r = await api('POST', `/api/comptes/${encodeURIComponent(identM)}/reinitialiser`, null, aNK); const tmp = r.j.provisoire; ok(tmp, 'mot de passe provisoire');
r = await api('GET', '/api/mes-fiches', null, mNK); ok(r.s === 401, 'les anciennes sessions du membre sont fermées');
r = await api('POST', '/api/connexion', { ident: identM, mdp: tmp }); ok(r.s === 200, 'connexion avec le provisoire');
r = await api('POST', '/api/recuperation', { ident: identM, code: codeM.toLowerCase(), mdp: 'nouveau1' }); ok(r.s === 200, 'récupération par code');

const ts = String(Date.now()), sig = b64u(await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, cle, new TextEncoder().encode('createur:' + ts)));
r = await api('GET', '/api/createur/tableau', null, null, { 'x-createur': ts + '.' + sig });
ok(r.s === 200 && r.j.conseils.some(c => c.province === 'Nord-Kivu' && c.fiches >= 1 && c.membres >= 1), 'tableau de bord du créateur');
r = await api('GET', '/api/createur/tableau', null, null, { 'x-createur': ts + '.' + sig.slice(0, -3) + 'abc' }); ok(r.s === 401, 'tableau créateur : signature falsifiée refusée');
r = await api('GET', '/api/registre', null, null, { origin: 'https://pirate.example' }); ok(r.s === 403, 'origine étrangère refusée');
console.log('TOUS LES TESTS API PASSENT');
fin(0);
