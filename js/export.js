// Exports et rapports (§2.8 du cahier des charges)
import { state, getDoc, getCode } from "./state.js";
import { flatCodes, codeMatrix } from "./analysis.js";
import { t } from "./i18n.js";

function download(filename, content, mime = "text/plain;charset=utf-8") {
  const blob = new Blob(["﻿" + content], { type: mime }); // BOM pour Excel
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvEscape(v) {
  const s = String(v ?? "");
  return /[";\n\r]/.test(s) ? '"' + s.replaceAll('"', '""') + '"' : s;
}
function toCsv(rows) {
  return rows.map(r => r.map(csvEscape).join(";")).join("\r\n");
}

function safeName(name) {
  return name.replace(/[^\p{L}\p{N} _-]/gu, "").trim().replace(/\s+/g, "_") || "projet";
}

/* ---------- Projet (.projx) ---------- */
export function exportProject() {
  const json = JSON.stringify(state.project, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = safeName(state.project.name) + ".projx";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------- Segments codés → CSV ---------- */
export function exportSegmentsCsv(segments) {
  const rows = [[t("document"), t("code"), t("segment"), t("weight"), t("comment"), "Début", "Fin"]];
  for (const s of segments) {
    rows.push([getDoc(s.docId)?.name ?? "?", getCode(s.codeId)?.name ?? "?", s.text, s.weight, s.comment, s.start, s.end]);
  }
  download(safeName(state.project.name) + "_segments.csv", toCsv(rows), "text/csv;charset=utf-8");
}

/* ---------- Système de codes → CSV ---------- */
export function exportCodeSystem() {
  const rows = [[t("code"), "Niveau", t("color"), t("freq")]];
  for (const c of flatCodes()) {
    const n = state.project.segments.filter(s => s.codeId === c.id).length;
    rows.push(["  ".repeat(c.depth) + c.name, c.depth + 1, c.color, n]);
  }
  download(safeName(state.project.name) + "_codes.csv", toCsv(rows), "text/csv;charset=utf-8");
}

/* ---------- Matrice codes × documents → CSV ---------- */
export function exportMatrixCsv() {
  const codes = flatCodes();
  const { docs, matrix } = codeMatrix(state.project.documents, codes);
  const rows = [[t("code"), ...docs.map(d => d.name), t("total")]];
  codes.forEach((c, i) => {
    const line = matrix[i];
    rows.push(["  ".repeat(c.depth) + c.name, ...line, line.reduce((a, b) => a + b, 0)]);
  });
  download(safeName(state.project.name) + "_matrice.csv", toCsv(rows), "text/csv;charset=utf-8");
}

/* ---------- Rapport imprimable (HTML → impression/PDF) ---------- */
export function openPrintableReport(segments) {
  const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const codes = flatCodes();
  const byCode = new Map(codes.map(c => [c.id, []]));
  for (const s of segments) if (byCode.has(s.codeId)) byCode.get(s.codeId).push(s);

  let body = `<h1>${esc(state.project.name)} — ${esc(t("report_title"))}</h1>
  <p class="meta">${esc(t("report_generated"))} ${new Date().toLocaleString()} · ${state.project.documents.length} ${esc(t("docs"))} · ${state.project.codes.length} ${esc(t("codes_lbl"))} · ${segments.length} ${esc(t("segments_lbl"))}</p>`;

  if (state.project.memo) body += `<div class="memo"><strong>${esc(t("project_memo"))} :</strong> ${esc(state.project.memo)}</div>`;

  for (const c of codes) {
    const segs = byCode.get(c.id) || [];
    if (!segs.length) continue;
    body += `<h2 style="border-left:8px solid ${esc(c.color)};padding-left:8px">${esc(c.name)} <small>(${segs.length})</small></h2>`;
    for (const s of segs) {
      body += `<div class="seg">
        <div class="src">${esc(getDoc(s.docId)?.name ?? "?")}${s.weight !== 1 ? ` · ${esc(t("weight"))} ${s.weight}` : ""}</div>
        <blockquote>${esc(s.text)}</blockquote>
        ${s.comment ? `<div class="com">💬 ${esc(s.comment)}</div>` : ""}
      </div>`;
    }
  }

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(state.project.name)}</title>
  <style>
    body{font-family:Georgia,serif;max-width:820px;margin:32px auto;padding:0 20px;color:#222;line-height:1.55}
    h1{font-size:24px} h2{font-size:17px;margin-top:26px} .meta{color:#666;font-size:13px}
    .memo{background:#f5f2e8;border:1px solid #ddd;padding:10px 14px;border-radius:6px;font-size:14px}
    .seg{margin:10px 0 16px} .src{font-size:12px;color:#555;font-weight:bold}
    blockquote{margin:4px 0 4px 14px;border-left:3px solid #ccc;padding-left:12px;font-size:14px}
    .com{font-size:12.5px;color:#777;font-style:italic;margin-left:14px}
    @media print { body{margin:10mm} }
  </style></head><body>${body}
  <script>window.onload = () => setTimeout(() => window.print(), 300);<\/script></body></html>`;

  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); }
}
