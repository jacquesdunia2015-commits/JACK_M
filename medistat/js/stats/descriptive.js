// medistat/js/stats/descriptive.js
// Statistiques descriptives — quantitatives et qualitatives.
// Couvre les indicateurs attendus d'un logiciel d'analyse (SPSS, R, Stata) :
// tendance centrale, dispersion, forme, position, intervalles de confiance,
// tableaux de fréquences, tableaux croisés et statistiques par groupe.

import { normal, studentt, chisquare } from "./distributions.js";

/* ===================== Nettoyage des données ===================== */

// Convertit en nombres et écarte les valeurs manquantes (NA, "", null, NaN).
export function numeric(values) {
  const out = [];
  for (const v of values) {
    if (v === null || v === undefined || v === "") continue;
    const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

export function missingCount(values) {
  return values.length - numeric(values).length;
}

/* ===================== Tendance centrale ===================== */

export const sum = xs => xs.reduce((a, b) => a + b, 0);
export const mean = xs => xs.length ? sum(xs) / xs.length : NaN;

export function median(xs) {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function mode(values) {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
  let best = -1;
  for (const c of counts.values()) if (c > best) best = c;
  const modes = [...counts.entries()].filter(([, c]) => c === best).map(([v]) => v);
  return { modes, count: best, multimodal: modes.length > 1 };
}

// Moyenne géométrique — utile pour les titres sérologiques et les charges virales
export function geometricMean(xs) {
  if (!xs.length || xs.some(x => x <= 0)) return NaN;
  return Math.exp(mean(xs.map(Math.log)));
}

// Moyenne harmonique — utile pour les taux et les débits
export function harmonicMean(xs) {
  if (!xs.length || xs.some(x => x === 0)) return NaN;
  return xs.length / sum(xs.map(x => 1 / x));
}

// Moyenne tronquée (trimmed mean), robuste aux valeurs extrêmes
export function trimmedMean(xs, proportion = 0.1) {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const k = Math.floor(s.length * proportion);
  const kept = s.slice(k, s.length - k);
  return kept.length ? mean(kept) : mean(s);
}

/* ===================== Dispersion ===================== */

// Variance d'échantillon (n−1) ou de population (n)
export function variance(xs, population = false) {
  const n = xs.length;
  if (n < 2) return NaN;
  const m = mean(xs);
  const ss = sum(xs.map(x => (x - m) ** 2));
  return ss / (population ? n : n - 1);
}

export const sd = (xs, population = false) => Math.sqrt(variance(xs, population));

export const sem = xs => sd(xs) / Math.sqrt(xs.length); // erreur-type de la moyenne

export function range(xs) {
  if (!xs.length) return NaN;
  return Math.max(...xs) - Math.min(...xs);
}

// Coefficient de variation (%) — comparaison de dispersions d'unités différentes
export function cv(xs) {
  const m = mean(xs);
  return m === 0 ? NaN : (sd(xs) / Math.abs(m)) * 100;
}

// Écart absolu médian, mis à l'échelle pour être comparable à un écart-type
export function mad(xs, constant = 1.4826) {
  const med = median(xs);
  return constant * median(xs.map(x => Math.abs(x - med)));
}

/* ===================== Position ===================== */

// Quantile — type 7 (défaut de R et de NumPy)
export function quantile(xs, p) {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  if (p <= 0) return s[0];
  if (p >= 1) return s[s.length - 1];
  const h = (s.length - 1) * p;
  const lo = Math.floor(h), hi = Math.ceil(h);
  return s[lo] + (h - lo) * (s[hi] - s[lo]);
}

export const q1 = xs => quantile(xs, 0.25);
export const q3 = xs => quantile(xs, 0.75);
export const iqr = xs => q3(xs) - q1(xs);

export function percentiles(xs, ps = [5, 10, 25, 50, 75, 90, 95]) {
  return ps.map(p => ({ p, value: quantile(xs, p / 100) }));
}

// Cotes z (standardisation)
export function zscores(xs) {
  const m = mean(xs), s = sd(xs);
  return xs.map(x => (x - m) / s);
}

/* ===================== Forme de la distribution ===================== */

// Asymétrie — g1 corrigé (identique à SPSS / Excel SKEW)
export function skewness(xs) {
  const n = xs.length;
  if (n < 3) return NaN;
  const m = mean(xs), s = sd(xs);
  const g1 = sum(xs.map(x => ((x - m) / s) ** 3)) * n / ((n - 1) * (n - 2));
  return g1;
}

export function skewnessSE(n) {
  return Math.sqrt(6 * n * (n - 1) / ((n - 2) * (n + 1) * (n + 3)));
}

// Aplatissement — excès de kurtosis corrigé (identique à SPSS / Excel KURT)
export function kurtosis(xs) {
  const n = xs.length;
  if (n < 4) return NaN;
  const m = mean(xs), s = sd(xs);
  const s4 = sum(xs.map(x => ((x - m) / s) ** 4));
  return (n * (n + 1) * s4) / ((n - 1) * (n - 2) * (n - 3)) -
    (3 * (n - 1) ** 2) / ((n - 2) * (n - 3));
}

export function kurtosisSE(n) {
  return 2 * skewnessSE(n) * Math.sqrt((n * n - 1) / ((n - 3) * (n + 5)));
}

/* ===================== Valeurs aberrantes ===================== */

// Règle de Tukey : modérées au-delà de 1,5 IQR, extrêmes au-delà de 3 IQR
export function outliersTukey(xs) {
  const lo = q1(xs), hi = q3(xs), i = hi - lo;
  const fenceLo = lo - 1.5 * i, fenceHi = hi + 1.5 * i;
  const extLo = lo - 3 * i, extHi = hi + 3 * i;
  return {
    fenceLo, fenceHi, extLo, extHi,
    mild: xs.filter(x => (x < fenceLo || x > fenceHi) && x >= extLo && x <= extHi),
    extreme: xs.filter(x => x < extLo || x > extHi),
  };
}

// Détection par cote z (|z| > seuil, 3 par convention)
export function outliersZ(xs, threshold = 3) {
  const z = zscores(xs);
  return xs.filter((_, i) => Math.abs(z[i]) > threshold);
}

/* ===================== Intervalles de confiance ===================== */

// IC de la moyenne (loi de Student)
export function ciMean(xs, level = 0.95) {
  const n = xs.length;
  if (n < 2) return null;
  const m = mean(xs), se = sem(xs);
  const t = studentt.inv(1 - (1 - level) / 2, n - 1);
  return { mean: m, se, lower: m - t * se, upper: m + t * se, level, df: n - 1 };
}

// IC d'une proportion — méthode de Wilson (recommandée, valide sur petits effectifs)
export function ciProportion(successes, n, level = 0.95, method = "wilson") {
  if (!n) return null;
  const p = successes / n;
  const z = normal.inv(1 - (1 - level) / 2);
  if (method === "wald") {
    const se = Math.sqrt(p * (1 - p) / n);
    return { p, lower: Math.max(0, p - z * se), upper: Math.min(1, p + z * se), level, method };
  }
  const d = 1 + z * z / n;
  const centre = (p + z * z / (2 * n)) / d;
  const half = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
  return { p, lower: Math.max(0, centre - half), upper: Math.min(1, centre + half), level, method: "wilson" };
}

// IC de la médiane par la loi binomiale (non paramétrique, exact)
export function ciMedian(xs, level = 0.95) {
  const n = xs.length;
  if (n < 6) return null;
  const s = [...xs].sort((a, b) => a - b);
  const z = normal.inv(1 - (1 - level) / 2);
  const k = Math.floor((n - z * Math.sqrt(n)) / 2);
  const lo = Math.max(0, k - 1), hi = Math.min(n - 1, n - k);
  return { median: median(xs), lower: s[lo], upper: s[hi], level };
}

// IC d'un taux d'incidence (loi de Poisson, méthode exacte du χ²)
export function ciRate(events, personTime, level = 0.95) {
  const a = (1 - level) / 2;
  const lower = events === 0 ? 0 : chisquare.inv(a, 2 * events) / 2;
  const upper = chisquare.inv(1 - a, 2 * (events + 1)) / 2;
  return { rate: events / personTime, lower: lower / personTime, upper: upper / personTime, level };
}

/* ===================== Résumé complet ===================== */

// Résumé d'une variable quantitative — l'équivalent de summary() + describe()
export function describe(values, level = 0.95) {
  const raw = Array.isArray(values) ? values : [...values];
  const xs = numeric(raw);
  const n = xs.length;
  if (!n) return { n: 0, missing: raw.length, empty: true };
  const s = [...xs].sort((a, b) => a - b);
  const m = mean(xs);
  const ci = ciMean(xs, level);
  return {
    n,
    missing: raw.length - n,
    sum: sum(xs),
    mean: m,
    trimmedMean: trimmedMean(xs, 0.05),
    geometricMean: xs.every(x => x > 0) ? geometricMean(xs) : null,
    median: median(xs),
    mode: mode(xs),
    min: s[0],
    max: s[n - 1],
    range: s[n - 1] - s[0],
    q1: q1(xs), q3: q3(xs), iqr: iqr(xs),
    variance: variance(xs),
    sd: sd(xs),
    sem: sem(xs),
    cv: cv(xs),
    mad: mad(xs),
    skewness: skewness(xs), skewnessSE: skewnessSE(n),
    kurtosis: kurtosis(xs), kurtosisSE: kurtosisSE(n),
    ciLower: ci?.lower ?? null, ciUpper: ci?.upper ?? null, ciLevel: level,
    percentiles: percentiles(xs),
    outliers: outliersTukey(xs),
  };
}

/* ===================== Variables qualitatives ===================== */

// Tableau de fréquences : effectifs, pourcentages, pourcentages valides et cumulés
export function frequencyTable(values, { sort = "value" } = {}) {
  const counts = new Map();
  let missing = 0;
  for (const v of values) {
    if (v === null || v === undefined || String(v).trim() === "") { missing++; continue; }
    const key = String(v).trim();
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const valid = [...counts.values()].reduce((a, b) => a + b, 0);
  const total = valid + missing;
  let rows = [...counts.entries()].map(([value, count]) => ({
    value, count,
    percent: total ? (count / total) * 100 : 0,
    validPercent: valid ? (count / valid) * 100 : 0,
  }));
  if (sort === "count") rows.sort((a, b) => b.count - a.count);
  else rows.sort((a, b) => {
    const na = Number(a.value), nb = Number(b.value);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return a.value.localeCompare(b.value, "fr");
  });
  let cum = 0;
  for (const r of rows) { cum += r.validPercent; r.cumulativePercent = cum; }
  return { rows, valid, missing, total, distinct: rows.length };
}

// Indices de diversité pour variables nominales
export function diversity(values) {
  const { rows, valid } = frequencyTable(values);
  const ps = rows.map(r => r.count / valid).filter(p => p > 0);
  const shannon = -ps.reduce((a, p) => a + p * Math.log(p), 0);
  const simpson = 1 - ps.reduce((a, p) => a + p * p, 0);
  const k = ps.length;
  return {
    shannon,
    shannonNormalized: k > 1 ? shannon / Math.log(k) : 0,
    simpson,
    categories: k,
  };
}

// Tableau croisé (contingence) à deux entrées, avec les pourcentages usuels
export function crosstab(rowValues, colValues) {
  const pairs = [];
  for (let i = 0; i < rowValues.length; i++) {
    const r = rowValues[i], c = colValues[i];
    if (r === null || r === undefined || String(r).trim() === "") continue;
    if (c === null || c === undefined || String(c).trim() === "") continue;
    pairs.push([String(r).trim(), String(c).trim()]);
  }
  const rowLevels = [...new Set(pairs.map(p => p[0]))].sort((a, b) => a.localeCompare(b, "fr"));
  const colLevels = [...new Set(pairs.map(p => p[1]))].sort((a, b) => a.localeCompare(b, "fr"));
  const counts = rowLevels.map(() => colLevels.map(() => 0));
  for (const [r, c] of pairs) counts[rowLevels.indexOf(r)][colLevels.indexOf(c)]++;
  const rowTotals = counts.map(r => r.reduce((a, b) => a + b, 0));
  const colTotals = colLevels.map((_, j) => counts.reduce((a, r) => a + r[j], 0));
  const n = pairs.length;
  const expected = counts.map((r, i) => r.map((_, j) => rowTotals[i] * colTotals[j] / n));
  return {
    rowLevels, colLevels, counts, rowTotals, colTotals, n, expected,
    rowPercent: counts.map((r, i) => r.map(v => rowTotals[i] ? v * 100 / rowTotals[i] : 0)),
    colPercent: counts.map(r => r.map((v, j) => colTotals[j] ? v * 100 / colTotals[j] : 0)),
    totalPercent: counts.map(r => r.map(v => n ? v * 100 / n : 0)),
    // Résidus standardisés ajustés : |r| > 1,96 signale une case contributive
    adjustedResiduals: counts.map((r, i) => r.map((v, j) => {
      const e = expected[i][j];
      if (!e) return 0;
      return (v - e) / Math.sqrt(e * (1 - rowTotals[i] / n) * (1 - colTotals[j] / n));
    })),
  };
}

/* ===================== Statistiques par groupe ===================== */

// Découpe une variable selon un facteur : { niveau → valeurs }
export function groupBy(values, groups) {
  const map = new Map();
  for (let i = 0; i < values.length; i++) {
    const g = groups[i];
    if (g === null || g === undefined || String(g).trim() === "") continue;
    const key = String(g).trim();
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(values[i]);
  }
  return map;
}

// Tableau descriptif comparatif par groupe — le « tableau 1 » des publications
export function describeByGroup(values, groups, level = 0.95) {
  const map = groupBy(values, groups);
  const out = [];
  for (const [group, vals] of [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "fr"))) {
    out.push({ group, ...describe(vals, level) });
  }
  return out;
}

/* ===================== Histogramme et densité ===================== */

// Règle de Sturges / Freedman-Diaconis pour le nombre de classes
export function binCount(xs, rule = "fd") {
  const n = xs.length;
  if (n < 2) return 1;
  if (rule === "sturges") return Math.ceil(Math.log2(n) + 1);
  if (rule === "sqrt") return Math.ceil(Math.sqrt(n));
  const h = 2 * iqr(xs) / Math.cbrt(n); // Freedman-Diaconis
  if (!h) return Math.ceil(Math.log2(n) + 1);
  return Math.max(1, Math.min(100, Math.ceil((Math.max(...xs) - Math.min(...xs)) / h)));
}

export function histogram(xs, bins = null) {
  if (!xs.length) return { bins: [] };
  const k = bins || binCount(xs);
  const lo = Math.min(...xs), hi = Math.max(...xs);
  const width = (hi - lo) / k || 1;
  const out = Array.from({ length: k }, (_, i) => ({
    from: lo + i * width, to: lo + (i + 1) * width, count: 0,
  }));
  for (const x of xs) {
    let i = Math.floor((x - lo) / width);
    if (i >= k) i = k - 1;
    if (i < 0) i = 0;
    out[i].count++;
  }
  for (const b of out) { b.frequency = b.count / xs.length; b.density = b.frequency / width; }
  return { bins: out, width, min: lo, max: hi, n: xs.length };
}

// Estimation de densité par noyau gaussien (règle de Silverman)
export function kde(xs, points = 128, bandwidth = null) {
  if (xs.length < 2) return [];
  const h = bandwidth || 0.9 * Math.min(sd(xs), iqr(xs) / 1.349) * Math.pow(xs.length, -0.2) || 1;
  const lo = Math.min(...xs) - 3 * h, hi = Math.max(...xs) + 3 * h;
  const step = (hi - lo) / (points - 1);
  const out = [];
  for (let i = 0; i < points; i++) {
    const x = lo + i * step;
    let d = 0;
    for (const xi of xs) d += Math.exp(-0.5 * ((x - xi) / h) ** 2);
    out.push({ x, y: d / (xs.length * h * Math.sqrt(2 * Math.PI)) });
  }
  return out;
}

// Points d'un diagramme quantile-quantile normal (contrôle visuel de normalité)
export function qqNormal(xs) {
  const n = xs.length;
  const s = [...xs].sort((a, b) => a - b);
  const m = mean(xs), sdv = sd(xs);
  return s.map((v, i) => ({
    theoretical: normal.inv((i + 1 - 0.375) / (n + 0.25)), // Blom
    sample: v,
    standardized: (v - m) / sdv,
  }));
}

// Données d'une boîte à moustaches
export function boxplotData(xs) {
  const lo = q1(xs), med = median(xs), hi = q3(xs), i = hi - lo;
  const fenceLo = lo - 1.5 * i, fenceHi = hi + 1.5 * i;
  const inside = xs.filter(x => x >= fenceLo && x <= fenceHi);
  return {
    min: Math.min(...xs), max: Math.max(...xs),
    q1: lo, median: med, q3: hi, iqr: i,
    whiskerLow: inside.length ? Math.min(...inside) : Math.min(...xs),
    whiskerHigh: inside.length ? Math.max(...inside) : Math.max(...xs),
    outliers: xs.filter(x => x < fenceLo || x > fenceHi),
    mean: mean(xs),
  };
}
