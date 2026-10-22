// medistat/js/stats/regression.js
// Modèles de régression — linéaire simple et multiple, logistique, de Poisson.
// Algèbre matricielle minimale incluse (élimination de Gauss-Jordan), afin de
// rester sans aucune dépendance externe.

import { normal, studentt, chisquare, fdist } from "./distributions.js";
import { mean, sd, sum, numeric } from "./descriptive.js";

/* ===================== Algèbre linéaire ===================== */

export function matMul(A, B) {
  const n = A.length, m = B[0].length, k = B.length;
  const C = Array.from({ length: n }, () => new Array(m).fill(0));
  for (let i = 0; i < n; i++)
    for (let j = 0; j < m; j++) {
      let s = 0;
      for (let t = 0; t < k; t++) s += A[i][t] * B[t][j];
      C[i][j] = s;
    }
  return C;
}

export function transpose(A) {
  return A[0].map((_, j) => A.map(r => r[j]));
}

// Inversion par Gauss-Jordan avec pivot partiel
export function inverse(A) {
  const n = A.length;
  const M = A.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    if (Math.abs(M[piv][col]) < 1e-12) return null; // matrice singulière (colinéarité)
    [M[col], M[piv]] = [M[piv], M[col]];
    const d = M[col][col];
    for (let j = 0; j < 2 * n; j++) M[col][j] /= d;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col];
      if (!f) continue;
      for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[col][j];
    }
  }
  return M.map(r => r.slice(n));
}

/* ===================== Régression linéaire simple ===================== */

export function linearRegression(xs, ys, { alpha = 0.05 } = {}) {
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
  if (!sxx) return null;
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  const fitted = x.map(v => intercept + slope * v);
  const residuals = y.map((v, i) => v - fitted[i]);
  const ssRes = sum(residuals.map(r => r * r));
  const ssReg = syy - ssRes;
  const dfRes = n - 2;
  const mse = ssRes / dfRes;
  const seSlope = Math.sqrt(mse / sxx);
  const seIntercept = Math.sqrt(mse * (1 / n + mx * mx / sxx));
  const tSlope = slope / seSlope;
  const tInt = intercept / seIntercept;
  const r2 = ssReg / syy;
  const F = (ssReg / 1) / mse;
  const tc = studentt.inv(1 - alpha / 2, dfRes);

  // Durbin-Watson : autocorrélation des résidus (séries temporelles / suivi)
  let dwNum = 0;
  for (let i = 1; i < n; i++) dwNum += (residuals[i] - residuals[i - 1]) ** 2;
  const dw = dwNum / ssRes;

  return {
    test: "Régression linéaire simple",
    n, alpha,
    coefficients: [
      {
        name: "Constante", estimate: intercept, se: seIntercept, t: tInt, df: dfRes,
        p: 2 * studentt.cdf(-Math.abs(tInt), dfRes),
        ciLower: intercept - tc * seIntercept, ciUpper: intercept + tc * seIntercept,
      },
      {
        name: "Pente (X)", estimate: slope, se: seSlope, t: tSlope, df: dfRes,
        p: 2 * studentt.cdf(-Math.abs(tSlope), dfRes),
        ciLower: slope - tc * seSlope, ciUpper: slope + tc * seSlope,
        standardized: slope * Math.sqrt(sxx / syy), // bêta standardisé = r
      },
    ],
    r: Math.sign(slope) * Math.sqrt(r2),
    r2,
    adjustedR2: 1 - (1 - r2) * (n - 1) / dfRes,
    residualSE: Math.sqrt(mse),
    F, dfF: [1, dfRes], p: fdist.sf(F, 1, dfRes),
    anova: [
      { source: "Régression", ss: ssReg, df: 1, ms: ssReg, F, p: fdist.sf(F, 1, dfRes) },
      { source: "Résiduel", ss: ssRes, df: dfRes, ms: mse, F: null, p: null },
      { source: "Total", ss: syy, df: n - 1, ms: null, F: null, p: null },
    ],
    fitted, residuals,
    standardizedResiduals: residuals.map(r => r / Math.sqrt(mse)),
    durbinWatson: dw,
    equation: `Y = ${intercept.toFixed(4)} ${slope >= 0 ? "+" : "−"} ${Math.abs(slope).toFixed(4)} × X`,
    predict: xv => intercept + slope * xv,
    interpretation: `Chaque unité supplémentaire de X est associée à une variation de ${slope.toFixed(4)} unité(s) de Y ; le modèle explique ${(r2 * 100).toFixed(1)} % de la variance.`,
  };
}

/* ===================== Régression linéaire multiple ===================== */

// predictors : tableau de colonnes { name, values }
export function multipleRegression(y, predictors, { alpha = 0.05 } = {}) {
  const names = predictors.map((p, i) => p.name || `X${i + 1}`);
  const cols = predictors.map(p => p.values || p);
  // Écarte les lignes comportant au moins une valeur manquante
  const rows = [];
  for (let i = 0; i < y.length; i++) {
    const yv = Number(y[i]);
    const xv = cols.map(c => Number(c[i]));
    if (Number.isFinite(yv) && xv.every(Number.isFinite)) rows.push({ y: yv, x: xv });
  }
  const n = rows.length, k = cols.length;
  if (n < k + 2) return null;

  const X = rows.map(r => [1, ...r.x]);            // matrice de conception
  const Y = rows.map(r => [r.y]);
  const Xt = transpose(X);
  const XtXinv = inverse(matMul(Xt, X));
  if (!XtXinv) return { error: "Matrice singulière : au moins deux prédicteurs sont colinéaires." };
  const beta = matMul(XtXinv, matMul(Xt, Y)).map(r => r[0]);

  const fitted = X.map(r => sum(r.map((v, j) => v * beta[j])));
  const yv = rows.map(r => r.y);
  const my = mean(yv);
  const residuals = yv.map((v, i) => v - fitted[i]);
  const ssRes = sum(residuals.map(r => r * r));
  const ssTot = sum(yv.map(v => (v - my) ** 2));
  const ssReg = ssTot - ssRes;
  const dfRes = n - k - 1;
  const mse = ssRes / dfRes;
  const r2 = ssReg / ssTot;
  const adjR2 = 1 - (1 - r2) * (n - 1) / dfRes;
  const F = (ssReg / k) / mse;
  const tc = studentt.inv(1 - alpha / 2, dfRes);

  const sdY = sd(yv);
  const coefficients = beta.map((b, j) => {
    const se = Math.sqrt(mse * XtXinv[j][j]);
    const t = b / se;
    const out = {
      name: j === 0 ? "Constante" : names[j - 1],
      estimate: b, se, t, df: dfRes,
      p: 2 * studentt.cdf(-Math.abs(t), dfRes),
      ciLower: b - tc * se, ciUpper: b + tc * se,
    };
    if (j > 0) {
      const p = j - 1;                                       // indice du prédicteur
      const sdX = sd(rows.map(r => r.x[p]));
      out.standardized = b * sdX / sdY;                      // bêta standardisé
      // Facteur d'inflation de la variance : on régresse ce prédicteur sur
      // tous les autres. VIF > 10 signale une colinéarité problématique.
      const otherIdx = cols.map((_, q) => q).filter(q => q !== p);
      if (otherIdx.length) {
        const aux = multipleRegressionCore(
          rows.map(r => r.x[p]),
          otherIdx.map(q => rows.map(r => r.x[q])));
        out.vif = aux && aux.r2 < 1 ? 1 / (1 - aux.r2) : null;
        out.tolerance = out.vif ? 1 / out.vif : null;
      }
    }
    return out;
  });

  // Durbin-Watson
  let dwNum = 0;
  for (let i = 1; i < n; i++) dwNum += (residuals[i] - residuals[i - 1]) ** 2;

  const eqTerms = coefficients.slice(1)
    .map(c => `${c.estimate >= 0 ? "+" : "−"} ${Math.abs(c.estimate).toFixed(4)}×${c.name}`)
    .join(" ");

  return {
    test: "Régression linéaire multiple",
    n, k, alpha, coefficients,
    r2, adjustedR2: adjR2,
    r: Math.sqrt(r2),
    residualSE: Math.sqrt(mse),
    F, dfF: [k, dfRes], p: fdist.sf(F, k, dfRes),
    anova: [
      { source: "Régression", ss: ssReg, df: k, ms: ssReg / k, F, p: fdist.sf(F, k, dfRes) },
      { source: "Résiduel", ss: ssRes, df: dfRes, ms: mse, F: null, p: null },
      { source: "Total", ss: ssTot, df: n - 1, ms: null, F: null, p: null },
    ],
    fitted, residuals,
    standardizedResiduals: residuals.map(r => r / Math.sqrt(mse)),
    durbinWatson: dwNum / ssRes,
    aic: n * Math.log(ssRes / n) + 2 * (k + 1),
    bic: n * Math.log(ssRes / n) + Math.log(n) * (k + 1),
    equation: `Y = ${beta[0].toFixed(4)} ${eqTerms}`,
    predict: xvals => beta[0] + sum(xvals.map((v, j) => v * beta[j + 1])),
    interpretation: `Le modèle explique ${(r2 * 100).toFixed(1)} % de la variance (R² ajusté = ${(adjR2 * 100).toFixed(1)} %) ; il est globalement ${fdist.sf(F, k, dfRes) < alpha ? "" : "non "}significatif.`,
  };
}

// Noyau minimal réutilisé pour le calcul des VIF
function multipleRegressionCore(y, cols) {
  const n = y.length, k = cols.length;
  if (n < k + 2) return null;
  const X = y.map((_, i) => [1, ...cols.map(c => c[i])]);
  const Y = y.map(v => [v]);
  const XtXinv = inverse(matMul(transpose(X), X));
  if (!XtXinv) return null;
  const beta = matMul(XtXinv, matMul(transpose(X), Y)).map(r => r[0]);
  const fitted = X.map(r => sum(r.map((v, j) => v * beta[j])));
  const my = mean(y);
  const ssRes = sum(y.map((v, i) => (v - fitted[i]) ** 2));
  const ssTot = sum(y.map(v => (v - my) ** 2));
  return { r2: ssTot ? 1 - ssRes / ssTot : 0 };
}

/* ===================== Régression logistique ===================== */

// Estimation par maximum de vraisemblance (Newton-Raphson / IRLS).
// Renvoie les rapports de cotes (OR) et leurs intervalles de confiance —
// l'analyse de référence pour un critère binaire (guérison, positivité…).
export function logisticRegression(y, predictors, { alpha = 0.05, maxIter = 50, tol = 1e-10 } = {}) {
  const names = predictors.map((p, i) => p.name || `X${i + 1}`);
  const cols = predictors.map(p => p.values || p);
  const rows = [];
  for (let i = 0; i < y.length; i++) {
    const yv = Number(y[i]);
    const xv = cols.map(c => Number(c[i]));
    if ((yv === 0 || yv === 1) && xv.every(Number.isFinite)) rows.push({ y: yv, x: xv });
  }
  const n = rows.length, k = cols.length;
  if (n < k + 5) return null;
  const events = sum(rows.map(r => r.y));
  if (events === 0 || events === n) return { error: "La variable à expliquer ne présente qu'une seule modalité." };

  const X = rows.map(r => [1, ...r.x]);
  const Y = rows.map(r => r.y);
  let beta = new Array(k + 1).fill(0);
  beta[0] = Math.log(events / (n - events)); // départ : logit du taux de base

  const sigmoid = z => 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, z))));
  let XtWXinv = null, converged = false, iter = 0, logLik = 0;

  for (iter = 0; iter < maxIter; iter++) {
    const eta = X.map(r => sum(r.map((v, j) => v * beta[j])));
    const p = eta.map(sigmoid);
    const W = p.map(pi => Math.max(1e-10, pi * (1 - pi)));
    // Matrice d'information X'WX
    const XtWX = Array.from({ length: k + 1 }, () => new Array(k + 1).fill(0));
    for (let a = 0; a <= k; a++) for (let b = 0; b <= k; b++) {
      let s = 0;
      for (let i = 0; i < n; i++) s += X[i][a] * W[i] * X[i][b];
      XtWX[a][b] = s;
    }
    const inv = inverse(XtWX);
    if (!inv) return { error: "Le modèle ne converge pas (séparation complète ou colinéarité)." };
    XtWXinv = inv;
    // Score X'(y − p)
    const score = Array.from({ length: k + 1 }, (_, a) =>
      sum(X.map((r, i) => r[a] * (Y[i] - p[i]))));
    const delta = matMul(inv, score.map(v => [v])).map(r => r[0]);
    beta = beta.map((b, j) => b + delta[j]);
    logLik = sum(Y.map((yi, i) => {
      const pi = sigmoid(sum(X[i].map((v, j) => v * beta[j])));
      return yi * Math.log(Math.max(1e-15, pi)) + (1 - yi) * Math.log(Math.max(1e-15, 1 - pi));
    }));
    if (Math.max(...delta.map(Math.abs)) < tol) { converged = true; break; }
  }

  const z = normal.inv(1 - alpha / 2);
  const coefficients = beta.map((b, j) => {
    const se = Math.sqrt(XtWXinv[j][j]);
    const wald = (b / se) ** 2;
    return {
      name: j === 0 ? "Constante" : names[j - 1],
      estimate: b, se, wald, df: 1,
      z: b / se, p: chisquare.sf(wald, 1),
      oddsRatio: Math.exp(b),
      orLower: Math.exp(b - z * se), orUpper: Math.exp(b + z * se),
    };
  });

  // Vraisemblance du modèle nul, pour les pseudo-R²
  const p0 = events / n;
  const logLik0 = events * Math.log(p0) + (n - events) * Math.log(1 - p0);
  const chi2Model = 2 * (logLik - logLik0);
  const pModel = chisquare.sf(chi2Model, k);
  const probs = X.map(r => sigmoid(sum(r.map((v, j) => v * beta[j]))));

  // Classement au seuil 0,5 : matrice de confusion
  let tp = 0, tn = 0, fp = 0, fn = 0;
  probs.forEach((pi, i) => {
    const pred = pi >= 0.5 ? 1 : 0;
    if (pred === 1 && Y[i] === 1) tp++;
    else if (pred === 0 && Y[i] === 0) tn++;
    else if (pred === 1 && Y[i] === 0) fp++;
    else fn++;
  });

  // Test d'adéquation de Hosmer-Lemeshow (déciles de risque)
  const hl = hosmerLemeshow(Y, probs);

  return {
    test: "Régression logistique binaire",
    n, k, alpha, converged, iterations: iter + 1,
    coefficients,
    logLikelihood: logLik, logLikelihoodNull: logLik0,
    modelChi2: chi2Model, modelDf: k, p: pModel,
    pseudoR2: {
      coxSnell: 1 - Math.exp(-chi2Model / n),
      nagelkerke: (1 - Math.exp(-chi2Model / n)) / (1 - Math.exp(2 * logLik0 / n)),
      mcFadden: 1 - logLik / logLik0,
    },
    aic: -2 * logLik + 2 * (k + 1),
    bic: -2 * logLik + Math.log(n) * (k + 1),
    predictedProbabilities: probs,
    classification: {
      tp, tn, fp, fn,
      accuracy: (tp + tn) / n,
      sensitivity: (tp + fn) ? tp / (tp + fn) : null,
      specificity: (tn + fp) ? tn / (tn + fp) : null,
    },
    hosmerLemeshow: hl,
    predict: xvals => sigmoid(beta[0] + sum(xvals.map((v, j) => v * beta[j + 1]))),
    interpretation: pModel < alpha
      ? `Le modèle est globalement significatif (χ²(${k}) = ${chi2Model.toFixed(2)}, p ${pModel < 0.001 ? "< 0,001" : "= " + pModel.toFixed(4)}) et classe correctement ${(((tp + tn) / n) * 100).toFixed(1)} % des observations.`
      : "Le modèle n'apporte pas d'information significative par rapport au modèle nul.",
  };
}

// Test d'adéquation de Hosmer-Lemeshow
function hosmerLemeshow(y, probs, groups = 10) {
  const n = y.length;
  const idx = probs.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]);
  const g = Math.min(groups, Math.floor(n / 5));
  if (g < 3) return null;
  const size = Math.floor(n / g);
  let chi2 = 0;
  const table = [];
  for (let q = 0; q < g; q++) {
    const from = q * size, to = q === g - 1 ? n : (q + 1) * size;
    const slice = idx.slice(from, to);
    const obs = sum(slice.map(([, i]) => y[i]));
    const exp = sum(slice.map(([p]) => p));
    const m = slice.length;
    if (exp > 0 && exp < m) chi2 += (obs - exp) ** 2 / (exp * (1 - exp / m));
    table.push({ group: q + 1, n: m, observed: obs, expected: exp });
  }
  const df = g - 2;
  const p = chisquare.sf(chi2, df);
  return {
    chi2, df, p, table,
    // Ici, un p ÉLEVÉ est favorable : il indique une bonne adéquation du modèle
    interpretation: p > 0.05
      ? "L'adéquation du modèle aux données est satisfaisante (p > 0,05)."
      : "L'adéquation du modèle est insuffisante (p ≤ 0,05).",
  };
}

/* ===================== Régression de Poisson ===================== */

// Modélisation d'un nombre d'événements (nombre d'examens, de passages…),
// avec décalage logarithmique facultatif (offset) pour un taux d'incidence.
export function poissonRegression(y, predictors, { offset = null, alpha = 0.05, maxIter = 50, tol = 1e-10 } = {}) {
  const names = predictors.map((p, i) => p.name || `X${i + 1}`);
  const cols = predictors.map(p => p.values || p);
  const rows = [];
  for (let i = 0; i < y.length; i++) {
    const yv = Number(y[i]);
    const xv = cols.map(c => Number(c[i]));
    const off = offset ? Math.log(Number(offset[i])) : 0;
    if (Number.isFinite(yv) && yv >= 0 && xv.every(Number.isFinite) && Number.isFinite(off))
      rows.push({ y: yv, x: xv, off });
  }
  const n = rows.length, k = cols.length;
  if (n < k + 3) return null;
  const X = rows.map(r => [1, ...r.x]);
  const Y = rows.map(r => r.y);
  const OFF = rows.map(r => r.off);
  let beta = new Array(k + 1).fill(0);
  beta[0] = Math.log(Math.max(0.1, mean(Y)));
  let inv = null, converged = false, iter = 0;

  for (iter = 0; iter < maxIter; iter++) {
    const mu = X.map((r, i) => Math.exp(Math.min(500, sum(r.map((v, j) => v * beta[j])) + OFF[i])));
    const XtWX = Array.from({ length: k + 1 }, () => new Array(k + 1).fill(0));
    for (let a = 0; a <= k; a++) for (let b = 0; b <= k; b++) {
      let s = 0;
      for (let i = 0; i < n; i++) s += X[i][a] * mu[i] * X[i][b];
      XtWX[a][b] = s;
    }
    inv = inverse(XtWX);
    if (!inv) return { error: "Le modèle de Poisson ne converge pas." };
    const score = Array.from({ length: k + 1 }, (_, a) =>
      sum(X.map((r, i) => r[a] * (Y[i] - mu[i]))));
    const delta = matMul(inv, score.map(v => [v])).map(r => r[0]);
    beta = beta.map((b, j) => b + delta[j]);
    if (Math.max(...delta.map(Math.abs)) < tol) { converged = true; break; }
  }

  const mu = X.map((r, i) => Math.exp(sum(r.map((v, j) => v * beta[j])) + OFF[i]));
  const logLik = sum(Y.map((yi, i) => yi * Math.log(mu[i]) - mu[i] - lgammaInt(yi)));
  const deviance = 2 * sum(Y.map((yi, i) => (yi > 0 ? yi * Math.log(yi / mu[i]) : 0) - (yi - mu[i])));
  const z = normal.inv(1 - alpha / 2);
  const coefficients = beta.map((b, j) => {
    const se = Math.sqrt(inv[j][j]);
    const wald = (b / se) ** 2;
    return {
      name: j === 0 ? "Constante" : names[j - 1],
      estimate: b, se, z: b / se, wald, p: chisquare.sf(wald, 1),
      rateRatio: Math.exp(b),
      rrLower: Math.exp(b - z * se), rrUpper: Math.exp(b + z * se),
    };
  });
  const dfRes = n - k - 1;
  return {
    test: offset ? "Régression de Poisson (taux d'incidence)" : "Régression de Poisson (comptage)",
    n, k, alpha, converged, iterations: iter + 1,
    coefficients, logLikelihood: logLik,
    deviance, dfResidual: dfRes,
    dispersion: deviance / dfRes,
    overdispersed: deviance / dfRes > 1.5,
    aic: -2 * logLik + 2 * (k + 1),
    fitted: mu,
    interpretation: deviance / dfRes > 1.5
      ? "Surdispersion détectée (déviance/ddl > 1,5) : envisager un modèle binomial négatif."
      : "L'ajustement de Poisson est acceptable.",
  };
}

// ln(k!) pour un entier — via la fonction gamma
function lgammaInt(k) {
  let s = 0;
  for (let i = 2; i <= k; i++) s += Math.log(i);
  return s;
}

/* ===================== Diagnostics de régression ===================== */

// Test de Breusch-Pagan : hétéroscédasticité des résidus
export function breuschPagan(residuals, fitted) {
  const n = residuals.length;
  const sigma2 = sum(residuals.map(r => r * r)) / n;
  const u = residuals.map(r => r * r / sigma2);
  const aux = linearRegression(fitted, u);
  if (!aux) return null;
  const lm = aux.r2 * n;
  const p = chisquare.sf(lm, 1);
  return {
    test: "Test de Breusch-Pagan (hétéroscédasticité)",
    statistic: lm, statisticName: "LM", df: 1, p,
    interpretation: p < 0.05
      ? "Hétéroscédasticité détectée : la variance des résidus n'est pas constante."
      : "Homoscédasticité acceptable.",
  };
}

// Distance de Cook : détection des observations influentes
export function cooksDistance(x, y) {
  const reg = linearRegression(x, y);
  if (!reg) return null;
  const n = reg.n;
  const mx = mean(numeric(x));
  const sxx = sum(numeric(x).map(v => (v - mx) ** 2));
  const mse = reg.residualSE ** 2;
  return reg.residuals.map((r, i) => {
    const h = 1 / n + (Number(x[i]) - mx) ** 2 / sxx; // effet de levier
    return { index: i, leverage: h, residual: r, cook: (r * r / (2 * mse)) * h / (1 - h) ** 2 };
  });
}
