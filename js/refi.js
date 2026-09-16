// js/refi.js — Export REFI-QDA 1.5 (.qdpx) — standard d'échange QDA
// Compatible MAXQDA 2022+, NVivo 14+, ATLAS.ti 22+
// Structure : project.qde (XML, schéma urn:QDA-XML:project:1.0) + Sources/*.txt

import { buildZip } from "./docxout.js";
import { uid } from "./state.js";

const xmlEsc = s => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;")
  .replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// GUID déterministe et strictement hexadécimal (exigé par le schéma REFI) :
// le même identifiant QualiCode produit toujours le même GUID, ce qui garantit
// la cohérence des références croisées (CodeRef, SourceRef…).
function toGuid(id) {
  const s = String(id || "default");
  let hex = "";
  for (let i = 0; i < s.length && hex.length < 32; i++)
    hex += s.charCodeAt(i).toString(16).padStart(2, "0").slice(-2);
  let h = 0x811c9dc5; // remplissage FNV-1a pour les identifiants courts
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  while (hex.length < 32) { hex += h.toString(16).padStart(8, "0"); h = (Math.imul(h, 0x01000193) + 1) >>> 0; }
  hex = hex.slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function buildRefiQdpx(project) {
  const now = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const userGuid = toGuid("user-" + (project.id || "qc"));

  // ── Codes (hiérarchiques)
  function codeXml(code, all) {
    const children = all.filter(c => c.parentId === code.id);
    const inner = children.map(c => codeXml(c, all)).join("");
    return `<Code guid="${toGuid(code.id)}" name="${xmlEsc(code.name)}" isCodable="true" color="${xmlEsc(code.color || "#888888")}">${inner}</Code>`;
  }
  const codes = project.codes || [];
  const codesXml = codes.filter(c => !c.parentId).map(c => codeXml(c, codes)).join("");

  // ── Variables (déclaration)
  const vars = project.variables || [];
  const varsXml = vars.map(v =>
    `<Variable guid="${toGuid("var-" + v)}" name="${xmlEsc(v)}" typeOfVariable="Text"/>`
  ).join("");

  // ── Cas : porteur des valeurs de variables (le schéma les attache aux Cases)
  const casesXml = (project.documents || []).map(doc => {
    const vals = vars.map(v => {
      const val = doc.variables?.[v];
      if (!val) return "";
      return `<VariableValue><VariableRef targetGUID="${toGuid("var-" + v)}"/><TextValue>${xmlEsc(val)}</TextValue></VariableValue>`;
    }).join("");
    return `<Case guid="${toGuid("case-" + doc.id)}" name="${xmlEsc(doc.name)}">${vals}<SourceRef targetGUID="${toGuid(doc.id)}"/></Case>`;
  }).join("");

  // ── Sources : un TextSource par document, codages en PlainTextSelection
  const sourceFiles = []; // {name, text}
  const sourcesXml = (project.documents || []).map(doc => {
    const safeName = doc.name.replace(/[^a-zA-Z0-9_\-.]/g, "_").slice(0, 40);
    const filePath = `Sources/${safeName}_${String(doc.id).slice(-6)}.txt`;
    sourceFiles.push({ name: filePath, text: doc.text });

    // Seuls les segments textuels sont exportables en PlainTextSelection
    // (les zones d'images et extraits de piste ont des offsets négatifs)
    const segs = (project.segments || []).filter(s => s.docId === doc.id && s.start >= 0);
    const selectionsXml = segs.map(seg =>
      `<PlainTextSelection guid="${toGuid("sel-" + seg.id)}" startPosition="${seg.start}" endPosition="${seg.end}">` +
        `<Coding guid="${toGuid(seg.id)}" creatingUser="${userGuid}" creationDateTime="${xmlEsc(seg.created || now)}">` +
          `<CodeRef targetGUID="${toGuid(seg.codeId)}"/>` +
        `</Coding>` +
      `</PlainTextSelection>`
    ).join("");

    return `<TextSource guid="${toGuid(doc.id)}" name="${xmlEsc(doc.name)}" ` +
      `plainTextPath="internal://${xmlEsc(filePath)}" creatingUser="${userGuid}" ` +
      `creationDateTime="${xmlEsc(doc.created || now)}">${selectionsXml}</TextSource>`;
  }).join("");

  // ── Notes (mémos)
  const memoParts = [];
  if (project.memo) memoParts.push({ id: "project-memo", title: "Mémo du projet", text: project.memo, created: project.created });
  for (const m of project.memos || []) memoParts.push({ id: m.id, title: m.title || "Mémo", text: m.text, created: m.created });
  const notesXml = memoParts.map(m =>
    `<Note guid="${toGuid("note-" + m.id)}" name="${xmlEsc(m.title)}" creatingUser="${userGuid}" ` +
    `creationDateTime="${xmlEsc(m.created || now)}"><PlainTextContent>${xmlEsc(m.text)}</PlainTextContent></Note>`
  ).join("");

  // ── project.qde (l'ordre des sections suit le schéma REFI)
  const qde = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<Project name="${xmlEsc(project.name)}" origin="QualiCode 2026" ` +
    `creatingUserGUID="${userGuid}" ` +
    `creationDateTime="${xmlEsc((project.created || now).replace(/\.\d+Z$/, "Z"))}" ` +
    `modifiedDateTime="${xmlEsc((project.modified || now).replace(/\.\d+Z$/, "Z"))}" ` +
    `xmlns="urn:QDA-XML:project:1.0">\n` +
    `<Users><User guid="${userGuid}" name="Chercheur"/></Users>\n` +
    (codesXml ? `<CodeBook><Codes>${codesXml}</Codes></CodeBook>\n` : "") +
    (varsXml ? `<Variables>${varsXml}</Variables>\n` : "") +
    (casesXml ? `<Cases>${casesXml}</Cases>\n` : "") +
    (sourcesXml ? `<Sources>${sourcesXml}</Sources>\n` : "") +
    (notesXml ? `<Notes>${notesXml}</Notes>\n` : "") +
    `</Project>`;

  // ── ZIP .qdpx (méthode STORE, noms UTF-8)
  const entries = [{ name: "project.qde", text: qde }];
  for (const sf of sourceFiles) entries.push({ name: sf.name, text: sf.text });
  return buildZip(entries);
}

/* ================================================================
   Import REFI-QDA (.qdpx) — lecture des projets MAXQDA / NVivo /
   ATLAS.ti / QualiCode au format d'échange standard.
================================================================ */

// Lecteur ZIP minimal : répertoire central + décompression deflate-raw
async function readZipEntries(ab) {
  const bytes = new Uint8Array(ab);
  const view = new DataView(ab);
  // EOCD (fin de répertoire central)
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65558); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("qdpx-invalide");
  const count = view.getUint16(eocd + 10, true);
  let off = view.getUint32(eocd + 16, true);
  const entries = new Map();
  const dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (view.getUint32(off, true) !== 0x02014b50) break;
    const method = view.getUint16(off + 10, true);
    const csize = view.getUint32(off + 20, true);
    const nameLen = view.getUint16(off + 28, true);
    const extraLen = view.getUint16(off + 30, true);
    const cmtLen = view.getUint16(off + 32, true);
    const lho = view.getUint32(off + 42, true);
    const name = dec.decode(bytes.subarray(off + 46, off + 46 + nameLen));
    // En-tête local : recalcule le début réel des données
    const lNameLen = view.getUint16(lho + 26, true);
    const lExtraLen = view.getUint16(lho + 28, true);
    const dataStart = lho + 30 + lNameLen + lExtraLen;
    const data = bytes.slice(dataStart, dataStart + csize);
    let content;
    if (method === 0) content = data;
    else if (method === 8) {
      const ds = new DecompressionStream("deflate-raw");
      const w = ds.writable.getWriter();
      w.write(data).catch(() => {});
      w.close().catch(() => {});
      const chunks = [];
      const r = ds.readable.getReader();
      for (;;) { const { done, value } = await r.read(); if (done) break; chunks.push(value); }
      const len = chunks.reduce((s, c) => s + c.length, 0);
      content = new Uint8Array(len);
      let o = 0;
      for (const c of chunks) { content.set(c, o); o += c.length; }
    } else { off += 46 + nameLen + extraLen + cmtLen; continue; }
    entries.set(name, content);
    off += 46 + nameLen + extraLen + cmtLen;
  }
  return entries;
}

const CODE_IMPORT_COLORS = ["#e15759", "#f28e2b", "#edc948", "#59a14f", "#4e79a7", "#b07aa1", "#76b7b2", "#ff9da7"];

// Construit un projet QualiCode depuis un .qdpx. Retourne {project, stats}.
export async function importRefiQdpx(ab) {
  const entries = await readZipEntries(ab);
  const qdeName = [...entries.keys()].find(n => n.toLowerCase().endsWith(".qde"));
  if (!qdeName) throw new Error("qdpx-invalide");
  const xml = new DOMParser().parseFromString(new TextDecoder().decode(entries.get(qdeName)), "text/xml");
  if (xml.querySelector("parsererror")) throw new Error("qdpx-invalide");
  const all = tag => [...xml.getElementsByTagNameNS("*", tag)];
  const projEl = all("Project")[0];
  if (!projEl) throw new Error("qdpx-invalide");

  const now = new Date().toISOString();
  const project = {
    format: "qualicode-projx", version: 1, id: uid(),
    name: projEl.getAttribute("name") || "Projet importé",
    created: now, modified: now, memo: "",
    documentGroups: [], documents: [], codes: [], segments: [],
    memos: [], variables: [], trash: { documents: [], codes: [] },
    savedQueries: [], conceptMaps: [], bibliography: [],
  };

  // Codes (hiérarchie imbriquée)
  const codeIdByGuid = new Map();
  let colorIdx = 0;
  const walkCodes = (el, parentId) => {
    for (const child of el.children) {
      if (child.localName !== "Code") continue;
      const id = uid();
      codeIdByGuid.set(child.getAttribute("guid"), id);
      project.codes.push({
        id, parentId,
        name: child.getAttribute("name") || "Code",
        color: child.getAttribute("color") || CODE_IMPORT_COLORS[(colorIdx++) % CODE_IMPORT_COLORS.length],
        created: now,
      });
      walkCodes(child, id);
    }
  };
  for (const cb of all("Codes")) walkCodes(cb, null);

  // Variables déclarées
  const varNameByGuid = new Map();
  for (const v of all("Variable")) {
    const name = v.getAttribute("name");
    if (!name) continue;
    varNameByGuid.set(v.getAttribute("guid"), name);
    if (!project.variables.includes(name)) project.variables.push(name);
  }

  // Sources texte
  const docIdByGuid = new Map();
  const dec = new TextDecoder();
  for (const src of all("TextSource")) {
    const id = uid();
    docIdByGuid.set(src.getAttribute("guid"), id);
    let text = "";
    const path = src.getAttribute("plainTextPath") || "";
    const inner = [...src.children].find(c => c.localName === "PlainTextContent");
    if (path.startsWith("internal://")) {
      const p = path.slice("internal://".length);
      const bytes = entries.get(p) || entries.get(decodeURIComponent(p));
      if (bytes) text = dec.decode(bytes);
    }
    if (!text && inner) text = inner.textContent || "";
    project.documents.push({
      id, name: src.getAttribute("name") || "Document", groupId: null,
      text: text.replace(/\r\n/g, "\n"), variables: {}, created: now,
    });
    // Codages : PlainTextSelection > Coding > CodeRef (ou Coding direct)
    for (const sel of [...src.getElementsByTagNameNS("*", "PlainTextSelection")]) {
      const start = Number(sel.getAttribute("startPosition") ?? 0);
      const end = Number(sel.getAttribute("endPosition") ?? 0);
      for (const ref of [...sel.getElementsByTagNameNS("*", "CodeRef")]) {
        const codeId = codeIdByGuid.get(ref.getAttribute("targetGUID"));
        if (!codeId || !(end > start)) continue;
        project.segments.push({
          id: uid(), docId: id, codeId, start, end,
          text: text.slice(start, end), weight: 1, comment: "", created: now,
        });
      }
    }
  }

  // Cas : valeurs de variables rattachées aux sources
  for (const cas of all("Case")) {
    const refs = [...cas.getElementsByTagNameNS("*", "SourceRef")]
      .map(r => docIdByGuid.get(r.getAttribute("targetGUID"))).filter(Boolean);
    if (!refs.length) continue;
    for (const vv of [...cas.getElementsByTagNameNS("*", "VariableValue")]) {
      const vref = vv.getElementsByTagNameNS("*", "VariableRef")[0];
      const name = vref && varNameByGuid.get(vref.getAttribute("targetGUID"));
      if (!name) continue;
      const valEl = [...vv.children].find(c => /Value$/.test(c.localName) && c.localName !== "VariableRef");
      const val = valEl ? valEl.textContent.trim() : "";
      if (!val) continue;
      for (const docId of refs) {
        const doc = project.documents.find(d => d.id === docId);
        if (doc) doc.variables[name] = val;
      }
    }
  }

  // Notes → mémos (la première note « projet » devient le mémo du projet)
  for (const note of all("Note")) {
    const content = [...note.getElementsByTagNameNS("*", "PlainTextContent")].map(x => x.textContent).join("") || "";
    if (!content.trim()) continue;
    if (!project.memo) project.memo = content;
    else project.memos.push({
      id: uid(), targetType: "project", targetId: null,
      title: note.getAttribute("name") || "Mémo importé", text: content, created: now,
    });
  }

  return {
    project,
    stats: { documents: project.documents.length, codes: project.codes.length, segments: project.segments.length },
  };
}
