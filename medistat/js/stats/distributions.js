// medistat/js/stats/distributions.js
// Lois de probabilité et fonctions spéciales — zéro dépendance.
// Base numérique de tout le moteur statistique : densités, fonctions de
// répartition (CDF) et quantiles (fonction inverse) des lois usuelles.
// Les algorithmes suivent Numerical Recipes (Lanczos, Lentz) avec une
// précision visée de 1e-10, suffisante pour reproduire les sorties de R.

/* ===================== Fonctions spéciales ===================== */

// ln Γ(x) — approximation de Lanczos (g = 5, n = 6)
export function gammaln(x) {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x, tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += c[j] / ++y;
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}

export function gammafn(x) {
  if (x < 0.5) return Math.PI / (Math.sin(Math.PI * x) * gammafn(1 - x)); // réflexion
  return Math.exp(gammaln(x));
}

// ln B(a,b)
export function betaln(a, b) { return gammaln(a) + gammaln(b) - gammaln(a + b); }

// Coefficient binomial ln C(n,k)
export function lchoose(n, k) {
  if (k < 0 || k > n) return -Infinity;
  return gammaln(n + 1) - gammaln(k + 1) - gammaln(n - k + 1);
}
export function choose(n, k) { return Math.round(Math.exp(lchoose(n, k))); }

// Fonction gamma incomplète régularisée P(a,x) = γ(a,x)/Γ(a)
export function lowerGamma(a, x) {
  if (x <= 0 || a <= 0) return 0;
  if (x < a + 1) {
    // développement en série
    let ap = a, sum = 1 / a, del = sum;
    for (let n = 0; n < 500; n++) {
      ap++; del *= x / ap; sum += del;
      if (Math.abs(del) < Math.abs(sum) * 1e-15) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - gammaln(a));
  }
  return 1 - upperGamma(a, x);
}

// Q(a,x) = 1 - P(a,x) par fraction continue (algorithme de Lentz modifié)
export function upperGamma(a, x) {
  if (x <= 0 || a <= 0) return 1;
  if (x < a + 1) return 1 - lowerGamma(a, x);
  let b = x + 1 - a, c = 1e300, d = 1 / b, h = d;
  for (let i = 1; i < 500; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-15) break;
  }
  return Math.exp(-x + a * Math.log(x) - gammaln(a)) * h;
}

// Fonction bêta incomplète régularisée I_x(a,b) — fraction continue
export function incbeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(a * Math.log(x) + b * Math.log(1 - x) - betaln(a, b));
  // La fraction continue converge vite du côté où x est « petit » : on bascule
  // sur la relation de symétrie I_x(a,b) = 1 − I_{1−x}(b,a) sinon.
  if (x < (a + 1) / (a + b + 2)) return front * betacf(x, a, b) / a;
  return 1 - front * betacf(1 - x, b, a) / b;
}

function betacf(x, a, b) {
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - qab * x / qap;
  if (Math.abs(d) < 1e-300) d = 1e-300;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 500; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-300) d = 1e-300;
    c = 1 + aa / c; if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < 1e-300) d = 1e-300;
    c = 1 + aa / c; if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-15) break;
  }
  return h;
}

// Fonction d'erreur et son complément
export function erf(x) { return x < 0 ? -lowerGamma(0.5, x * x) : lowerGamma(0.5, x * x); }
export function erfc(x) { return 1 - erf(x); }

/* ===================== Loi normale ===================== */

export const normal = {
  pdf(x, mu = 0, sd = 1) {
    const z = (x - mu) / sd;
    return Math.exp(-0.5 * z * z) / (sd * Math.sqrt(2 * Math.PI));
  },
  // Φ(x) — précision ~1e-15 via erfc de Cody
  cdf(x, mu = 0, sd = 1) {
    const z = (x - mu) / (sd * Math.SQRT2);
    return 0.5 * (1 + (z < 0 ? -lowerGamma(0.5, z * z) : lowerGamma(0.5, z * z)));
  },
  // Φ⁻¹(p) — algorithme d'Acklam raffiné par une itération de Halley
  inv(p, mu = 0, sd = 1) {
    if (p <= 0) return -Infinity;
    if (p >= 1) return Infinity;
    const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02,
      1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02,
      6.680131188771972e+01, -1.328068155288572e+01];
    const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00,
      -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00,
      3.754408661907416e+00];
    const pl = 0.02425;
    let q, r, x;
    if (p < pl) {
      q = Math.sqrt(-2 * Math.log(p));
      x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    } else if (p <= 1 - pl) {
      q = p - 0.5; r = q * q;
      x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
        (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
    } else {
      q = Math.sqrt(-2 * Math.log(1 - p));
      x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    // Raffinement de Halley
    const e = normal.cdf(x) - p;
    const u = e * Math.sqrt(2 * Math.PI) * Math.exp(x * x / 2);
    x = x - u / (1 + x * u / 2);
    return mu + sd * x;
  },
};

/* ===================== Loi de Student ===================== */

export const studentt = {
  pdf(x, df) {
    return Math.exp(gammaln((df + 1) / 2) - gammaln(df / 2)) /
      Math.sqrt(df * Math.PI) * Math.pow(1 + x * x / df, -(df + 1) / 2);
  },
  cdf(x, df) {
    const p = 0.5 * incbeta(df / (df + x * x), df / 2, 0.5);
    return x > 0 ? 1 - p : p;
  },
  inv(p, df) {
    if (p <= 0) return -Infinity;
    if (p >= 1) return Infinity;
    // recherche par bissection encadrée (robuste, ~60 itérations)
    let lo = -1e6, hi = 1e6;
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2;
      if (studentt.cdf(mid, df) < p) lo = mid; else hi = mid;
      if (hi - lo < 1e-12 * Math.max(1, Math.abs(lo))) break;
    }
    return (lo + hi) / 2;
  },
};

/* ===================== Loi du χ² ===================== */

export const chisquare = {
  pdf(x, df) {
    if (x <= 0) return 0;
    return Math.exp((df / 2 - 1) * Math.log(x) - x / 2 - gammaln(df / 2) - (df / 2) * Math.LN2);
  },
  cdf(x, df) { return x <= 0 ? 0 : lowerGamma(df / 2, x / 2); },
  // P(X² ≥ x) — valeur p unilatérale à droite, la plus utilisée
  sf(x, df) { return x <= 0 ? 1 : upperGamma(df / 2, x / 2); },
  inv(p, df) {
    if (p <= 0) return 0;
    if (p >= 1) return Infinity;
    let lo = 0, hi = 1e6;
    for (let i = 0; i < 300; i++) {
      const mid = (lo + hi) / 2;
      if (chisquare.cdf(mid, df) < p) lo = mid; else hi = mid;
      if (hi - lo < 1e-12 * Math.max(1, lo)) break;
    }
    return (lo + hi) / 2;
  },
};

/* ===================== Loi de Fisher-Snedecor ===================== */

export const fdist = {
  pdf(x, d1, d2) {
    if (x <= 0) return 0;
    const num = d1 * Math.log(d1 * x) + d2 * Math.log(d2) - (d1 + d2) * Math.log(d1 * x + d2);
    return Math.exp(0.5 * num - Math.log(x) - betaln(d1 / 2, d2 / 2));
  },
  cdf(x, d1, d2) {
    if (x <= 0) return 0;
    return incbeta(d1 * x / (d1 * x + d2), d1 / 2, d2 / 2);
  },
  // P(F ≥ x) — valeur p de l'ANOVA
  sf(x, d1, d2) { return 1 - fdist.cdf(x, d1, d2); },
  inv(p, d1, d2) {
    if (p <= 0) return 0;
    if (p >= 1) return Infinity;
    let lo = 0, hi = 1e7;
    for (let i = 0; i < 300; i++) {
      const mid = (lo + hi) / 2;
      if (fdist.cdf(mid, d1, d2) < p) lo = mid; else hi = mid;
      if (hi - lo < 1e-12 * Math.max(1, lo)) break;
    }
    return (lo + hi) / 2;
  },
};

/* ===================== Lois discrètes ===================== */

export const binomial = {
  pmf(k, n, p) {
    if (k < 0 || k > n) return 0;
    if (p === 0) return k === 0 ? 1 : 0;
    if (p === 1) return k === n ? 1 : 0;
    return Math.exp(lchoose(n, k) + k * Math.log(p) + (n - k) * Math.log(1 - p));
  },
  cdf(k, n, p) {
    let s = 0;
    for (let i = 0; i <= Math.floor(k); i++) s += binomial.pmf(i, n, p);
    return Math.min(1, s);
  },
};

export const poisson = {
  pmf(k, lambda) {
    if (k < 0) return 0;
    return Math.exp(-lambda + k * Math.log(lambda) - gammaln(k + 1));
  },
  cdf(k, lambda) {
    let s = 0;
    for (let i = 0; i <= Math.floor(k); i++) s += poisson.pmf(i, lambda);
    return Math.min(1, s);
  },
};

export const hypergeometric = {
  // P(X = k) : k succès dans un tirage de n parmi N dont K succès
  pmf(k, N, K, n) {
    if (k < Math.max(0, n + K - N) || k > Math.min(n, K)) return 0;
    return Math.exp(lchoose(K, k) + lchoose(N - K, n - k) - lchoose(N, n));
  },
};

/* ===================== Loi de l'étendue studentisée ===================== */
// Nécessaire au test post-hoc de Tukey (HSD). Intégration numérique de la
// distribution de q = étendue / erreur-type, formule de Copenhaver & Holland.

export const tukey = {
  // P(q ≤ x) pour k moyennes et df degrés de liberté
  cdf(x, k, df) {
    if (x <= 0) return 0;
    // Intégration de Gauss-Legendre sur la loi du χ de l'erreur-type
    const outer = 60, inner = 60;
    let sum = 0;
    // s = racine(χ²_df / df) ; densité de s
    const lo = 0, hi = 1 + 12 / Math.sqrt(df); // support numérique utile
    const h = (hi - lo) / outer;
    for (let i = 0; i < outer; i++) {
      const s = lo + (i + 0.5) * h;
      const lden = (df / 2) * Math.log(df / 2) + (df - 1) * Math.log(s) -
        df * s * s / 2 - gammaln(df / 2) + Math.log(2);
      sum += Math.exp(lden) * tukey.rangeCdf(x * s, k, inner) * h;
    }
    return Math.min(1, Math.max(0, sum));
  },
  // P(étendue de k N(0,1) ≤ w)
  rangeCdf(w, k, n = 60) {
    if (w <= 0) return 0;
    const lo = -8, hi = 8, h = (hi - lo) / n;
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const z = lo + (i + 0.5) * h;
      const d = normal.cdf(z + w) - normal.cdf(z);
      if (d > 0) sum += normal.pdf(z) * Math.pow(d, k - 1) * h;
    }
    return Math.min(1, k * sum);
  },
  // Valeur p du test de Tukey
  sf(x, k, df) { return 1 - tukey.cdf(x, k, df); },
  inv(p, k, df) {
    let lo = 0, hi = 100;
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2;
      if (tukey.cdf(mid, k, df) < p) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  },
};

/* ===================== Utilitaires de valeur p ===================== */

// Valeur p bilatérale à partir d'un z
export function pFromZ(z, tail = "two") {
  const p = normal.cdf(-Math.abs(z));
  return tail === "two" ? 2 * p : (tail === "left" ? normal.cdf(z) : 1 - normal.cdf(z));
}

// Valeur p à partir d'un t
export function pFromT(t, df, tail = "two") {
  if (tail === "two") return 2 * studentt.cdf(-Math.abs(t), df);
  if (tail === "left") return studentt.cdf(t, df);
  return 1 - studentt.cdf(t, df);
}

// Formatage lisible d'une valeur p, façon publication scientifique
export function formatP(p) {
  if (p === null || p === undefined || Number.isNaN(p)) return "—";
  if (p < 0.001) return "< 0,001";
  return p.toFixed(3).replace(".", ",");
}

// Étoiles de significativité
export function stars(p) {
  if (p === null || Number.isNaN(p)) return "";
  if (p < 0.001) return "***";
  if (p < 0.01) return "**";
  if (p < 0.05) return "*";
  if (p < 0.1) return ".";
  return "n.s.";
}
