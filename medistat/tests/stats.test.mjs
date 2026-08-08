#!/usr/bin/env node
// medistat/tests/stats.test.mjs
// Contrôle de validité du moteur statistique.
//
// Chaque valeur attendue provient soit d'un calcul analytique reproductible à
// la main, soit d'une identité mathématique vérifiable, soit d'une sortie de
// référence publiée (R, SPSS). Lancement :  node tests/stats.test.mjs
//
// Le programme sort avec le code 1 dès qu'un contrôle échoue, ce qui permet de
// l'intégrer à une chaîne d'intégration continue.

import * as dist from "../js/stats/distributions.js";
import * as desc from "../js/stats/descriptive.js";
import * as inf from "../js/stats/inferential.js";
import * as reg from "../js/stats/regression.js";
import * as surv from "../js/stats/survival.js";
import * as diag from "../js/stats/diagnostic.js";
import * as mult from "../js/stats/multivariate.js";
import * as qual from "../js/stats/qualitative.js";

let passed = 0, failed = 0;
const failures = [];

function check(name, got, expected, tol = 1e-6) {
  const ok = Number.isFinite(got) && Number.isFinite(expected)
    ? Math.abs(got - expected) <= tol * Math.max(1, Math.abs(expected))
    : got === expected;
  if (ok) { passed++; }
  else { failed++; failures.push(`${name}\n     obtenu = ${got}\n     attendu = ${expected}`); }
}

function assert(name, condition, detail = "") {
  if (condition) passed++;
  else { failed++; failures.push(`${name}${detail ? "\n     " + detail : ""}`); }
}

function section(title) {
  console.log(`\n\x1b[1m── ${title}\x1b[0m`);
}

/* ===================================================================== */
section("Lois de probabilité (référence : R)");

check("pnorm(1,96)", dist.normal.cdf(1.96), 0.9750021048517796, 1e-12);
check("qnorm(0,975)", dist.normal.inv(0.975), 1.959963984540054, 1e-9);
check("qnorm(0,005)", dist.normal.inv(0.005), -2.575829303548901, 1e-9);
check("qt(0,975 ; 10)", dist.studentt.inv(0.975, 10), 2.228138851986273, 1e-8);
check("qt(0,975 ; 1)", dist.studentt.inv(0.975, 1), 12.70620473617471, 1e-6);
check("qchisq(0,95 ; 3)", dist.chisquare.inv(0.95, 3), 7.814727903251179, 1e-8);
check("qchisq(0,95 ; 1)", dist.chisquare.inv(0.95, 1), 3.841458820694124, 1e-8);
check("qf(0,95 ; 3,20)", dist.fdist.inv(0.95, 3, 20), 3.098391212727569, 1e-8);
check("dbinom(3 ; 10 ; 0,3)", dist.binomial.pmf(3, 10, 0.3), 0.26682793199999995, 1e-10);
check("pbinom(3 ; 10 ; 0,3)", dist.binomial.cdf(3, 10, 0.3), 0.6496107184, 1e-10);
check("ppois(3 ; 2,5)", dist.poisson.cdf(3, 2.5), 0.7575761331330659, 1e-10);
check("gamma(5) = 4!", dist.gammafn(5), 24, 1e-9);
check("gamma(0,5) = √π", dist.gammafn(0.5), Math.sqrt(Math.PI), 1e-9);
// Forme close exacte de la loi de Student à 3 ddl
{
  const t = 2.1213203435596424, u = t / Math.sqrt(3);
  const exact = 0.5 + (1 / Math.PI) * (u / (1 + t * t / 3) + Math.atan(u));
  check("pt(2,1213 ; 3) — forme close", dist.studentt.cdf(t, 3), exact, 1e-12);
}
// qtukey : valeurs publiées des tables de l'étendue studentisée
check("qtukey(0,95 ; 3 ; 12)", dist.tukey.inv(0.95, 3, 12), 3.772929, 1e-4);
check("qtukey(0,95 ; 4 ; 20)", dist.tukey.inv(0.95, 4, 20), 3.958293, 1e-4);
// Identités
check("Φ(0) = 0,5", dist.normal.cdf(0), 0.5, 1e-14);
check("symétrie de Φ", dist.normal.cdf(-1.5) + dist.normal.cdf(1.5), 1, 1e-12);
check("symétrie de Student", dist.studentt.cdf(-2, 7) + dist.studentt.cdf(2, 7), 1, 1e-12);

/* ===================================================================== */
section("Statistiques descriptives");

const D1 = [2, 4, 4, 4, 5, 5, 7, 9];
const d1 = desc.describe(D1);
check("moyenne", d1.mean, 5);
check("écart-type (n−1)", d1.sd, Math.sqrt(32 / 7));
check("variance", d1.variance, 32 / 7);
check("médiane", d1.median, 4.5);
check("Q1 (type 7)", d1.q1, 4);
check("Q3 (type 7)", d1.q3, 5.5);
check("étendue", d1.range, 7);
// Asymétrie SPSS/Excel : G1 = g1·√(n(n−1))/(n−2), g1 biaisé = 0,65625
check("asymétrie (convention SPSS)", d1.skewness, 0.65625 * Math.sqrt(8 * 7) / 6, 1e-9);
check("effectif", d1.n, 8);
assert("mode : 4 apparaît 3 fois", d1.mode.count === 3 && d1.mode.modes[0] === 4);
check("moyenne géométrique de [1,2,4,8]", desc.geometricMean([1, 2, 4, 8]), Math.pow(64, 0.25), 1e-12);
check("moyenne harmonique de [1,2,4]", desc.harmonicMean([1, 2, 4]), 3 / (1 + 0.5 + 0.25), 1e-12);
check("MAD de [1..9]", desc.mad([1,2,3,4,5,6,7,8,9]), 1.4826 * 2, 1e-12);
check("coefficient de variation", desc.cv([10, 20, 30]), (10 / 20) * 100, 1e-12);
// Valeurs manquantes
const withNA = desc.describe([1, 2, null, "", 4, "abc", 5]);
check("valeurs manquantes écartées", withNA.n, 4);
check("valeurs manquantes comptées", withNA.missing, 3);
// Tableau de fréquences
const ft = desc.frequencyTable(["a", "b", "a", "c", "a", null]);
check("fréquences : effectif valide", ft.valid, 5);
check("fréquences : manquants", ft.missing, 1);
check("fréquences : % valide de 'a'", ft.rows.find(r => r.value === "a").validPercent, 60);
check("cumul final = 100 %", ft.rows[ft.rows.length - 1].cumulativePercent, 100, 1e-9);
// Tableau croisé
const ct = desc.crosstab(["H","H","F","F","F"], ["oui","non","oui","oui","non"]);
check("croisé : effectif total", ct.n, 5);
check("croisé : total ligne F", ct.rowTotals[ct.rowLevels.indexOf("F")], 3);
// Quantiles : identité sur une suite régulière
check("quantile 0,5 = médiane", desc.quantile([1,2,3,4,5], 0.5), 3, 1e-12);
check("histogramme : somme des effectifs", desc.histogram(D1).bins.reduce((a,b)=>a+b.count,0), 8);

/* ===================================================================== */
section("Tests de comparaison de moyennes");

// t à un échantillon — calcul manuel
{
  const x = [5, 7, 5, 3, 5, 3, 3, 9];
  const r = inf.tTestOneSample(x, 4);
  // moyenne = 5 ; SC = 32 ; sd d'échantillon = √(32/7) ; se = sd/√8
  const sdEch = Math.sqrt(32 / 7);
  check("t un échantillon", r.statistic, 1 / (sdEch / Math.sqrt(8)), 1e-9);
  check("ddl", r.df, 7);
  check("d de Cohen", r.effect.value, 1 / sdEch, 1e-9);
}
// t indépendant (variances égales)
{
  const r = inf.tTestIndependent([1,2,3,4,5], [6,7,8,9,10], { equalVariance: true });
  check("t indépendant", r.statistic, -5, 1e-12);
  check("ddl", r.df, 8);
  check("différence de moyennes", r.detail.meanDifference, -5, 1e-12);
}
// Welch : ddl < ddl de Student quand les variances diffèrent
{
  const r = inf.tTestIndependent([1,2,3,4,5], [10,20,30,40,50], { equalVariance: false });
  assert("Welch : ddl réduit", r.df < 8, `ddl = ${r.df}`);
}
// t apparié
{
  const r = inf.tTestPaired([5,6,7,8,9], [4,4,5,7,8]);
  check("t apparié", r.statistic, 5.715476066494083, 1e-9);
  check("différence moyenne", r.detail.meanDifference, 1.4, 1e-12);
}
// Cohérence : t apparié ≡ t un échantillon sur les différences
{
  const a = [12,15,18,11,9,14], b = [10,14,15,12,7,13];
  const p1 = inf.tTestPaired(a, b).statistic;
  const p2 = inf.tTestOneSample(a.map((v,i)=>v-b[i]), 0).statistic;
  check("t apparié ≡ t sur différences", p1, p2, 1e-12);
}
// Test z sur proportions
{
  const r = inf.zTestTwoProportions(40, 100, 25, 100);
  // p1=0,40 p2=0,25 ppool=0,325 se=√(0,325·0,675·0,02)=0,066238 z=2,26454
  check("z deux proportions", r.statistic, 0.15 / Math.sqrt(0.325 * 0.675 * 0.02), 1e-9);
  check("risque relatif", r.detail.riskRatio, 1.6, 1e-12);
}

/* ===================================================================== */
section("Analyse de variance");

{
  const r = inf.anovaOneWay([[1,2,3],[4,5,6],[7,8,9]]);
  check("ANOVA F", r.statistic, 27, 1e-12);
  check("SC inter", r.table[0].ss, 54, 1e-12);
  check("SC intra", r.table[1].ss, 6, 1e-12);
  check("SC totale = inter + intra", r.table[2].ss, 60, 1e-12);
  check("η²", r.effect.value, 54 / 60, 1e-12);
  check("ddl", r.df[0], 2); check("ddl résiduel", r.df[1], 6);
}
// Identité : ANOVA à 2 groupes ≡ carré du t de Student
{
  const g1 = [3,4,5,6,7], g2 = [8,9,10,11,12];
  const F = inf.anovaOneWay([g1, g2]).statistic;
  const t = inf.tTestIndependent(g1, g2, { equalVariance: true }).statistic;
  check("F = t² (2 groupes)", F, t * t, 1e-10);
}
// ANOVA à deux facteurs : décomposition complète des sommes de carrés
{
  const y  = [10,12,11,13, 20,22,21,23, 15,17,16,18, 25,27,26,28];
  const fa = ["a1","a1","a1","a1","a1","a1","a1","a1","a2","a2","a2","a2","a2","a2","a2","a2"];
  const fb = ["b1","b1","b1","b1","b2","b2","b2","b2","b1","b1","b1","b1","b2","b2","b2","b2"];
  const r = inf.anovaTwoWay(y, fa, fb);
  const tot = r.table.find(t => t.source === "Total").ss;
  const parts = r.table.filter(t => t.source !== "Total").reduce((a,t)=>a+t.ss, 0);
  check("SC totale = somme des composantes", parts, tot, 1e-9);
  assert("effet B significatif", r.table[1].p < 0.001, `p = ${r.table[1].p}`);
}
// Mesures répétées
{
  const m = [[10,12,15],[11,13,16],[9,11,14],[12,14,17],[10,13,15]];
  const r = inf.anovaRepeatedMeasures(m);
  assert("mesures répétées : effet significatif", r.p < 0.001, `p = ${r.p}`);
  assert("epsilon Greenhouse-Geisser dans [1/(k−1) ; 1]",
    r.sphericity.greenhouseGeisser >= 0.5 - 1e-9 && r.sphericity.greenhouseGeisser <= 1 + 1e-9,
    `ε = ${r.sphericity.greenhouseGeisser}`);
}
// Tukey HSD
{
  const r = inf.tukeyHSD([[1,2,3],[4,5,6],[10,11,12]]);
  check("Tukey : nombre de comparaisons", r.comparisons.length, 3);
  assert("Tukey : groupes 1 et 3 différents", r.comparisons[1].significant);
}
// Corrections de multiplicité
{
  const ps = [0.01, 0.02, 0.03, 0.04, 0.05];
  const holm = inf.holmCorrection(ps);
  check("Holm : premier p ajusté = 5×0,01", holm[0], 0.05, 1e-12);
  assert("Holm : monotone croissant", holm.every((v,i)=> i===0 || v >= holm[i-1] - 1e-12));
  const fdr = inf.fdrCorrection(ps);
  check("BH : dernier p ajusté = p", fdr[4], 0.05, 1e-12);
  assert("BH ≤ Holm", fdr.every((v,i)=> v <= holm[i] + 1e-12));
}

/* ===================================================================== */
section("Tests non paramétriques");

{
  const r = inf.mannWhitney([1,2,3],[4,5,6]);
  check("Mann-Whitney U", r.statistic, 0, 1e-12);
  check("somme des rangs groupe 1", r.detail.rankSum1, 6, 1e-12);
}
{
  const r = inf.kruskalWallis([[1,2,3],[4,5,6],[7,8,9]]);
  check("Kruskal-Wallis H", r.statistic, 7.2, 1e-9);
  check("Kruskal-Wallis p", r.p, 0.027323722447292528, 1e-9);
}
// Identité : Kruskal-Wallis à 2 groupes ≈ Mann-Whitney
{
  const a = [1,3,5,7,9,11], b = [2,4,6,8,10,12];
  const kw = inf.kruskalWallis([a,b]);
  const mw = inf.mannWhitney(a,b);
  assert("KW(2 groupes) et MW concordent",
    Math.abs(kw.p - mw.p) < 0.12, `KW p=${kw.p.toFixed(4)} MW p=${mw.p.toFixed(4)}`);
}
{
  const r = inf.wilcoxonSignedRank([10,12,14,16,18,20,22],[8,11,12,15,15,19,18]);
  assert("Wilcoxon signé calculé", r !== null && Number.isFinite(r.p), `p = ${r?.p}`);
  check("Wilcoxon : différence médiane", r.detail.medianDifference, 2, 1e-12);
}
{
  const r = inf.friedman([[1,2,3],[1,2,3],[1,2,3],[1,2,3],[2,1,3],[1,3,2]]);
  assert("Friedman calculé", Number.isFinite(r.statistic), `χ² = ${r?.statistic}`);
  assert("W de Kendall dans [0 ; 1]", r.effect.value >= 0 && r.effect.value <= 1);
}
{
  const r = inf.signTest([5,6,7,8,9,10,11,12],[4,5,6,7,8,9,10,13]);
  check("test des signes : positifs", r.detail.positive, 7);
  check("test des signes : négatifs", r.detail.negative, 1);
}

/* ===================================================================== */
section("Tests sur variables catégorielles");

// χ² sans correction — formule fermée du tableau 2×2
{
  const r = inf.chiSquareTable([[10,20],[30,40]], { correction: false });
  const attendu = 100 * Math.pow(10*40 - 20*30, 2) / (30*70*40*60);
  check("χ² (sans Yates)", r.statistic, attendu, 1e-12);
  check("ddl", r.df, 1);
  check("V de Cramér", r.effect.value, Math.sqrt(attendu / 100), 1e-12);
}
// Correction de Yates : réduit toujours la statistique
{
  const sans = inf.chiSquareTable([[10,20],[30,40]], { correction: false }).statistic;
  const avec = inf.chiSquareTable([[10,20],[30,40]], { correction: true }).statistic;
  assert("Yates réduit le χ²", avec < sans, `${avec} < ${sans}`);
}
// Test exact de Fisher : expérience de dégustation de thé (référence classique)
{
  const r = inf.fisherExact(3,1,1,3);
  check("Fisher p bilatéral", r.p, 0.4857142857142857, 1e-9);
  check("Fisher OR", r.statistic, 9, 1e-12);
  const r2 = inf.fisherExact(3,1,1,3,{ tail:"greater" });
  check("Fisher p unilatéral", r2.p, 0.24285714285714285, 1e-9);
}
// Ajustement : dé équilibré
{
  const r = inf.chiSquareGoodnessOfFit([10,10,10,10,10,10]);
  check("χ² ajustement parfait", r.statistic, 0, 1e-12);
  const r2 = inf.chiSquareGoodnessOfFit([20,10,10,10,10,0]);
  check("χ² ajustement : ddl", r2.df, 5);
  check("χ² ajustement", r2.statistic, (100+0+0+0+0+100)/10, 1e-12);
}
// McNemar exact
{
  const r = inf.mcnemar(10,5,15,20);
  check("McNemar : discordants", r.detail.discordant, 20);
  assert("McNemar significatif", r.p < 0.05, `p = ${r.p}`);
}
// Mantel-Haenszel : deux strates au même OR → OR commun identique
{
  const r = inf.mantelHaenszel([
    { a:10, b:10, c:5,  d:20, label:"strate 1" },
    { a:20, b:20, c:10, d:40, label:"strate 2" },
  ]);
  check("OR de Mantel-Haenszel", r.effect.value, 4, 1e-9);
}
// Test binomial
{
  const r = inf.binomialTest(9, 10, 0.5);
  check("binomial exact p", r.p, 2 * (dist.binomial.pmf(9,10,0.5) + dist.binomial.pmf(10,10,0.5)), 1e-9);
}

/* ===================================================================== */
section("Corrélations");

{
  const r = inf.pearsonCorrelation([1,2,3,4,5],[2,4,5,4,5]);
  check("r de Pearson", r.statistic, 6 / Math.sqrt(60), 1e-12);
  check("r²", r.effect.r2, 0.6, 1e-12);
  check("ddl", r.df, 3);
}
// Corrélation parfaite
check("r = 1 (relation affine)", inf.pearsonCorrelation([1,2,3,4],[2,4,6,8]).statistic, 1, 1e-12);
check("r = −1", inf.pearsonCorrelation([1,2,3,4],[8,6,4,2]).statistic, -1, 1e-12);
// Spearman sur relation monotone non linéaire = 1
check("ρ de Spearman = 1", inf.spearmanCorrelation([1,2,3,4,5],[1,4,9,16,25]).statistic, 1, 1e-12);
// Kendall
{
  const r = inf.kendallTau([1,2,3,4,5],[1,2,3,4,5]);
  check("τ de Kendall = 1", r.statistic, 1, 1e-12);
  check("paires concordantes", r.detail.concordant, 10);
}
// Matrice de corrélation : symétrie et diagonale unité
{
  const m = inf.correlationMatrix([[1,2,3,4,5],[2,4,5,4,5],[5,3,2,4,1]]);
  check("diagonale = 1", m.r[0][0], 1);
  check("symétrie", m.r[0][1], m.r[1][0], 1e-15);
}

/* ===================================================================== */
section("Fidélité et accord");

check("κ accord parfait", inf.cohenKappa(["a","b","a","b"],["a","b","a","b"]).statistic, 1, 1e-12);
{
  // Exemple classique : a=20 b=5 c=10 d=15 → po=0,70 pe=0,50 κ=0,40
  const r1 = Array(20).fill("+").concat(Array(5).fill("+"), Array(10).fill("−"), Array(15).fill("−"));
  const r2 = Array(20).fill("+").concat(Array(5).fill("−"), Array(10).fill("+"), Array(15).fill("−"));
  const k = inf.cohenKappa(r1, r2);
  check("κ de Cohen", k.statistic, 0.4, 1e-9);
  check("accord observé", k.detail.observedAgreement, 0.7, 1e-12);
}
{
  const a = inf.cronbachAlpha([[1,2,3,4,5],[1,2,3,4,5],[1,2,3,4,5]]);
  check("α = 1 (items identiques)", a.alpha, 1, 1e-9);
}
{
  const i = inf.icc([[9,10],[8,9],[7,7],[6,6],[5,4]]);
  assert("ICC élevé sur données concordantes", i.icc > 0.8, `ICC = ${i.icc}`);
}

/* ===================================================================== */
section("Normalité et homogénéité");

{
  // Échantillon issu d'une loi normale : Shapiro-Wilk ne doit pas rejeter
  const norm = [9.7,10.1,9.9,10.3,10.0,9.8,10.2,9.6,10.4,10.1,9.9,10.0,10.2,9.8,10.1];
  const sw = inf.shapiroWilk(norm);
  assert("Shapiro-Wilk : W dans [0 ; 1]", sw.statistic > 0 && sw.statistic <= 1, `W = ${sw.statistic}`);
  assert("Shapiro-Wilk : normalité non rejetée", sw.p > 0.05, `p = ${sw.p}`);
  // Distribution fortement asymétrique : doit être rejetée
  const skew = [1,1,1,1,1,1,1,2,2,2,3,4,8,20,60];
  const sw2 = inf.shapiroWilk(skew);
  assert("Shapiro-Wilk : asymétrie détectée", sw2.p < 0.05, `p = ${sw2.p}`);

  // Propriétés structurelles de W — elles ont détecté une erreur de signe
  // sur les coefficients extrêmes de Royston, et la verrouillent désormais.
  assert("Shapiro-Wilk : W ≤ 1 systématiquement",
    [norm, skew, [2,4,5,7,9], Array.from({length:20},(_,i)=>i+1)]
      .every(s => inf.shapiroWilk(s).statistic <= 1));
  // Invariance par transformation affine (W est sans dimension)
  check("Shapiro-Wilk : invariance affine",
    inf.shapiroWilk(norm.map(v => v * 37.5 - 1200)).statistic, sw.statistic, 1e-12);
  // W doit rester proche de la statistique de Shapiro-Francia W′ = r²(x₍ᵢ₎, mᵢ)
  {
    const s = [...norm].sort((a,b)=>a-b), n = s.length;
    const m = s.map((_,i)=> dist.normal.inv((i + 1 - 0.375)/(n + 0.25)));
    const mx = desc.mean(s), mm = desc.mean(m);
    const num = desc.sum(s.map((v,i)=>(v-mx)*(m[i]-mm)));
    const wPrime = num*num / (desc.sum(s.map(v=>(v-mx)**2)) * desc.sum(m.map(v=>(v-mm)**2)));
    assert("Shapiro-Wilk : W ≈ W′ (Shapiro-Francia)",
      Math.abs(sw.statistic - wPrime) < 0.02, `W = ${sw.statistic}, W′ = ${wPrime}`);
  }
}
{
  const lv = inf.levene([[1,2,3,4,5],[1,2,3,4,5]]);
  check("Levene F = 0 (groupes identiques)", lv.statistic, 0, 1e-9);
  const lv2 = inf.levene([[10,10,10,10,10,11],[1,50,2,80,3,90]]);
  assert("Levene détecte l'hétérogénéité", lv2.p < 0.05, `p = ${lv2.p}`);
}
{
  const b = inf.bartlett([[1,2,3,4,5],[1,2,3,4,5],[1,2,3,4,5]]);
  check("Bartlett = 0 (variances égales)", b.statistic, 0, 1e-9);
}

/* ===================================================================== */
section("Régression");

{
  // Relation parfaitement affine : y = 2x + 1
  const r = reg.linearRegression([1,2,3,4,5],[3,5,7,9,11]);
  check("pente", r.coefficients[1].estimate, 2, 1e-9);
  check("constante", r.coefficients[0].estimate, 1, 1e-9);
  check("R² = 1", r.r2, 1, 1e-9);
  check("prédiction en x = 10", r.predict(10), 21, 1e-9);
}
{
  // Régression avec bruit : cohérence r² = r²(Pearson)
  const x = [1,2,3,4,5,6,7,8], y = [2,4,5,4,5,7,8,9];
  const lr = reg.linearRegression(x,y);
  const pc = inf.pearsonCorrelation(x,y);
  check("R² régression = r² Pearson", lr.r2, pc.statistic ** 2, 1e-10);
  check("F = t² du coefficient", lr.F, lr.coefficients[1].t ** 2, 1e-9);
  check("somme des résidus = 0", lr.residuals.reduce((a,b)=>a+b,0), 0, 1e-9);
}
{
  // Multiple : y = 2·x1 + 3·x2 exactement
  const r = reg.multipleRegression(
    [5, 8, 11, 14, 13, 16],
    [{ name:"x1", values:[1,1,1,1,2,2] }, { name:"x2", values:[1,2,3,4,3,4] }]);
  check("coefficient x1", r.coefficients[1].estimate, 2, 1e-7);
  check("coefficient x2", r.coefficients[2].estimate, 3, 1e-7);
  check("R² = 1", r.r2, 1, 1e-9);
}
{
  // Régression simple ≡ multiple à un prédicteur
  const x = [1,2,3,4,5,6,7,8,9,10], y = [3,5,4,8,9,11,10,14,15,17];
  const s = reg.linearRegression(x,y);
  const m = reg.multipleRegression(y, [{ name:"x", values:x }]);
  check("pente identique", m.coefficients[1].estimate, s.coefficients[1].estimate, 1e-9);
  check("R² identique", m.r2, s.r2, 1e-9);
}
{
  // Logistique : séparation nette → coefficient positif et forte exactitude
  const x = [1,2,3,4,5,6,7,8,9,10,11,12,13,14];
  const y = [0,0,0,0,0,0,1,0,1,1,1,1,1,1];
  const r = reg.logisticRegression(y, [{ name:"x", values:x }]);
  assert("logistique : convergence", r.converged === true, JSON.stringify(r.error || ""));
  assert("logistique : OR > 1", r.coefficients[1].oddsRatio > 1, `OR = ${r.coefficients[1]?.oddsRatio}`);
  assert("logistique : bon classement", r.classification.accuracy >= 0.85, `exactitude = ${r.classification.accuracy}`);
  assert("logistique : pseudo-R² dans [0 ; 1]",
    r.pseudoR2.nagelkerke >= 0 && r.pseudoR2.nagelkerke <= 1.0001, `${r.pseudoR2.nagelkerke}`);
}
{
  // Poisson : la constante doit approcher ln(moyenne) sans prédicteur utile
  const y = [2,3,4,3,5,4,6,5,7,6,8,7];
  const x = [1,1,2,2,3,3,4,4,5,5,6,6];
  const r = reg.poissonRegression(y, [{ name:"x", values:x }]);
  assert("Poisson : convergence", r.converged === true, JSON.stringify(r.error || ""));
  assert("Poisson : ratio de taux > 1", r.coefficients[1].rateRatio > 1);
}
{
  // Inversion matricielle
  const A = [[4,7],[2,6]];
  const Ainv = reg.inverse(A);
  const I = reg.matMul(A, Ainv);
  check("A·A⁻¹ = I (0,0)", I[0][0], 1, 1e-12);
  check("A·A⁻¹ = I (0,1)", I[0][1], 0, 1e-12);
  assert("matrice singulière détectée", reg.inverse([[1,2],[2,4]]) === null);
}

/* ===================================================================== */
section("Analyse de survie");

{
  // Sans censure, tous décédés : S(t) décroît par paliers de 1/n
  const km = surv.kaplanMeier([1,2,3,4,5],[1,1,1,1,1]);
  check("KM : S après le 1er événement", km.steps[1].survival, 0.8, 1e-12);
  check("KM : S finale", km.steps[km.steps.length-1].survival, 0, 1e-12);
  check("KM : survie médiane", km.medianSurvival, 3);
  check("KM : nombre d'événements", km.events, 5);
}
{
  // Avec censure
  const km = surv.kaplanMeier([2,3,4,5,6],[1,0,1,0,1]);
  check("KM : censurés", km.censored, 2);
  assert("KM : S décroissante", km.steps.every((s,i)=> i===0 || s.survival <= km.steps[i-1].survival + 1e-12));
  assert("KM : IC contient S", km.steps.every(s => s.lower <= s.survival + 1e-9 && s.survival <= s.upper + 1e-9));
}
{
  // Log-rank : deux groupes nettement distincts
  const t = [1,2,3,4,5, 20,21,22,23,24];
  const e = [1,1,1,1,1, 1,1,1,1,1];
  const g = ["A","A","A","A","A","B","B","B","B","B"];
  const lr = surv.logRankTest(t,e,g);
  assert("log-rank : différence détectée", lr.p < 0.01, `p = ${lr.p}`);
  check("log-rank : ddl", lr.df, 1);
}
{
  // Groupes identiques : aucune différence
  const t = [1,2,3,4,1,2,3,4], e = [1,1,1,1,1,1,1,1];
  const g = ["A","A","A","A","B","B","B","B"];
  const lr = surv.logRankTest(t,e,g);
  assert("log-rank : pas de différence", lr.p > 0.5, `p = ${lr.p}`);
}
{
  // Validation par simulation : on engendre des délais suivant exactement le
  // modèle de Cox (hazard ∝ e^{βx}, loi exponentielle), avec β connu = 0,8.
  // Un estimateur correct doit retrouver cette valeur. Générateur congruentiel
  // à graine fixe : le test est parfaitement reproductible.
  let seed = 20260719;
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return (seed + 1) / 0x7fffffff; };
  const BETA = 0.8;
  const times = [], events = [], xs = [];
  for (let i = 0; i < 400; i++) {
    const x = Math.round(rand() * 3 * 100) / 100;        // covariable dans [0 ; 3]
    const t = -Math.log(rand()) / Math.exp(BETA * x);    // délai exponentiel
    const c = -Math.log(rand()) / 0.15;                  // censure indépendante
    xs.push(x);
    times.push(Math.min(t, c));
    events.push(t <= c ? 1 : 0);
  }
  const cox = surv.coxRegression(times, events, [{ name: "x", values: xs }]);
  assert("Cox : convergence", cox.converged === true, JSON.stringify(cox.error || ""));
  check("Cox : β estimé ≈ β vrai (0,8)", cox.coefficients[0].estimate, BETA, 0.15);
  assert("Cox : IC du HR contient e^0,8 = 2,2255",
    cox.coefficients[0].hrLower < Math.exp(BETA) && Math.exp(BETA) < cox.coefficients[0].hrUpper,
    `IC = [${cox.coefficients[0].hrLower.toFixed(3)} ; ${cox.coefficients[0].hrUpper.toFixed(3)}]`);
  assert("Cox : modèle significatif", cox.p < 0.001, `p = ${cox.p}`);
  assert("Cox : concordance > 0,6", cox.concordance > 0.6, `c = ${cox.concordance}`);
}
{
  // Séparation monotone : le modèle doit refuser proprement, sans planter
  const cox = surv.coxRegression(
    [5,6,7,8,9,10,11,12],
    [1,1,1,1,1,1,1,1],
    [{ name:"score", values:[8,7,6,5,4,3,2,1] }]);
  assert("Cox : séparation monotone signalée", typeof cox.error === "string",
    JSON.stringify(cox).slice(0, 120));
}

/* ===================================================================== */
section("Performance diagnostique");

{
  const r = diag.diagnosticAccuracy(90, 10, 10, 90);
  check("sensibilité", r.sensitivity.value, 0.9, 1e-12);
  check("spécificité", r.specificity.value, 0.9, 1e-12);
  check("exactitude", r.accuracy.value, 0.9, 1e-12);
  check("indice de Youden", r.youdenIndex, 0.8, 1e-12);
  check("rapport de vraisemblance +", r.positiveLikelihoodRatio, 9, 1e-12);
  check("rapport de vraisemblance −", r.negativeLikelihoodRatio, 1/9, 1e-12);
  check("OR diagnostique", r.diagnosticOddsRatio, 81, 1e-12);
  check("score F1", r.f1Score, 0.9, 1e-12);
  assert("IC de Wilson encadre la valeur",
    r.sensitivity.lower < 0.9 && r.sensitivity.upper > 0.9);
}
{
  // Discrimination parfaite : AUC = 1
  const roc = diag.rocCurve([1,2,3,4,5,6,7,8],[0,0,0,0,1,1,1,1]);
  check("AUC = 1 (séparation parfaite)", roc.auc, 1, 1e-12);
  check("seuil optimal Youden", roc.optimalThreshold.youden.index, 1, 1e-12);
  // Aucune discrimination : AUC = 0,5
  // Ex æquo complets : le test ne discrimine rien, chaque paire compte pour 0,5
  const roc2 = diag.rocCurve([5,5,5,5,5,5],[0,1,0,1,0,1]);
  check("AUC = 0,5 (aucune information)", roc2.auc, 0.5, 1e-12);
  // Discrimination inversée : AUC < 0,5
  const roc4 = diag.rocCurve([8,7,6,5,4,3,2,1],[0,0,0,0,1,1,1,1]);
  check("AUC = 0 (discrimination inversée)", roc4.auc, 0, 1e-12);
  // Équivalence AUC ↔ U de Mann-Whitney
  const vals = [2,5,3,8,7,1,9,4,6,10];
  const lab  = [0,1,0,1,1,0,1,0,1,0];
  const roc3 = diag.rocCurve(vals, lab);
  const pos = vals.filter((_,i)=>lab[i]===1), neg = vals.filter((_,i)=>lab[i]===0);
  const mw = inf.mannWhitney(pos, neg);
  const U = mw.detail.U1;
  check("AUC = U/(n₁·n₂)", roc3.auc, Math.max(U, pos.length*neg.length - U)/(pos.length*neg.length), 1e-12);
}
{
  const ba = diag.blandAltman([10,12,14,16,18],[10.5,12.4,13.8,16.2,18.1]);
  check("Bland-Altman : biais", ba.bias, (-0.5-0.4+0.2-0.2-0.1)/5, 1e-9);
  assert("limites d'agrément encadrent le biais",
    ba.limitsOfAgreement.lower < ba.bias && ba.bias < ba.limitsOfAgreement.upper);
}
{
  const rm = diag.riskMeasures(30, 70, 10, 90, { design:"cohort" });
  check("risque exposés", rm.riskExposed, 0.3, 1e-12);
  check("risque non exposés", rm.riskUnexposed, 0.1, 1e-12);
  check("risque relatif", rm.relativeRisk.value, 3, 1e-12);
  check("rapport de cotes", rm.oddsRatio.value, (30*90)/(70*10), 1e-12);
  check("nombre de sujets à traiter", rm.numberNeededToTreat, 5, 1e-12);
}
{
  const w = diag.westgardRules([10,10.1,9.9,10.2,13.5], 10, 0.5);
  assert("Westgard : règle 1-3s déclenchée", w.violations.some(v=>v.rule==="1-3s"));
  assert("Westgard : série hors contrôle", w.inControl === false);
  const w2 = diag.westgardRules([10,10.1,9.9,10.2,10.0,9.95], 10, 0.5);
  assert("Westgard : série sous contrôle", w2.inControl === true);
}
{
  const ri = diag.referenceInterval(Array.from({length:200},(_,i)=> 100 + (i-100)/25));
  assert("intervalle de référence calculé", Number.isFinite(ri.lower) && Number.isFinite(ri.upper));
  assert("borne basse < borne haute", ri.lower < ri.upper);
}

/* ===================================================================== */
section("Analyses multivariées");

{
  // Vecteurs propres d'une matrice diagonale connue
  const e = mult.jacobiEigen([[3,0],[0,1]]);
  check("valeur propre 1", e.values[0], 3, 1e-12);
  check("valeur propre 2", e.values[1], 1, 1e-12);
  // Matrice de corrélation 2×2 : valeurs propres 1±r
  const e2 = mult.jacobiEigen([[1,0.6],[0.6,1]]);
  check("λ₁ = 1 + r", e2.values[0], 1.6, 1e-12);
  check("λ₂ = 1 − r", e2.values[1], 0.4, 1e-12);
}
{
  const p = mult.pca([
    { name:"a", values:[1,2,3,4,5,6,7,8] },
    { name:"b", values:[2,4,6,8,10,12,14,16] },
    { name:"c", values:[5,3,8,2,9,1,7,4] },
  ]);
  check("ACP : somme des valeurs propres = nb de variables", p.eigenvalues.reduce((x,y)=>x+y,0), 3, 1e-9);
  check("ACP : variance cumulée finale = 100 %", p.cumulativeVariance[2], 100, 1e-9);
  assert("ACP : a et b parfaitement corrélées → λ₃ ≈ 0", Math.abs(p.eigenvalues[2]) < 1e-9,
    `λ₃ = ${p.eigenvalues[2]}`);
}
{
  // k-moyennes sur deux nuages nettement séparés
  const km = mult.kMeans([
    { name:"x", values:[1,1.2,0.8,10,10.2,9.8] },
    { name:"y", values:[1,0.9,1.1,10,9.9,10.1] },
  ], 2);
  check("k-moyennes : 2 classes", km.clusters.length, 2);
  assert("k-moyennes : classes équilibrées 3/3", km.clusters.every(c=>c.size===3),
    km.clusters.map(c=>c.size).join("/"));
  assert("k-moyennes : silhouette élevée", km.silhouette > 0.8, `s = ${km.silhouette}`);
}
{
  const lda = mult.linearDiscriminant([
    { name:"x", values:[1,2,1.5,10,11,10.5] },
    { name:"y", values:[1,2,1.2,10,11,10.2] },
  ], ["A","A","A","B","B","B"]);
  check("AFD : reclassement parfait", lda.accuracy, 1, 1e-12);
}
{
  const ca = mult.correspondenceAnalysis([[20,10,5],[5,15,20],[10,10,10]]);
  assert("AFC : inertie positive", ca.totalInertia > 0);
  check("AFC : χ² = inertie × n", ca.chi2, ca.totalInertia * ca.n, 1e-9);
}

/* ===================================================================== */
section("Analyse qualitative");

{
  const t = qual.tokenize("Le patient présente une douleur thoracique et de la fièvre.");
  assert("tokenisation : mots vides retirés", !t.includes("le") && !t.includes("une"));
  assert("tokenisation : mots pleins conservés",
    t.includes("patient") && t.includes("douleur") && t.includes("thoracique"),
    t.join(","));
}
check("racinisation : douleurs → douleur", qual.stemFr("douleurs"), "douleur");
check("désaccentuation", qual.deaccent("fièvre élevée"), "fievre elevee");
{
  const wf = qual.wordFrequency([
    "douleur thoracique intense douleur",
    "fièvre élevée douleur abdominale",
  ]);
  const dl = wf.allRows.find(r => r.word === "douleur");
  check("fréquence de 'douleur'", dl.count, 3);
  check("'douleur' présent dans 2 documents", dl.documents, 2);
  assert("richesse lexicale dans [0 ; 1]", wf.typeTokenRatio > 0 && wf.typeTokenRatio <= 1);
}
{
  const c = qual.concordance(["La douleur est vive", "Aucune douleur signalée"], "douleur");
  check("concordancier : 2 occurrences", c.occurrences, 2);
  assert("concordancier : contexte gauche capté", c.lines[0].left.includes("La"));
}
{
  const docs = [
    { id:"E1", text:"J'ai beaucoup de douleur et de la fièvre depuis trois jours." },
    { id:"E2", text:"La fièvre a disparu mais la fatigue persiste." },
    { id:"E3", text:"Aucune douleur, aucune fièvre, je me sens bien." },
  ];
  const cb = [
    { code:"DOULEUR", theme:"Symptômes", patterns:["douleur"] },
    { code:"FIEVRE",  theme:"Symptômes", patterns:["fièvre"] },
    { code:"FATIGUE", theme:"Symptômes", patterns:["fatigue"] },
  ];
  const r = qual.applyCodebook(docs, cb);
  check("codage : segments totaux", r.totalSegments, 6);
  check("codage : documents codés", r.codedDocuments, 3);
  check("codage : couverture de FIEVRE", r.codeStats.find(s=>s.code==="FIEVRE").documents, 3);
  const co = qual.cooccurrence(r.matrix, r.codes);
  check("cooccurrence DOULEUR×FIEVRE", co.matrix[0][1], 2);
}
{
  const s1 = qual.sentimentAnalysis("Je me sens beaucoup mieux, le personnel est très compétent.");
  const s2 = qual.sentimentAnalysis("Douleur intense, attente très longue, service décevant.");
  assert("sentiment positif détecté", s1.score > 0, `score = ${s1.score}`);
  assert("sentiment négatif détecté", s2.score < 0, `score = ${s2.score}`);
  const s3 = qual.sentimentAnalysis("Ce n'est pas bien du tout.");
  assert("négation prise en compte", s3.score < 0, `score = ${s3.score}`);
}
{
  const a = [[1],[1],[0],[0],[1],[0]];
  const b = [[1],[1],[0],[0],[0],[0]];
  const r = qual.intercoderReliability(a, b, ["CODE1"]);
  assert("fidélité inter-codeurs calculée", Number.isFinite(r.overallKappa), `κ = ${r.overallKappa}`);
  assert("κ élevé sur codage proche", r.overallKappa > 0.5, `κ = ${r.overallKappa}`);
}

/* ===================================================================== */
section("Puissance et taille d'échantillon");

{
  const p = inf.powerTTest({ d:0.5, power:0.8, alpha:0.05 });
  // Référence classique : d = 0,5, puissance 80 % → n ≈ 63 à 64 par groupe
  assert("n pour d = 0,5 et puissance 80 %", p.n >= 62 && p.n <= 65, `n = ${p.n}`);
  const p2 = inf.powerTTest({ n:64, d:0.5, alpha:0.05 });
  assert("puissance ≈ 80 % avec n = 64", p2.power > 0.78 && p2.power < 0.82, `puissance = ${p2.power}`);
}
{
  const s = inf.sampleSizeProportion({ p:0.5, margin:0.05, level:0.95 });
  check("n pour ±5 % (proportion 50 %)", s.n, 385);
  const s2 = inf.sampleSizeProportion({ p:0.5, margin:0.05, level:0.95, population:1000 });
  assert("correction population finie réduit n", s2.n < s.n, `${s2.n} < ${s.n}`);
}

/* ===================================================================== */
console.log(`\n${"═".repeat(62)}`);
if (failed === 0) {
  console.log(`\x1b[32m✓ ${passed} contrôles réussis, aucun échec.\x1b[0m`);
} else {
  console.log(`\x1b[31m✗ ${failed} échec(s) sur ${passed + failed} contrôles :\x1b[0m`);
  failures.forEach((f, i) => console.log(`\n  ${i + 1}. ${f}`));
}
console.log(`${"═".repeat(62)}\n`);
process.exit(failed === 0 ? 0 : 1);
