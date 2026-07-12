// js/refi.js — Export REFI-QDA 1.5 (.qdpx) — standard d'échange QDA
// Compatible MAXQDA 2022+, NVivo 14+, ATLAS.ti 22+
// Structure : project.qde (XML, schéma urn:QDA-XML:project:1.0) + Sources/*.txt

import { buildZip } from "./docxout.js";

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

    const segs = (project.segments || []).filter(s => s.docId === doc.id);
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
