// medistat/js/stats/qualitative.js
// Analyse de données QUALITATIVES — texte libre, entretiens, observations,
// commentaires de biologistes, motifs de consultation, verbatims patients.
// Codage thématique, lexicométrie, cooccurrences, concordancier, saturation,
// et passerelle méthodes mixtes vers l'analyse quantitative.

import { sum, mean } from "./descriptive.js";
import { chiSquareTable, cohenKappa } from "./inferential.js";

/* ===================== Normalisation lexicale ===================== */

// Mots vides français et anglais — écartés des analyses lexicales
export const STOPWORDS_FR = new Set(`au aux avec ce ces dans de des du elle en et eux il ils je la le les leur lui ma mais me même mes moi mon ne nos notre nous on ou par pas pour qu que qui sa se ses son sur ta te tes toi ton tu un une vos votre vous c d j l à m n s t y été étée étées étés étant suis es est sommes êtes sont serai seras sera serons serez seront étais était étions étiez étaient fus fut fûmes fûtes furent sois soit soyons soyez soient fusse fusses fût ai as a avons avez ont aurai auras aura aurons aurez auront avais avait avions aviez avaient eus eut eûmes eûtes eurent aie aies ait ayons ayez aient eusse eusses eût ayant eu eue eues eus cet cette ceux celui celle plus moins très bien aussi alors donc car ni or si comme quand dont où deux trois lors puis entre chez sans sous vers depuis pendant après avant tout tous toute toutes autre autres même mêmes tel telle quel quelle`.split(/\s+/));

export const STOPWORDS_EN = new Set(`a an and are as at be but by for if in into is it no not of on or such that the their then there these they this to was will with i you he she we they me him her us them my your his its our have has had do does did been being from would could should can may might must shall about after all also any because before between both during each few more most other over same some than too under very what when where which who whom why how`.split(/\s+/));

// Retire les accents pour la comparaison, sans altérer l'affichage
export const deaccent = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// Découpage en mots (unicode, apostrophes françaises gérées)
export function tokenize(text, { minLength = 3, stopwords = "fr", lowercase = true } = {}) {
  if (!text) return [];
  let t = String(text);
  if (lowercase) t = t.toLowerCase();
  // L'apostrophe élide un déterminant : « l'analyse » → « analyse »
  t = t.replace(/['']/g, "'").replace(/\b([cdjlmnstqu]|qu)'/g, " ");
  const words = t.match(/[\p{L}\p{N}][\p{L}\p{N}\-]*/gu) || [];
  const stop = stopwords === "fr" ? STOPWORDS_FR
    : stopwords === "en" ? STOPWORDS_EN
    : stopwords === "both" ? new Set([...STOPWORDS_FR, ...STOPWORDS_EN])
    : new Set();
  return words.filter(w => w.length >= minLength && !stop.has(w) && !/^\d+$/.test(w));
}

// Racinisation légère du français (suffixes flexionnels les plus fréquents).
// Objectif : regrouper « douleur / douleurs », « fatigué / fatiguée / fatigués ».
export function stemFr(word) {
  let w = word.toLowerCase();
  const suffixes = [
    "issements", "issement", "atrices", "atrice", "ateurs", "ations", "ation",
    "ements", "ement", "ances", "ance", "ences", "ence", "ables", "able",
    "ibles", "ible", "istes", "iste", "ismes", "isme", "euses", "euse",
    "euxes", "ités", "ité", "ives", "ive", "ifs", "if", "aux", "ales", "ale",
    "els", "elle", "eaux", "eau", "ées", "ée", "és", "es", "s", "e",
  ];
  for (const suf of suffixes) {
    if (w.length - suf.length >= 4 && w.endsWith(suf)) return w.slice(0, -suf.length);
  }
  return w;
}

/* ===================== Lexicométrie ===================== */

// Fréquences lexicales : le point de départ de toute analyse textuelle
export function wordFrequency(texts, { minLength = 3, stopwords = "fr", stem = false, top = 100 } = {}) {
  const docs = Array.isArray(texts) ? texts : [texts];
  const counts = new Map();
  const docFreq = new Map();
  let totalTokens = 0;

  docs.forEach(text => {
    const tokens = tokenize(text, { minLength, stopwords });
    const seen = new Set();
    for (const raw of tokens) {
      const w = stem ? stemFr(raw) : raw;
      counts.set(w, (counts.get(w) || 0) + 1);
      totalTokens++;
      if (!seen.has(w)) { seen.add(w); docFreq.set(w, (docFreq.get(w) || 0) + 1); }
    }
  });

  const rows = [...counts.entries()]
    .map(([word, count]) => ({
      word, count,
      frequency: totalTokens ? count / totalTokens : 0,
      documents: docFreq.get(word) || 0,
      documentFrequency: docs.length ? (docFreq.get(word) || 0) / docs.length : 0,
      // TF-IDF moyen : pondère les mots discriminants plutôt que fréquents
      tfidf: totalTokens && docs.length
        ? (count / totalTokens) * Math.log(docs.length / (docFreq.get(word) || 1))
        : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Indicateurs de richesse lexicale
  const types = rows.length;
  return {
    rows: rows.slice(0, top),
    allRows: rows,
    totalTokens, uniqueWords: types, documents: docs.length,
    typeTokenRatio: totalTokens ? types / totalTokens : 0,
    // Indice de Guiraud : richesse corrigée de la longueur du corpus
    guiraudIndex: totalTokens ? types / Math.sqrt(totalTokens) : 0,
    hapaxCount: rows.filter(r => r.count === 1).length,
    hapaxRatio: types ? rows.filter(r => r.count === 1).length / types : 0,
  };
}

// N-grammes : expressions récurrentes (« douleur thoracique », « fièvre persistante »)
export function ngrams(texts, n = 2, { minCount = 2, stopwords = "fr", top = 50 } = {}) {
  const docs = Array.isArray(texts) ? texts : [texts];
  const counts = new Map();
  for (const text of docs) {
    const tokens = tokenize(text, { stopwords });
    for (let i = 0; i + n <= tokens.length; i++) {
      const gram = tokens.slice(i, i + n).join(" ");
      counts.set(gram, (counts.get(gram) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, c]) => c >= minCount)
    .map(([ngram, count]) => ({ ngram, count, n }))
    .sort((a, b) => b.count - a.count)
    .slice(0, top);
}

// Concordancier (KWIC) : chaque occurrence d'un mot dans son contexte.
// C'est l'outil qui permet de vérifier le sens réel d'un terme codé.
export function concordance(texts, term, { window = 40, ids = null, caseSensitive = false } = {}) {
  const docs = Array.isArray(texts) ? texts : [texts];
  const out = [];
  const needle = caseSensitive ? term : deaccent(term.toLowerCase());
  docs.forEach((text, d) => {
    if (!text) return;
    const src = String(text);
    const hay = caseSensitive ? src : deaccent(src.toLowerCase());
    let from = 0, idx;
    while ((idx = hay.indexOf(needle, from)) !== -1) {
      out.push({
        document: ids ? ids[d] : d,
        position: idx,
        left: src.slice(Math.max(0, idx - window), idx),
        match: src.slice(idx, idx + term.length),
        right: src.slice(idx + term.length, idx + term.length + window),
      });
      from = idx + Math.max(1, term.length);
    }
  });
  return { term, occurrences: out.length, documents: new Set(out.map(o => o.document)).size, lines: out };
}

/* ===================== Codage thématique ===================== */

// Applique un livre de codes (mots-clés ou expressions régulières) à un corpus.
// C'est le passage du texte brut à la donnée analysable — l'étape centrale
// d'une analyse qualitative assistée par ordinateur.
export function applyCodebook(documents, codebook, { caseSensitive = false } = {}) {
  // documents : [{ id, text, meta }]  |  codebook : [{ code, theme, patterns[] }]
  const segments = [];
  const matrix = documents.map(() => codebook.map(() => 0));

  documents.forEach((doc, di) => {
    const src = String(doc.text || "");
    const hay = caseSensitive ? src : deaccent(src.toLowerCase());
    codebook.forEach((entry, ci) => {
      for (const pattern of entry.patterns || []) {
        if (pattern instanceof RegExp) {
          const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g");
          let m;
          while ((m = re.exec(src)) !== null) {
            segments.push({
              documentId: doc.id, documentIndex: di, code: entry.code, theme: entry.theme,
              start: m.index, end: m.index + m[0].length, text: m[0],
              context: src.slice(Math.max(0, m.index - 60), m.index + m[0].length + 60),
            });
            matrix[di][ci]++;
            if (!re.global) break;
          }
        } else {
          const needle = caseSensitive ? String(pattern) : deaccent(String(pattern).toLowerCase());
          let from = 0, idx;
          while ((idx = hay.indexOf(needle, from)) !== -1) {
            segments.push({
              documentId: doc.id, documentIndex: di, code: entry.code, theme: entry.theme,
              start: idx, end: idx + needle.length, text: src.slice(idx, idx + needle.length),
              context: src.slice(Math.max(0, idx - 60), idx + needle.length + 60),
            });
            matrix[di][ci]++;
            from = idx + Math.max(1, needle.length);
          }
        }
      }
    });
  });

  const codeStats = codebook.map((entry, ci) => {
    const occurrences = sum(matrix.map(r => r[ci]));
    const docs = matrix.filter(r => r[ci] > 0).length;
    return {
      code: entry.code, theme: entry.theme, occurrences,
      documents: docs,
      coverage: documents.length ? docs / documents.length : 0,
    };
  }).sort((a, b) => b.occurrences - a.occurrences);

  return {
    segments, matrix,
    codes: codebook.map(c => c.code),
    documents: documents.map(d => d.id),
    codeStats,
    totalSegments: segments.length,
    codedDocuments: matrix.filter(r => sum(r) > 0).length,
    saturation: saturationCurve(documents, segments),
  };
}

// Courbe de saturation : à partir de combien d'entretiens n'apprend-on plus
// rien de nouveau ? Critère méthodologique clé en recherche qualitative.
export function saturationCurve(documents, segments) {
  const seen = new Set();
  const curve = [];
  documents.forEach((doc, i) => {
    const before = seen.size;
    segments.filter(s => s.documentIndex === i).forEach(s => seen.add(s.code));
    curve.push({
      document: i + 1, id: doc.id,
      cumulativeCodes: seen.size,
      newCodes: seen.size - before,
    });
  });
  // Saturation atteinte : 3 documents consécutifs sans nouveau code
  let saturationPoint = null;
  for (let i = 2; i < curve.length; i++) {
    if (curve[i].newCodes === 0 && curve[i - 1].newCodes === 0 && curve[i - 2].newCodes === 0) {
      saturationPoint = i - 1;
      break;
    }
  }
  return {
    curve, saturationPoint,
    reached: saturationPoint !== null,
    interpretation: saturationPoint !== null
      ? `La saturation théorique est atteinte au document ${saturationPoint} : les documents suivants n'apportent plus de code nouveau.`
      : "La saturation n'est pas atteinte : le recueil de données devrait se poursuivre.",
  };
}

/* ===================== Cooccurrences et réseaux ===================== */

// Matrice de cooccurrence des codes : quels thèmes apparaissent ensemble ?
export function cooccurrence(matrix, labels, { minCount = 1 } = {}) {
  const k = labels.length;
  const co = Array.from({ length: k }, () => new Array(k).fill(0));
  const presence = matrix.map(r => r.map(v => (v > 0 ? 1 : 0)));
  const n = presence.length;

  for (const row of presence) {
    for (let i = 0; i < k; i++) {
      if (!row[i]) continue;
      co[i][i]++;
      for (let j = i + 1; j < k; j++) if (row[j]) { co[i][j]++; co[j][i]++; }
    }
  }

  // Liens pondérés — indice de Jaccard et information mutuelle ponctuelle
  const links = [];
  for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) {
    if (co[i][j] < minCount) continue;
    const union = co[i][i] + co[j][j] - co[i][j];
    const pi = co[i][i] / n, pj = co[j][j] / n, pij = co[i][j] / n;
    links.push({
      source: labels[i], target: labels[j],
      count: co[i][j],
      jaccard: union ? co[i][j] / union : 0,
      pmi: pi && pj && pij ? Math.log(pij / (pi * pj)) : 0,
      // Test exact de l'association entre les deux codes
      phi: phiCoefficient(presence, i, j),
    });
  }
  links.sort((a, b) => b.jaccard - a.jaccard);

  return {
    matrix: co, labels, n,
    links,
    // Centralité de degré : le code le plus « connecté » structure le corpus
    centrality: labels.map((l, i) => ({
      code: l,
      frequency: co[i][i],
      degree: links.filter(x => x.source === l || x.target === l).length,
      strength: sum(links.filter(x => x.source === l || x.target === l).map(x => x.jaccard)),
    })).sort((a, b) => b.strength - a.strength),
  };
}

function phiCoefficient(presence, i, j) {
  let a = 0, b = 0, c = 0, d = 0;
  for (const r of presence) {
    if (r[i] && r[j]) a++;
    else if (r[i] && !r[j]) b++;
    else if (!r[i] && r[j]) c++;
    else d++;
  }
  const den = Math.sqrt((a + b) * (c + d) * (a + c) * (b + d));
  return den ? (a * d - b * c) / den : 0;
}

/* ===================== Méthodes mixtes ===================== */

// Croise un code qualitatif avec une variable quantitative ou catégorielle :
// c'est ce qui permet de dire « le thème X est plus fréquent chez les femmes ».
export function codeByVariable(matrix, codeIndex, variableValues, { alpha = 0.05 } = {}) {
  const levels = [...new Set(variableValues.map(v => String(v ?? "").trim()).filter(Boolean))].sort();
  if (levels.length < 2) return null;
  const withCode = levels.map(() => 0), withoutCode = levels.map(() => 0);
  matrix.forEach((row, i) => {
    const lv = String(variableValues[i] ?? "").trim();
    const li = levels.indexOf(lv);
    if (li === -1) return;
    (row[codeIndex] > 0 ? withCode : withoutCode)[li]++;
  });
  const test = chiSquareTable([withCode, withoutCode], { alpha });
  return {
    levels, withCode, withoutCode,
    proportions: levels.map((l, i) => ({
      level: l,
      n: withCode[i] + withoutCode[i],
      withCode: withCode[i],
      percent: (withCode[i] + withoutCode[i]) ? withCode[i] * 100 / (withCode[i] + withoutCode[i]) : 0,
    })),
    test,
  };
}

// Accord inter-codeurs sur l'ensemble d'un livre de codes
export function intercoderReliability(codingA, codingB, codes) {
  // codingA / codingB : matrices documents × codes (0/1) produites par deux codeurs
  const perCode = codes.map((code, ci) => {
    const a = codingA.map(r => (r[ci] > 0 ? "1" : "0"));
    const b = codingB.map(r => (r[ci] > 0 ? "1" : "0"));
    const k = cohenKappa(a, b);
    const agree = a.filter((v, i) => v === b[i]).length / a.length;
    return {
      code,
      kappa: k ? k.statistic : null,
      agreement: agree,
      magnitude: k ? k.effect.magnitude : null,
    };
  });
  const valid = perCode.filter(p => Number.isFinite(p.kappa));
  const overall = valid.length ? mean(valid.map(p => p.kappa)) : null;
  return {
    test: "Fidélité inter-codeurs",
    perCode,
    overallKappa: overall,
    meanAgreement: mean(perCode.map(p => p.agreement)),
    interpretation: overall === null ? "Kappa non calculable."
      : overall >= 0.8 ? "Accord inter-codeurs excellent : le codage est fiable."
      : overall >= 0.6 ? "Accord inter-codeurs satisfaisant."
      : "Accord inter-codeurs insuffisant : le livre de codes doit être clarifié et une nouvelle session de codage organisée.",
  };
}

/* ===================== Analyse de sentiment lexicale ===================== */

// Lexique médical français simple, orienté vécu du patient et gravité clinique.
const LEXICON_POS = new Map(Object.entries({
  amélioration: 2, amélioré: 2, guéri: 3, guérison: 3, satisfait: 2, satisfaisant: 2,
  bien: 1, bon: 1, bonne: 1, mieux: 2, stable: 1, normal: 1, rassuré: 2,
  efficace: 2, favorable: 2, positif: 1, soulagé: 2, soulagement: 2, rapide: 1,
  excellent: 3, parfait: 3, accueillant: 2, attentif: 2, compétent: 2, écoute: 2,
}));
const LEXICON_NEG = new Map(Object.entries({
  douleur: -2, douloureux: -2, aggravation: -3, aggravé: -3, grave: -3, sévère: -3,
  mal: -2, mauvais: -2, pire: -3, inquiet: -2, inquiétude: -2, angoisse: -3,
  anxieux: -2, fatigue: -1, fatigué: -1, échec: -3, complication: -3, rechute: -3,
  insatisfait: -2, attente: -1, retard: -2, long: -1, lent: -1, difficile: -2,
  erreur: -3, négligence: -3, impoli: -2, inacceptable: -3, décevant: -2, peur: -2,
}));
const NEGATIONS = new Set(["pas", "plus", "jamais", "aucun", "aucune", "ni", "sans", "non"]);
const INTENSIFIERS = new Map(Object.entries({
  très: 1.5, extrêmement: 2, beaucoup: 1.5, trop: 1.5, vraiment: 1.3,
  assez: 0.8, peu: 0.5, légèrement: 0.5, un: 1, plutôt: 0.8,
}));

export function sentimentAnalysis(text) {
  if (!text) return { score: 0, normalized: 0, label: "neutre", matches: [] };
  const words = String(text).toLowerCase()
    .replace(/['']/g, "'")
    .match(/[\p{L}]+/gu) || [];
  let score = 0;
  const matches = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    let v = LEXICON_POS.get(w) ?? LEXICON_NEG.get(w);
    if (v === undefined) continue;
    // Négation dans les 3 mots précédents : inverse la polarité
    let negated = false;
    for (let k = Math.max(0, i - 3); k < i; k++) if (NEGATIONS.has(words[k])) negated = true;
    // Intensificateur immédiatement avant : module l'amplitude
    const intens = i > 0 ? (INTENSIFIERS.get(words[i - 1]) ?? 1) : 1;
    const finalValue = (negated ? -v : v) * intens;
    score += finalValue;
    matches.push({ word: w, base: v, negated, intensifier: intens, value: finalValue });
  }
  const normalized = words.length ? score / Math.sqrt(words.length) : 0;
  return {
    score, normalized, words: words.length, matches,
    label: normalized > 0.5 ? "positif" : normalized < -0.5 ? "négatif" : "neutre",
    polarity: matches.length ? score / matches.length : 0,
  };
}

/* ===================== Synthèse d'un corpus ===================== */

// Rapport d'analyse qualitative complet, prêt à être inséré dans un mémoire
export function corpusSummary(documents, codebook, { variable = null } = {}) {
  const coding = applyCodebook(documents, codebook);
  const texts = documents.map(d => d.text || "");
  const lexicon = wordFrequency(texts, { top: 50 });
  const co = cooccurrence(coding.matrix, coding.codes);
  const themes = new Map();
  for (const s of coding.codeStats) {
    const t = s.theme || "Sans thème";
    if (!themes.has(t)) themes.set(t, { theme: t, codes: [], occurrences: 0, documents: new Set() });
    const entry = themes.get(t);
    entry.codes.push(s.code);
    entry.occurrences += s.occurrences;
  }
  for (const s of coding.segments) {
    const t = s.theme || "Sans thème";
    themes.get(t)?.documents.add(s.documentId);
  }

  const sentiments = texts.map(sentimentAnalysis);
  const result = {
    documents: documents.length,
    totalWords: lexicon.totalTokens,
    lexicalRichness: lexicon.typeTokenRatio,
    guiraudIndex: lexicon.guiraudIndex,
    topWords: lexicon.rows.slice(0, 25),
    bigrams: ngrams(texts, 2, { minCount: 2, top: 20 }),
    coding,
    themes: [...themes.values()].map(t => ({
      theme: t.theme, codes: t.codes, occurrences: t.occurrences, documents: t.documents.size,
    })).sort((a, b) => b.occurrences - a.occurrences),
    cooccurrence: co,
    saturation: coding.saturation,
    sentiment: {
      mean: mean(sentiments.map(s => s.normalized)),
      positive: sentiments.filter(s => s.label === "positif").length,
      neutral: sentiments.filter(s => s.label === "neutre").length,
      negative: sentiments.filter(s => s.label === "négatif").length,
      byDocument: sentiments.map((s, i) => ({ id: documents[i].id, ...s })),
    },
  };

  if (variable) {
    result.byVariable = coding.codes.map((code, ci) =>
      ({ code, ...codeByVariable(coding.matrix, ci, variable) }));
  }
  return result;
}
