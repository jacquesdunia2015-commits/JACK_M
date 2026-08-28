// Modèle de données et persistance locale (sauvegarde automatique — §3.5)
export const CODE_COLORS = [
  "#e15759", "#f28e2b", "#edc948", "#59a14f", "#4e79a7",
  "#b07aa1", "#76b7b2", "#ff9da7", "#9c755f", "#bab0ac",
  "#d37295", "#8cd17d", "#499894", "#f1ce63", "#86bcb6",
];

// Bibliothèque multi-projets : un index de métadonnées + une clé par projet.
// L'ancienne clé unique "qualicode.project" est migrée au premier chargement.
const LEGACY_KEY = "qualicode.project";
const INDEX_KEY = "qualicode.projects.index";
const CURRENT_KEY = "qualicode.currentProjectId";
const PROJECT_PREFIX = "qualicode.project.";
const PREFS_KEY = "qualicode.prefs";

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

export function emptyProject(name) {
  const now = new Date().toISOString();
  return {
    format: "qualicode-projx",
    version: 1,
    id: uid(),
    name: name || "Projet sans titre",
    created: now,
    modified: now,
    memo: "",
    documentGroups: [],   // {id, name}
    documents: [],        // {id, name, groupId, text, variables:{}, created}
    codes: [],            // {id, name, parentId, color, created}
    segments: [],         // {id, docId, codeId, start, end, text, weight, comment, created}
    memos: [],            // {id, targetType: project|document|code|segment, targetId, title, text, created}
    variables: [],        // ["âge", "sexe", ...]
    trash: { documents: [], codes: [] },
    savedQueries: [],   // {id, name, activatedDocs, activatedCodes, retrievalMode, created}
    conceptMaps: [],    // {id, name, nodes:[{id,label,x,y,color,width,height}], edges:[{id,from,to,label}]}
    bibliography: [],   // {id, type, authors, year, title, container, doi, notes}
  };
}

export const state = {
  project: emptyProject(),
  ui: {
    lang: "fr",
    theme: "light",
    currentDocId: null,
    activatedDocs: new Set(),
    activatedCodes: new Set(),
    selectedCodeId: null,
    retrievalMode: "or",
    showHighlights: true,
    dirty: false,
  },
};

/* ---------- Persistance : IndexedDB (gros corpus) + index localStorage ----------
   Les projets vivent dans IndexedDB (clonage structuré : pas de JSON.stringify,
   capacité en gigaoctets → des milliers de documents). Seuls l'index de la
   bibliothèque et les préférences restent dans localStorage (petits).
   Les anciens projets stockés en localStorage sont migrés au premier chargement. */
let saveTimer = null;
let onSavedCallback = null;
export function setOnSaved(cb) { onSavedCallback = cb; }

export function scheduleSave() {
  state.ui.dirty = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persistNow, 800);
}

function readIndex() {
  try { return JSON.parse(localStorage.getItem(INDEX_KEY)) || []; } catch { return []; }
}
function writeIndex(index) {
  try { localStorage.setItem(INDEX_KEY, JSON.stringify(index)); } catch (e) { console.error(e); }
}

let dbPromise = null;
function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const rq = indexedDB.open("qualicode", 1);
      rq.onupgradeneeded = () => rq.result.createObjectStore("projects");
      rq.onsuccess = () => resolve(rq.result);
      rq.onerror = () => reject(rq.error);
    });
  }
  return dbPromise;
}
function idbPut(key, value) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction("projects", "readwrite");
    tx.objectStore("projects").put(value, key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  }));
}
function idbGet(key) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const rq = db.transaction("projects").objectStore("projects").get(key);
    rq.onsuccess = () => resolve(rq.result ?? null);
    rq.onerror = () => reject(rq.error);
  }));
}
function idbDelete(key) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction("projects", "readwrite");
    tx.objectStore("projects").delete(key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  }));
}

export function persistNow() {
  state.project.modified = new Date().toISOString();
  if (!state.project.id) state.project.id = uid();
  const p = state.project;
  try {
    localStorage.setItem(CURRENT_KEY, p.id);
    const index = readIndex().filter(e => e.id !== p.id);
    index.unshift({
      id: p.id, name: p.name, modified: p.modified,
      documents: p.documents.length, codes: p.codes.length, segments: p.segments.length,
    });
    writeIndex(index);
  } catch (e) { console.error(e); }
  // Écriture asynchrone (clonage structuré : rapide même sur un gros corpus)
  return idbPut(p.id, p).then(() => {
    state.ui.dirty = false;
    if (onSavedCallback) onSavedCallback();
  }).catch(e => console.error("Autosave failed", e));
}

// Migration : ancienne clé unique + anciens projets localStorage → IndexedDB
async function migrateLegacyProjects() {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k === LEGACY_KEY || (k && k.startsWith(PROJECT_PREFIX))) keys.push(k);
    }
    for (const k of keys) {
      try {
        const p = JSON.parse(localStorage.getItem(k));
        if (p && p.format === "qualicode-projx") {
          const proj = normalizeProject(p);
          await idbPut(proj.id, proj);
          const index = readIndex().filter(e => e.id !== proj.id);
          index.unshift({
            id: proj.id, name: proj.name, modified: proj.modified,
            documents: proj.documents.length, codes: proj.codes.length, segments: proj.segments.length,
          });
          writeIndex(index);
          if (k === LEGACY_KEY) localStorage.setItem(CURRENT_KEY, proj.id);
        }
      } catch (e) { console.error(e); }
      localStorage.removeItem(k);
    }
  } catch (e) { console.error(e); }
}

export async function loadProjectById(id) {
  try {
    const p = await idbGet(id);
    if (p && p.format === "qualicode-projx") return normalizeProject(p);
  } catch (e) { console.error(e); }
  return null;
}

export function listProjects() {
  return readIndex();
}

export function deleteProjectById(id) {
  try {
    idbDelete(id).catch(e => console.error(e));
    writeIndex(readIndex().filter(e => e.id !== id));
    if (localStorage.getItem(CURRENT_KEY) === id) localStorage.removeItem(CURRENT_KEY);
  } catch (e) { console.error(e); }
}

export async function loadPersisted() {
  try {
    await migrateLegacyProjects();
    const currentId = localStorage.getItem(CURRENT_KEY);
    const candidates = [currentId, ...readIndex().map(e => e.id)].filter(Boolean);
    for (const id of candidates) {
      const p = await loadProjectById(id);
      if (p) { state.project = p; return true; }
    }
  } catch (e) { console.error(e); }
  return false;
}

export function savePrefs() {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ lang: state.ui.lang, theme: state.ui.theme }));
  } catch { /* stockage local indisponible (hébergement restreint) : préférences non persistées */ }
}
export function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) || "{}");
    if (p.lang) state.ui.lang = p.lang;
    if (p.theme) state.ui.theme = p.theme;
  } catch { /* défauts */ }
}

export function normalizeProject(p) {
  const base = emptyProject(p.name);
  const proj = Object.assign(base, p);
  proj.id = proj.id || uid();
  proj.trash = proj.trash || { documents: [], codes: [] };
  proj.memos = proj.memos || [];
  proj.variables = proj.variables || [];
  proj.savedQueries = proj.savedQueries || [];
  proj.conceptMaps = proj.conceptMaps || [];
  proj.bibliography = proj.bibliography || [];
  return proj;
}

/* ---------- Accesseurs ---------- */
export const getDoc = id => state.project.documents.find(d => d.id === id);
export const getCode = id => state.project.codes.find(c => c.id === id);
export const getGroup = id => state.project.documentGroups.find(g => g.id === id);
export const getSegment = id => state.project.segments.find(s => s.id === id);

export function childCodes(parentId) {
  return state.project.codes.filter(c => (c.parentId || null) === (parentId || null));
}

// Un code et tous ses descendants
export function codeWithDescendants(codeId) {
  const out = [codeId];
  for (const child of childCodes(codeId)) out.push(...codeWithDescendants(child.id));
  return out;
}

export function segmentsOfCode(codeId, includeChildren = false) {
  const ids = includeChildren ? new Set(codeWithDescendants(codeId)) : new Set([codeId]);
  return state.project.segments.filter(s => ids.has(s.codeId));
}

export function segmentsOfDoc(docId) {
  return state.project.segments.filter(s => s.docId === docId);
}

/* ---------- Undo / Redo (en mémoire, non persisté) ---------- */
let _undoStack = [];
let _redoStack = [];
const MAX_UNDO = 30;

function _snapshot() {
  const p = state.project;
  // Les documents sont copiés SUPERFICIELLEMENT : leurs champs volumineux
  // (text, imageData) sont immuables après l'import, on les partage par
  // référence — l'annulation reste instantanée même sur des milliers de docs.
  const copyDoc = d => ({ ...d, variables: { ...(d.variables || {}) } });
  return {
    segments: JSON.parse(JSON.stringify(p.segments)),
    codes: JSON.parse(JSON.stringify(p.codes)),
    documents: p.documents.map(copyDoc),
    documentGroups: p.documentGroups.map(g => ({ ...g })),
    trash: {
      documents: p.trash.documents.map(it => ({ doc: copyDoc(it.doc), segments: it.segments.slice() })),
      codes: p.trash.codes.map(it => ({ codes: it.codes.map(c => ({ ...c })), segments: it.segments.slice() })),
    },
    memos: JSON.parse(JSON.stringify(p.memos)),
    variables: p.variables.slice(),
    bibliography: JSON.parse(JSON.stringify(p.bibliography || [])),
  };
}

export function pushUndoSnapshot() {
  _undoStack.push(_snapshot());
  if (_undoStack.length > MAX_UNDO) _undoStack.shift();
  _redoStack = [];
}

export function clearUndoHistory() {
  _undoStack = [];
  _redoStack = [];
}

export function undoAction() {
  if (!_undoStack.length) return false;
  _redoStack.push(_snapshot());
  Object.assign(state.project, _undoStack.pop());
  scheduleSave();
  return true;
}

export function redoAction() {
  if (!_redoStack.length) return false;
  _undoStack.push(_snapshot());
  Object.assign(state.project, _redoStack.pop());
  scheduleSave();
  return true;
}

export function canUndo() { return _undoStack.length > 0; }
export function canRedo() { return _redoStack.length > 0; }

/* ---------- Mutations ---------- */
export function addDocument(name, text, groupId = null) {
  pushUndoSnapshot();
  const doc = { id: uid(), name, groupId, text, variables: {}, created: new Date().toISOString() };
  state.project.documents.push(doc);
  scheduleSave();
  return doc;
}

export function addGroup(name) {
  pushUndoSnapshot();
  const g = { id: uid(), name };
  state.project.documentGroups.push(g);
  scheduleSave();
  return g;
}

export function addCode(name, parentId = null, color = null) {
  pushUndoSnapshot();
  const c = {
    id: uid(), name, parentId,
    color: color || CODE_COLORS[state.project.codes.length % CODE_COLORS.length],
    created: new Date().toISOString(),
  };
  state.project.codes.push(c);
  scheduleSave();
  return c;
}

export function addSegment(docId, codeId, start, end, text) {
  // Évite les doublons exacts (même code, même plage)
  const dup = state.project.segments.find(s => s.docId === docId && s.codeId === codeId && s.start === start && s.end === end);
  if (dup) return dup;
  pushUndoSnapshot(); // seulement si on ajoute vraiment un nouveau segment
  const s = { id: uid(), docId, codeId, start, end, text, weight: 1, comment: "", created: new Date().toISOString() };
  state.project.segments.push(s);
  scheduleSave();
  return s;
}

export function deleteSegment(segId) {
  pushUndoSnapshot();
  state.project.segments = state.project.segments.filter(s => s.id !== segId);
  scheduleSave();
}

export function trashDocument(docId) {
  const doc = getDoc(docId);
  if (!doc) return;
  pushUndoSnapshot();
  const segs = segmentsOfDoc(docId);
  state.project.trash.documents.push({ doc, segments: segs });
  state.project.documents = state.project.documents.filter(d => d.id !== docId);
  state.project.segments = state.project.segments.filter(s => s.docId !== docId);
  state.ui.activatedDocs.delete(docId);
  if (state.ui.currentDocId === docId) state.ui.currentDocId = null;
  scheduleSave();
}

export function trashCode(codeId) {
  pushUndoSnapshot();
  const ids = codeWithDescendants(codeId);
  const codes = state.project.codes.filter(c => ids.includes(c.id));
  const segs = state.project.segments.filter(s => ids.includes(s.codeId));
  state.project.trash.codes.push({ codes, segments: segs });
  state.project.codes = state.project.codes.filter(c => !ids.includes(c.id));
  state.project.segments = state.project.segments.filter(s => !ids.includes(s.codeId));
  ids.forEach(id => state.ui.activatedCodes.delete(id));
  if (ids.includes(state.ui.selectedCodeId)) state.ui.selectedCodeId = null;
  scheduleSave();
}

export function restoreTrashedDoc(index) {
  pushUndoSnapshot();
  const item = state.project.trash.documents.splice(index, 1)[0];
  if (!item) return;
  state.project.documents.push(item.doc);
  // Ne restaure que les segments dont le code existe encore
  const codeIds = new Set(state.project.codes.map(c => c.id));
  state.project.segments.push(...item.segments.filter(s => codeIds.has(s.codeId)));
  scheduleSave();
}

export function restoreTrashedCode(index) {
  pushUndoSnapshot();
  const item = state.project.trash.codes.splice(index, 1)[0];
  if (!item) return;
  state.project.codes.push(...item.codes);
  const docIds = new Set(state.project.documents.map(d => d.id));
  state.project.segments.push(...item.segments.filter(s => docIds.has(s.docId)));
  scheduleSave();
}

/* ---------- Requêtes sauvegardées ---------- */
export function saveQuery(name, activatedDocs, activatedCodes, retrievalMode) {
  const q = {
    id: uid(), name,
    activatedDocs: [...activatedDocs],
    activatedCodes: [...activatedCodes],
    retrievalMode,
    created: new Date().toISOString(),
  };
  state.project.savedQueries.push(q);
  scheduleSave();
  return q;
}

export function deleteQuery(id) {
  state.project.savedQueries = state.project.savedQueries.filter(q => q.id !== id);
  scheduleSave();
}

export function upsertMemo(targetType, targetId, text, title = "") {
  let memo = state.project.memos.find(m => m.targetType === targetType && m.targetId === targetId);
  if (memo) {
    memo.text = text; memo.title = title || memo.title; memo.modified = new Date().toISOString();
  } else {
    memo = { id: uid(), targetType, targetId, title, text, created: new Date().toISOString() };
    state.project.memos.push(memo);
  }
  scheduleSave();
  return memo;
}

export function getMemo(targetType, targetId) {
  return state.project.memos.find(m => m.targetType === targetType && m.targetId === targetId);
}
