// js/biblio.js — Références bibliographiques (exports Zotero / EndNote / Mendeley)
// Formats lus : RIS (.ris) et BibTeX (.bib). Stockées dans le projet
// (project.bibliography), exportables en liste formatée pour le mémoire.

export function detectBiblioFormat(filename, text) {
  if (/^\s*TY\s{2}-\s/m.test(text)) return "ris";
  if (/@\w+\s*\{/.test(text)) return "bibtex";
  if (/\.ris$/i.test(filename)) return "ris";
  if (/\.bib$/i.test(filename)) return "bibtex";
  return null;
}

const RIS_TYPES = { JOUR: "article", BOOK: "livre", CHAP: "chapitre", THES: "thèse", RPRT: "rapport", CONF: "communication", ELEC: "en ligne" };

export function parseRis(text) {
  const refs = [];
  let cur = null;
  for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
    const m = /^([A-Z][A-Z0-9])\s{2}-\s?(.*)$/.exec(line.trim());
    if (!m) continue;
    const [, tag, valRaw] = m;
    const val = valRaw.trim();
    if (tag === "TY") { cur = { authors: [], type: RIS_TYPES[val] || val.toLowerCase() }; continue; }
    if (!cur) continue;
    if (tag === "ER") { refs.push(finishRef(cur)); cur = null; continue; }
    if (tag === "AU" || tag === "A1") cur.authors.push(val);
    else if (tag === "PY" || tag === "Y1") cur.year = (val.match(/\d{4}/) || [""])[0];
    else if (tag === "TI" || tag === "T1") cur.title = val;
    else if (tag === "JO" || tag === "JF" || tag === "T2" || tag === "BT") cur.container = cur.container || val;
    else if (tag === "DO") cur.doi = val;
    else if (tag === "PB") cur.publisher = val;
    else if (tag === "VL") cur.volume = val;
    else if (tag === "IS") cur.issue = val;
    else if (tag === "SP") cur.pages = val + (cur.pages ? "–" + cur.pages : "");
    else if (tag === "EP") cur.pages = cur.pages ? cur.pages.split("–")[0] + "–" + val : val;
  }
  if (cur) refs.push(finishRef(cur));
  return refs.filter(r => r.title);
}

export function parseBibtex(text) {
  const refs = [];
  const entryRe = /@(\w+)\s*\{\s*([^,]*),([\s\S]*?)\n\}/g;
  let m;
  while ((m = entryRe.exec(text)) !== null) {
    const fields = {};
    const fieldRe = /(\w+)\s*=\s*(?:\{((?:[^{}]|\{[^{}]*\})*)\}|"([^"]*)"|(\w+))/g;
    let fm;
    while ((fm = fieldRe.exec(m[3])) !== null)
      fields[fm[1].toLowerCase()] = (fm[2] ?? fm[3] ?? fm[4] ?? "").replace(/[{}]/g, "").trim();
    const type = { article: "article", book: "livre", incollection: "chapitre", inproceedings: "communication", phdthesis: "thèse", mastersthesis: "mémoire", techreport: "rapport" }[m[1].toLowerCase()] || m[1].toLowerCase();
    refs.push(finishRef({
      type,
      authors: (fields.author || "").split(/\s+and\s+/i).filter(Boolean),
      year: (fields.year || "").match(/\d{4}/)?.[0] || "",
      title: fields.title || "",
      container: fields.journal || fields.booktitle || "",
      publisher: fields.publisher || "",
      volume: fields.volume || "", issue: fields.number || "",
      pages: (fields.pages || "").replace(/--/g, "–"),
      doi: fields.doi || "",
    }));
  }
  return refs.filter(r => r.title);
}

function finishRef(r) {
  return {
    type: r.type || "article",
    authors: r.authors || [],
    year: r.year || "",
    title: r.title || "",
    container: r.container || "",
    publisher: r.publisher || "",
    volume: r.volume || "", issue: r.issue || "", pages: r.pages || "",
    doi: r.doi || "",
  };
}

// « Nom, P. » quel que soit l'ordre d'origine (« Nom, Prénom » ou « Prénom Nom »)
function apaAuthor(a) {
  const s = a.trim();
  if (!s) return "";
  if (s.includes(",")) {
    const [last, first] = s.split(",").map(x => x.trim());
    return last + (first ? ", " + first.split(/\s+/).map(p => p[0].toUpperCase() + ".").join(" ") : "");
  }
  const parts = s.split(/\s+/);
  if (parts.length === 1) return s;
  const last = parts.pop();
  return last + ", " + parts.map(p => p[0].toUpperCase() + ".").join(" ");
}

// Référence formatée (style proche APA 7, suffisant pour un mémoire)
export function formatApa(r) {
  const auths = r.authors.map(apaAuthor).filter(Boolean);
  let names = auths.length > 3 ? auths.slice(0, 3).join(", ") + ", et al." : auths.join(auths.length > 1 ? ", " : "");
  if (auths.length === 2) names = auths[0] + " & " + auths[1];
  const year = r.year ? ` (${r.year}).` : "";
  let rest = ` ${r.title}.`;
  if (r.container) {
    rest += ` ${r.container}`;
    if (r.volume) rest += `, ${r.volume}` + (r.issue ? `(${r.issue})` : "");
    if (r.pages) rest += `, ${r.pages}`;
    rest += ".";
  } else if (r.publisher) {
    rest += ` ${r.publisher}.`;
  }
  if (r.doi) rest += ` https://doi.org/${r.doi.replace(/^https?:\/\/doi\.org\//, "")}`;
  return (names || "Anonyme") + year + rest;
}
