// medistat/js/stats/survival.js
// Analyse de survie — Kaplan-Meier, test du log-rank, modèle de Cox.
// Utile au suivi de cohortes : délai jusqu'au décès, à la guérison, à la
// rechute, ou — en contexte laboratoire — délai de rendu des résultats.

import { normal, chisquare } from "./distributions.js";
import { sum, mean } from "./descriptive.js";
import { inverse, matMul } from "./regression.js";

/* ===================== Estimateur de Kaplan-Meier ===================== */

// times   : délais observés
// events  : 1 = événement survenu, 0 = censuré (perdu de vue / fin d'étude)
export function kaplanMeier(times, events, { alpha = 0.05, label = "" } = {}) {
  const data = [];
  for (let i = 0; i < Math.min(times.length, events.length); i++) {
    const t = Number(times[i]);
    const e = Number(events[i]);
    if (Number.isFinite(t) && t >= 0 && (e === 0 || e === 1)) data.push({ t, e });
  }
  const n = data.length;
  if (!n) return null;
  data.sort((a, b) => a.t - b.t || b.e - a.e);

  const eventTimes = [...new Set(data.filter(d => d.e === 1).map(d => d.t))].sort((a, b) => a - b);
  const z = normal.inv(1 - alpha / 2);
  const steps = [{ time: 0, atRisk: n, events: 0, censored: 0, survival: 1, se: 0, lower: 1, upper: 1 }];
  let S = 1, cumVar = 0;

  for (const t of eventTimes) {
    const atRisk = data.filter(d => d.t >= t).length;
    const d = data.filter(d2 => d2.t === t && d2.e === 1).length;
    const c = data.filter(d2 => d2.t === t && d2.e === 0).length;
    S *= (1 - d / atRisk);
    // Formule de Greenwood pour la variance
    cumVar += d / (atRisk * (atRisk - d)) || 0;
    const se = S * Math.sqrt(cumVar);
    // IC sur l'échelle log-log : garanti dans [0,1]
    let lower = 0, upper = 1;
    if (S > 0 && S < 1) {
      const ll = Math.log(-Math.log(S));
      const seLL = Math.sqrt(cumVar) / Math.abs(Math.log(S));
      lower = Math.exp(-Math.exp(ll + z * seLL));
      upper = Math.exp(-Math.exp(ll - z * seLL));
    } else if (S === 1) { lower = 1; upper = 1; }
    steps.push({ time: t, atRisk, events: d, censored: c, survival: S, se, lower, upper });
  }

  // Survie médiane : premier instant où S ≤ 0,5
  const medianStep = steps.find(s => s.survival <= 0.5);
  // Temps de survie moyen restreint (RMST) : aire sous la courbe
  let rmst = 0;
  for (let i = 1; i < steps.length; i++) {
    rmst += steps[i - 1].survival * (steps[i].time - steps[i - 1].time);
  }
  const maxT = Math.max(...data.map(d => d.t));
  rmst += steps[steps.length - 1].survival * (maxT - steps[steps.length - 1].time);

  return {
    test: "Estimateur de Kaplan-Meier",
    label, n,
    events: data.filter(d => d.e === 1).length,
    censored: data.filter(d => d.e === 0).length,
    steps,
    medianSurvival: medianStep ? medianStep.time : null,
    restrictedMeanSurvival: rmst,
    maxFollowUp: maxT,
    survivalAt: t => {
      let s = 1;
      for (const st of steps) if (st.time <= t) s = st.survival;
      return s;
    },
    interpretation: medianStep
      ? `Survie médiane : ${medianStep.time} (${data.filter(d => d.e === 1).length} événements sur ${n} sujets).`
      : `La survie médiane n'est pas atteinte au terme du suivi (${data.filter(d => d.e === 1).length} événements sur ${n} sujets).`,
  };
}

/* ===================== Test du log-rank ===================== */

// Comparaison des courbes de survie de k groupes
export function logRankTest(times, events, groups, { alpha = 0.05 } = {}) {
  const data = [];
  for (let i = 0; i < times.length; i++) {
    const t = Number(times[i]), e = Number(events[i]);
    const g = String(groups[i] ?? "").trim();
    if (Number.isFinite(t) && (e === 0 || e === 1) && g) data.push({ t, e, g });
  }
  const levels = [...new Set(data.map(d => d.g))].sort();
  const k = levels.length;
  if (k < 2) return null;

  const eventTimes = [...new Set(data.filter(d => d.e === 1).map(d => d.t))].sort((a, b) => a - b);
  const O = new Array(k).fill(0);
  const E = new Array(k).fill(0);
  // Matrice de covariance des (O − E), nécessaire pour k > 2
  const V = Array.from({ length: k }, () => new Array(k).fill(0));

  for (const t of eventTimes) {
    const atRisk = levels.map(l => data.filter(d => d.g === l && d.t >= t).length);
    const nRisk = sum(atRisk);
    const dEvents = levels.map(l => data.filter(d => d.g === l && d.t === t && d.e === 1).length);
    const dTot = sum(dEvents);
    if (nRisk <= 1 || !dTot) continue;
    for (let i = 0; i < k; i++) {
      O[i] += dEvents[i];
      E[i] += dTot * atRisk[i] / nRisk;
      for (let j = 0; j < k; j++) {
        const delta = i === j ? 1 : 0;
        V[i][j] += dTot * (nRisk - dTot) / (nRisk - 1) *
          (atRisk[i] / nRisk) * (delta - atRisk[j] / nRisk);
      }
    }
  }

  // Statistique quadratique sur k−1 composantes (la dernière est redondante)
  const d = O.slice(0, k - 1).map((o, i) => o - E[i]);
  const Vsub = V.slice(0, k - 1).map(r => r.slice(0, k - 1));
  const Vinv = inverse(Vsub);
  let chi2;
  if (Vinv) {
    chi2 = matMul(matMul([d], Vinv), d.map(v => [v]))[0][0];
  } else {
    chi2 = sum(O.map((o, i) => E[i] > 0 ? (o - E[i]) ** 2 / E[i] : 0)); // repli
  }
  const df = k - 1;
  const p = chisquare.sf(chi2, df);

  const groupStats = levels.map((l, i) => {
    const g = data.filter(d2 => d2.g === l);
    const km = kaplanMeier(g.map(d2 => d2.t), g.map(d2 => d2.e), { label: l });
    return {
      group: l, n: g.length, observed: O[i], expected: E[i],
      hazardRatioVsExpected: E[i] ? O[i] / E[i] : null,
      medianSurvival: km?.medianSurvival ?? null,
    };
  });

  // Rapport de risques (hazard ratio) pour deux groupes
  let hr = null, hrCi = null;
  if (k === 2 && E[0] && E[1]) {
    hr = (O[0] / E[0]) / (O[1] / E[1]);
    const seLog = Math.sqrt(1 / E[0] + 1 / E[1]);
    const z = normal.inv(1 - alpha / 2);
    hrCi = { lower: Math.exp(Math.log(hr) - z * seLog), upper: Math.exp(Math.log(hr) + z * seLog) };
  }

  return {
    test: "Test du log-rank (comparaison de courbes de survie)",
    statistic: chi2, statisticName: "χ²", df, p, n: data.length, alpha,
    significant: p < alpha,
    decision: p < alpha ? "Rejet de H₀" : "Non-rejet de H₀",
    groups: groupStats,
    hazardRatio: hr, hazardRatioCI: hrCi,
    interpretation: p < alpha
      ? `Les courbes de survie diffèrent significativement (χ²(${df}) = ${chi2.toFixed(3)}${hr ? `, HR = ${hr.toFixed(2)}` : ""}).`
      : "Aucune différence significative entre les courbes de survie.",
  };
}

/* ===================== Modèle de Cox à risques proportionnels ===================== */

// Estimation par vraisemblance partielle (approximation de Breslow pour les ex æquo)
export function coxRegression(times, events, predictors, { alpha = 0.05, maxIter = 50, tol = 1e-9 } = {}) {
  const names = predictors.map((p, i) => p.name || `X${i + 1}`);
  const cols = predictors.map(p => p.values || p);
  const data = [];
  for (let i = 0; i < times.length; i++) {
    const t = Number(times[i]), e = Number(events[i]);
    const x = cols.map(c => Number(c[i]));
    if (Number.isFinite(t) && (e === 0 || e === 1) && x.every(Number.isFinite)) data.push({ t, e, x });
  }
  const n = data.length, k = cols.length;
  if (n < k + 5) return null;
  data.sort((a, b) => a.t - b.t);
  const nEvents = data.filter(d => d.e === 1).length;
  if (!nEvents) return { error: "Aucun événement observé : le modèle de Cox ne peut être ajusté." };

  // Log-vraisemblance partielle, score et information de Fisher en un passage
  const evaluate = b => {
    const score = new Array(k).fill(0);
    const info = Array.from({ length: k }, () => new Array(k).fill(0));
    let ll = 0;
    for (let i = 0; i < n; i++) {
      if (data[i].e !== 1) continue;
      // Ensemble à risque : tous les sujets encore suivis à t_i
      const risk = data.filter(d => d.t >= data[i].t);
      const eta = risk.map(d => sum(d.x.map((v, j) => v * b[j])));
      // Stabilisation numérique : on retranche le maximum avant l'exponentielle
      const maxEta = Math.max(...eta);
      const w = eta.map(e => Math.exp(e - maxEta));
      const S0 = sum(w);
      const S1 = Array.from({ length: k }, (_, a) => sum(risk.map((d, q) => w[q] * d.x[a])));
      ll += sum(data[i].x.map((v, j) => v * b[j])) - (Math.log(S0) + maxEta);
      for (let a = 0; a < k; a++) {
        score[a] += data[i].x[a] - S1[a] / S0;
        for (let c = 0; c < k; c++) {
          const S2 = sum(risk.map((d, q) => w[q] * d.x[a] * d.x[c]));
          info[a][c] += S2 / S0 - (S1[a] / S0) * (S1[c] / S0);
        }
      }
    }
    return { ll, score, info };
  };

  let beta = new Array(k).fill(0);
  let inv = null, converged = false, iter = 0;
  let cur = evaluate(beta);
  let logLik = cur.ll;

  for (iter = 0; iter < maxIter; iter++) {
    inv = inverse(cur.info);
    if (!inv) {
      return {
        error: "Le modèle de Cox ne peut être ajusté : matrice d'information singulière. " +
          "Cela survient en cas de covariables colinéaires, ou lorsqu'une covariable " +
          "ordonne parfaitement les délais de survenue (séparation monotone).",
      };
    }
    const delta = matMul(inv, cur.score.map(v => [v])).map(r => r[0]);

    // Contrôle de pas : on n'accepte un pas que s'il augmente la vraisemblance,
    // en le divisant par deux jusqu'à 20 fois. Cela rend l'algorithme stable
    // sur les jeux de données déséquilibrés, là où Newton-Raphson pur diverge.
    let step = 1, next = null, halvings = 0;
    while (halvings < 20) {
      const candidate = beta.map((b, j) => b + step * delta[j]);
      if (candidate.every(b => Number.isFinite(b) && Math.abs(b) <= 50)) {
        const ev = evaluate(candidate);
        if (Number.isFinite(ev.ll) && ev.ll >= cur.ll - 1e-9) { next = { beta: candidate, ev }; break; }
      }
      step /= 2; halvings++;
    }
    if (!next) {
      // Aucun pas admissible : soit l'optimum est atteint, soit il n'existe pas
      if (Math.max(...cur.score.map(Math.abs)) < 1e-4) { converged = true; break; }
      return {
        error: "Le modèle de Cox diverge : les coefficients tendent vers l'infini " +
          "(séparation monotone). Regrouper les modalités de la covariable, " +
          "ou disposer d'observations censurées, permet généralement d'ajuster le modèle.",
      };
    }
    const moved = Math.max(...delta.map((d, j) => Math.abs(step * d)));
    beta = next.beta; cur = next.ev; logLik = cur.ll;
    if (moved < tol) { converged = true; break; }
  }
  inv = inverse(cur.info) || inv;

  const z = normal.inv(1 - alpha / 2);
  const coefficients = beta.map((b, j) => {
    const se = Math.sqrt(inv[j][j]);
    const wald = (b / se) ** 2;
    return {
      name: names[j], estimate: b, se, z: b / se, wald, df: 1,
      p: chisquare.sf(wald, 1),
      hazardRatio: Math.exp(b),
      hrLower: Math.exp(b - z * se), hrUpper: Math.exp(b + z * se),
    };
  });

  // Log-vraisemblance du modèle nul (β = 0)
  let logLik0 = 0;
  for (let i = 0; i < n; i++) {
    if (data[i].e !== 1) continue;
    logLik0 -= Math.log(data.filter(d => d.t >= data[i].t).length);
  }
  const lrChi2 = 2 * (logLik - logLik0);
  const p = chisquare.sf(lrChi2, k);

  return {
    test: "Modèle de Cox à risques proportionnels",
    n, k, events: nEvents, alpha, converged, iterations: iter + 1,
    coefficients,
    logLikelihood: logLik, logLikelihoodNull: logLik0,
    likelihoodRatioChi2: lrChi2, df: k, p,
    concordance: concordanceIndex(data, beta),
    aic: -2 * logLik + 2 * k,
    interpretation: p < alpha
      ? `Le modèle est significatif (χ²(${k}) = ${lrChi2.toFixed(2)}). Un HR > 1 traduit un risque accru.`
      : "Aucune covariable n'améliore significativement la prédiction du risque.",
  };
}

// Indice de concordance de Harrell (équivalent de l'AUC en survie)
function concordanceIndex(data, beta) {
  let concordant = 0, discordant = 0, tied = 0;
  const score = data.map(d => sum(d.x.map((v, j) => v * beta[j])));
  for (let i = 0; i < data.length; i++) {
    if (data[i].e !== 1) continue;
    for (let j = 0; j < data.length; j++) {
      if (data[j].t <= data[i].t) continue; // paire non comparable
      if (score[i] > score[j]) concordant++;
      else if (score[i] < score[j]) discordant++;
      else tied++;
    }
  }
  const tot = concordant + discordant + tied;
  return tot ? (concordant + 0.5 * tied) / tot : null;
}

/* ===================== Tables de survie actuarielles ===================== */

// Table de survie par intervalles — présentation classique en épidémiologie
export function lifeTable(times, events, intervalWidth = null) {
  const data = [];
  for (let i = 0; i < times.length; i++) {
    const t = Number(times[i]), e = Number(events[i]);
    if (Number.isFinite(t) && (e === 0 || e === 1)) data.push({ t, e });
  }
  if (!data.length) return null;
  const maxT = Math.max(...data.map(d => d.t));
  const width = intervalWidth || Math.max(1, Math.ceil(maxT / 10));
  const rows = [];
  let S = 1;
  for (let start = 0; start < maxT; start += width) {
    const end = start + width;
    const entering = data.filter(d => d.t >= start).length;
    const withdrawn = data.filter(d => d.t >= start && d.t < end && d.e === 0).length;
    const dEvents = data.filter(d => d.t >= start && d.t < end && d.e === 1).length;
    const effective = entering - withdrawn / 2; // effectif exposé corrigé
    const q = effective > 0 ? dEvents / effective : 0;
    S *= (1 - q);
    rows.push({
      interval: `[${start} ; ${end}[`, start, end,
      entering, withdrawn, events: dEvents,
      effectiveAtRisk: effective,
      hazard: q, survival: S,
    });
  }
  return { test: "Table de survie actuarielle", intervalWidth: width, rows };
}
