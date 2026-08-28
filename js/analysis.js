// Fonctions d'analyse : recherche, lexique, matrices (§2.6 du cahier des charges)
import { state, childCodes } from "./state.js";

/* ---------- Recherche plein texte avec opérateurs booléens ----------
   Syntaxe : les termes séparés par des espaces sont liés par ET ;
   « OU » / « OR » sépare des alternatives ; "guillemets" = phrase exacte. */
export function parseQuery(q) {
  const clauses = q.split(/\s+(?:OU|OR)\s+/i).map(clause => {
    const terms = [];
    const re = /"([^"]+)"|(\S+)/g;
    let m;
    while ((m = re.exec(clause)) !== null) {
      const term = (m[1] || m[2]).trim();
      if (term && !/^(ET|AND)$/i.test(term)) terms.push(term.toLowerCase());
    }
    return terms;
  }).filter(ts => ts.length);
  return clauses; // [[t1 ET t2] OU [t3]]
}

export function searchDocuments(query) {
  const clauses = parseQuery(query);
  if (!clauses.length) return [];
  const results = [];
  for (const doc of state.project.documents) {
    const lower = doc.text.toLowerCase();
    const matched = clauses.some(terms => terms.every(t => lower.includes(t)));
    if (!matched) continue;
    // Localise les occurrences par paragraphe pour l'affichage
    const allTerms = [...new Set(clauses.flat())];
    const paras = doc.text.split("\n");
    let offset = 0;
    for (let i = 0; i < paras.length; i++) {
      const pl = paras[i].toLowerCase();
      const hitTerms = allTerms.filter(t => pl.includes(t));
      if (hitTerms.length) {
        results.push({ docId: doc.id, paraIndex: i, paraStart: offset, text: paras[i], terms: hitTerms });
      }
      offset += paras[i].length + 1;
    }
  }
  return results;
}

/* ---------- Analyse lexicale ---------- */
export const STOPWORDS_FR = new Set(("au aux avec ce ces cet cette dans de des du elle elles en et eux il ils je j la le les leur leurs lui ma mais me même mes moi mon ne nos notre nous on ou où par pas pour qu que qui sa se ses son sur ta te tes toi ton tu un une vos votre vous y d l m n s t c qu est sont était été être avoir a ai as avons avez ont fait faire plus moins très bien tout tous toute toutes comme si alors donc or ni car aussi cela ça ceci celui celle ceux celles autre autres quand comment pourquoi parce entre vers chez sans sous après avant depuis pendant contre encore déjà toujours jamais souvent peu beaucoup trop assez").split(/\s+/));
export const STOPWORDS_EN = new Set(("a an and are as at be but by for if in into is it its of on or such that the their then there these they this to was will with i you he she we do does did not no yes have has had from than so what when where which who whom why how all any both each few more most other some can could should would may might must shall about over under again once here just own same too very s t don now").split(/\s+/));

export function tokenize(text) {
  return (text.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || [])
    .map(w => w.replace(/^[dljmnstc]['’]/, ""))
    .filter(Boolean);
}

export function wordFrequencies(docs, { minLength = 3, useStopwords = true } = {}) {
  const freq = new Map();
  for (const doc of docs) {
    for (const w of tokenize(doc.text)) {
      if (w.length < minLength) continue;
      if (useStopwords && (STOPWORDS_FR.has(w) || STOPWORDS_EN.has(w))) continue;
      freq.set(w, (freq.get(w) || 0) + 1);
    }
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]);
}

export function kwic(docs, keyword, contextChars = 45) {
  const out = [];
  const kw = keyword.toLowerCase();
  if (!kw) return out;
  for (const doc of docs) {
    const lower = doc.text.toLowerCase();
    let idx = lower.indexOf(kw);
    while (idx !== -1) {
      out.push({
        docId: doc.id,
        docName: doc.name,
        left: doc.text.slice(Math.max(0, idx - contextChars), idx),
        match: doc.text.slice(idx, idx + keyword.length),
        right: doc.text.slice(idx + keyword.length, idx + keyword.length + contextChars),
        pos: idx,
      });
      idx = lower.indexOf(kw, idx + kw.length);
    }
  }
  return out;
}

/* ---------- Matrices ---------- */
// Matrice codes × documents (fréquences)
export function codeMatrix(docs, codes) {
  const matrix = codes.map(code =>
    docs.map(doc => state.project.segments.filter(s => s.docId === doc.id && s.codeId === code.id).length)
  );
  return { docs, codes, matrix };
}

// Co-occurrences : deux codes co-occurrent si leurs segments se chevauchent dans un même document
export function coocMatrix(codes) {
  const n = codes.length;
  const matrix = Array.from({ length: n }, () => Array(n).fill(0));
  const byDoc = new Map();
  for (const s of state.project.segments) {
    if (!byDoc.has(s.docId)) byDoc.set(s.docId, []);
    byDoc.get(s.docId).push(s);
  }
  const codeIndex = new Map(codes.map((c, i) => [c.id, i]));
  for (const segs of byDoc.values()) {
    for (let i = 0; i < segs.length; i++) {
      for (let j = i + 1; j < segs.length; j++) {
        const a = segs[i], b = segs[j];
        if (a.codeId === b.codeId) continue;
        if (a.start < b.end && b.start < a.end) { // chevauchement
          const ia = codeIndex.get(a.codeId), ib = codeIndex.get(b.codeId);
          if (ia != null && ib != null) { matrix[ia][ib]++; matrix[ib][ia]++; }
        }
      }
    }
  }
  return { codes, matrix };
}

// Comparaison de groupes : codes × valeurs d'une variable de document
export function groupComparison(variable, codes) {
  const values = [...new Set(state.project.documents.map(d => d.variables?.[variable]).filter(v => v != null && v !== ""))].sort();
  const matrix = codes.map(code =>
    values.map(val => {
      const docIds = new Set(state.project.documents.filter(d => d.variables?.[variable] === val).map(d => d.id));
      return state.project.segments.filter(s => s.codeId === code.id && docIds.has(s.docId)).length;
    })
  );
  return { values, codes, matrix };
}

// Statistiques descriptives sur les variables de document
export function variableStats() {
  const out = [];
  for (const v of state.project.variables) {
    const counts = new Map();
    let n = 0;
    for (const d of state.project.documents) {
      const val = d.variables?.[v];
      if (val == null || val === "") continue;
      n++;
      counts.set(String(val), (counts.get(String(val)) || 0) + 1);
    }
    out.push({ variable: v, n, values: [...counts.entries()].sort((a, b) => b[1] - a[1]) });
  }
  return out;
}

// Codes "aplatis" dans l'ordre hiérarchique, avec profondeur
export function flatCodes(parentId = null, depth = 0) {
  const out = [];
  for (const c of childCodes(parentId)) {
    out.push({ ...c, depth });
    out.push(...flatCodes(c.id, depth + 1));
  }
  return out;
}
