// medistat/js/stats/multivariate.js
// Analyses multivariées — ACP, analyse factorielle, classification automatique
// (k-moyennes et classification ascendante hiérarchique), analyse
// discriminante et analyse des correspondances.
// Décomposition en valeurs propres par méthode de Jacobi (matrices symétriques).

import { mean, sd, sum, numeric } from "./descriptive.js";
import { chisquare } from "./distributions.js";

/* ===================== Décomposition en valeurs propres ===================== */

// Méthode de Jacobi cyclique — exacte pour les matrices symétriques réelles
export function jacobiEigen(matrix, maxIter = 100, tol = 1e-12) {
  const n = matrix.length;
  const A = matrix.map(r => [...r]);
  let V = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));

  for (let iter = 0; iter < maxIter; iter++) {
    // Somme des carrés hors diagonale
    let off = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] ** 2;
    if (off < tol) break;

    for (let p = 0; p < n - 1; p++) for (let q = p + 1; q < n; q++) {
      if (Math.abs(A[p][q]) < 1e-15) continue;
      const theta = (A[q][q] - A[p][p]) / (2 * A[p][q]);
      const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < n; k++) {
        const akp = A[k][p], akq = A[k][q];
        A[k][p] = c * akp - s * akq;
        A[k][q] = s * akp + c * akq;
      }
      for (let k = 0; k < n; k++) {
        const apk = A[p][k], aqk = A[q][k];
        A[p][k] = c * apk - s * aqk;
        A[q][k] = s * apk + c * aqk;
      }
      for (let k = 0; k < n; k++) {
        const vkp = V[k][p], vkq = V[k][q];
        V[k][p] = c * vkp - s * vkq;
        V[k][q] = s * vkp + c * vkq;
      }
    }
  }

  const pairs = Array.from({ length: n }, (_, i) => ({
    value: A[i][i],
    vector: V.map(r => r[i]),
  })).sort((a, b) => b.value - a.value); // ordre décroissant

  return { values: pairs.map(p => p.value), vectors: pairs.map(p => p.vector) };
}

/* ===================== Analyse en composantes principales ===================== */

// variables : tableau de colonnes { name, values }
export function pca(variables, { standardize = true, components = null } = {}) {
  const names = variables.map((v, i) => v.name || `V${i + 1}`);
  const cols = variables.map(v => v.values || v);
  // Lignes complètes uniquement
  const rows = [];
  const nObs = Math.min(...cols.map(c => c.length));
  for (let i = 0; i < nObs; i++) {
    const r = cols.map(c => Number(c[i]));
    if (r.every(Number.isFinite)) rows.push(r);
  }
  const n = rows.length, k = cols.length;
  if (n < 3 || k < 2) return null;

  const means = Array.from({ length: k }, (_, j) => mean(rows.map(r => r[j])));
  const sds = Array.from({ length: k }, (_, j) => sd(rows.map(r => r[j])));
  const Z = rows.map(r => r.map((v, j) => standardize ? (v - means[j]) / sds[j] : v - means[j]));

  // Matrice de corrélation (si standardisée) ou de covariance
  const C = Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) =>
    sum(Z.map(r => r[i] * r[j])) / (n - 1)));

  const { values, vectors } = jacobiEigen(C);
  const totalVar = sum(values);
  const nComp = components || values.filter(v => v > (standardize ? 1 : totalVar / k)).length || 2;

  // Coordonnées des individus sur les axes principaux
  const scores = Z.map(r => vectors.map(vec => sum(r.map((v, j) => v * vec[j]))));

  // Saturations : corrélation variable × composante
  const loadings = Array.from({ length: k }, (_, j) =>
    values.map((val, c) => vectors[c][j] * Math.sqrt(Math.max(0, val))));

  // Test de sphéricité de Bartlett : l'ACP a-t-elle un sens ?
  const detC = values.reduce((a, b) => a * Math.max(1e-300, b), 1);
  const bartlettChi2 = -(n - 1 - (2 * k + 5) / 6) * Math.log(detC);
  const bartlettDf = k * (k - 1) / 2;

  // Indice KMO (Kaiser-Meyer-Olkin) : adéquation de l'échantillonnage
  const kmoValue = kmo(C);

  return {
    test: "Analyse en composantes principales (ACP)",
    n, variables: names, standardize,
    eigenvalues: values,
    explainedVariance: values.map(v => v / totalVar * 100),
    cumulativeVariance: values.reduce((acc, v) => {
      acc.push((acc.length ? acc[acc.length - 1] : 0) + v / totalVar * 100);
      return acc;
    }, []),
    eigenvectors: vectors,
    loadings,
    communalities: loadings.map(l => sum(l.slice(0, nComp).map(v => v * v))),
    scores,
    componentsRetained: nComp,
    kaiserCriterion: values.filter(v => v > 1).length,
    correlationMatrix: C,
    bartlettSphericity: {
      chi2: bartlettChi2, df: bartlettDf, p: chisquare.sf(bartlettChi2, bartlettDf),
    },
    kmo: kmoValue,
    interpretation: `Les ${nComp} premières composantes restituent ${values.slice(0, nComp).reduce((a, v) => a + v / totalVar * 100, 0).toFixed(1)} % ` +
      `de l'information. Indice KMO = ${kmoValue.toFixed(3)} (${kmoValue >= 0.8 ? "excellent" : kmoValue >= 0.7 ? "satisfaisant" : kmoValue >= 0.6 ? "médiocre" : "insuffisant"}).`,
  };
}

// Indice KMO à partir de la matrice de corrélation
function kmo(C) {
  const k = C.length;
  // Inverse de C → corrélations partielles
  const M = C.map((r, i) => [...r, ...Array.from({ length: k }, (_, j) => (i === j ? 1 : 0))]);
  for (let col = 0; col < k; col++) {
    let piv = col;
    for (let r = col + 1; r < k; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    if (Math.abs(M[piv][col]) < 1e-12) return 0;
    [M[col], M[piv]] = [M[piv], M[col]];
    const d = M[col][col];
    for (let j = 0; j < 2 * k; j++) M[col][j] /= d;
    for (let r = 0; r < k; r++) {
      if (r === col) continue;
      const f = M[r][col];
      for (let j = 0; j < 2 * k; j++) M[r][j] -= f * M[col][j];
    }
  }
  const Cinv = M.map(r => r.slice(k));
  let sumR2 = 0, sumP2 = 0;
  for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) {
    if (i === j) continue;
    sumR2 += C[i][j] ** 2;
    const partial = -Cinv[i][j] / Math.sqrt(Cinv[i][i] * Cinv[j][j]);
    sumP2 += partial ** 2;
  }
  return sumR2 / (sumR2 + sumP2);
}

/* ===================== Classification par k-moyennes ===================== */

export function kMeans(variables, k = 3, { standardize = true, maxIter = 100, seed = 42 } = {}) {
  const names = variables.map((v, i) => v.name || `V${i + 1}`);
  const cols = variables.map(v => v.values || v);
  const rows = [];
  const nObs = Math.min(...cols.map(c => c.length));
  const indices = [];
  for (let i = 0; i < nObs; i++) {
    const r = cols.map(c => Number(c[i]));
    if (r.every(Number.isFinite)) { rows.push(r); indices.push(i); }
  }
  const n = rows.length, d = cols.length;
  if (n < k) return null;

  const means = Array.from({ length: d }, (_, j) => mean(rows.map(r => r[j])));
  const sds = Array.from({ length: d }, (_, j) => sd(rows.map(r => r[j])) || 1);
  const X = standardize ? rows.map(r => r.map((v, j) => (v - means[j]) / sds[j])) : rows;

  // Générateur pseudo-aléatoire reproductible (résultats stables entre exécutions)
  let s = seed;
  const rand = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };

  // Initialisation k-means++ : centres bien séparés dès le départ
  const centroids = [X[Math.floor(rand() * n)].slice()];
  while (centroids.length < k) {
    const dists = X.map(p => Math.min(...centroids.map(c => dist2(p, c))));
    const tot = sum(dists);
    let acc = rand() * tot, idx = 0;
    for (let i = 0; i < n; i++) { acc -= dists[i]; if (acc <= 0) { idx = i; break; } }
    centroids.push(X[idx].slice());
  }

  let assign = new Array(n).fill(0), iter = 0, changed = true;
  for (iter = 0; iter < maxIter && changed; iter++) {
    changed = false;
    for (let i = 0; i < n; i++) {
      let best = 0, bd = Infinity;
      for (let c = 0; c < k; c++) {
        const dd = dist2(X[i], centroids[c]);
        if (dd < bd) { bd = dd; best = c; }
      }
      if (assign[i] !== best) { assign[i] = best; changed = true; }
    }
    for (let c = 0; c < k; c++) {
      const members = X.filter((_, i) => assign[i] === c);
      if (members.length) {
        for (let j = 0; j < d; j++) centroids[c][j] = mean(members.map(m => m[j]));
      }
    }
  }

  // Inertie intra-classe et silhouette moyenne
  const wcss = sum(X.map((p, i) => dist2(p, centroids[assign[i]])));
  const grand = Array.from({ length: d }, (_, j) => mean(X.map(r => r[j])));
  const tss = sum(X.map(p => dist2(p, grand)));
  const silhouette = meanSilhouette(X, assign, k);

  const clusters = Array.from({ length: k }, (_, c) => {
    const memberIdx = indices.filter((_, i) => assign[i] === c);
    return {
      cluster: c + 1,
      size: memberIdx.length,
      percent: (memberIdx.length / n) * 100,
      members: memberIdx,
      centroid: names.map((nm, j) => ({
        variable: nm,
        standardized: centroids[c][j],
        original: standardize ? centroids[c][j] * sds[j] + means[j] : centroids[c][j],
      })),
    };
  });

  return {
    test: "Classification par k-moyennes",
    n, k, iterations: iter, converged: !changed,
    assignments: indices.map((orig, i) => ({ index: orig, cluster: assign[i] + 1 })),
    clusters,
    wcss, betweenSS: tss - wcss,
    varianceExplained: tss ? (tss - wcss) / tss * 100 : 0,
    silhouette,
    interpretation: `${k} classes identifiées, restituant ${tss ? ((tss - wcss) / tss * 100).toFixed(1) : 0} % de l'inertie totale. ` +
      `Silhouette moyenne = ${silhouette.toFixed(3)} (${silhouette > 0.7 ? "structure forte" : silhouette > 0.5 ? "structure raisonnable" : silhouette > 0.25 ? "structure faible" : "aucune structure nette"}).`,
  };
}

const dist2 = (a, b) => sum(a.map((v, i) => (v - b[i]) ** 2));

function meanSilhouette(X, assign, k) {
  const n = X.length;
  if (n > 2000) return NaN; // coût quadratique : on s'abstient au-delà
  let total = 0;
  for (let i = 0; i < n; i++) {
    const own = X.filter((_, q) => assign[q] === assign[i] && q !== i);
    if (!own.length) continue;
    const a = mean(own.map(p => Math.sqrt(dist2(X[i], p))));
    let b = Infinity;
    for (let c = 0; c < k; c++) {
      if (c === assign[i]) continue;
      const other = X.filter((_, q) => assign[q] === c);
      if (!other.length) continue;
      b = Math.min(b, mean(other.map(p => Math.sqrt(dist2(X[i], p)))));
    }
    if (Number.isFinite(b)) total += (b - a) / Math.max(a, b);
  }
  return total / n;
}

/* ===================== Classification ascendante hiérarchique ===================== */

export function hierarchicalClustering(variables, { standardize = true, linkage = "ward" } = {}) {
  const cols = variables.map(v => v.values || v);
  const rows = [];
  const nObs = Math.min(...cols.map(c => c.length));
  for (let i = 0; i < nObs; i++) {
    const r = cols.map(c => Number(c[i]));
    if (r.every(Number.isFinite)) rows.push(r);
  }
  const n = rows.length, d = cols.length;
  if (n < 3 || n > 500) return n > 500
    ? { error: "Au-delà de 500 observations, préférer les k-moyennes (coût quadratique)." }
    : null;

  const means = Array.from({ length: d }, (_, j) => mean(rows.map(r => r[j])));
  const sds = Array.from({ length: d }, (_, j) => sd(rows.map(r => r[j])) || 1);
  const X = standardize ? rows.map(r => r.map((v, j) => (v - means[j]) / sds[j])) : rows;

  let clusters = X.map((p, i) => ({ id: i, members: [i], centroid: [...p], size: 1 }));
  const merges = [];
  let nextId = n;

  while (clusters.length > 1) {
    let bi = 0, bj = 1, bd = Infinity;
    for (let i = 0; i < clusters.length; i++) for (let j = i + 1; j < clusters.length; j++) {
      let dd;
      if (linkage === "ward") {
        const ni = clusters[i].size, nj = clusters[j].size;
        dd = (ni * nj / (ni + nj)) * dist2(clusters[i].centroid, clusters[j].centroid);
      } else if (linkage === "single") {
        dd = Math.min(...clusters[i].members.flatMap(a =>
          clusters[j].members.map(b => dist2(X[a], X[b]))));
      } else if (linkage === "complete") {
        dd = Math.max(...clusters[i].members.flatMap(a =>
          clusters[j].members.map(b => dist2(X[a], X[b]))));
      } else { // moyenne
        dd = mean(clusters[i].members.flatMap(a =>
          clusters[j].members.map(b => dist2(X[a], X[b]))));
      }
      if (dd < bd) { bd = dd; bi = i; bj = j; }
    }
    const a = clusters[bi], b = clusters[bj];
    const members = [...a.members, ...b.members];
    const size = a.size + b.size;
    const centroid = Array.from({ length: d }, (_, j) =>
      (a.centroid[j] * a.size + b.centroid[j] * b.size) / size);
    merges.push({
      step: merges.length + 1, id: nextId,
      left: a.id, right: b.id, distance: Math.sqrt(bd), size,
    });
    clusters = clusters.filter((_, q) => q !== bi && q !== bj);
    clusters.push({ id: nextId++, members, centroid, size });
  }

  // Coupe de l'arbre pour un nombre de classes donné
  const cut = kCut => {
    const active = new Map();
    for (let i = 0; i < n; i++) active.set(i, [i]);
    for (const m of merges) {
      if (active.size <= kCut) break;
      const l = active.get(m.left) || [], r = active.get(m.right) || [];
      active.delete(m.left); active.delete(m.right);
      active.set(m.id, [...l, ...r]);
    }
    const groups = [...active.values()];
    const labels = new Array(n).fill(0);
    groups.forEach((g, c) => g.forEach(i => { labels[i] = c + 1; }));
    return { k: groups.length, labels, groups };
  };

  // Saut de distance maximal : suggestion du nombre de classes
  const dists = merges.map(m => m.distance);
  let bestK = 2, bestJump = 0;
  for (let i = Math.max(0, merges.length - 10); i < merges.length - 1; i++) {
    const jump = dists[i + 1] - dists[i];
    if (jump > bestJump) { bestJump = jump; bestK = n - i - 1; }
  }

  return {
    test: `Classification ascendante hiérarchique (agrégation : ${linkage === "ward" ? "Ward" : linkage})`,
    n, linkage, merges, cut,
    suggestedK: Math.max(2, Math.min(10, bestK)),
    interpretation: `Le dendrogramme suggère ${Math.max(2, Math.min(10, bestK))} classes (saut de distance maximal).`,
  };
}

/* ===================== Analyse factorielle des correspondances ===================== */

// AFC sur un tableau de contingence — représente lignes et colonnes
// dans un même plan : très utile pour croiser diagnostics et services.
export function correspondenceAnalysis(table, rowLabels = null, colLabels = null) {
  const I = table.length, J = table[0]?.length || 0;
  if (I < 2 || J < 2) return null;
  const N = sum(table.flat());
  const P = table.map(r => r.map(v => v / N));
  const rowMass = P.map(sum);
  const colMass = Array.from({ length: J }, (_, j) => sum(P.map(r => r[j])));

  // Matrice des écarts standardisés (résidus de Pearson normalisés)
  const S = Array.from({ length: I }, (_, i) => Array.from({ length: J }, (_, j) =>
    (P[i][j] - rowMass[i] * colMass[j]) / Math.sqrt(rowMass[i] * colMass[j])));

  // Valeurs propres via S'S (symétrique, J × J)
  const StS = Array.from({ length: J }, (_, a) => Array.from({ length: J }, (_, b) =>
    sum(S.map(r => r[a] * r[b]))));
  const { values, vectors } = jacobiEigen(StS);
  const nAxes = Math.min(I, J) - 1;
  const eig = values.slice(0, nAxes).map(v => Math.max(0, v));
  const totalInertia = sum(eig);

  // Coordonnées principales
  const colCoords = Array.from({ length: J }, (_, j) =>
    eig.map((val, a) => vectors[a][j] / Math.sqrt(colMass[j]) * Math.sqrt(val)));
  const rowCoords = Array.from({ length: I }, (_, i) =>
    eig.map((val, a) => {
      const proj = sum(Array.from({ length: J }, (_, j) => S[i][j] * vectors[a][j]));
      return val > 1e-12 ? proj / Math.sqrt(rowMass[i]) : 0;
    }));

  const chi2 = totalInertia * N;
  const df = (I - 1) * (J - 1);

  return {
    test: "Analyse factorielle des correspondances (AFC)",
    n: N,
    rowLabels: rowLabels || table.map((_, i) => `Ligne ${i + 1}`),
    colLabels: colLabels || Array.from({ length: J }, (_, j) => `Colonne ${j + 1}`),
    eigenvalues: eig,
    explainedInertia: eig.map(v => v / totalInertia * 100),
    totalInertia,
    chi2, df, p: chisquare.sf(chi2, df),
    rowCoordinates: rowCoords,
    colCoordinates: colCoords,
    rowMass, colMass,
    interpretation: `Les deux premiers axes restituent ${((eig[0] + (eig[1] || 0)) / totalInertia * 100).toFixed(1)} % de l'inertie. ` +
      `L'association est ${chisquare.sf(chi2, df) < 0.05 ? "" : "non "}significative (χ² = ${chi2.toFixed(2)}).`,
  };
}

/* ===================== Analyse discriminante linéaire ===================== */

export function linearDiscriminant(variables, groups) {
  const names = variables.map((v, i) => v.name || `V${i + 1}`);
  const cols = variables.map(v => v.values || v);
  const rows = [];
  const nObs = Math.min(...cols.map(c => c.length), groups.length);
  for (let i = 0; i < nObs; i++) {
    const r = cols.map(c => Number(c[i]));
    const g = String(groups[i] ?? "").trim();
    if (r.every(Number.isFinite) && g) rows.push({ x: r, g });
  }
  const levels = [...new Set(rows.map(r => r.g))].sort();
  const k = levels.length, d = cols.length, n = rows.length;
  if (k < 2 || n < d + k + 2) return null;

  const grandMean = Array.from({ length: d }, (_, j) => mean(rows.map(r => r.x[j])));
  const groupData = levels.map(l => rows.filter(r => r.g === l));
  const groupMeans = groupData.map(g => Array.from({ length: d }, (_, j) => mean(g.map(r => r.x[j]))));

  // Matrice de dispersion intra-groupe (W) — mise en commun
  const W = Array.from({ length: d }, () => new Array(d).fill(0));
  groupData.forEach((g, c) => {
    for (const r of g) for (let a = 0; a < d; a++) for (let b = 0; b < d; b++)
      W[a][b] += (r.x[a] - groupMeans[c][a]) * (r.x[b] - groupMeans[c][b]);
  });
  const Wpooled = W.map(r => r.map(v => v / (n - k)));

  // Inversion de W
  const M = Wpooled.map((r, i) => [...r, ...Array.from({ length: d }, (_, j) => (i === j ? 1 : 0))]);
  for (let col = 0; col < d; col++) {
    let piv = col;
    for (let r = col + 1; r < d; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    if (Math.abs(M[piv][col]) < 1e-12) return { error: "Variables colinéaires : analyse discriminante impossible." };
    [M[col], M[piv]] = [M[piv], M[col]];
    const dv = M[col][col];
    for (let j = 0; j < 2 * d; j++) M[col][j] /= dv;
    for (let r = 0; r < d; r++) {
      if (r === col) continue;
      const f = M[r][col];
      for (let j = 0; j < 2 * d; j++) M[r][j] -= f * M[col][j];
    }
  }
  const Winv = M.map(r => r.slice(d));

  // Fonctions de classement de Fisher
  const priors = groupData.map(g => g.length / n);
  const functions = groupMeans.map((mu, c) => {
    const coef = Array.from({ length: d }, (_, a) => sum(Winv[a].map((v, b) => v * mu[b])));
    const constant = -0.5 * sum(coef.map((v, a) => v * mu[a])) + Math.log(priors[c]);
    return { group: levels[c], constant, coefficients: names.map((nm, a) => ({ variable: nm, coefficient: coef[a] })) };
  });

  // Classement et taux de bon reclassement
  let correct = 0;
  const confusion = levels.map(() => levels.map(() => 0));
  const predictions = rows.map(r => {
    const scores = functions.map(f => f.constant + sum(f.coefficients.map((c, a) => c.coefficient * r.x[a])));
    const best = scores.indexOf(Math.max(...scores));
    confusion[levels.indexOf(r.g)][best]++;
    if (levels[best] === r.g) correct++;
    return { actual: r.g, predicted: levels[best], scores };
  });

  // Lambda de Wilks (test global de séparation des groupes)
  const T = Array.from({ length: d }, (_, a) => Array.from({ length: d }, (_, b) =>
    sum(rows.map(r => (r.x[a] - grandMean[a]) * (r.x[b] - grandMean[b])))));
  const detT = determinant(T), detW = determinant(W);
  const lambda = detT ? detW / detT : 1;
  const chi2 = -(n - 1 - (d + k) / 2) * Math.log(Math.max(1e-300, lambda));
  const df = d * (k - 1);

  return {
    test: "Analyse discriminante linéaire (Fisher)",
    n, k, d, groups: levels,
    groupMeans: levels.map((l, c) => ({
      group: l, n: groupData[c].length,
      means: names.map((nm, a) => ({ variable: nm, mean: groupMeans[c][a] })),
    })),
    classificationFunctions: functions,
    predictions,
    confusionMatrix: confusion,
    accuracy: correct / n,
    wilksLambda: lambda, chi2, df, p: chisquare.sf(chi2, df),
    interpretation: `${(correct / n * 100).toFixed(1)} % des observations sont correctement reclassées. ` +
      `Lambda de Wilks = ${lambda.toFixed(4)} (p ${chisquare.sf(chi2, df) < 0.001 ? "< 0,001" : "= " + chisquare.sf(chi2, df).toFixed(4)}).`,
  };
}

// Déterminant par élimination de Gauss
function determinant(A) {
  const n = A.length;
  const M = A.map(r => [...r]);
  let det = 1;
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    if (Math.abs(M[piv][c]) < 1e-14) return 0;
    if (piv !== c) { [M[c], M[piv]] = [M[piv], M[c]]; det = -det; }
    det *= M[c][c];
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / M[c][c];
      for (let j = c; j < n; j++) M[r][j] -= f * M[c][j];
    }
  }
  return det;
}
