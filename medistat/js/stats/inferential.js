// medistat/js/stats/inferential.js
// Statistiques inférentielles — tests paramétriques et non paramétriques.
// Chaque test renvoie un objet homogène :
//   { test, statistic, df, p, effect, ci, decision, interpretation, assumptions }
// afin que l'interface puisse afficher n'importe quel résultat sans code
// spécifique, et que les rapports soient rédigés automatiquement en français.

import {
  normal, studentt, chisquare, fdist, tukey,
  binomial, lchoose, gammaln,
} from "./distributions.js";
import {
  mean, sd, variance, median, quantile, numeric, sum, crosstab,
} from "./descriptive.js";

/* ===================== Utilitaires communs ===================== */

// Enveloppe standard d'un résultat de test
function result(o) {
  const alpha = o.alpha ?? 0.05;
  const significant = Number.isFinite(o.p) ? o.p < alpha : null;
  return {
    ...o,
    alpha,
    significant,
    decision: significant === null ? "indéterminé"
      : significant ? "Rejet de H₀" : "Non-rejet de H₀",
  };
}

// Rangs moyens avec gestion des ex æquo, et somme des corrections de liens
export function ranks(xs) {
  const idx = xs.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const r = new Array(xs.length);
  const tieGroups = [];
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
    if (j > i) tieGroups.push(j - i + 1);
    i = j + 1;
  }
  return { ranks: r, tieGroups, tieCorrection: sum(tieGroups.map(t => t ** 3 - t)) };
}

/* ============================================================
   1. TESTS DE NORMALITÉ ET DE DISTRIBUTION
   ============================================================ */

// Test de Shapiro-Wilk (Royston 1995, AS R94) — référence pour n de 3 à 5000
export function shapiroWilk(values) {
  const x = numeric(values).sort((a, b) => a - b);
  const n = x.length;
  if (n < 3) return null;
  if (n > 5000) return { test: "Shapiro-Wilk", note: "n > 5000 : test non applicable", p: null };

  // Coefficients m_i = Φ⁻¹((i − 3/8)/(n + 1/4))
  const m = [];
  for (let i = 1; i <= n; i++) m.push(normal.inv((i - 0.375) / (n + 0.25)));
  const ssm = sum(m.map(v => v * v));
  const rsn = 1 / Math.sqrt(n);
  const a = new Array(n);

  const poly = (c, xx) => c.reduce((acc, ci, k) => acc + ci * xx ** k, 0);
  const c1 = [0, 0.221157, -0.147981, -2.071190, 4.434685, -2.706056];
  const c2 = [0, 0.042981, -0.293762, -1.752461, 5.682633, -3.582633];

  // a_n = c_n + correction polynomiale, avec c = m/‖m‖. Le vecteur a est
  // antisymétrique et croissant comme m : négatif pour les petites valeurs
  // ordonnées, positif pour les grandes.
  const an = m[n - 1] / Math.sqrt(ssm) + poly(c1, rsn);
  let phi;
  if (n > 5) {
    const an1 = m[n - 2] / Math.sqrt(ssm) + poly(c2, rsn);
    phi = (ssm - 2 * m[n - 1] ** 2 - 2 * m[n - 2] ** 2) /
      (1 - 2 * an ** 2 - 2 * an1 ** 2);
    a[n - 1] = an; a[0] = -an;
    a[n - 2] = an1; a[1] = -an1;
    for (let i = 2; i < n - 2; i++) a[i] = m[i] / Math.sqrt(phi);
  } else {
    phi = (ssm - 2 * m[n - 1] ** 2) / (1 - 2 * an ** 2);
    a[n - 1] = an; a[0] = -an;
    for (let i = 1; i < n - 1; i++) a[i] = m[i] / Math.sqrt(phi);
  }

  const xbar = mean(x);
  const num = sum(a.map((ai, i) => ai * x[i])) ** 2;
  const den = sum(x.map(v => (v - xbar) ** 2));
  if (den === 0) return null;
  const W = num / den;

  // Valeur p : normalisation de Royston selon la taille d'échantillon
  let p;
  if (n === 3) {
    const pi6 = 1.909859, stqr = 1.047198;
    p = Math.max(0, Math.min(1, pi6 * (Math.asin(Math.sqrt(W)) - stqr)));
  } else if (n <= 11) {
    const g = [-2.273, 0.459];
    const gamma = g[0] + g[1] * n;
    const w = -Math.log(gamma - Math.log(1 - W));
    const mu = poly([0.5440, -0.39978, 0.025054, -6.714e-4], n);
    const sig = Math.exp(poly([1.3822, -0.77857, 0.062767, -0.0020322], n));
    p = 1 - normal.cdf((w - mu) / sig);
  } else {
    const ln = Math.log(n);
    const w = Math.log(1 - W);
    const mu = poly([-1.5861, -0.31082, -0.083751, 0.0038915], ln);
    const sig = Math.exp(poly([-0.4803, -0.082676, 0.0030302], ln));
    p = 1 - normal.cdf((w - mu) / sig);
  }

  return result({
    test: "Test de Shapiro-Wilk (normalité)",
    statistic: W, statisticName: "W", df: null, p, n,
    interpretation: p < 0.05
      ? "La distribution s'écarte significativement de la loi normale : privilégier les tests non paramétriques."
      : "Aucun écart significatif à la normalité n'est détecté : les tests paramétriques sont utilisables.",
  });
}

// Test de Kolmogorov-Smirnov (une distribution, avec correction de Lilliefors
// lorsque la moyenne et l'écart-type sont estimés sur l'échantillon)
export function kolmogorovSmirnov(values, { lilliefors = true } = {}) {
  const x = numeric(values).sort((a, b) => a - b);
  const n = x.length;
  if (n < 4) return null;
  const m = mean(x), s = sd(x);
  let D = 0;
  for (let i = 0; i < n; i++) {
    const F = normal.cdf(x[i], m, s);
    D = Math.max(D, Math.abs((i + 1) / n - F), Math.abs(F - i / n));
  }
  let p;
  if (lilliefors) {
    // Statistique modifiée et valeur p de Dallal-Wilkinson (p < 0,1), complétée
    // par les approximations polynomiales de Stephens au-delà — c'est la
    // procédure retenue par le paquet R `nortest` (lillie.test).
    const dmod = D * (Math.sqrt(n) - 0.01 + 0.85 / Math.sqrt(n));
    const pDW = Math.exp(-7.01256 * dmod * dmod * (n + 2.78019) +
      2.99587 * dmod * Math.sqrt(n + 2.78019) - 0.122119 +
      0.974598 / Math.sqrt(n) + 1.67997 / n);
    if (pDW < 0.1) {
      p = pDW;
    } else if (dmod < 0.302) {
      p = 1;
    } else if (dmod < 0.5) {
      p = 2.76773 - 19.828315 * dmod + 80.709644 * dmod ** 2 -
        138.55152 * dmod ** 3 + 81.218052 * dmod ** 4;
    } else if (dmod < 0.9) {
      p = -4.901232 + 40.662806 * dmod - 97.490286 * dmod ** 2 +
        94.029866 * dmod ** 3 - 32.355711 * dmod ** 4;
    } else if (dmod < 1.31) {
      p = 6.198765 - 19.558097 * dmod + 23.186922 * dmod ** 2 -
        12.234627 * dmod ** 3 + 2.423045 * dmod ** 4;
    } else {
      p = 0;
    }
    p = Math.max(0, Math.min(1, p));
  } else {
    // Loi asymptotique de Kolmogorov
    const t = D * (Math.sqrt(n) + 0.12 + 0.11 / Math.sqrt(n));
    p = 0;
    for (let k = 1; k <= 100; k++) p += 2 * (-1) ** (k - 1) * Math.exp(-2 * k * k * t * t);
    p = Math.max(0, Math.min(1, p));
  }
  return result({
    test: lilliefors ? "Kolmogorov-Smirnov (correction de Lilliefors)" : "Kolmogorov-Smirnov",
    statistic: D, statisticName: "D", df: null, p, n,
    interpretation: p < 0.05
      ? "L'échantillon ne suit pas la loi normale."
      : "L'hypothèse de normalité est compatible avec les données.",
  });
}

// Test d'Anderson-Darling — plus sensible que KS dans les queues de distribution
export function andersonDarling(values) {
  const x = numeric(values).sort((a, b) => a - b);
  const n = x.length;
  if (n < 8) return null;
  const m = mean(x), s = sd(x);
  let S = 0;
  for (let i = 0; i < n; i++) {
    const zi = normal.cdf(x[i], m, s);
    const zn = normal.cdf(x[n - 1 - i], m, s);
    S += (2 * (i + 1) - 1) * (Math.log(Math.max(1e-15, zi)) + Math.log(Math.max(1e-15, 1 - zn)));
  }
  const A2 = -n - S / n;
  const A2star = A2 * (1 + 0.75 / n + 2.25 / (n * n));
  let p;
  if (A2star < 0.2) p = 1 - Math.exp(-13.436 + 101.14 * A2star - 223.73 * A2star ** 2);
  else if (A2star < 0.34) p = 1 - Math.exp(-8.318 + 42.796 * A2star - 59.938 * A2star ** 2);
  else if (A2star < 0.6) p = Math.exp(0.9177 - 4.279 * A2star - 1.38 * A2star ** 2);
  else p = Math.exp(1.2937 - 5.709 * A2star + 0.0186 * A2star ** 2);
  return result({
    test: "Test d'Anderson-Darling (normalité)",
    statistic: A2star, statisticName: "A²", df: null, p: Math.max(0, Math.min(1, p)), n,
    interpretation: p < 0.05 ? "Écart significatif à la normalité." : "Normalité plausible.",
  });
}

// Test d'asymétrie et d'aplatissement de D'Agostino-Pearson (K²)
export function dagostinoPearson(values) {
  const x = numeric(values);
  const n = x.length;
  if (n < 20) return null;
  const m = mean(x), s = sd(x, true);
  const g1 = sum(x.map(v => ((v - m) / s) ** 3)) / n;
  const g2 = sum(x.map(v => ((v - m) / s) ** 4)) / n - 3;
  // Transformation de l'asymétrie (D'Agostino 1970)
  const Y = g1 * Math.sqrt((n + 1) * (n + 3) / (6 * (n - 2)));
  const b2 = 3 * (n * n + 27 * n - 70) * (n + 1) * (n + 3) /
    ((n - 2) * (n + 5) * (n + 7) * (n + 9));
  const W2 = Math.sqrt(2 * (b2 - 1)) - 1;
  const delta = 1 / Math.sqrt(0.5 * Math.log(W2));
  const alpha = Math.sqrt(2 / (W2 - 1));
  const Zg1 = delta * Math.log(Y / alpha + Math.sqrt((Y / alpha) ** 2 + 1));
  // Transformation de l'aplatissement (Anscombe-Glynn)
  const Eb2 = 3 * (n - 1) / (n + 1);
  const varb2 = 24 * n * (n - 2) * (n - 3) / ((n + 1) ** 2 * (n + 3) * (n + 5));
  const Xk = ((g2 + 3) - Eb2) / Math.sqrt(varb2);
  const sqbeta = 6 * (n * n - 5 * n + 2) / ((n + 7) * (n + 9)) *
    Math.sqrt(6 * (n + 3) * (n + 5) / (n * (n - 2) * (n - 3)));
  const A = 6 + 8 / sqbeta * (2 / sqbeta + Math.sqrt(1 + 4 / (sqbeta * sqbeta)));
  const Zg2 = (1 - 2 / (9 * A) - Math.cbrt((1 - 2 / A) / (1 + Xk * Math.sqrt(2 / (A - 4))))) /
    Math.sqrt(2 / (9 * A));
  const K2 = Zg1 * Zg1 + Zg2 * Zg2;
  const p = chisquare.sf(K2, 2);
  return result({
    test: "Test d'omnibus de D'Agostino-Pearson",
    statistic: K2, statisticName: "K²", df: 2, p, n,
    detail: { skewness: g1, zSkewness: Zg1, kurtosis: g2, zKurtosis: Zg2 },
    interpretation: p < 0.05 ? "Distribution non normale (asymétrie et/ou aplatissement)." : "Normalité plausible.",
  });
}

/* ============================================================
   2. TESTS D'HOMOGÉNÉITÉ DES VARIANCES
   ============================================================ */

// Test de Levene (centré sur la médiane = test de Brown-Forsythe, robuste)
export function levene(groups, { center = "median" } = {}) {
  const gs = groups.map(numeric).filter(g => g.length > 1);
  const k = gs.length;
  if (k < 2) return null;
  const N = sum(gs.map(g => g.length));
  const z = gs.map(g => {
    const c = center === "mean" ? mean(g) : median(g);
    return g.map(v => Math.abs(v - c));
  });
  const zbarAll = mean(z.flat());
  const between = sum(z.map(zi => zi.length * (mean(zi) - zbarAll) ** 2));
  const within = sum(z.map(zi => { const mz = mean(zi); return sum(zi.map(v => (v - mz) ** 2)); }));
  const F = (between / (k - 1)) / (within / (N - k));
  const p = fdist.sf(F, k - 1, N - k);
  return result({
    test: center === "mean" ? "Test de Levene (moyenne)" : "Test de Brown-Forsythe (Levene médiane)",
    statistic: F, statisticName: "F", df: [k - 1, N - k], p, n: N,
    interpretation: p < 0.05
      ? "Les variances diffèrent significativement : utiliser une correction (Welch)."
      : "L'homogénéité des variances est acceptable.",
  });
}

// Test de Bartlett — puissant mais sensible à la non-normalité
export function bartlett(groups) {
  const gs = groups.map(numeric).filter(g => g.length > 1);
  const k = gs.length;
  if (k < 2) return null;
  const N = sum(gs.map(g => g.length));
  const sp2 = sum(gs.map(g => (g.length - 1) * variance(g))) / (N - k);
  const num = (N - k) * Math.log(sp2) - sum(gs.map(g => (g.length - 1) * Math.log(variance(g))));
  const den = 1 + (sum(gs.map(g => 1 / (g.length - 1))) - 1 / (N - k)) / (3 * (k - 1));
  const K2 = num / den;
  const p = chisquare.sf(K2, k - 1);
  return result({
    test: "Test de Bartlett (homogénéité des variances)",
    statistic: K2, statisticName: "χ²", df: k - 1, p, n: N,
    interpretation: p < 0.05 ? "Variances hétérogènes." : "Variances homogènes.",
  });
}

/* ============================================================
   3. TESTS DE COMPARAISON DE MOYENNES (PARAMÉTRIQUES)
   ============================================================ */

// Test t sur un échantillon
export function tTestOneSample(values, mu = 0, { alpha = 0.05, tail = "two" } = {}) {
  const x = numeric(values);
  const n = x.length;
  if (n < 2) return null;
  const m = mean(x), s = sd(x), se = s / Math.sqrt(n);
  const t = (m - mu) / se;
  const df = n - 1;
  const p = tail === "two" ? 2 * studentt.cdf(-Math.abs(t), df)
    : tail === "less" ? studentt.cdf(t, df) : 1 - studentt.cdf(t, df);
  const tc = studentt.inv(1 - alpha / 2, df);
  const d = (m - mu) / s; // d de Cohen
  return result({
    test: "Test t pour un échantillon",
    statistic: t, statisticName: "t", df, p, n, alpha,
    detail: { mean: m, sd: s, se, mu, meanDifference: m - mu },
    ci: { lower: (m - mu) - tc * se, upper: (m - mu) + tc * se, level: 1 - alpha },
    effect: { name: "d de Cohen", value: d, magnitude: cohenMagnitude(d) },
    interpretation: `La moyenne observée (${m.toFixed(3)}) ${p < alpha ? "diffère" : "ne diffère pas"} significativement de la valeur de référence ${mu}.`,
  });
}

// Test t pour échantillons indépendants — variances égales (Student) ou non (Welch)
export function tTestIndependent(group1, group2, { equalVariance = null, alpha = 0.05, tail = "two" } = {}) {
  const x = numeric(group1), y = numeric(group2);
  const n1 = x.length, n2 = y.length;
  if (n1 < 2 || n2 < 2) return null;
  const m1 = mean(x), m2 = mean(y);
  const v1 = variance(x), v2 = variance(y);

  // Choix automatique : Welch si Levene rejette l'homogénéité
  let useEqual = equalVariance;
  const lev = levene([x, y]);
  if (useEqual === null) useEqual = !(lev && lev.p < 0.05);

  let t, df, se;
  if (useEqual) {
    const sp2 = ((n1 - 1) * v1 + (n2 - 1) * v2) / (n1 + n2 - 2);
    se = Math.sqrt(sp2 * (1 / n1 + 1 / n2));
    df = n1 + n2 - 2;
  } else {
    se = Math.sqrt(v1 / n1 + v2 / n2);
    df = (v1 / n1 + v2 / n2) ** 2 /
      ((v1 / n1) ** 2 / (n1 - 1) + (v2 / n2) ** 2 / (n2 - 1)); // Welch-Satterthwaite
  }
  t = (m1 - m2) / se;
  const p = tail === "two" ? 2 * studentt.cdf(-Math.abs(t), df)
    : tail === "less" ? studentt.cdf(t, df) : 1 - studentt.cdf(t, df);
  const tc = studentt.inv(1 - alpha / 2, df);
  const sp = Math.sqrt(((n1 - 1) * v1 + (n2 - 1) * v2) / (n1 + n2 - 2));
  const d = (m1 - m2) / sp;
  const g = d * (1 - 3 / (4 * (n1 + n2) - 9)); // correction de Hedges

  return result({
    test: useEqual ? "Test t de Student (échantillons indépendants)" : "Test t de Welch (variances inégales)",
    statistic: t, statisticName: "t", df, p, n: n1 + n2, alpha,
    detail: {
      n1, n2, mean1: m1, mean2: m2, sd1: Math.sqrt(v1), sd2: Math.sqrt(v2),
      meanDifference: m1 - m2, se, equalVariance: useEqual,
    },
    ci: { lower: (m1 - m2) - tc * se, upper: (m1 - m2) + tc * se, level: 1 - alpha },
    effect: { name: "d de Cohen", value: d, hedgesG: g, magnitude: cohenMagnitude(d) },
    assumptions: { levene: lev },
    interpretation: `La différence de moyennes (${(m1 - m2).toFixed(3)}) est ${p < alpha ? "" : "non "}significative (${useEqual ? "Student" : "Welch"}).`,
  });
}

// Test t pour échantillons appariés (avant/après, mesures répétées)
export function tTestPaired(before, after, { alpha = 0.05, tail = "two" } = {}) {
  const pairs = [];
  for (let i = 0; i < Math.min(before.length, after.length); i++) {
    const a = Number(before[i]), b = Number(after[i]);
    if (Number.isFinite(a) && Number.isFinite(b)) pairs.push([a, b]);
  }
  const n = pairs.length;
  if (n < 2) return null;
  const diffs = pairs.map(([a, b]) => a - b);
  const md = mean(diffs), sdd = sd(diffs), se = sdd / Math.sqrt(n);
  const t = md / se, df = n - 1;
  const p = tail === "two" ? 2 * studentt.cdf(-Math.abs(t), df)
    : tail === "less" ? studentt.cdf(t, df) : 1 - studentt.cdf(t, df);
  const tc = studentt.inv(1 - alpha / 2, df);
  const xs = pairs.map(p2 => p2[0]), ys = pairs.map(p2 => p2[1]);
  const dz = md / sdd;
  return result({
    test: "Test t pour échantillons appariés",
    statistic: t, statisticName: "t", df, p, n, alpha,
    detail: {
      mean1: mean(xs), mean2: mean(ys), sd1: sd(xs), sd2: sd(ys),
      meanDifference: md, sdDifference: sdd, se,
    },
    ci: { lower: md - tc * se, upper: md + tc * se, level: 1 - alpha },
    effect: { name: "d de Cohen (dz)", value: dz, magnitude: cohenMagnitude(dz) },
    interpretation: `L'évolution moyenne (${md.toFixed(3)}) est ${p < alpha ? "" : "non "}significative.`,
  });
}

// Test z sur une proportion
export function zTestProportion(successes, n, p0 = 0.5, { alpha = 0.05, tail = "two" } = {}) {
  if (!n) return null;
  const p = successes / n;
  const se = Math.sqrt(p0 * (1 - p0) / n);
  const z = (p - p0) / se;
  const pv = tail === "two" ? 2 * normal.cdf(-Math.abs(z))
    : tail === "less" ? normal.cdf(z) : 1 - normal.cdf(z);
  const zc = normal.inv(1 - alpha / 2);
  const seObs = Math.sqrt(p * (1 - p) / n);
  return result({
    test: "Test z sur une proportion",
    statistic: z, statisticName: "z", df: null, p: pv, n, alpha,
    detail: { proportion: p, expected: p0, successes },
    ci: { lower: Math.max(0, p - zc * seObs), upper: Math.min(1, p + zc * seObs), level: 1 - alpha },
    effect: { name: "h de Cohen", value: 2 * Math.asin(Math.sqrt(p)) - 2 * Math.asin(Math.sqrt(p0)) },
    interpretation: `La proportion observée (${(p * 100).toFixed(1)} %) ${pv < alpha ? "diffère" : "ne diffère pas"} de ${(p0 * 100).toFixed(1)} %.`,
  });
}

// Test z de comparaison de deux proportions
export function zTestTwoProportions(s1, n1, s2, n2, { alpha = 0.05, tail = "two" } = {}) {
  if (!n1 || !n2) return null;
  const p1 = s1 / n1, p2 = s2 / n2;
  const pPool = (s1 + s2) / (n1 + n2);
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / n1 + 1 / n2));
  const z = (p1 - p2) / se;
  const pv = tail === "two" ? 2 * normal.cdf(-Math.abs(z))
    : tail === "less" ? normal.cdf(z) : 1 - normal.cdf(z);
  const zc = normal.inv(1 - alpha / 2);
  const seDiff = Math.sqrt(p1 * (1 - p1) / n1 + p2 * (1 - p2) / n2);
  const rr = p2 ? p1 / p2 : NaN;
  const or = (p2 && p1 < 1 && p2 < 1) ? (p1 / (1 - p1)) / (p2 / (1 - p2)) : NaN;
  return result({
    test: "Test z de comparaison de deux proportions",
    statistic: z, statisticName: "z", df: null, p: pv, n: n1 + n2, alpha,
    detail: {
      p1, p2, n1, n2, difference: p1 - p2,
      riskRatio: rr, oddsRatio: or,
      numberNeededToTreat: (p1 - p2) ? 1 / Math.abs(p1 - p2) : Infinity,
    },
    ci: { lower: (p1 - p2) - zc * seDiff, upper: (p1 - p2) + zc * seDiff, level: 1 - alpha },
    effect: { name: "h de Cohen", value: 2 * Math.asin(Math.sqrt(p1)) - 2 * Math.asin(Math.sqrt(p2)) },
    interpretation: `L'écart de proportions (${((p1 - p2) * 100).toFixed(1)} points) est ${pv < alpha ? "" : "non "}significatif.`,
  });
}

function cohenMagnitude(d) {
  const a = Math.abs(d);
  if (a < 0.2) return "négligeable";
  if (a < 0.5) return "petit";
  if (a < 0.8) return "moyen";
  return "grand";
}

/* ============================================================
   4. ANALYSE DE VARIANCE (ANOVA)
   ============================================================ */

// ANOVA à un facteur + éta² + oméga² + puissance approchée
export function anovaOneWay(groups, labels = null, { alpha = 0.05 } = {}) {
  const gs = groups.map(numeric).filter(g => g.length > 0);
  const k = gs.length;
  if (k < 2) return null;
  const names = labels || gs.map((_, i) => `Groupe ${i + 1}`);
  const all = gs.flat();
  const N = all.length;
  const grand = mean(all);
  const ssBetween = sum(gs.map(g => g.length * (mean(g) - grand) ** 2));
  const ssWithin = sum(gs.map(g => { const m = mean(g); return sum(g.map(v => (v - m) ** 2)); }));
  const ssTotal = ssBetween + ssWithin;
  const dfB = k - 1, dfW = N - k;
  const msB = ssBetween / dfB, msW = ssWithin / dfW;
  const F = msB / msW;
  const p = fdist.sf(F, dfB, dfW);
  const eta2 = ssBetween / ssTotal;
  const omega2 = (ssBetween - dfB * msW) / (ssTotal + msW);
  const f = Math.sqrt(eta2 / (1 - eta2)); // f de Cohen

  return result({
    test: "ANOVA à un facteur",
    statistic: F, statisticName: "F", df: [dfB, dfW], p, n: N, alpha,
    table: [
      { source: "Inter-groupes", ss: ssBetween, df: dfB, ms: msB, F, p },
      { source: "Intra-groupes (résiduel)", ss: ssWithin, df: dfW, ms: msW, F: null, p: null },
      { source: "Total", ss: ssTotal, df: N - 1, ms: null, F: null, p: null },
    ],
    groups: gs.map((g, i) => ({
      label: names[i], n: g.length, mean: mean(g), sd: sd(g),
      se: sd(g) / Math.sqrt(g.length),
    })),
    effect: {
      name: "η² (êta carré)", value: eta2, omegaSquared: omega2, cohensF: f,
      magnitude: eta2 < 0.01 ? "négligeable" : eta2 < 0.06 ? "petit" : eta2 < 0.14 ? "moyen" : "grand",
    },
    assumptions: { levene: levene(gs), normality: gs.map(g => shapiroWilk(g)) },
    interpretation: p < alpha
      ? `Au moins un groupe diffère significativement des autres (F(${dfB},${dfW}) = ${F.toFixed(3)}). Un test post-hoc est nécessaire.`
      : "Aucune différence significative entre les groupes.",
  });
}

// ANOVA de Welch — robuste à l'hétérogénéité des variances
export function anovaWelch(groups, labels = null, { alpha = 0.05 } = {}) {
  const gs = groups.map(numeric).filter(g => g.length > 1);
  const k = gs.length;
  if (k < 2) return null;
  const w = gs.map(g => g.length / variance(g));
  const sw = sum(w);
  const mTilde = sum(gs.map((g, i) => w[i] * mean(g))) / sw;
  const A = sum(gs.map((g, i) => w[i] * (mean(g) - mTilde) ** 2)) / (k - 1);
  const B = sum(gs.map((g, i) => (1 - w[i] / sw) ** 2 / (g.length - 1)));
  const F = A / (1 + 2 * (k - 2) / (k * k - 1) * B);
  const df2 = (k * k - 1) / (3 * B);
  const p = fdist.sf(F, k - 1, df2);
  return result({
    test: "ANOVA de Welch (variances inégales)",
    statistic: F, statisticName: "F", df: [k - 1, df2], p, n: sum(gs.map(g => g.length)), alpha,
    groups: gs.map((g, i) => ({
      label: (labels || [])[i] || `Groupe ${i + 1}`, n: g.length, mean: mean(g), sd: sd(g),
    })),
    interpretation: p < alpha ? "Différence significative entre les groupes (Welch)." : "Pas de différence significative.",
  });
}

// ANOVA à deux facteurs avec interaction (plan équilibré ou non, somme de type II)
export function anovaTwoWay(values, factorA, factorB, { alpha = 0.05 } = {}) {
  const rows = [];
  for (let i = 0; i < values.length; i++) {
    const v = Number(values[i]);
    if (!Number.isFinite(v)) continue;
    const a = String(factorA[i] ?? "").trim(), b = String(factorB[i] ?? "").trim();
    if (!a || !b) continue;
    rows.push({ v, a, b });
  }
  const levelsA = [...new Set(rows.map(r => r.a))].sort();
  const levelsB = [...new Set(rows.map(r => r.b))].sort();
  const a = levelsA.length, b = levelsB.length, N = rows.length;
  if (a < 2 || b < 2 || N <= a * b) return null;

  const grand = mean(rows.map(r => r.v));
  const cellMeans = {}, cellN = {};
  for (const la of levelsA) for (const lb of levelsB) {
    const cell = rows.filter(r => r.a === la && r.b === lb).map(r => r.v);
    cellMeans[la + "|" + lb] = cell.length ? mean(cell) : null;
    cellN[la + "|" + lb] = cell.length;
  }
  const ssA = sum(levelsA.map(la => {
    const g = rows.filter(r => r.a === la).map(r => r.v);
    return g.length * (mean(g) - grand) ** 2;
  }));
  const ssB = sum(levelsB.map(lb => {
    const g = rows.filter(r => r.b === lb).map(r => r.v);
    return g.length * (mean(g) - grand) ** 2;
  }));
  const ssCells = sum(levelsA.flatMap(la => levelsB.map(lb => {
    const n = cellN[la + "|" + lb];
    return n ? n * (cellMeans[la + "|" + lb] - grand) ** 2 : 0;
  })));
  const ssAB = ssCells - ssA - ssB;
  const ssTotal = sum(rows.map(r => (r.v - grand) ** 2));
  const ssError = ssTotal - ssCells;
  const dfA = a - 1, dfB = b - 1, dfAB = dfA * dfB, dfE = N - a * b;
  const msE = ssError / dfE;
  const mk = (ss, df) => ({ ss, df, ms: ss / df, F: (ss / df) / msE, p: fdist.sf((ss / df) / msE, df, dfE) });
  const rA = mk(ssA, dfA), rB = mk(ssB, dfB), rAB = mk(ssAB, dfAB);

  return result({
    test: "ANOVA à deux facteurs (avec interaction)",
    statistic: rAB.F, statisticName: "F (interaction)", df: [dfAB, dfE], p: rAB.p, n: N, alpha,
    table: [
      { source: "Facteur A", ...rA, partialEta2: ssA / (ssA + ssError) },
      { source: "Facteur B", ...rB, partialEta2: ssB / (ssB + ssError) },
      { source: "Interaction A × B", ...rAB, partialEta2: ssAB / (ssAB + ssError) },
      { source: "Résiduel", ss: ssError, df: dfE, ms: msE, F: null, p: null },
      { source: "Total", ss: ssTotal, df: N - 1, ms: null, F: null, p: null },
    ],
    levels: { A: levelsA, B: levelsB },
    cellMeans, cellN,
    interpretation: rAB.p < alpha
      ? "L'interaction est significative : l'effet d'un facteur dépend du niveau de l'autre. Les effets principaux doivent être interprétés avec prudence."
      : `Pas d'interaction significative. Effet A : p = ${rA.p.toFixed(4)} ; effet B : p = ${rB.p.toFixed(4)}.`,
  });
}

// ANOVA à mesures répétées (un facteur intra-sujet)
export function anovaRepeatedMeasures(matrix, labels = null, { alpha = 0.05 } = {}) {
  // matrix : tableau de sujets, chacun avec k mesures
  const rows = matrix.map(r => r.map(Number)).filter(r => r.every(Number.isFinite));
  const n = rows.length, k = rows[0]?.length || 0;
  if (n < 2 || k < 2) return null;
  const grand = mean(rows.flat());
  const condMeans = Array.from({ length: k }, (_, j) => mean(rows.map(r => r[j])));
  const subjMeans = rows.map(mean);
  const ssTotal = sum(rows.flat().map(v => (v - grand) ** 2));
  const ssCond = n * sum(condMeans.map(m => (m - grand) ** 2));
  const ssSubj = k * sum(subjMeans.map(m => (m - grand) ** 2));
  const ssError = ssTotal - ssCond - ssSubj;
  const dfCond = k - 1, dfSubj = n - 1, dfError = dfCond * dfSubj;
  const msCond = ssCond / dfCond, msError = ssError / dfError;
  const F = msCond / msError;
  const p = fdist.sf(F, dfCond, dfError);

  // Correction de Greenhouse-Geisser pour la violation de sphéricité
  const cov = Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => {
    const xi = rows.map(r => r[i]), xj = rows.map(r => r[j]);
    const mi = mean(xi), mj = mean(xj);
    return sum(xi.map((v, t) => (v - mi) * (xj[t] - mj))) / (n - 1);
  }));
  const meanAll = mean(cov.flat());
  const meanDiag = mean(cov.map((r, i) => r[i]));
  const rowMeans = cov.map(mean);
  const numGG = k * k * (meanDiag - meanAll) ** 2;
  const denGG = (k - 1) * (sum(cov.flat().map(v => v * v)) - 2 * k * sum(rowMeans.map(v => v * v)) + k * k * meanAll * meanAll);
  const eps = Math.max(1 / (k - 1), Math.min(1, numGG / denGG));
  const pGG = fdist.sf(F, dfCond * eps, dfError * eps);

  return result({
    test: "ANOVA à mesures répétées",
    statistic: F, statisticName: "F", df: [dfCond, dfError], p, n, alpha,
    table: [
      { source: "Conditions (intra-sujets)", ss: ssCond, df: dfCond, ms: msCond, F, p },
      { source: "Sujets", ss: ssSubj, df: dfSubj, ms: ssSubj / dfSubj, F: null, p: null },
      { source: "Erreur", ss: ssError, df: dfError, ms: msError, F: null, p: null },
      { source: "Total", ss: ssTotal, df: n * k - 1, ms: null, F: null, p: null },
    ],
    conditions: condMeans.map((m, j) => ({
      label: (labels || [])[j] || `Mesure ${j + 1}`, mean: m, sd: sd(rows.map(r => r[j])), n,
    })),
    sphericity: { greenhouseGeisser: eps, pCorrected: pGG },
    effect: { name: "η² partiel", value: ssCond / (ssCond + ssError) },
    interpretation: p < alpha
      ? `Les mesures diffèrent significativement au cours du suivi (p corrigé Greenhouse-Geisser = ${pGG.toFixed(4)}).`
      : "Aucune évolution significative entre les mesures.",
  });
}

// ANCOVA — comparaison de moyennes ajustées sur une covariable
export function ancova(values, groups, covariate, { alpha = 0.05 } = {}) {
  const rows = [];
  for (let i = 0; i < values.length; i++) {
    const y = Number(values[i]), c = Number(covariate[i]);
    const g = String(groups[i] ?? "").trim();
    if (Number.isFinite(y) && Number.isFinite(c) && g) rows.push({ y, c, g });
  }
  const levels = [...new Set(rows.map(r => r.g))].sort();
  const k = levels.length, N = rows.length;
  if (k < 2 || N < k + 3) return null;
  const ybar = mean(rows.map(r => r.y)), cbar = mean(rows.map(r => r.c));
  // Pente intra-groupe commune
  let spxy = 0, spxx = 0;
  for (const lv of levels) {
    const g = rows.filter(r => r.g === lv);
    const my = mean(g.map(r => r.y)), mc = mean(g.map(r => r.c));
    for (const r of g) { spxy += (r.c - mc) * (r.y - my); spxx += (r.c - mc) ** 2; }
  }
  const beta = spxy / spxx;
  const adjusted = levels.map(lv => {
    const g = rows.filter(r => r.g === lv);
    return {
      group: lv, n: g.length,
      unadjustedMean: mean(g.map(r => r.y)),
      adjustedMean: mean(g.map(r => r.y)) - beta * (mean(g.map(r => r.c)) - cbar),
    };
  });
  const ssTotal = sum(rows.map(r => (r.y - ybar) ** 2));
  const sstxy = sum(rows.map(r => (r.c - cbar) * (r.y - ybar)));
  const sstxx = sum(rows.map(r => (r.c - cbar) ** 2));
  const ssErrorAdj = sum(levels.flatMap(lv => {
    const g = rows.filter(r => r.g === lv);
    const my = mean(g.map(r => r.y)), mc = mean(g.map(r => r.c));
    return g.map(r => ((r.y - my) - beta * (r.c - mc)) ** 2);
  }));
  const ssTotalAdj = ssTotal - sstxy * sstxy / sstxx;
  const ssGroupAdj = ssTotalAdj - ssErrorAdj;
  const dfG = k - 1, dfE = N - k - 1;
  const F = (ssGroupAdj / dfG) / (ssErrorAdj / dfE);
  const p = fdist.sf(F, dfG, dfE);
  return result({
    test: "ANCOVA (analyse de covariance)",
    statistic: F, statisticName: "F", df: [dfG, dfE], p, n: N, alpha,
    detail: { slope: beta, covariateMean: cbar, adjustedMeans: adjusted },
    effect: { name: "η² partiel", value: ssGroupAdj / (ssGroupAdj + ssErrorAdj) },
    interpretation: p < alpha
      ? "Les groupes diffèrent significativement après ajustement sur la covariable."
      : "Aucune différence entre groupes après ajustement sur la covariable.",
  });
}

/* ============================================================
   5. TESTS POST-HOC
   ============================================================ */

// Tukey HSD — comparaisons deux à deux après ANOVA significative
export function tukeyHSD(groups, labels = null, { alpha = 0.05 } = {}) {
  const gs = groups.map(numeric).filter(g => g.length > 0);
  const k = gs.length;
  if (k < 3) return null;
  const names = labels || gs.map((_, i) => `Groupe ${i + 1}`);
  const N = sum(gs.map(g => g.length));
  const dfE = N - k;
  const msE = sum(gs.map(g => { const m = mean(g); return sum(g.map(v => (v - m) ** 2)); })) / dfE;
  const qc = tukey.inv(1 - alpha, k, dfE);
  const pairs = [];
  for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) {
    const diff = mean(gs[i]) - mean(gs[j]);
    const se = Math.sqrt(msE / 2 * (1 / gs[i].length + 1 / gs[j].length));
    const q = Math.abs(diff) / se;
    const p = tukey.sf(q, k, dfE);
    pairs.push({
      group1: names[i], group2: names[j], difference: diff,
      se, q, p, significant: p < alpha,
      ciLower: diff - qc * se, ciUpper: diff + qc * se,
    });
  }
  return {
    test: "Test post-hoc de Tukey (HSD)", alpha, comparisons: pairs, msError: msE, df: dfE,
    interpretation: `${pairs.filter(p => p.significant).length} comparaison(s) significative(s) sur ${pairs.length}.`,
  };
}

// Bonferroni — correction conservatrice, applicable à toute famille de tests
export function bonferroni(groups, labels = null, { alpha = 0.05 } = {}) {
  const gs = groups.map(numeric).filter(g => g.length > 1);
  const k = gs.length;
  const names = labels || gs.map((_, i) => `Groupe ${i + 1}`);
  const m = k * (k - 1) / 2;
  const pairs = [];
  for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) {
    const t = tTestIndependent(gs[i], gs[j], { equalVariance: true, alpha });
    pairs.push({
      group1: names[i], group2: names[j],
      difference: t.detail.meanDifference, t: t.statistic, df: t.df,
      pRaw: t.p, pAdjusted: Math.min(1, t.p * m), significant: t.p * m < alpha,
    });
  }
  return { test: "Comparaisons multiples (correction de Bonferroni)", alpha, comparisons: pairs, familySize: m };
}

// Correction de Holm-Bonferroni (séquentielle, plus puissante)
export function holmCorrection(pValues) {
  const idx = pValues.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]);
  const m = pValues.length;
  const adj = new Array(m);
  let prev = 0;
  idx.forEach(([p, i], rank) => {
    const v = Math.min(1, Math.max(prev, (m - rank) * p));
    adj[i] = v; prev = v;
  });
  return adj;
}

// Correction de Benjamini-Hochberg (contrôle du taux de fausses découvertes)
export function fdrCorrection(pValues) {
  const m = pValues.length;
  const idx = pValues.map((p, i) => [p, i]).sort((a, b) => b[0] - a[0]);
  const adj = new Array(m);
  let prev = 1;
  idx.forEach(([p, i], rank) => {
    const k = m - rank;
    const v = Math.min(prev, p * m / k);
    adj[i] = v; prev = v;
  });
  return adj;
}

// Test de Dunnett — comparaison de plusieurs groupes à un témoin unique
export function dunnett(controlGroup, treatmentGroups, labels = null, { alpha = 0.05 } = {}) {
  const ctrl = numeric(controlGroup);
  const trts = treatmentGroups.map(numeric);
  const all = [ctrl, ...trts];
  const k = all.length, N = sum(all.map(g => g.length));
  const dfE = N - k;
  const msE = sum(all.map(g => { const m = mean(g); return sum(g.map(v => (v - m) ** 2)); })) / dfE;
  const comparisons = trts.map((g, i) => {
    const diff = mean(g) - mean(ctrl);
    const se = Math.sqrt(msE * (1 / g.length + 1 / ctrl.length));
    const t = diff / se;
    // Valeur p ajustée par l'inégalité de Šidák (approximation de Dunnett)
    const pRaw = 2 * studentt.cdf(-Math.abs(t), dfE);
    return {
      group: (labels || [])[i] || `Traitement ${i + 1}`, control: "Témoin",
      difference: diff, se, t, df: dfE, pRaw,
      pAdjusted: Math.min(1, 1 - Math.pow(1 - pRaw, trts.length)),
      significant: 1 - Math.pow(1 - pRaw, trts.length) < alpha,
    };
  });
  return { test: "Test de Dunnett (comparaison au témoin)", alpha, comparisons, msError: msE, df: dfE };
}

/* ============================================================
   6. TESTS NON PARAMÉTRIQUES
   ============================================================ */

// Mann-Whitney U / Wilcoxon rang-somme — alternative au test t indépendant
export function mannWhitney(group1, group2, { alpha = 0.05, tail = "two", exact = null } = {}) {
  const x = numeric(group1), y = numeric(group2);
  const n1 = x.length, n2 = y.length;
  if (!n1 || !n2) return null;
  const { ranks: r, tieCorrection } = ranks([...x, ...y]);
  const R1 = sum(r.slice(0, n1));
  const U1 = R1 - n1 * (n1 + 1) / 2;
  const U2 = n1 * n2 - U1;
  const U = Math.min(U1, U2);
  const N = n1 + n2;
  const mu = n1 * n2 / 2;
  const sigma = Math.sqrt(n1 * n2 / 12 * ((N + 1) - tieCorrection / (N * (N - 1))));
  const z = (U - mu + 0.5 * Math.sign(mu - U)) / sigma; // correction de continuité
  let p = tail === "two" ? 2 * normal.cdf(-Math.abs(z))
    : tail === "less" ? normal.cdf(z) : 1 - normal.cdf(z);
  p = Math.min(1, p);
  const rEffect = Math.abs(z) / Math.sqrt(N); // r de Rosenthal
  // Delta de Cliff : probabilité de supériorité
  const cliff = (2 * U1 / (n1 * n2)) - 1;
  return result({
    test: "Test U de Mann-Whitney (Wilcoxon rang-somme)",
    statistic: U, statisticName: "U", df: null, p, n: N, alpha,
    detail: {
      U1, U2, z, n1, n2, rankSum1: R1, rankSum2: sum(r.slice(n1)),
      meanRank1: R1 / n1, meanRank2: sum(r.slice(n1)) / n2,
      median1: median(x), median2: median(y), ties: tieCorrection > 0,
    },
    effect: {
      name: "r (Rosenthal)", value: rEffect, cliffDelta: cliff,
      magnitude: rEffect < 0.1 ? "négligeable" : rEffect < 0.3 ? "petit" : rEffect < 0.5 ? "moyen" : "grand",
    },
    interpretation: `Les distributions des deux groupes ${p < alpha ? "diffèrent" : "ne diffèrent pas"} significativement (médianes : ${median(x)} vs ${median(y)}).`,
  });
}

// Wilcoxon signé — alternative au test t apparié
export function wilcoxonSignedRank(before, after, { alpha = 0.05, tail = "two" } = {}) {
  const diffs = [];
  for (let i = 0; i < Math.min(before.length, after.length); i++) {
    const a = Number(before[i]), b = Number(after[i]);
    if (Number.isFinite(a) && Number.isFinite(b) && a - b !== 0) diffs.push(a - b);
  }
  const n = diffs.length;
  if (n < 5) return null;
  const abs = diffs.map(Math.abs);
  const { ranks: r, tieCorrection } = ranks(abs);
  const Wplus = sum(diffs.map((d, i) => d > 0 ? r[i] : 0));
  const Wminus = sum(diffs.map((d, i) => d < 0 ? r[i] : 0));
  const W = Math.min(Wplus, Wminus);
  const mu = n * (n + 1) / 4;
  const sigma = Math.sqrt(n * (n + 1) * (2 * n + 1) / 24 - tieCorrection / 48);
  const z = (W - mu + 0.5) / sigma;
  let p = tail === "two" ? 2 * normal.cdf(-Math.abs(z))
    : tail === "less" ? normal.cdf(z) : 1 - normal.cdf(z);
  p = Math.min(1, p);
  const rEffect = Math.abs(z) / Math.sqrt(n);
  return result({
    test: "Test des rangs signés de Wilcoxon",
    statistic: W, statisticName: "W", df: null, p, n, alpha,
    detail: {
      Wplus, Wminus, z, nPairs: n,
      medianDifference: median(diffs), zeroDifferences: Math.min(before.length, after.length) - n,
    },
    effect: { name: "r", value: rEffect, magnitude: rEffect < 0.3 ? "petit" : rEffect < 0.5 ? "moyen" : "grand" },
    interpretation: `L'évolution appariée est ${p < alpha ? "" : "non "}significative (différence médiane : ${median(diffs)}).`,
  });
}

// Kruskal-Wallis — alternative non paramétrique à l'ANOVA à un facteur
export function kruskalWallis(groups, labels = null, { alpha = 0.05 } = {}) {
  const gs = groups.map(numeric).filter(g => g.length > 0);
  const k = gs.length;
  if (k < 2) return null;
  const names = labels || gs.map((_, i) => `Groupe ${i + 1}`);
  const all = gs.flat();
  const N = all.length;
  const { ranks: r, tieCorrection } = ranks(all);
  let offset = 0;
  const groupStats = gs.map((g, i) => {
    const rr = r.slice(offset, offset + g.length);
    offset += g.length;
    return {
      label: names[i], n: g.length, rankSum: sum(rr), meanRank: sum(rr) / g.length,
      median: median(g), q1: quantile(g, 0.25), q3: quantile(g, 0.75),
    };
  });
  let H = 12 / (N * (N + 1)) * sum(groupStats.map(s => s.rankSum ** 2 / s.n)) - 3 * (N + 1);
  if (tieCorrection > 0) H /= (1 - tieCorrection / (N ** 3 - N)); // correction pour ex æquo
  const df = k - 1;
  const p = chisquare.sf(H, df);
  const eta2 = (H - k + 1) / (N - k); // êta² fondé sur les rangs
  return result({
    test: "Test de Kruskal-Wallis",
    statistic: H, statisticName: "H", df, p, n: N, alpha,
    groups: groupStats,
    effect: { name: "η² (rangs)", value: Math.max(0, eta2), epsilonSquared: H / ((N * N - 1) / (N + 1)) },
    interpretation: p < alpha
      ? "Au moins un groupe diffère significativement : un test post-hoc de Dunn est recommandé."
      : "Aucune différence significative entre les groupes.",
  });
}

// Test post-hoc de Dunn après Kruskal-Wallis
export function dunnTest(groups, labels = null, { alpha = 0.05, adjust = "holm" } = {}) {
  const gs = groups.map(numeric).filter(g => g.length > 0);
  const k = gs.length;
  const names = labels || gs.map((_, i) => `Groupe ${i + 1}`);
  const all = gs.flat();
  const N = all.length;
  const { ranks: r, tieCorrection } = ranks(all);
  let offset = 0;
  const meanRanks = gs.map(g => {
    const rr = r.slice(offset, offset + g.length);
    offset += g.length;
    return sum(rr) / g.length;
  });
  const raw = [], pairs = [];
  for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) {
    const se = Math.sqrt(((N * (N + 1) - tieCorrection / (N - 1)) / 12) * (1 / gs[i].length + 1 / gs[j].length));
    const z = (meanRanks[i] - meanRanks[j]) / se;
    const p = 2 * normal.cdf(-Math.abs(z));
    raw.push(p);
    pairs.push({ group1: names[i], group2: names[j], z, pRaw: p, meanRankDiff: meanRanks[i] - meanRanks[j] });
  }
  const adjusted = adjust === "bonferroni" ? raw.map(p => Math.min(1, p * raw.length))
    : adjust === "fdr" ? fdrCorrection(raw) : holmCorrection(raw);
  pairs.forEach((pr, i) => { pr.pAdjusted = adjusted[i]; pr.significant = adjusted[i] < alpha; });
  return { test: `Test post-hoc de Dunn (ajustement ${adjust})`, alpha, comparisons: pairs };
}

// Test de Friedman — mesures répétées non paramétrique
export function friedman(matrix, labels = null, { alpha = 0.05 } = {}) {
  const rows = matrix.map(r => r.map(Number)).filter(r => r.every(Number.isFinite));
  const n = rows.length, k = rows[0]?.length || 0;
  if (n < 2 || k < 3) return null;
  const rankRows = rows.map(r => ranks(r).ranks);
  const colSums = Array.from({ length: k }, (_, j) => sum(rankRows.map(r => r[j])));
  let chi2 = 12 / (n * k * (k + 1)) * sum(colSums.map(s => s * s)) - 3 * n * (k + 1);
  // Correction pour les ex æquo intra-sujet
  const tieSum = sum(rows.map(r => ranks(r).tieCorrection));
  if (tieSum > 0) chi2 /= 1 - tieSum / (n * k * (k * k - 1));
  const df = k - 1;
  const p = chisquare.sf(chi2, df);
  const kendallW = chi2 / (n * (k - 1)); // coefficient de concordance de Kendall
  return result({
    test: "Test de Friedman (mesures répétées)",
    statistic: chi2, statisticName: "χ²", df, p, n, alpha,
    conditions: Array.from({ length: k }, (_, j) => ({
      label: (labels || [])[j] || `Mesure ${j + 1}`,
      meanRank: colSums[j] / n, median: median(rows.map(r => r[j])),
    })),
    effect: { name: "W de Kendall", value: kendallW, magnitude: kendallW < 0.3 ? "faible" : kendallW < 0.5 ? "modéré" : "fort" },
    interpretation: p < alpha ? "Les conditions diffèrent significativement." : "Aucune différence entre les conditions.",
  });
}

// Test Q de Cochran — variable binaire, k mesures répétées
export function cochranQ(matrix, labels = null, { alpha = 0.05 } = {}) {
  const rows = matrix.map(r => r.map(v => (v ? 1 : 0)));
  const n = rows.length, k = rows[0]?.length || 0;
  if (n < 2 || k < 3) return null;
  const colSums = Array.from({ length: k }, (_, j) => sum(rows.map(r => r[j])));
  const rowSums = rows.map(sum);
  const N = sum(rowSums);
  const Q = (k - 1) * (k * sum(colSums.map(c => c * c)) - N * N) /
    (k * N - sum(rowSums.map(r => r * r)));
  const df = k - 1;
  const p = chisquare.sf(Q, df);
  return result({
    test: "Test Q de Cochran",
    statistic: Q, statisticName: "Q", df, p, n, alpha,
    conditions: colSums.map((c, j) => ({
      label: (labels || [])[j] || `Mesure ${j + 1}`, successes: c, proportion: c / n,
    })),
    interpretation: p < alpha ? "Les proportions diffèrent significativement entre les mesures." : "Proportions homogènes.",
  });
}

// Test des signes — le plus robuste des tests appariés
export function signTest(before, after, { alpha = 0.05 } = {}) {
  let pos = 0, neg = 0, ties = 0;
  for (let i = 0; i < Math.min(before.length, after.length); i++) {
    const d = Number(before[i]) - Number(after[i]);
    if (!Number.isFinite(d)) continue;
    if (d > 0) pos++; else if (d < 0) neg++; else ties++;
  }
  const n = pos + neg;
  if (!n) return null;
  const k = Math.min(pos, neg);
  const p = Math.min(1, 2 * binomial.cdf(k, n, 0.5));
  return result({
    test: "Test des signes",
    statistic: k, statisticName: "S", df: null, p, n, alpha,
    detail: { positive: pos, negative: neg, ties },
    interpretation: p < alpha ? "Évolution significative." : "Pas d'évolution significative.",
  });
}

// Test des séquences (runs) de Wald-Wolfowitz — contrôle du caractère aléatoire
export function runsTest(values, { alpha = 0.05 } = {}) {
  const x = numeric(values);
  if (x.length < 10) return null;
  const med = median(x);
  const signs = x.filter(v => v !== med).map(v => v > med ? 1 : 0);
  const n = signs.length;
  const n1 = sum(signs), n2 = n - n1;
  let runs = 1;
  for (let i = 1; i < n; i++) if (signs[i] !== signs[i - 1]) runs++;
  const mu = 2 * n1 * n2 / n + 1;
  const sigma = Math.sqrt(2 * n1 * n2 * (2 * n1 * n2 - n) / (n * n * (n - 1)));
  const z = (runs - mu) / sigma;
  const p = 2 * normal.cdf(-Math.abs(z));
  return result({
    test: "Test des séquences de Wald-Wolfowitz",
    statistic: runs, statisticName: "Séquences", df: null, p, n, alpha,
    detail: { expected: mu, z, aboveMedian: n1, belowMedian: n2 },
    interpretation: p < alpha ? "La série n'est pas aléatoire (tendance ou cycle)." : "Série compatible avec le hasard.",
  });
}

// Test de Kolmogorov-Smirnov à deux échantillons
export function ksTwoSample(group1, group2, { alpha = 0.05 } = {}) {
  const x = numeric(group1).sort((a, b) => a - b);
  const y = numeric(group2).sort((a, b) => a - b);
  const n1 = x.length, n2 = y.length;
  if (!n1 || !n2) return null;
  const all = [...new Set([...x, ...y])].sort((a, b) => a - b);
  let D = 0;
  for (const v of all) {
    const F1 = x.filter(a => a <= v).length / n1;
    const F2 = y.filter(a => a <= v).length / n2;
    D = Math.max(D, Math.abs(F1 - F2));
  }
  const ne = n1 * n2 / (n1 + n2);
  const t = D * (Math.sqrt(ne) + 0.12 + 0.11 / Math.sqrt(ne));
  let p = 0;
  for (let k = 1; k <= 100; k++) p += 2 * (-1) ** (k - 1) * Math.exp(-2 * k * k * t * t);
  p = Math.max(0, Math.min(1, p));
  return result({
    test: "Test de Kolmogorov-Smirnov à deux échantillons",
    statistic: D, statisticName: "D", df: null, p, n: n1 + n2, alpha,
    interpretation: p < alpha ? "Les deux distributions diffèrent significativement." : "Distributions comparables.",
  });
}

// Test de Mood — comparaison de médianes de k groupes
export function moodMedianTest(groups, labels = null, { alpha = 0.05 } = {}) {
  const gs = groups.map(numeric).filter(g => g.length > 0);
  const grand = median(gs.flat());
  const table = [
    gs.map(g => g.filter(v => v > grand).length),
    gs.map(g => g.filter(v => v <= grand).length),
  ];
  const res = chiSquareTable(table, { alpha });
  return {
    ...res,
    test: "Test de la médiane de Mood",
    grandMedian: grand,
    groups: gs.map((g, i) => ({
      label: (labels || [])[i] || `Groupe ${i + 1}`, n: g.length, median: median(g),
      above: g.filter(v => v > grand).length,
    })),
  };
}

/* ============================================================
   7. TESTS SUR VARIABLES CATÉGORIELLES
   ============================================================ */

// χ² d'indépendance sur un tableau de contingence brut
export function chiSquareTable(table, { alpha = 0.05, correction = null } = {}) {
  const rows = table.length, cols = table[0]?.length || 0;
  if (rows < 2 || cols < 2) return null;
  const rowSum = table.map(r => sum(r));
  const colSum = Array.from({ length: cols }, (_, j) => sum(table.map(r => r[j])));
  const n = sum(rowSum);
  if (!n) return null;
  const expected = table.map((r, i) => r.map((_, j) => rowSum[i] * colSum[j] / n));
  // Correction de continuité de Yates : par défaut sur les tableaux 2×2
  const yates = correction === null ? (rows === 2 && cols === 2) : correction;
  let chi2 = 0, lowCells = 0, minExpected = Infinity;
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const e = expected[i][j];
    if (e < 5) lowCells++;
    minExpected = Math.min(minExpected, e);
    if (e > 0) {
      const diff = Math.abs(table[i][j] - e);
      chi2 += (yates ? Math.max(0, diff - 0.5) ** 2 : diff ** 2) / e;
    }
  }
  const df = (rows - 1) * (cols - 1);
  const p = chisquare.sf(chi2, df);
  const minDim = Math.min(rows - 1, cols - 1);
  const cramersV = Math.sqrt(chi2 / (n * minDim));
  const phi = rows === 2 && cols === 2 ? Math.sqrt(chi2 / n) : null;
  const contingencyC = Math.sqrt(chi2 / (chi2 + n));

  // Rapport de vraisemblance G² (alternative au χ² de Pearson)
  let g2 = 0;
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    if (table[i][j] > 0) g2 += 2 * table[i][j] * Math.log(table[i][j] / expected[i][j]);
  }

  const lowShare = lowCells / (rows * cols);
  return result({
    test: yates ? "Test du χ² d'indépendance (correction de Yates)" : "Test du χ² d'indépendance",
    statistic: chi2, statisticName: "χ²", df, p, n, alpha,
    detail: {
      observed: table, expected, rowSum, colSum,
      likelihoodRatioG2: g2, pG2: chisquare.sf(g2, df),
      minExpected, lowExpectedCells: lowCells, lowExpectedShare: lowShare,
      residuals: table.map((r, i) => r.map((v, j) => (v - expected[i][j]) / Math.sqrt(expected[i][j]))),
      adjustedResiduals: table.map((r, i) => r.map((v, j) => {
        const e = expected[i][j];
        return e ? (v - e) / Math.sqrt(e * (1 - rowSum[i] / n) * (1 - colSum[j] / n)) : 0;
      })),
    },
    effect: {
      name: "V de Cramér", value: cramersV, phi, contingencyCoefficient: contingencyC,
      magnitude: cramersV < 0.1 ? "négligeable" : cramersV < 0.3 ? "faible" : cramersV < 0.5 ? "modéré" : "fort",
    },
    assumptions: {
      valid: lowShare <= 0.2 && minExpected >= 1,
      warning: lowShare > 0.2
        ? `${lowCells} case(s) ont un effectif théorique < 5 (${(lowShare * 100).toFixed(0)} %) : préférer le test exact de Fisher.`
        : null,
    },
    interpretation: p < alpha
      ? `Il existe une association significative entre les deux variables (V de Cramér = ${cramersV.toFixed(3)}).`
      : "Aucune association significative n'est mise en évidence.",
  });
}

// χ² à partir de deux vecteurs de données brutes
export function chiSquareIndependence(var1, var2, opts = {}) {
  const ct = crosstab(var1, var2);
  const res = chiSquareTable(ct.counts, opts);
  return res ? { ...res, crosstab: ct } : null;
}

// χ² d'ajustement (goodness-of-fit) à une distribution attendue
export function chiSquareGoodnessOfFit(observed, expectedProbs = null, { alpha = 0.05 } = {}) {
  const k = observed.length;
  const n = sum(observed);
  const probs = expectedProbs || Array(k).fill(1 / k);
  const expected = probs.map(p => p * n);
  let chi2 = 0;
  for (let i = 0; i < k; i++) if (expected[i] > 0) chi2 += (observed[i] - expected[i]) ** 2 / expected[i];
  const df = k - 1;
  const p = chisquare.sf(chi2, df);
  return result({
    test: "Test du χ² d'ajustement",
    statistic: chi2, statisticName: "χ²", df, p, n, alpha,
    detail: { observed, expected, residuals: observed.map((o, i) => (o - expected[i]) / Math.sqrt(expected[i])) },
    effect: { name: "w de Cohen", value: Math.sqrt(chi2 / n) },
    interpretation: p < alpha
      ? "La distribution observée diffère significativement de la distribution attendue."
      : "La distribution observée est compatible avec la distribution attendue.",
  });
}

// Test exact de Fisher (2×2) — valide sur petits effectifs
export function fisherExact(a, b, c, d, { alpha = 0.05, tail = "two" } = {}) {
  const n = a + b + c + d;
  const row1 = a + b, col1 = a + c;
  const pOf = k => Math.exp(
    lchoose(row1, k) + lchoose(n - row1, col1 - k) - lchoose(n, col1)
  );
  const pObs = pOf(a);
  const kMin = Math.max(0, col1 - (n - row1)), kMax = Math.min(row1, col1);
  let pTwo = 0, pLess = 0, pGreater = 0;
  for (let k = kMin; k <= kMax; k++) {
    const pk = pOf(k);
    if (pk <= pObs * (1 + 1e-9)) pTwo += pk;
    if (k <= a) pLess += pk;
    if (k >= a) pGreater += pk;
  }
  const p = tail === "two" ? Math.min(1, pTwo) : tail === "less" ? pLess : pGreater;
  // Rapport de cotes avec IC de Woolf (correction de Haldane si case nulle)
  const zeroCell = a === 0 || b === 0 || c === 0 || d === 0;
  const A = a + (zeroCell ? 0.5 : 0), B = b + (zeroCell ? 0.5 : 0);
  const C = c + (zeroCell ? 0.5 : 0), D = d + (zeroCell ? 0.5 : 0);
  const or = (A * D) / (B * C);
  const seLog = Math.sqrt(1 / A + 1 / B + 1 / C + 1 / D);
  const z = normal.inv(1 - alpha / 2);
  return result({
    test: "Test exact de Fisher",
    statistic: or, statisticName: "OR", df: null, p, n, alpha,
    detail: {
      table: [[a, b], [c, d]], pLess, pGreater, pTwoSided: pTwo,
      haldaneCorrection: zeroCell,
    },
    effect: { name: "Rapport de cotes (OR)", value: or },
    ci: { lower: Math.exp(Math.log(or) - z * seLog), upper: Math.exp(Math.log(or) + z * seLog), level: 1 - alpha },
    interpretation: p < alpha
      ? `Association significative (OR = ${or.toFixed(2)}).`
      : "Aucune association significative (test exact).",
  });
}

// Test de McNemar — données appariées binaires (avant/après, deux tests diagnostiques)
export function mcnemar(a, b, c, d, { alpha = 0.05, exact = null } = {}) {
  const n = a + b + c + d;
  const disc = b + c;
  const useExact = exact === null ? disc < 25 : exact;
  let statistic, p, df = 1, name;
  if (useExact) {
    p = Math.min(1, 2 * binomial.cdf(Math.min(b, c), disc, 0.5));
    statistic = Math.min(b, c); name = "b (binomial exact)";
  } else {
    statistic = (Math.abs(b - c) - 1) ** 2 / disc; // correction de continuité
    p = chisquare.sf(statistic, 1); name = "χ²";
  }
  const or = c ? b / c : Infinity;
  return result({
    test: useExact ? "Test de McNemar (version exacte binomiale)" : "Test de McNemar",
    statistic, statisticName: name, df: useExact ? null : df, p, n, alpha,
    detail: {
      table: [[a, b], [c, d]], discordant: disc,
      proportion1: (a + b) / n, proportion2: (a + c) / n,
      difference: (b - c) / n, oddsRatio: or,
    },
    interpretation: p < alpha
      ? "Changement significatif entre les deux mesures appariées."
      : "Aucun changement significatif.",
  });
}

// Test de Mantel-Haenszel — OR commun stratifié (contrôle d'un facteur de confusion)
export function mantelHaenszel(strata, { alpha = 0.05 } = {}) {
  // strata : [{ a, b, c, d, label }]
  let numOR = 0, denOR = 0, sumA = 0, sumE = 0, sumV = 0;
  const detail = [];
  for (const s of strata) {
    const { a, b, c, d } = s;
    const n = a + b + c + d;
    if (!n) continue;
    numOR += a * d / n;
    denOR += b * c / n;
    const r1 = a + b, r2 = c + d, c1 = a + c, c2 = b + d;
    sumA += a;
    sumE += r1 * c1 / n;
    sumV += (r1 * r2 * c1 * c2) / (n * n * (n - 1));
    detail.push({ label: s.label || "", or: (a * d) / (b * c), n });
  }
  const orMH = numOR / denOR;
  const chi2 = (Math.abs(sumA - sumE) - 0.5) ** 2 / sumV;
  const p = chisquare.sf(chi2, 1);
  // IC « test-based » de Miettinen : ln(OR) ± z·|ln OR|/√χ²  — simple et stable
  const z = normal.inv(1 - alpha / 2);
  const seLn = Math.sqrt(1 / sumV);
  return result({
    test: "Test de Mantel-Haenszel (analyse stratifiée)",
    statistic: chi2, statisticName: "χ²", df: 1, p, n: sum(strata.map(s => s.a + s.b + s.c + s.d)), alpha,
    effect: { name: "OR de Mantel-Haenszel", value: orMH },
    ci: {
      lower: Math.exp(Math.log(orMH) - z * seLn),
      upper: Math.exp(Math.log(orMH) + z * seLn),
      level: 1 - alpha,
    },
    detail: { strata: detail, sumA, expectedA: sumE, variance: sumV },
    interpretation: p < alpha
      ? `Association significative après ajustement sur les strates (OR ajusté = ${orMH.toFixed(2)}).`
      : "Aucune association après ajustement.",
  });
}

// Test binomial exact
export function binomialTest(successes, n, p0 = 0.5, { alpha = 0.05, tail = "two" } = {}) {
  const pObs = binomial.pmf(successes, n, p0);
  let p;
  if (tail === "two") {
    p = 0;
    for (let k = 0; k <= n; k++) {
      const pk = binomial.pmf(k, n, p0);
      if (pk <= pObs * (1 + 1e-9)) p += pk;
    }
  } else if (tail === "less") p = binomial.cdf(successes, n, p0);
  else p = 1 - binomial.cdf(successes - 1, n, p0);
  return result({
    test: "Test binomial exact",
    statistic: successes, statisticName: "k", df: null, p: Math.min(1, p), n, alpha,
    detail: { proportion: successes / n, expected: p0 },
    interpretation: p < alpha ? "La proportion observée diffère significativement." : "Proportion conforme à l'attendu.",
  });
}

// Test de Poisson — comparaison d'un taux d'incidence à une référence
export function poissonTest(events, personTime, rate0, { alpha = 0.05 } = {}) {
  const expected = rate0 * personTime;
  let p = 0;
  const pObs = Math.exp(-expected + events * Math.log(expected) - gammaln(events + 1));
  for (let k = 0; k <= Math.max(events * 3, expected * 3 + 20); k++) {
    const pk = Math.exp(-expected + k * Math.log(expected) - gammaln(k + 1));
    if (pk <= pObs * (1 + 1e-9)) p += pk;
  }
  const z = normal.inv(1 - alpha / 2);
  const rate = events / personTime;
  return result({
    test: "Test de Poisson (taux d'incidence)",
    statistic: events, statisticName: "k", df: null, p: Math.min(1, p), n: events, alpha,
    detail: { observedRate: rate, expectedRate: rate0, expectedEvents: expected, rateRatio: rate / rate0 },
    ci: {
      lower: chisquare.inv(alpha / 2, 2 * events) / 2 / personTime,
      upper: chisquare.inv(1 - alpha / 2, 2 * (events + 1)) / 2 / personTime,
      level: 1 - alpha,
    },
    interpretation: p < alpha ? "Le taux observé diffère significativement du taux de référence." : "Taux conforme.",
  });
}

/* ============================================================
   8. MESURES D'ASSOCIATION ET DE CORRÉLATION
   ============================================================ */

// Corrélation de Pearson avec IC de Fisher
export function pearsonCorrelation(xs, ys, { alpha = 0.05, tail = "two" } = {}) {
  const pairs = [];
  for (let i = 0; i < Math.min(xs.length, ys.length); i++) {
    const a = Number(xs[i]), b = Number(ys[i]);
    if (Number.isFinite(a) && Number.isFinite(b)) pairs.push([a, b]);
  }
  const n = pairs.length;
  if (n < 3) return null;
  const x = pairs.map(p => p[0]), y = pairs.map(p => p[1]);
  const mx = mean(x), my = mean(y);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
  }
  if (!sxx || !syy) return null;
  const r = sxy / Math.sqrt(sxx * syy);
  const df = n - 2;
  const t = r * Math.sqrt(df / Math.max(1e-15, 1 - r * r));
  const p = tail === "two" ? 2 * studentt.cdf(-Math.abs(t), df)
    : tail === "less" ? studentt.cdf(t, df) : 1 - studentt.cdf(t, df);
  // Transformation z de Fisher pour l'intervalle de confiance
  const z = 0.5 * Math.log((1 + r) / (1 - r));
  const se = 1 / Math.sqrt(n - 3);
  const zc = normal.inv(1 - alpha / 2);
  const th = v => (Math.exp(2 * v) - 1) / (Math.exp(2 * v) + 1);
  return result({
    test: "Corrélation de Pearson",
    statistic: r, statisticName: "r", df, p, n, alpha,
    detail: { t, meanX: mx, meanY: my, sdX: sd(x), sdY: sd(y), covariance: sxy / (n - 1), r2: r * r },
    ci: n > 3
      ? { lower: th(z - zc * se), upper: th(z + zc * se), level: 1 - alpha }
      : null,
    effect: {
      name: "r de Pearson", value: r, r2: r * r,
      magnitude: Math.abs(r) < 0.1 ? "négligeable" : Math.abs(r) < 0.3 ? "faible"
        : Math.abs(r) < 0.5 ? "modérée" : Math.abs(r) < 0.7 ? "forte" : "très forte",
    },
    interpretation: `Corrélation ${r > 0 ? "positive" : "négative"} ${p < alpha ? "significative" : "non significative"} (r = ${r.toFixed(3)}, ${(r * r * 100).toFixed(1)} % de variance partagée).`,
  });
}

// Corrélation de Spearman (rangs)
export function spearmanCorrelation(xs, ys, { alpha = 0.05 } = {}) {
  const pairs = [];
  for (let i = 0; i < Math.min(xs.length, ys.length); i++) {
    const a = Number(xs[i]), b = Number(ys[i]);
    if (Number.isFinite(a) && Number.isFinite(b)) pairs.push([a, b]);
  }
  if (pairs.length < 3) return null;
  const rx = ranks(pairs.map(p => p[0])).ranks;
  const ry = ranks(pairs.map(p => p[1])).ranks;
  const base = pearsonCorrelation(rx, ry, { alpha });
  if (!base) return null;
  return {
    ...base,
    test: "Corrélation de Spearman (rho)",
    statisticName: "ρ",
    effect: { ...base.effect, name: "ρ de Spearman" },
    interpretation: `Corrélation monotone ${base.statistic > 0 ? "positive" : "négative"} ${base.p < alpha ? "significative" : "non significative"} (ρ = ${base.statistic.toFixed(3)}).`,
  };
}

// Tau-b de Kendall — robuste, adapté aux petits échantillons et aux ex æquo
export function kendallTau(xs, ys, { alpha = 0.05 } = {}) {
  const pairs = [];
  for (let i = 0; i < Math.min(xs.length, ys.length); i++) {
    const a = Number(xs[i]), b = Number(ys[i]);
    if (Number.isFinite(a) && Number.isFinite(b)) pairs.push([a, b]);
  }
  const n = pairs.length;
  if (n < 3) return null;
  let concordant = 0, discordant = 0, tiesX = 0, tiesY = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const dx = pairs[i][0] - pairs[j][0], dy = pairs[i][1] - pairs[j][1];
    if (dx === 0 && dy === 0) continue;
    if (dx === 0) { tiesX++; continue; }
    if (dy === 0) { tiesY++; continue; }
    if (dx * dy > 0) concordant++; else discordant++;
  }
  const n0 = n * (n - 1) / 2;
  const tau = (concordant - discordant) / Math.sqrt((n0 - tiesX) * (n0 - tiesY));
  const se = Math.sqrt(2 * (2 * n + 5) / (9 * n * (n - 1)));
  const z = tau / se;
  const p = 2 * normal.cdf(-Math.abs(z));
  return result({
    test: "Corrélation de Kendall (tau-b)",
    statistic: tau, statisticName: "τ", df: null, p, n, alpha,
    detail: { concordant, discordant, tiesX, tiesY, z },
    effect: { name: "τ-b de Kendall", value: tau },
    interpretation: `Concordance ${p < alpha ? "significative" : "non significative"} (τ = ${tau.toFixed(3)}).`,
  });
}

// Corrélation partielle — association nette de l'effet d'une variable de contrôle
export function partialCorrelation(xs, ys, controls, { alpha = 0.05 } = {}) {
  const rxy = pearsonCorrelation(xs, ys, { alpha });
  const rxz = pearsonCorrelation(xs, controls, { alpha });
  const ryz = pearsonCorrelation(ys, controls, { alpha });
  if (!rxy || !rxz || !ryz) return null;
  const a = rxy.statistic, b = rxz.statistic, c = ryz.statistic;
  const r = (a - b * c) / Math.sqrt((1 - b * b) * (1 - c * c));
  const n = rxy.n, df = n - 3;
  const t = r * Math.sqrt(df / Math.max(1e-15, 1 - r * r));
  const p = 2 * studentt.cdf(-Math.abs(t), df);
  return result({
    test: "Corrélation partielle (contrôle d'une variable)",
    statistic: r, statisticName: "r partiel", df, p, n, alpha,
    detail: { zeroOrder: a, rXZ: b, rYZ: c, t },
    interpretation: `Après contrôle de la covariable, r passe de ${a.toFixed(3)} à ${r.toFixed(3)}.`,
  });
}

// Matrice de corrélation entre plusieurs variables
export function correlationMatrix(variables, names = null, { method = "pearson", alpha = 0.05 } = {}) {
  const k = variables.length;
  const labels = names || variables.map((_, i) => `V${i + 1}`);
  const fn = method === "spearman" ? spearmanCorrelation
    : method === "kendall" ? kendallTau : pearsonCorrelation;
  const r = Array.from({ length: k }, () => new Array(k).fill(null));
  const p = Array.from({ length: k }, () => new Array(k).fill(null));
  const nMat = Array.from({ length: k }, () => new Array(k).fill(0));
  for (let i = 0; i < k; i++) {
    r[i][i] = 1; p[i][i] = 0;
    for (let j = i + 1; j < k; j++) {
      const res = fn(variables[i], variables[j], { alpha });
      r[i][j] = r[j][i] = res ? res.statistic : null;
      p[i][j] = p[j][i] = res ? res.p : null;
      nMat[i][j] = nMat[j][i] = res ? res.n : 0;
    }
  }
  return { method, labels, r, p, n: nMat, alpha };
}

/* ============================================================
   9. FIDÉLITÉ ET ACCORD (indispensables en analyse qualitative)
   ============================================================ */

// Alpha de Cronbach — cohérence interne d'une échelle
export function cronbachAlpha(items) {
  // items : tableau de colonnes (chaque colonne = un item, même nombre de sujets)
  const k = items.length;
  if (k < 2) return null;
  const n = Math.min(...items.map(it => it.length));
  const cols = items.map(it => numeric(it.slice(0, n)));
  const totals = Array.from({ length: n }, (_, i) => sum(cols.map(c => c[i])));
  const sumItemVar = sum(cols.map(c => variance(c)));
  const totalVar = variance(totals);
  const alpha = (k / (k - 1)) * (1 - sumItemVar / totalVar);
  // Alpha si l'item est supprimé — repère les items qui dégradent l'échelle
  const ifDeleted = cols.map((_, drop) => {
    const rest = cols.filter((_, i) => i !== drop);
    const kk = rest.length;
    if (kk < 2) return null;
    const tot = Array.from({ length: n }, (_, i) => sum(rest.map(c => c[i])));
    return (kk / (kk - 1)) * (1 - sum(rest.map(variance)) / variance(tot));
  });
  return {
    test: "Alpha de Cronbach (cohérence interne)",
    alpha, items: k, n,
    itemTotalCorrelations: cols.map((c, i) => {
      const rest = Array.from({ length: n }, (_, j) => sum(cols.filter((_, q) => q !== i).map(cc => cc[j])));
      return pearsonCorrelation(c, rest)?.statistic ?? null;
    }),
    alphaIfItemDeleted: ifDeleted,
    interpretation: alpha >= 0.9 ? "Excellente cohérence interne."
      : alpha >= 0.8 ? "Bonne cohérence interne."
      : alpha >= 0.7 ? "Cohérence interne acceptable."
      : alpha >= 0.6 ? "Cohérence interne discutable."
      : "Cohérence interne insuffisante : réviser les items.",
  };
}

// Kappa de Cohen — accord entre deux codeurs (analyse qualitative, double lecture)
export function cohenKappa(rater1, rater2, { alpha = 0.05, weights = null } = {}) {
  const pairs = [];
  for (let i = 0; i < Math.min(rater1.length, rater2.length); i++) {
    const a = rater1[i], b = rater2[i];
    if (a === null || a === undefined || a === "" || b === null || b === undefined || b === "") continue;
    pairs.push([String(a), String(b)]);
  }
  const n = pairs.length;
  if (!n) return null;
  const cats = [...new Set(pairs.flat())].sort();
  const k = cats.length;
  const m = cats.map(() => cats.map(() => 0));
  for (const [a, b] of pairs) m[cats.indexOf(a)][cats.indexOf(b)]++;
  const rowSum = m.map(sum);
  const colSum = cats.map((_, j) => sum(m.map(r => r[j])));

  // Poids : non pondéré, linéaire ou quadratique (échelles ordinales)
  const w = (i, j) => {
    if (i === j) return 1;
    if (!weights) return 0;
    const d = Math.abs(i - j) / (k - 1);
    return weights === "quadratic" ? 1 - d * d : 1 - d;
  };
  let po = 0, pe = 0;
  for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) {
    po += w(i, j) * m[i][j] / n;
    pe += w(i, j) * (rowSum[i] / n) * (colSum[j] / n);
  }
  const kappa = (po - pe) / (1 - pe);
  const se = Math.sqrt(po * (1 - po) / (n * (1 - pe) ** 2));
  const z = normal.inv(1 - alpha / 2);
  return result({
    test: weights ? `Kappa de Cohen pondéré (${weights === "quadratic" ? "quadratique" : "linéaire"})` : "Kappa de Cohen (accord inter-juges)",
    statistic: kappa, statisticName: "κ", df: null,
    p: 2 * normal.cdf(-Math.abs(kappa / (se || 1e-9))), n, alpha,
    detail: { observedAgreement: po, expectedAgreement: pe, categories: cats, matrix: m },
    ci: { lower: kappa - z * se, upper: kappa + z * se, level: 1 - alpha },
    effect: {
      name: "κ", value: kappa,
      magnitude: kappa < 0 ? "désaccord" : kappa < 0.21 ? "très faible" : kappa < 0.41 ? "faible"
        : kappa < 0.61 ? "modéré" : kappa < 0.81 ? "fort" : "presque parfait",
    },
    interpretation: `Accord ${kappa < 0.41 ? "insuffisant" : kappa < 0.61 ? "modéré" : "satisfaisant"} entre les deux codeurs (κ = ${kappa.toFixed(3)}, échelle de Landis & Koch).`,
  });
}

// Kappa de Fleiss — accord entre plus de deux codeurs
export function fleissKappa(matrix) {
  // matrix : lignes = sujets, colonnes = catégories, cellule = nb de juges
  const n = matrix.length;
  if (!n) return null;
  const nRaters = sum(matrix[0]);
  const k = matrix[0].length;
  const pj = Array.from({ length: k }, (_, j) => sum(matrix.map(r => r[j])) / (n * nRaters));
  const Pi = matrix.map(r => (sum(r.map(v => v * v)) - nRaters) / (nRaters * (nRaters - 1)));
  const pbar = mean(Pi);
  const pebar = sum(pj.map(p => p * p));
  const kappa = (pbar - pebar) / (1 - pebar);
  return {
    test: "Kappa de Fleiss (accord multi-juges)",
    kappa, subjects: n, raters: nRaters, categories: k,
    observedAgreement: pbar, expectedAgreement: pebar,
    interpretation: kappa < 0.41 ? "Accord faible entre les codeurs." : kappa < 0.61 ? "Accord modéré." : "Accord satisfaisant.",
  };
}

// Coefficient de corrélation intraclasse (ICC) — fidélité de mesures répétées
export function icc(matrix, { model = "2,1", alpha = 0.05 } = {}) {
  // matrix : lignes = sujets, colonnes = juges/mesures
  const rows = matrix.map(r => r.map(Number)).filter(r => r.every(Number.isFinite));
  const n = rows.length, k = rows[0]?.length || 0;
  if (n < 2 || k < 2) return null;
  const grand = mean(rows.flat());
  const rowMeans = rows.map(mean);
  const colMeans = Array.from({ length: k }, (_, j) => mean(rows.map(r => r[j])));
  const ssTotal = sum(rows.flat().map(v => (v - grand) ** 2));
  const ssRow = k * sum(rowMeans.map(m => (m - grand) ** 2));
  const ssCol = n * sum(colMeans.map(m => (m - grand) ** 2));
  const ssErr = ssTotal - ssRow - ssCol;
  const msR = ssRow / (n - 1);
  const msC = ssCol / (k - 1);
  const msE = ssErr / ((n - 1) * (k - 1));
  const msW = (ssCol + ssErr) / (n * (k - 1));

  const values = {
    "1,1": (msR - msW) / (msR + (k - 1) * msW),
    "1,k": (msR - msW) / msR,
    "2,1": (msR - msE) / (msR + (k - 1) * msE + k * (msC - msE) / n),
    "2,k": (msR - msE) / (msR + (msC - msE) / n),
    "3,1": (msR - msE) / (msR + (k - 1) * msE),
    "3,k": (msR - msE) / msR,
  };
  const value = values[model] ?? values["2,1"];
  const F = msR / msE;
  const p = fdist.sf(F, n - 1, (n - 1) * (k - 1));
  return {
    test: `Coefficient de corrélation intraclasse — ICC(${model})`,
    icc: value, allModels: values, F, df: [n - 1, (n - 1) * (k - 1)], p,
    subjects: n, raters: k,
    interpretation: value < 0.5 ? "Fidélité faible." : value < 0.75 ? "Fidélité modérée."
      : value < 0.9 ? "Bonne fidélité." : "Excellente fidélité.",
  };
}

/* ============================================================
   10. PUISSANCE ET TAILLE D'ÉCHANTILLON
   ============================================================ */

// Puissance d'un test t à deux échantillons
export function powerTTest({ n = null, d = null, power = null, alpha = 0.05, tail = "two" }) {
  const zA = normal.inv(1 - alpha / (tail === "two" ? 2 : 1));
  if (n && d) {
    const ncp = d * Math.sqrt(n / 2);
    const pw = 1 - normal.cdf(zA - ncp) + normal.cdf(-zA - ncp);
    return { power: pw, n, d, alpha, interpretation: `Puissance = ${(pw * 100).toFixed(1)} % avec ${n} sujets par groupe.` };
  }
  if (d && power) {
    const zB = normal.inv(power);
    const need = Math.ceil(2 * ((zA + zB) / d) ** 2);
    return { n: need, d, power, alpha, interpretation: `${need} sujets par groupe (soit ${need * 2} au total) sont nécessaires.` };
  }
  if (n && power) {
    const zB = normal.inv(power);
    return { d: (zA + zB) * Math.sqrt(2 / n), n, power, alpha };
  }
  return null;
}

// Taille d'échantillon pour l'estimation d'une proportion
export function sampleSizeProportion({ p = 0.5, margin = 0.05, level = 0.95, population = null }) {
  const z = normal.inv(1 - (1 - level) / 2);
  let n = z * z * p * (1 - p) / (margin * margin);
  if (population) n = n / (1 + (n - 1) / population); // correction population finie
  return {
    n: Math.ceil(n), p, margin, level, population,
    interpretation: `${Math.ceil(n)} sujets sont nécessaires pour estimer une proportion de ${(p * 100).toFixed(0)} % à ±${(margin * 100).toFixed(1)} points (confiance ${(level * 100).toFixed(0)} %).`,
  };
}

// Taille d'échantillon pour comparer deux proportions
export function sampleSizeTwoProportions({ p1, p2, alpha = 0.05, power = 0.8 }) {
  const zA = normal.inv(1 - alpha / 2), zB = normal.inv(power);
  const pbar = (p1 + p2) / 2;
  const n = ((zA * Math.sqrt(2 * pbar * (1 - pbar)) + zB * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2))) ** 2) / ((p1 - p2) ** 2);
  return {
    n: Math.ceil(n), p1, p2, alpha, power,
    interpretation: `${Math.ceil(n)} sujets par groupe sont nécessaires pour détecter un écart de ${((p1 - p2) * 100).toFixed(1)} points.`,
  };
}
