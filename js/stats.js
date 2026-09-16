// js/stats.js — Statistiques avancées (type SPSS/R), 100 % locales.
// Tests du χ² avec valeur p exacte (fonction gamma incomplète), V de Cramér,
// corrélations de Pearson et Spearman entre codes, et pont vers R/SPSS
// (matrice documents × codes + script R prêt à exécuter).

/* ---------- Fonctions numériques (Numerical Recipes) ---------- */
// ln Γ(x) — approximation de Lanczos
function gammaLn(x) {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x, tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += c[j] / ++y;
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}

// P(a,x) régularisée — série ; Q(a,x) — fraction continue
function gammaP(a, x) {
  if (x <= 0) return 0;
  if (x < a + 1) {
    let ap = a, sum = 1 / a, del = sum;
    for (let n = 0; n < 200; n++) {
      ap++; del *= x / ap; sum += del;
      if (Math.abs(del) < Math.abs(sum) * 1e-12) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - gammaLn(a));
  }
  // Q par fraction continue de Lentz
  let b = x + 1 - a, c2 = 1e300, d = 1 / b, h = d;
  for (let i = 1; i < 200; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300;
    c2 = b + an / c2; if (Math.abs(c2) < 1e-300) c2 = 1e-300;
    d = 1 / d;
    const del = d * c2;
    h *= del;
    if (Math.abs(del - 1) < 1e-12) break;
  }
  return 1 - Math.exp(-x + a * Math.log(x) - gammaLn(a)) * h;
}

// Valeur p du χ² : P(X² ≥ chi2) pour df degrés de liberté
export function chiSquarePValue(chi2, df) {
  if (chi2 <= 0 || df <= 0) return 1;
  return Math.max(0, Math.min(1, 1 - gammaP(df / 2, chi2 / 2)));
}

/* ---------- Tests ---------- */
// Test du χ² d'indépendance sur un tableau de contingence (lignes × colonnes)
export function chiSquareTest(table) {
  const rows = table.length, cols = table[0]?.length || 0;
  const rowSum = table.map(r => r.reduce((a, b) => a + b, 0));
  const colSum = Array.from({ length: cols }, (_, j) => table.reduce((a, r) => a + r[j], 0));
  const n = rowSum.reduce((a, b) => a + b, 0);
  if (!n || rows < 2 || cols < 2) return null;
  let chi2 = 0, lowExpected = 0;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const expected = rowSum[i] * colSum[j] / n;
      if (expected > 0) chi2 += (table[i][j] - expected) ** 2 / expected;
      if (expected < 5) lowExpected++;
    }
  }
  const df = (rows - 1) * (cols - 1);
  const p = chiSquarePValue(chi2, df);
  const v = Math.sqrt(chi2 / (n * Math.min(rows - 1, cols - 1))); // V de Cramér
  return { chi2, df, p, v, n, lowExpectedShare: lowExpected / (rows * cols) };
}

// Corrélation de Pearson
export function pearson(xs, ys) {
  const n = xs.length;
  if (n < 3) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  if (!sxx || !syy) return null;
  const r = sxy / Math.sqrt(sxx * syy);
  // Valeur p approchée via t² → F ≈ χ²(1) pour n grand ; t exact par Student→gamma
  const t = r * Math.sqrt((n - 2) / Math.max(1e-12, 1 - r * r));
  const p = chiSquarePValue(t * t, 1); // approximation raisonnable pour n ≥ 10
  return { r, n, p };
}

// Corrélation de Spearman (rangs, gestion des ex æquo par rang moyen)
export function spearman(xs, ys) {
  const rank = arr => {
    const idx = arr.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
    const ranks = new Array(arr.length);
    let i = 0;
    while (i < idx.length) {
      let j = i;
      while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
      const avg = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) ranks[idx[k][1]] = avg;
      i = j + 1;
    }
    return ranks;
  };
  return pearson(rank(xs), rank(ys));
}

/* ---------- Construction des données depuis le projet ---------- */
// Matrice documents × codes (nombre de segments), avec variables
export function docCodeMatrix(project, flatCodesList) {
  const codes = flatCodesList;
  const rows = project.documents.map(doc => {
    const counts = {};
    for (const c of codes) counts[c.id] = 0;
    for (const s of project.segments) if (s.docId === doc.id && counts[s.codeId] !== undefined) counts[s.codeId]++;
    return { doc, counts };
  });
  return { codes, rows };
}

// Tableau de contingence : présence du code (oui/non) × catégories d'une variable
export function codeByVariableTable(project, codeIds, variable) {
  const cats = [...new Set(project.documents.map(d => (d.variables?.[variable] ?? "").trim()).filter(Boolean))].sort();
  if (cats.length < 2) return null;
  const codeSet = new Set(codeIds);
  const withCode = cats.map(() => 0), withoutCode = cats.map(() => 0);
  for (const doc of project.documents) {
    const cat = (doc.variables?.[variable] ?? "").trim();
    const ci = cats.indexOf(cat);
    if (ci === -1) continue;
    const has = project.segments.some(s => s.docId === doc.id && codeSet.has(s.codeId));
    (has ? withCode : withoutCode)[ci]++;
  }
  return { cats, table: [withCode, withoutCode] };
}

/* ---------- Pont R / SPSS ---------- */
const rEsc = s => String(s).replace(/[^\p{L}\p{N}_]/gu, "_");

export function buildRExport(project, flatCodesList) {
  const { codes, rows } = docCodeMatrix(project, flatCodesList);
  const vars = project.variables || [];
  const header = ["document", ...vars.map(rEsc), ...codes.map(c => "code_" + rEsc(c.name))];
  const csvEsc = v => /[",;\n]/.test(String(v)) ? '"' + String(v).replaceAll('"', '""') + '"' : String(v);
  const lines = [header.join(",")];
  for (const { doc, counts } of rows) {
    lines.push([
      csvEsc(doc.name),
      ...vars.map(v => csvEsc(doc.variables?.[v] ?? "")),
      ...codes.map(c => counts[c.id]),
    ].join(","));
  }
  const csv = lines.join("\n");

  const firstVar = vars[0] ? rEsc(vars[0]) : "variable";
  const firstCode = codes[0] ? "code_" + rEsc(codes[0].name) : "code_exemple";
  const script = `# QualiCode → R : matrice documents × codes (+ variables)
# Le même fichier CSV s'importe aussi dans SPSS ou jamovi (Fichier > Importer CSV).
donnees <- read.csv("qualicode_matrice.csv", encoding = "UTF-8", check.names = FALSE)
str(donnees)

# Fréquences descriptives des codes
colSums(donnees[, grepl("^code_", names(donnees))])

# Test du chi-2 : présence d'un code selon une variable (exemple)
tab <- table(donnees$${firstVar}, donnees$${firstCode} > 0)
tab
chisq.test(tab)

# Corrélations entre codes (Spearman)
codes_mat <- donnees[, grepl("^code_", names(donnees))]
round(cor(codes_mat, method = "spearman"), 2)
`;
  return { csv, script };
}
