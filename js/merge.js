// Fusion de projets (travail en équipe asynchrone, §2.1) et
// accord inter-codeurs par kappa de Cohen (§2.9, critère d'acceptation n°4).
import { uid } from "./state.js";

/**
 * Fusionne `incoming` dans `target` (mutation de `target`).
 * - Documents appariés par nom + texte identiques ; sinon ajoutés.
 * - Codes appariés par chemin hiérarchique (mêmes noms au même niveau) ; sinon créés.
 * - Segments importés étiquetés avec `coderLabel` (sauf s'ils portent déjà un codeur).
 * Retourne des statistiques de fusion.
 */
export function mergeProjects(target, incoming, coderLabel = "C2") {
  const stats = {
    docsMatched: 0, docsAdded: 0,
    codesMatched: 0, codesAdded: 0,
    segmentsAdded: 0, segmentsSkipped: 0,
    memosAdded: 0,
  };

  // Groupes de documents (appariement par nom)
  const groupMap = new Map();
  for (const g of incoming.documentGroups || []) {
    const existing = target.documentGroups.find(x => x.name === g.name);
    if (existing) groupMap.set(g.id, existing.id);
    else {
      const ng = { id: uid(), name: g.name };
      target.documentGroups.push(ng);
      groupMap.set(g.id, ng.id);
    }
  }

  // Documents
  const docMap = new Map();
  for (const d of incoming.documents || []) {
    const match = target.documents.find(x => x.name === d.name && x.text === d.text);
    if (match) {
      docMap.set(d.id, match.id);
      stats.docsMatched++;
      match.variables = { ...(d.variables || {}), ...(match.variables || {}) }; // l'existant prime
    } else {
      let name = d.name;
      if (target.documents.some(x => x.name === name)) name += " (fusion)";
      const nd = { ...d, id: uid(), name, groupId: d.groupId ? (groupMap.get(d.groupId) ?? null) : null };
      target.documents.push(nd);
      docMap.set(d.id, nd.id);
      stats.docsAdded++;
    }
  }

  // Codes : appariement niveau par niveau sur le nom (chemin hiérarchique)
  const codeMap = new Map();
  const mergeLevel = (incomingParent, targetParent) => {
    const children = (incoming.codes || []).filter(c => (c.parentId || null) === incomingParent);
    for (const c of children) {
      const match = target.codes.find(x => (x.parentId || null) === targetParent && x.name === c.name);
      if (match) {
        codeMap.set(c.id, match.id);
        stats.codesMatched++;
        mergeLevel(c.id, match.id);
      } else {
        const nc = { ...c, id: uid(), parentId: targetParent };
        target.codes.push(nc);
        codeMap.set(c.id, nc.id);
        stats.codesAdded++;
        mergeLevel(c.id, nc.id);
      }
    }
  };
  mergeLevel(null, null);

  // Variables
  for (const v of incoming.variables || []) {
    if (!target.variables.includes(v)) target.variables.push(v);
  }

  // Segments (étiquetés par codeur)
  for (const s of incoming.segments || []) {
    const docId = docMap.get(s.docId);
    const codeId = codeMap.get(s.codeId);
    if (!docId || !codeId) { stats.segmentsSkipped++; continue; }
    const coder = s.coder || coderLabel;
    const dup = (target.segments || []).find(x =>
      x.docId === docId && x.codeId === codeId && x.start === s.start && x.end === s.end &&
      (x.coder || "C1") === coder);
    if (dup) { stats.segmentsSkipped++; continue; }
    target.segments.push({ ...s, id: uid(), docId, codeId, coder });
    stats.segmentsAdded++;
  }

  // Mémos (hors mémos de segments, dont les cibles ne sont pas transposables)
  for (const m of incoming.memos || []) {
    if (m.targetType === "segment") continue;
    let targetId = m.targetId;
    if (m.targetType === "document") targetId = docMap.get(m.targetId);
    else if (m.targetType === "code") targetId = codeMap.get(m.targetId);
    if (m.targetType !== "project" && !targetId) continue;
    const dup = target.memos.find(x => x.targetType === m.targetType && x.targetId === targetId && x.text === m.text);
    if (!dup) {
      target.memos.push({ ...m, id: uid(), targetId });
      stats.memosAdded++;
    }
  }

  return stats;
}

/** Étiquettes de codeurs présentes dans le projet ("C1" pour les segments non étiquetés). */
export function coderLabels(project) {
  return [...new Set((project.segments || []).map(s => s.coder || "C1"))].sort();
}

/**
 * Accord inter-codeurs (kappa de Cohen), unité d'analyse : le paragraphe.
 * Pour chaque code et chaque paragraphe des documents codés par les deux codeurs,
 * on compare « le codeur a appliqué ce code ici » (oui/non) entre A et B.
 */
export function interCoderAgreement(project, coderA, coderB) {
  const segsA = project.segments.filter(s => (s.coder || "C1") === coderA);
  const segsB = project.segments.filter(s => (s.coder || "C1") === coderB);
  const docsA = new Set(segsA.map(s => s.docId));
  const docsB = new Set(segsB.map(s => s.docId));
  const sharedDocs = project.documents.filter(d => docsA.has(d.id) && docsB.has(d.id));

  // Unités : paragraphes non vides des documents partagés
  const units = [];
  for (const d of sharedDocs) {
    let off = 0;
    for (const para of d.text.split("\n")) {
      if (para.trim()) units.push({ docId: d.id, start: off, end: off + para.length });
      off += para.length + 1;
    }
  }

  const overlaps = (s, u) => s.docId === u.docId && s.start < u.end && s.end > u.start;
  const kappaOf = (a, b, c, d) => {
    const n = a + b + c + d;
    if (!n) return { po: 0, kappa: 0 };
    const po = (a + d) / n;
    const pe = ((a + b) * (a + c) + (c + d) * (b + d)) / (n * n);
    return { po, kappa: pe === 1 ? 1 : (po - pe) / (1 - pe) };
  };

  const perCode = [];
  let A = 0, B = 0, C = 0, D = 0; // agrégats pour le kappa global
  for (const code of project.codes) {
    const cA = segsA.filter(s => s.codeId === code.id);
    const cB = segsB.filter(s => s.codeId === code.id);
    if (!cA.length && !cB.length) continue;
    let a = 0, b = 0, c = 0, d = 0;
    for (const u of units) {
      const inA = cA.some(s => overlaps(s, u));
      const inB = cB.some(s => overlaps(s, u));
      if (inA && inB) a++;
      else if (inA) b++;
      else if (inB) c++;
      else d++;
    }
    perCode.push({ code, a, b, c, d, n: a + b + c + d, ...kappaOf(a, b, c, d) });
    A += a; B += b; C += c; D += d;
  }

  return {
    sharedDocs: sharedDocs.length,
    units: units.length,
    perCode,
    overall: { n: A + B + C + D, ...kappaOf(A, B, C, D) },
  };
}

/** Interprétation du kappa selon Landis & Koch (1977) — clé i18n. */
export function kappaInterpretation(k) {
  if (k < 0) return "kappa_poor";
  if (k <= 0.20) return "kappa_slight";
  if (k <= 0.40) return "kappa_fair";
  if (k <= 0.60) return "kappa_moderate";
  if (k <= 0.80) return "kappa_substantial";
  return "kappa_almost";
}
