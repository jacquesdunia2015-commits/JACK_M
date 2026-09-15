// medistat/js/stats/diagnostic.js
// Évaluation des tests diagnostiques — le cœur statistique d'un laboratoire.
// Sensibilité, spécificité, valeurs prédictives, rapports de vraisemblance,
// courbe ROC et aire sous la courbe, choix du seuil optimal, concordance de
// méthodes (Bland-Altman), et mesures de risque épidémiologiques.

import { normal, chisquare } from "./distributions.js";
import { mean, sd, sum, numeric, median, quantile } from "./descriptive.js";

/* ===================== Performance d'un test binaire ===================== */

// tp : vrais positifs, fp : faux positifs, fn : faux négatifs, tn : vrais négatifs
export function diagnosticAccuracy(tp, fp, fn, tn, { alpha = 0.05, prevalence = null } = {}) {
  const n = tp + fp + fn + tn;
  if (!n) return null;
  const z = normal.inv(1 - alpha / 2);

  // IC de Wilson : robuste même lorsque la proportion vaut 0 ou 1
  const wilson = (s, t) => {
    if (!t) return { value: null, lower: null, upper: null };
    const p = s / t;
    const d = 1 + z * z / t;
    const c = (p + z * z / (2 * t)) / d;
    const h = z * Math.sqrt(p * (1 - p) / t + z * z / (4 * t * t)) / d;
    return { value: p, lower: Math.max(0, c - h), upper: Math.min(1, c + h) };
  };

  const sensitivity = wilson(tp, tp + fn);
  const specificity = wilson(tn, tn + fp);
  const accuracy = wilson(tp + tn, n);
  const prev = prevalence ?? (tp + fn) / n;

  // Valeurs prédictives recalculées pour la prévalence cible (théorème de Bayes)
  const se = sensitivity.value, sp = specificity.value;
  const ppvBayes = (se * prev) / (se * prev + (1 - sp) * (1 - prev));
  const npvBayes = (sp * (1 - prev)) / ((1 - se) * prev + sp * (1 - prev));

  const lrPlus = sp < 1 ? se / (1 - sp) : Infinity;
  const lrMinus = sp > 0 ? (1 - se) / sp : Infinity;
  const youden = se + sp - 1;

  // Kappa de Cohen entre le test et la référence
  const po = (tp + tn) / n;
  const pe = ((tp + fp) * (tp + fn) + (fn + tn) * (fp + tn)) / (n * n);
  const kappa = (po - pe) / (1 - pe);

  // Rapport de cotes diagnostique
  const zeroCell = tp === 0 || fp === 0 || fn === 0 || tn === 0;
  const [A, B, C, D] = zeroCell ? [tp + 0.5, fp + 0.5, fn + 0.5, tn + 0.5] : [tp, fp, fn, tn];
  const dor = (A * D) / (B * C);
  const seLogDor = Math.sqrt(1 / A + 1 / B + 1 / C + 1 / D);

  return {
    test: "Performance diagnostique",
    n, table: { tp, fp, fn, tn }, alpha,
    prevalence: prev,
    sensitivity, specificity, accuracy,
    ppv: wilson(tp, tp + fp),
    npv: wilson(tn, tn + fn),
    ppvAtPrevalence: ppvBayes,
    npvAtPrevalence: npvBayes,
    falsePositiveRate: (tn + fp) ? fp / (tn + fp) : null,
    falseNegativeRate: (tp + fn) ? fn / (tp + fn) : null,
    positiveLikelihoodRatio: lrPlus,
    negativeLikelihoodRatio: lrMinus,
    youdenIndex: youden,
    diagnosticOddsRatio: dor,
    dorCI: {
      lower: Math.exp(Math.log(dor) - z * seLogDor),
      upper: Math.exp(Math.log(dor) + z * seLogDor),
    },
    f1Score: (2 * tp) / (2 * tp + fp + fn),
    matthewsCorrelation: Math.sqrt((tp + fp) * (tp + fn) * (tn + fp) * (tn + fn))
      ? (tp * tn - fp * fn) / Math.sqrt((tp + fp) * (tp + fn) * (tn + fp) * (tn + fn)) : null,
    cohenKappa: kappa,
    numberNeededToDiagnose: youden ? 1 / youden : Infinity,
    interpretation: `Sensibilité ${(se * 100).toFixed(1)} % (IC ${(sensitivity.lower * 100).toFixed(1)}–${(sensitivity.upper * 100).toFixed(1)}), ` +
      `spécificité ${(sp * 100).toFixed(1)} % (IC ${(specificity.lower * 100).toFixed(1)}–${(specificity.upper * 100).toFixed(1)}). ` +
      `RV+ = ${lrPlus === Infinity ? "∞" : lrPlus.toFixed(2)} ; RV− = ${lrMinus.toFixed(2)}. ` +
      (lrPlus >= 10 ? "Un résultat positif est très informatif." :
        lrPlus >= 5 ? "Un résultat positif est modérément informatif." :
          "Un résultat positif apporte peu d'information."),
  };
}

/* ===================== Courbe ROC ===================== */

// values : mesure quantitative du test ; labels : 1 = malade, 0 = sain
// direction "higher" : une valeur élevée oriente vers la maladie
export function rocCurve(values, labels, { alpha = 0.05, direction = "higher" } = {}) {
  const data = [];
  for (let i = 0; i < Math.min(values.length, labels.length); i++) {
    const v = Number(values[i]);
    const l = Number(labels[i]);
    if (Number.isFinite(v) && (l === 0 || l === 1)) {
      data.push({ v: direction === "higher" ? v : -v, raw: Number(values[i]), l });
    }
  }
  const nPos = data.filter(d => d.l === 1).length;
  const nNeg = data.filter(d => d.l === 0).length;
  if (!nPos || !nNeg) return null;

  const thresholds = [...new Set(data.map(d => d.v))].sort((a, b) => b - a);
  const points = [{ threshold: Infinity, rawThreshold: direction === "higher" ? Infinity : -Infinity, sensitivity: 0, specificity: 1, fpr: 0, youden: 0 }];
  for (const t of thresholds) {
    const tp = data.filter(d => d.v >= t && d.l === 1).length;
    const fp = data.filter(d => d.v >= t && d.l === 0).length;
    const sens = tp / nPos, spec = 1 - fp / nNeg;
    points.push({
      threshold: t,
      rawThreshold: direction === "higher" ? t : -t,
      sensitivity: sens, specificity: spec, fpr: 1 - spec,
      youden: sens + spec - 1,
      tp, fp, fn: nPos - tp, tn: nNeg - fp,
    });
  }

  // AUC par la statistique U de Mann-Whitney (équivalence exacte, ex æquo gérés)
  let concordant = 0;
  const pos = data.filter(d => d.l === 1).map(d => d.v);
  const neg = data.filter(d => d.l === 0).map(d => d.v);
  for (const p of pos) for (const nv of neg) {
    if (p > nv) concordant += 1;
    else if (p === nv) concordant += 0.5;
  }
  const auc = concordant / (nPos * nNeg);

  // Erreur-type de Hanley & McNeil
  const q1v = auc / (2 - auc);
  const q2v = 2 * auc * auc / (1 + auc);
  const seAuc = Math.sqrt((auc * (1 - auc) + (nPos - 1) * (q1v - auc * auc) +
    (nNeg - 1) * (q2v - auc * auc)) / (nPos * nNeg));
  const z = normal.inv(1 - alpha / 2);
  const zAuc = (auc - 0.5) / seAuc;
  const pAuc = 2 * normal.cdf(-Math.abs(zAuc));

  // Seuil optimal : indice de Youden maximal
  const best = points.reduce((a, b) => (b.youden > a.youden ? b : a), points[0]);
  // Seuil le plus proche du coin idéal (0,1)
  const closest = points.reduce((a, b) => {
    const da = a.fpr ** 2 + (1 - a.sensitivity) ** 2;
    const db = b.fpr ** 2 + (1 - b.sensitivity) ** 2;
    return db < da ? b : a;
  }, points[0]);

  return {
    test: "Courbe ROC",
    n: data.length, nPositive: nPos, nNegative: nNeg, alpha, direction,
    points,
    auc, seAuc, z: zAuc, p: pAuc,
    ci: { lower: Math.max(0, auc - z * seAuc), upper: Math.min(1, auc + z * seAuc), level: 1 - alpha },
    optimalThreshold: {
      youden: { value: best.rawThreshold, sensitivity: best.sensitivity, specificity: best.specificity, index: best.youden },
      closestToCorner: { value: closest.rawThreshold, sensitivity: closest.sensitivity, specificity: closest.specificity },
    },
    quality: auc >= 0.9 ? "excellente" : auc >= 0.8 ? "bonne" : auc >= 0.7 ? "acceptable"
      : auc >= 0.6 ? "médiocre" : "sans valeur discriminante",
    interpretation: `AUC = ${auc.toFixed(3)} (IC ${(Math.max(0, auc - z * seAuc)).toFixed(3)}–${(Math.min(1, auc + z * seAuc)).toFixed(3)}), ` +
      `discrimination ${auc >= 0.9 ? "excellente" : auc >= 0.8 ? "bonne" : auc >= 0.7 ? "acceptable" : "faible"}. ` +
      `Seuil optimal (Youden) : ${best.rawThreshold} → Se = ${(best.sensitivity * 100).toFixed(1)} %, Sp = ${(best.specificity * 100).toFixed(1)} %.`,
  };
}

// Comparaison de deux AUC sur les mêmes sujets (test de DeLong simplifié)
export function compareAUC(roc1, roc2, { correlation = 0, alpha = 0.05 } = {}) {
  if (!roc1 || !roc2) return null;
  const seDiff = Math.sqrt(roc1.seAuc ** 2 + roc2.seAuc ** 2 - 2 * correlation * roc1.seAuc * roc2.seAuc);
  const z = (roc1.auc - roc2.auc) / seDiff;
  const p = 2 * normal.cdf(-Math.abs(z));
  return {
    test: "Comparaison de deux aires sous la courbe (AUC)",
    auc1: roc1.auc, auc2: roc2.auc, difference: roc1.auc - roc2.auc,
    se: seDiff, z, p, significant: p < alpha,
    interpretation: p < alpha
      ? `Le premier test est significativement ${roc1.auc > roc2.auc ? "meilleur" : "moins bon"} (Δ AUC = ${(roc1.auc - roc2.auc).toFixed(3)}).`
      : "Les deux tests ont des performances comparables.",
  };
}

/* ===================== Concordance de deux méthodes de mesure ===================== */

// Bland-Altman : validation d'un nouvel automate contre une méthode de référence
export function blandAltman(method1, method2, { alpha = 0.05 } = {}) {
  const pairs = [];
  for (let i = 0; i < Math.min(method1.length, method2.length); i++) {
    const a = Number(method1[i]), b = Number(method2[i]);
    if (Number.isFinite(a) && Number.isFinite(b)) pairs.push([a, b]);
  }
  const n = pairs.length;
  if (n < 3) return null;
  const diffs = pairs.map(([a, b]) => a - b);
  const means = pairs.map(([a, b]) => (a + b) / 2);
  const bias = mean(diffs);
  const sdDiff = sd(diffs);
  const loaLower = bias - 1.96 * sdDiff;
  const loaUpper = bias + 1.96 * sdDiff;
  // IC des limites d'agrément
  const seLoa = sdDiff * Math.sqrt(3 / n);
  const z = normal.inv(1 - alpha / 2);
  const seBias = sdDiff / Math.sqrt(n);

  // Différence proportionnelle : la régression des écarts sur les moyennes
  const mm = mean(means), md = mean(diffs);
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (means[i] - mm) * (diffs[i] - md); sxx += (means[i] - mm) ** 2; }
  const slope = sxx ? sxy / sxx : 0;

  const withinLoa = diffs.filter(d => d >= loaLower && d <= loaUpper).length;

  return {
    test: "Analyse de concordance de Bland-Altman",
    n, bias, sdDifference: sdDiff,
    biasCI: { lower: bias - z * seBias, upper: bias + z * seBias },
    limitsOfAgreement: { lower: loaLower, upper: loaUpper },
    loaLowerCI: { lower: loaLower - z * seLoa, upper: loaLower + z * seLoa },
    loaUpperCI: { lower: loaUpper - z * seLoa, upper: loaUpper + z * seLoa },
    points: pairs.map(([a, b], i) => ({ mean: means[i], difference: diffs[i], m1: a, m2: b })),
    proportionalBiasSlope: slope,
    percentWithinLimits: (withinLoa / n) * 100,
    meanPercentageError: mean(pairs.map(([a, b], i) => means[i] ? Math.abs(a - b) / means[i] * 100 : 0)),
    interpretation: `Biais moyen = ${bias.toFixed(4)} (IC ${(bias - z * seBias).toFixed(4)} à ${(bias + z * seBias).toFixed(4)}). ` +
      `Limites d'agrément : ${loaLower.toFixed(4)} à ${loaUpper.toFixed(4)}. ` +
      (Math.abs(bias) < seBias * z
        ? "Aucun biais systématique significatif entre les deux méthodes."
        : "Un biais systématique significatif est présent."),
  };
}

// Coefficient de concordance de Lin (CCC) — accord global sur une échelle continue
export function linConcordance(x, y) {
  const pairs = [];
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    const a = Number(x[i]), b = Number(y[i]);
    if (Number.isFinite(a) && Number.isFinite(b)) pairs.push([a, b]);
  }
  const n = pairs.length;
  if (n < 3) return null;
  const xs = pairs.map(p => p[0]), ys = pairs.map(p => p[1]);
  const mx = mean(xs), my = mean(ys);
  const vx = sum(xs.map(v => (v - mx) ** 2)) / n;
  const vy = sum(ys.map(v => (v - my) ** 2)) / n;
  const cxy = sum(pairs.map(([a, b]) => (a - mx) * (b - my))) / n;
  const ccc = 2 * cxy / (vx + vy + (mx - my) ** 2);
  const r = cxy / Math.sqrt(vx * vy);
  return {
    test: "Coefficient de concordance de Lin (CCC)",
    ccc, pearson: r, accuracy: ccc / r, n,
    interpretation: ccc < 0.9 ? "Concordance insuffisante." : ccc < 0.95 ? "Concordance modérée."
      : ccc < 0.99 ? "Bonne concordance." : "Excellente concordance.",
  };
}

/* ===================== Mesures de risque épidémiologique ===================== */

// Tableau 2×2 exposition × maladie
//                malades   non malades
//  exposés          a            b
//  non exposés      c            d
export function riskMeasures(a, b, c, d, { alpha = 0.05, design = "cohort" } = {}) {
  const z = normal.inv(1 - alpha / 2);
  const n1 = a + b, n0 = c + d, n = a + b + c + d;
  const risk1 = n1 ? a / n1 : null;
  const risk0 = n0 ? c / n0 : null;

  // Rapport de cotes (valide dans tous les schémas, y compris cas-témoins)
  const zeroCell = a === 0 || b === 0 || c === 0 || d === 0;
  const [A, B, C, D] = zeroCell ? [a + 0.5, b + 0.5, c + 0.5, d + 0.5] : [a, b, c, d];
  const or = (A * D) / (B * C);
  const seLogOr = Math.sqrt(1 / A + 1 / B + 1 / C + 1 / D);

  const out = {
    test: "Mesures d'association épidémiologiques",
    design, n, table: [[a, b], [c, d]], alpha,
    oddsRatio: {
      value: or,
      lower: Math.exp(Math.log(or) - z * seLogOr),
      upper: Math.exp(Math.log(or) + z * seLogOr),
    },
  };

  if (design === "cohort" && risk1 !== null && risk0 !== null) {
    const rr = risk0 ? risk1 / risk0 : null;
    const seLogRr = Math.sqrt(1 / A - 1 / (A + B) + 1 / C - 1 / (C + D));
    const arr = risk1 - risk0;
    const seArr = Math.sqrt(risk1 * (1 - risk1) / n1 + risk0 * (1 - risk0) / n0);
    out.riskExposed = risk1;
    out.riskUnexposed = risk0;
    out.relativeRisk = rr ? {
      value: rr,
      lower: Math.exp(Math.log(rr) - z * seLogRr),
      upper: Math.exp(Math.log(rr) + z * seLogRr),
    } : null;
    out.riskDifference = { value: arr, lower: arr - z * seArr, upper: arr + z * seArr };
    out.attributableRiskPercent = rr ? (rr - 1) / rr * 100 : null;
    out.populationAttributableRisk = (a + c) / n - risk0;
    out.numberNeededToTreat = arr ? Math.abs(1 / arr) : Infinity;
    out.numberNeededToHarm = arr > 0 ? 1 / arr : null;
  }

  const orTxt = `OR = ${or.toFixed(2)} (IC ${out.oddsRatio.lower.toFixed(2)}–${out.oddsRatio.upper.toFixed(2)})`;
  const sig = out.oddsRatio.lower > 1 || out.oddsRatio.upper < 1;
  out.interpretation = `${orTxt}. ${sig
    ? `L'association est statistiquement significative : l'exposition ${or > 1 ? "augmente" : "diminue"} le risque.`
    : "L'intervalle de confiance contient 1 : l'association n'est pas significative."}` +
    (out.relativeRisk ? ` RR = ${out.relativeRisk.value.toFixed(2)} (IC ${out.relativeRisk.lower.toFixed(2)}–${out.relativeRisk.upper.toFixed(2)}).` : "");
  return out;
}

/* ===================== Valeurs de référence de laboratoire ===================== */

// Intervalle de référence sur une population saine (norme CLSI C28-A3) :
// méthode non paramétrique par percentiles 2,5 % et 97,5 %, avec IC de rang.
export function referenceInterval(values, { level = 0.95, method = "auto" } = {}) {
  const xs = numeric(values).sort((a, b) => a - b);
  const n = xs.length;
  if (n < 20) return { error: "Au moins 20 sujets sont nécessaires (120 recommandés par la norme CLSI)." };
  const lowP = (1 - level) / 2, highP = 1 - lowP;

  const nonParam = { lower: quantile(xs, lowP), upper: quantile(xs, highP) };
  const m = mean(xs), s = sd(xs);
  const zc = normal.inv(highP);
  const param = { lower: m - zc * s, upper: m + zc * s };

  // Intervalles de confiance à 90 % des bornes, par les rangs (CLSI)
  const rankLow = n * lowP;
  const seRank = Math.sqrt(n * lowP * (1 - lowP));
  const ciLowerBound = {
    lower: xs[Math.max(0, Math.floor(rankLow - 1.96 * seRank))],
    upper: xs[Math.min(n - 1, Math.ceil(rankLow + 1.96 * seRank))],
  };
  const rankHigh = n * highP;
  const ciUpperBound = {
    lower: xs[Math.max(0, Math.floor(rankHigh - 1.96 * seRank))],
    upper: xs[Math.min(n - 1, Math.ceil(rankHigh + 1.96 * seRank))],
  };

  const chosen = method === "parametric" ? param : nonParam;
  return {
    test: "Intervalle de référence (CLSI C28-A3)",
    n, level,
    nonParametric: nonParam,
    parametric: param,
    recommended: n >= 120 ? "non paramétrique" : "à interpréter avec prudence (n < 120)",
    lower: chosen.lower, upper: chosen.upper,
    lowerCI: ciLowerBound, upperCI: ciUpperBound,
    median: median(xs), mean: m, sd: s,
    interpretation: `Intervalle de référence à ${(level * 100).toFixed(0)} % : ${chosen.lower.toFixed(3)} – ${chosen.upper.toFixed(3)} ` +
      `(n = ${n}${n < 120 ? ", effectif inférieur à la recommandation CLSI de 120 sujets" : ""}).`,
  };
}

// Différence critique (valeur de changement significatif) entre deux dosages
// successifs chez le même patient — indispensable au suivi biologique.
export function referenceChangeValue(cvAnalytical, cvIntraIndividual, { level = 0.95, direction = "two" } = {}) {
  const z = direction === "two" ? normal.inv(1 - (1 - level) / 2) : normal.inv(level);
  const rcv = Math.sqrt(2) * z * Math.sqrt(cvAnalytical ** 2 + cvIntraIndividual ** 2);
  return {
    test: "Différence critique (Reference Change Value)",
    rcv, cvAnalytical, cvIntraIndividual, level,
    indexOfIndividuality: cvIntraIndividual / Math.sqrt(cvAnalytical ** 2 + cvIntraIndividual ** 2),
    interpretation: `Une variation de plus de ${rcv.toFixed(1)} % entre deux dosages successifs est significative ` +
      `(confiance ${(level * 100).toFixed(0)} %) et ne relève pas de la seule variabilité analytique et biologique.`,
  };
}

/* ===================== Contrôle qualité interne ===================== */

// Règles de Westgard appliquées à une série de contrôles internes
export function westgardRules(values, targetMean, targetSD) {
  const xs = numeric(values);
  const z = xs.map(v => (v - targetMean) / targetSD);
  const violations = [];
  const flag = (rule, index, message) => violations.push({ rule, index, value: xs[index], z: z[index], message });

  for (let i = 0; i < z.length; i++) {
    if (Math.abs(z[i]) > 3) flag("1-3s", i, "Un contrôle dépasse ±3 écarts-types : série à rejeter.");
    else if (Math.abs(z[i]) > 2) flag("1-2s", i, "Un contrôle dépasse ±2 écarts-types : alerte, examiner les règles suivantes.");
    if (i >= 1 && Math.abs(z[i]) > 2 && Math.abs(z[i - 1]) > 2 && Math.sign(z[i]) === Math.sign(z[i - 1]))
      flag("2-2s", i, "Deux contrôles consécutifs au-delà de ±2 ET du même côté : erreur systématique.");
    if (i >= 1 && Math.abs(z[i] - z[i - 1]) > 4)
      flag("R-4s", i, "Écart de plus de 4 ET entre deux contrôles consécutifs : erreur aléatoire.");
    if (i >= 3 && [0, 1, 2, 3].every(k => z[i - k] > 1) )
      flag("4-1s", i, "Quatre contrôles consécutifs au-delà de +1 ET : dérive.");
    if (i >= 3 && [0, 1, 2, 3].every(k => z[i - k] < -1))
      flag("4-1s", i, "Quatre contrôles consécutifs en deçà de −1 ET : dérive.");
    if (i >= 9 && [0,1,2,3,4,5,6,7,8,9].every(k => z[i - k] > 0))
      flag("10x", i, "Dix contrôles consécutifs du même côté de la moyenne : biais systématique.");
    if (i >= 9 && [0,1,2,3,4,5,6,7,8,9].every(k => z[i - k] < 0))
      flag("10x", i, "Dix contrôles consécutifs du même côté de la moyenne : biais systématique.");
  }

  const rejections = violations.filter(v => ["1-3s", "2-2s", "R-4s", "4-1s", "10x"].includes(v.rule));
  return {
    test: "Contrôle qualité interne — règles de Westgard",
    n: xs.length, targetMean, targetSD,
    observedMean: mean(xs), observedSD: sd(xs),
    bias: mean(xs) - targetMean,
    cv: targetMean ? (sd(xs) / mean(xs)) * 100 : null,
    zScores: z, violations,
    inControl: rejections.length === 0,
    interpretation: rejections.length === 0
      ? "La série est sous contrôle : aucune règle de rejet n'est violée."
      : `${rejections.length} violation(s) de règle de rejet : la série doit être reprise et l'automate contrôlé.`,
  };
}

// Six Sigma analytique : indicateur de performance méthodologique
export function sixSigmaMetric(tea, bias, cv) {
  // tea : erreur totale admissible (%), bias : biais (%), cv : coefficient de variation (%)
  const sigma = cv ? (tea - Math.abs(bias)) / cv : null;
  return {
    test: "Métrique Six Sigma analytique",
    sigma, tea, bias, cv,
    quality: sigma === null ? "indéterminée"
      : sigma >= 6 ? "classe mondiale" : sigma >= 5 ? "excellente" : sigma >= 4 ? "bonne"
        : sigma >= 3 ? "acceptable (minimum requis)" : "insuffisante",
    interpretation: sigma === null ? "Coefficient de variation nul ou manquant."
      : `Sigma = ${sigma.toFixed(2)} : performance ${sigma >= 4 ? "satisfaisante" : sigma >= 3 ? "au seuil minimal acceptable" : "insuffisante, méthode à revoir"}.`,
  };
}
