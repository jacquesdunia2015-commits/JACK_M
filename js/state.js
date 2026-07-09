// Modèle de données et persistance locale (sauvegarde automatique — §3.5)
export const CODE_COLORS = [
  "#e15759", "#f28e2b", "#edc948", "#59a14f", "#4e79a7",
  "#b07aa1", "#76b7b2", "#ff9da7", "#9c755f", "#bab0ac",
  "#d37295", "#8cd17d", "#499894", "#f1ce63", "#86bcb6",
];

const STORAGE_KEY = "qualicode.project";
const PREFS_KEY = "qualicode.prefs";

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

export function emptyProject(name) {
  const now = new Date().toISOString();
  return {
    format: "qualicode-projx",
    version: 1,
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

/* ---------- Persistance ---------- */
let saveTimer = null;
let onSavedCallback = null;
export function setOnSaved(cb) { onSavedCallback = cb; }

export function scheduleSave() {
  state.ui.dirty = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persistNow, 800);
}

export function persistNow() {
  state.project.modified = new Date().toISOString();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.project));
    state.ui.dirty = false;
    if (onSavedCallback) onSavedCallback();
  } catch (e) {
    console.error("Autosave failed", e);
  }
}

export function loadPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && p.format === "qualicode-projx") { state.project = normalizeProject(p); return true; }
    }
  } catch (e) { console.error(e); }
  return false;
}

export function savePrefs() {
  localStorage.setItem(PREFS_KEY, JSON.stringify({ lang: state.ui.lang, theme: state.ui.theme }));
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
  proj.trash = proj.trash || { documents: [], codes: [] };
  proj.memos = proj.memos || [];
  proj.variables = proj.variables || [];
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

/* ---------- Mutations ---------- */
export function addDocument(name, text, groupId = null) {
  const doc = { id: uid(), name, groupId, text, variables: {}, created: new Date().toISOString() };
  state.project.documents.push(doc);
  scheduleSave();
  return doc;
}

export function addGroup(name) {
  const g = { id: uid(), name };
  state.project.documentGroups.push(g);
  scheduleSave();
  return g;
}

export function addCode(name, parentId = null, color = null) {
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
  const s = { id: uid(), docId, codeId, start, end, text, weight: 1, comment: "", created: new Date().toISOString() };
  state.project.segments.push(s);
  scheduleSave();
  return s;
}

export function deleteSegment(segId) {
  state.project.segments = state.project.segments.filter(s => s.id !== segId);
  scheduleSave();
}

export function trashDocument(docId) {
  const doc = getDoc(docId);
  if (!doc) return;
  const segs = segmentsOfDoc(docId);
  state.project.trash.documents.push({ doc, segments: segs });
  state.project.documents = state.project.documents.filter(d => d.id !== docId);
  state.project.segments = state.project.segments.filter(s => s.docId !== docId);
  state.ui.activatedDocs.delete(docId);
  if (state.ui.currentDocId === docId) state.ui.currentDocId = null;
  scheduleSave();
}

export function trashCode(codeId) {
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
  const item = state.project.trash.documents.splice(index, 1)[0];
  if (!item) return;
  state.project.documents.push(item.doc);
  // Ne restaure que les segments dont le code existe encore
  const codeIds = new Set(state.project.codes.map(c => c.id));
  state.project.segments.push(...item.segments.filter(s => codeIds.has(s.codeId)));
  scheduleSave();
}

export function restoreTrashedCode(index) {
  const item = state.project.trash.codes.splice(index, 1)[0];
  if (!item) return;
  state.project.codes.push(...item.codes);
  const docIds = new Set(state.project.documents.map(d => d.id));
  state.project.segments.push(...item.segments.filter(s => docIds.has(s.docId)));
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
