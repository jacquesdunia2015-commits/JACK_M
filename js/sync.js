// js/sync.js — Collaboration par dossier partagé (niveau 2, sans serveur dédié).
// Chaque codeur publie SA copie du projet dans un dossier commun (Google Drive,
// Dropbox, OneDrive, clé USB, partage réseau…) : un fichier par codeur, donc
// aucun conflit d'écriture. On récupère les copies des collègues et on les
// fusionne avec l'outil de fusion existant (puis kappa de Cohen).
// Requiert l'API File System Access (Chrome / Edge / Opera).

const SEEN_KEY = "qualicode.sync.seen";   // { [nomFichier]: lastModified fusionné }
const CODER_KEY = "qualicode.coderName";  // nom du codeur sur CETTE machine

export function isSyncSupported() {
  return typeof window.showDirectoryPicker === "function";
}

export async function pickFolder() {
  return window.showDirectoryPicker({ mode: "readwrite" });
}

export function getCoderName() {
  try { return localStorage.getItem(CODER_KEY) || ""; } catch { return ""; }
}
export function setCoderName(name) {
  try { localStorage.setItem(CODER_KEY, name); } catch { /* stockage indisponible */ }
}

// Nom de fichier publié : qc__<projet>__<codeur>.projx
export function publishFilename(projectName, coder) {
  const safe = s => String(s).replace(/[^\p{L}\p{N} _-]/gu, "").trim().replace(/\s+/g, "_").slice(0, 40);
  return `qc__${safe(projectName) || "projet"}__${safe(coder) || "codeur"}.projx`;
}

// Écrit (ou remplace) mon fichier dans le dossier partagé
export async function writeToFolder(dirHandle, filename, content) {
  const fh = await dirHandle.getFileHandle(filename, { create: true });
  const w = await fh.createWritable();
  await w.write(content);
  await w.close();
}

// Liste les .projx du dossier, avec le fichier lisible et sa date
export async function listProjxFiles(dirHandle) {
  const out = [];
  for await (const entry of dirHandle.values()) {
    if (entry.kind !== "file" || !entry.name.toLowerCase().endsWith(".projx")) continue;
    try {
      const file = await entry.getFile();
      out.push({ name: entry.name, lastModified: file.lastModified, file });
    } catch { /* fichier illisible (en cours de synchro cloud) : ignoré */ }
  }
  return out.sort((a, b) => b.lastModified - a.lastModified);
}

// Extrait le nom du codeur depuis un nom de fichier publié par QualiCode
export function coderFromFilename(name) {
  const m = /^qc__.*__(.+)\.projx$/i.exec(name);
  return m ? m[1].replace(/_/g, " ") : "";
}

/* ---- Suivi des fichiers déjà fusionnés (pour signaler les nouveautés) ---- */
function readSeen() {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY)) || {}; } catch { return {}; }
}
export function markSeen(filename, lastModified) {
  const seen = readSeen();
  seen[filename] = lastModified;
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(seen)); } catch { /* non bloquant */ }
}
// "new" = jamais fusionné · "updated" = modifié depuis la dernière fusion · "seen" = à jour
export function fileStatus(filename, lastModified) {
  const seen = readSeen();
  if (!(filename in seen)) return "new";
  return lastModified > seen[filename] ? "updated" : "seen";
}
