/**
 * CNBM-RDC — Réception GRATUITE des fiches dans Google Drive (Google Apps Script).
 * Conseil National des Biologistes Médicaux et Techniciens de laboratoire en
 * République Démocratique du Congo.
 *
 * Ce script reçoit automatiquement les fiches envoyées par l'application de
 * recensement (données, photo, vidéo, pièces justificatives) et les range dans
 * Google Drive : un dossier par province, un sous-dossier par membre, et un
 * tableau Google Sheets « Registre » avec une ligne par membre.
 *
 * MISE EN PLACE (une seule fois, voir le guide cnbm/drive/GUIDE.md) :
 *   1. Exécuter la fonction « initialiser » (menu Exécuter) et autoriser l'accès.
 *      Le journal affiche la CLÉ D'ACCÈS ADMINISTRATEUR : notez-la.
 *   2. Déployer → Nouveau déploiement → Application Web
 *      « Exécuter en tant que : Moi », « Qui a accès : Tout le monde ».
 *   3. Copier l'URL (…/exec) et la coller, avec la clé, dans l'application :
 *      Espace responsables → « Réception automatique (Google Drive) ».
 *
 * Pour donner à un conseil provincial un accès limité à SA province, exécuter
 * « creerCleProvince » après avoir indiqué la province dans la fonction.
 */

const NOM_DOSSIER = "CNBM-RDC — Recensement des membres";
const ENTETES = ["Identifiant", "Province", "Nom complet", "Catégorie", "Téléphone", "Reçue le", "Mise à jour", "Données (ne pas modifier)", "Fichiers (ne pas modifier)"];
const RE_FICHE = /^CNBM-\d{8}-[A-Z0-9]{6}$/;
const RE_NOM = /^[A-Za-z0-9._-]{1,120}$/;
const MAX_FICHIER = 35 * 1024 * 1024;
const NATIONAL = "National (toutes les provinces)";

/* ------------------------------------------------------------ mise en place */
function initialiser() {
  const p = PropertiesService.getScriptProperties();
  let racine;
  try { racine = DriveApp.getFolderById(p.getProperty("RACINE")); } catch (e) { racine = null; }
  if (!racine) { racine = DriveApp.createFolder(NOM_DOSSIER); p.setProperty("RACINE", racine.getId()); }
  let feuille;
  try { feuille = SpreadsheetApp.openById(p.getProperty("FEUILLE")); } catch (e) { feuille = null; }
  if (!feuille) {
    feuille = SpreadsheetApp.create("CNBM-RDC — Registre des fiches reçues");
    const f = feuille.getSheets()[0]; f.setName("Registre"); f.appendRow(ENTETES); f.setFrozenRows(1);
    f.getRange(1, 1, 1, ENTETES.length).setFontWeight("bold").setBackground("#0b5fa5").setFontColor("#ffffff");
    DriveApp.getFileById(feuille.getId()).moveTo(racine);
    p.setProperty("FEUILLE", feuille.getId());
  }
  const cles = lireCles();
  if (!Object.keys(cles).some(k => cles[k] === "*")) { cles[nouvelleCle()] = "*"; p.setProperty("CLES", JSON.stringify(cles)); }
  const nat = Object.keys(cles).find(k => cles[k] === "*");
  Logger.log("Dossier Drive : " + racine.getUrl());
  Logger.log("Registre (Google Sheets) : " + feuille.getUrl());
  Logger.log("CLÉ D'ACCÈS ADMINISTRATEUR (toutes provinces) : " + nat);
}
/** Crée une clé qui ne donne accès qu'aux fiches d'une province. Modifiez le nom puis exécutez. */
function creerCleProvince() {
  const province = "Nord-Kivu"; // ← écrire ici la province, exactement comme dans l'application
  const cles = lireCles(), cle = nouvelleCle();
  cles[cle] = province;
  PropertiesService.getScriptProperties().setProperty("CLES", JSON.stringify(cles));
  Logger.log("Clé d'accès pour « " + province + " » : " + cle);
}
function lireCles() { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty("CLES") || "{}"); } catch (e) { return {}; } }
function nouvelleCle() { return Utilities.getUuid().replace(/-/g, "").slice(0, 20).toUpperCase().replace(/(.{5})(?=.)/g, "$1-"); }

/* ------------------------------------------------------------ outils */
function sortie(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function erreur(msg) { return sortie({ erreur: msg }); }
function feuille() { return SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty("FEUILLE")).getSheets()[0]; }
function racine() { return DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty("RACINE")); }
function ligneDe(f, id) { const c = f.getRange("A:A").createTextFinder(id).matchEntireCell(true).findNext(); return c ? c.getRow() : 0; }
function sousDossier(parent, nom) { const it = parent.getFoldersByName(nom); return it.hasNext() ? it.next() : parent.createFolder(nom); }
function dossierFiche(province, id) {
  const p = sousDossier(racine(), province || "Sans province");
  const it = p.getFolders();
  while (it.hasNext()) { const d = it.next(); if (d.getName().indexOf(id) === 0) return d; }
  return p.createFolder(id);
}
function hex(octets) { return octets.map(b => ((b + 256) % 256).toString(16).padStart(2, "0")).join(""); }
function droits(cle) { const c = lireCles()[String(cle || "").trim().toUpperCase()]; return c || null; }
function provinceDe(meta) {
  const p = meta.conseil && meta.conseil.province;
  if (p && p !== NATIONAL) return p;
  const l = (meta.lieux || []).map(x => x.province).filter(x => x && !/Hors RDC/.test(x))[0];
  return l || (meta.data && meta.data.adrProvince) || "Sans province";
}
function nomComplet(d) { return [d.nom, d.postnom].filter(Boolean).join(" ").toUpperCase() + (d.prenom ? " " + d.prenom : ""); }

/* ------------------------------------------------------------ réception (POST) */
function doPost(e) {
  const verrou = LockService.getScriptLock();
  try {
    verrou.waitLock(30000);
    const v = JSON.parse(e.postData.contents || "{}");
    if (v.action === "fiche") return recevoirFiche(v.meta || {});
    if (v.action === "fichier") return recevoirFichier(v);
    const portee = droits(v.cle);
    if (!portee) return erreur("Clé d'accès administrateur incorrecte.");
    if (v.action === "adhesion") return accepterAdhesion(v, portee);
    if (v.action === "supprimer") return supprimer(v, portee);
    return erreur("Action inconnue.");
  } catch (err) {
    return erreur("Erreur : " + err.message);
  } finally { try { verrou.releaseLock(); } catch (e2) {} }
}
function recevoirFiche(meta) {
  if (!RE_FICHE.test(meta.id || "") || !meta.data) return erreur("Fiche incomplète.");
  const f = feuille(), n = ligneDe(f, meta.id), province = provinceDe(meta), maintenant = Date.now();
  let fichiers = [];
  if (n) fichiers = JSON.parse(f.getRange(n, 9).getValue() || "[]");
  // Fichiers retirés par le membre : mis à la corbeille.
  const gardes = meta.fichiers || [];
  const dossier = dossierFiche(n ? f.getRange(n, 2).getValue() : province, meta.id);
  fichiers = fichiers.filter(x => {
    if (gardes.indexOf(x.nom) >= 0) return true;
    const it = dossier.getFilesByName(x.nom); while (it.hasNext()) it.next().setTrashed(true);
    return false;
  });
  delete meta.photo; delete meta.video;
  const ligne = [meta.id, n ? f.getRange(n, 2).getValue() : province, nomComplet(meta.data), meta.data.categorie || "", meta.data.telephone || "",
    n ? f.getRange(n, 6).getValue() : new Date(maintenant), new Date(maintenant), JSON.stringify(meta), JSON.stringify(fichiers)];
  if (n) f.getRange(n, 1, 1, ligne.length).setValues([ligne]); else f.appendRow(ligne);
  dossier.setName(meta.id + " — " + nomComplet(meta.data));
  return sortie({ ok: true, fichiers: fichiers });
}
function recevoirFichier(v) {
  if (!RE_FICHE.test(v.id || "") || !RE_NOM.test(v.nom || "") || v.nom.indexOf(v.id + "_") !== 0) return erreur("Nom de fichier invalide.");
  const f = feuille(), n = ligneDe(f, v.id);
  if (!n) return erreur("Fiche introuvable : envoyez d'abord la fiche.");
  const octets = Utilities.base64Decode(v.data || "");
  if (octets.length > MAX_FICHIER) return erreur("Fichier trop volumineux.");
  const dossier = dossierFiche(f.getRange(n, 2).getValue(), v.id);
  const it = dossier.getFilesByName(v.nom); while (it.hasNext()) it.next().setTrashed(true);
  dossier.createFile(Utilities.newBlob(octets, v.mime || "application/octet-stream", v.nom));
  const empreinte = hex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, octets));
  const fichiers = JSON.parse(f.getRange(n, 9).getValue() || "[]").filter(x => x.nom !== v.nom);
  fichiers.push({ nom: v.nom, mime: v.mime, taille: octets.length, empreinte: empreinte, maj: Date.now() });
  f.getRange(n, 9).setValue(JSON.stringify(fichiers));
  f.getRange(n, 7).setValue(new Date());
  return sortie({ ok: true });
}
function accepterAdhesion(v, portee) {
  const f = feuille(), n = ligneDe(f, v.id);
  if (!n || (portee !== "*" && f.getRange(n, 2).getValue() !== portee)) return erreur("Fiche introuvable.");
  const meta = JSON.parse(f.getRange(n, 8).getValue());
  meta.data.adhMembre = "Oui"; meta.data.adhAnnee = meta.data.adhAnnee || String(new Date().getFullYear());
  if (v.numero) meta.data.numeroOrdre = String(v.numero).slice(0, 40);
  meta.adhesionValidee = Date.now();
  f.getRange(n, 8).setValue(JSON.stringify(meta)); f.getRange(n, 7).setValue(new Date());
  return sortie({ ok: true });
}
function supprimer(v, portee) {
  const f = feuille(), n = ligneDe(f, v.id);
  if (!n || (portee !== "*" && f.getRange(n, 2).getValue() !== portee)) return erreur("Fiche introuvable.");
  dossierFiche(f.getRange(n, 2).getValue(), v.id).setTrashed(true);
  f.deleteRow(n);
  return sortie({ ok: true });
}

/* ------------------------------------------------------------ consultation (GET) */
function doGet(e) {
  const q = e.parameter || {};
  if (!q.action || q.action === "sante") return sortie({ ok: true, service: "cnbm-drive" });
  const portee = droits(q.cle);
  if (!portee) return erreur("Clé d'accès administrateur incorrecte.");
  if (q.action === "acces") return sortie({ ok: true, portee: portee });
  if (q.action === "liste") {
    const depuis = Number(q.depuis) || 0, f = feuille(), n = f.getLastRow();
    const lignes = n > 1 ? f.getRange(2, 1, n - 1, ENTETES.length).getValues() : [];
    const fiches = lignes.filter(l => l[0] && (portee === "*" || l[1] === portee) && new Date(l[6]).getTime() > depuis).map(l => {
      const meta = JSON.parse(l[7] || "{}");
      return Object.assign(meta, { province: l[1], recu: new Date(l[5]).getTime(), maj: new Date(l[6]).getTime(), fichiersServeur: JSON.parse(l[8] || "[]") });
    });
    return sortie({ fiches: fiches, maintenant: Date.now(), portee: portee });
  }
  if (q.action === "fichier") {
    const f = feuille(), n = ligneDe(f, q.id || "");
    if (!n || (portee !== "*" && f.getRange(n, 2).getValue() !== portee) || !RE_NOM.test(q.nom || "")) return erreur("Fichier introuvable.");
    const it = dossierFiche(f.getRange(n, 2).getValue(), q.id).getFilesByName(q.nom);
    if (!it.hasNext()) return erreur("Fichier introuvable.");
    const b = it.next().getBlob();
    return sortie({ mime: b.getContentType(), data: Utilities.base64Encode(b.getBytes()) });
  }
  return erreur("Action inconnue.");
}
