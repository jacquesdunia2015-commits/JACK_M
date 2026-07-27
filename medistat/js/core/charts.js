// medistat/js/core/charts.js
// Graphiques en SVG pur — aucune bibliothèque, aucun appel réseau.
// Couvre les besoins de la visualisation médicale et statistique :
// barres, lignes, secteurs, nuages, histogrammes, boîtes à moustaches,
// courbes ROC, courbes de survie, forêts d'effets et cartes de chaleur.
// Tous les graphiques sont responsifs, accessibles et exportables en PNG.

const NS = "http://www.w3.org/2000/svg";

// Palette qualitative distinguable, y compris par les personnes atteintes de
// déficience de la vision des couleurs (dérivée de la palette d'Okabe & Ito).
export const PALETTE = [
  "#2b6cb0", "#dd6b20", "#38a169", "#c53030", "#805ad5",
  "#00838f", "#b7791f", "#d53f8c", "#4a5568", "#2c7a7b",
];

export const COULEURS = {
  normal: "#22c55e",
  bas: "#f59e0b",
  haut: "#f59e0b",
  critique: "#dc2626",
  neutre: "#94a3b8",
  accent: "#2b6cb0",
  grille: "#e2e8f0",
  texte: "#475569",
  axe: "#94a3b8",
};

function el(nom, attributs = {}, enfants = []) {
  const e = document.createElementNS(NS, nom);
  for (const [k, v] of Object.entries(attributs)) {
    if (v === null || v === undefined) continue;
    e.setAttribute(k, String(v));
  }
  for (const enfant of [enfants].flat(3)) {
    if (enfant === null || enfant === undefined || enfant === false) continue;
    e.appendChild(enfant instanceof Node ? enfant : document.createTextNode(String(enfant)));
  }
  return e;
}

function texte(contenu, x, y, options = {}) {
  const t = el("text", {
    x, y,
    "font-size": options.taille || 11,
    "font-family": "system-ui, -apple-system, 'Segoe UI', sans-serif",
    "font-weight": options.gras ? "600" : "400",
    fill: options.couleur || COULEURS.texte,
    "text-anchor": options.ancre || "middle",
    "dominant-baseline": options.baseline || "auto",
    transform: options.rotation ? `rotate(${options.rotation} ${x} ${y})` : null,
  });
  t.textContent = String(contenu);
  return t;
}

// Cadre commun : dimensions, marges, titre, zone de tracé
function cadre({ largeur = 640, hauteur = 380, marges = {}, titre = null, sousTitre = null }) {
  const m = { haut: titre ? 44 : 20, droite: 24, bas: 52, gauche: 62, ...marges };
  const svg = el("svg", {
    viewBox: `0 0 ${largeur} ${hauteur}`,
    class: "graphique",
    role: "img",
    preserveAspectRatio: "xMidYMid meet",
  });
  if (titre) {
    svg.appendChild(texte(titre, largeur / 2, 20, { taille: 13, gras: true, couleur: "#1e293b" }));
    if (sousTitre) svg.appendChild(texte(sousTitre, largeur / 2, 36, { taille: 10, couleur: "#64748b" }));
  }
  return {
    svg, m, largeur, hauteur,
    l: largeur - m.gauche - m.droite,   // largeur utile
    h: hauteur - m.haut - m.bas,        // hauteur utile
  };
}

// Échelle linéaire avec graduations « rondes »
function echelle(min, max, cible = 6) {
  if (min === max) { min -= 1; max += 1; }
  const brut = (max - min) / cible;
  const magnitude = Math.pow(10, Math.floor(Math.log10(Math.abs(brut) || 1)));
  const norm = brut / magnitude;
  const pas = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * magnitude;
  const bas = Math.floor(min / pas) * pas;
  const haut = Math.ceil(max / pas) * pas;
  const ticks = [];
  for (let v = bas; v <= haut + pas / 1000; v += pas) ticks.push(Number(v.toFixed(10)));
  return { min: bas, max: haut, pas, ticks };
}

const nb = (v, d = null) => {
  if (!Number.isFinite(v)) return "—";
  const dec = d ?? (Number.isInteger(v) ? 0 : Math.abs(v) < 1 ? 2 : 1);
  return v.toLocaleString("fr-FR", { minimumFractionDigits: dec, maximumFractionDigits: dec });
};

// Axes et grille
function axes(c, xEch, yEch, { libelleX = null, libelleY = null, xCategories = null } = {}) {
  const g = el("g");
  const px = v => c.m.gauche + ((v - xEch.min) / (xEch.max - xEch.min)) * c.l;
  const py = v => c.m.haut + c.h - ((v - yEch.min) / (yEch.max - yEch.min)) * c.h;

  // Grille horizontale
  for (const t of yEch.ticks) {
    g.appendChild(el("line", {
      x1: c.m.gauche, y1: py(t), x2: c.m.gauche + c.l, y2: py(t),
      stroke: COULEURS.grille, "stroke-width": 1,
    }));
    g.appendChild(texte(nb(t), c.m.gauche - 8, py(t) + 4, { ancre: "end", taille: 10 }));
  }
  // Axe des abscisses
  g.appendChild(el("line", {
    x1: c.m.gauche, y1: c.m.haut + c.h, x2: c.m.gauche + c.l, y2: c.m.haut + c.h,
    stroke: COULEURS.axe, "stroke-width": 1.5,
  }));
  g.appendChild(el("line", {
    x1: c.m.gauche, y1: c.m.haut, x2: c.m.gauche, y2: c.m.haut + c.h,
    stroke: COULEURS.axe, "stroke-width": 1.5,
  }));

  if (xCategories) {
    const pas = c.l / xCategories.length;
    // Rotation des étiquettes lorsqu'elles sont trop serrées
    const pivoter = xCategories.length > 8 || xCategories.some(s => String(s).length > 8);
    xCategories.forEach((cat, i) => {
      const x = c.m.gauche + pas * (i + 0.5);
      g.appendChild(texte(cat, x, c.m.haut + c.h + (pivoter ? 14 : 18), {
        taille: 10, rotation: pivoter ? -35 : 0, ancre: pivoter ? "end" : "middle",
      }));
    });
  } else if (xEch) {
    for (const t of xEch.ticks) {
      g.appendChild(texte(nb(t), px(t), c.m.haut + c.h + 18, { taille: 10 }));
      g.appendChild(el("line", {
        x1: px(t), y1: c.m.haut + c.h, x2: px(t), y2: c.m.haut + c.h + 4, stroke: COULEURS.axe,
      }));
    }
  }

  if (libelleX) g.appendChild(texte(libelleX, c.m.gauche + c.l / 2, c.hauteur - 8, { taille: 11, gras: true }));
  if (libelleY) {
    const t = texte(libelleY, 14, c.m.haut + c.h / 2, { taille: 11, gras: true });
    t.setAttribute("transform", `rotate(-90 14 ${c.m.haut + c.h / 2})`);
    g.appendChild(t);
  }
  return { g, px, py };
}

// Infobulle native : lisible partout, y compris à l'impression
function bulle(element, contenu) {
  element.appendChild(el("title", {}, [contenu]));
  return element;
}

/* ===================== Diagramme en barres ===================== */

export function barres(donnees, options = {}) {
  // donnees : [{ label, valeur, couleur?, erreur? }]
  const c = cadre(options);
  const valeurs = donnees.map(d => d.valeur);
  const maxErreur = Math.max(...donnees.map(d => (d.erreur || 0)), 0);
  const yEch = echelle(Math.min(0, ...valeurs), Math.max(...valeurs) + maxErreur);
  const { g, py } = axes(c, null, yEch, {
    libelleX: options.libelleX, libelleY: options.libelleY,
    xCategories: donnees.map(d => d.label),
  });
  c.svg.appendChild(g);

  const pas = c.l / donnees.length;
  const largeurBarre = Math.min(pas * 0.7, 64);
  donnees.forEach((d, i) => {
    const x = c.m.gauche + pas * (i + 0.5) - largeurBarre / 2;
    const y0 = py(Math.max(0, yEch.min));
    const y = py(d.valeur);
    const couleur = d.couleur || options.couleur || PALETTE[i % PALETTE.length];
    const rect = el("rect", {
      x, y: Math.min(y, y0), width: largeurBarre, height: Math.abs(y0 - y),
      fill: couleur, rx: 3, class: "barre",
    });
    c.svg.appendChild(bulle(rect, `${d.label} : ${nb(d.valeur)}${options.unite ? " " + options.unite : ""}`));

    // Barre d'erreur (écart-type ou intervalle de confiance)
    if (d.erreur) {
      const xc = x + largeurBarre / 2;
      c.svg.appendChild(el("line", {
        x1: xc, y1: py(d.valeur - d.erreur), x2: xc, y2: py(d.valeur + d.erreur),
        stroke: "#334155", "stroke-width": 1.5,
      }));
      for (const v of [d.valeur - d.erreur, d.valeur + d.erreur]) {
        c.svg.appendChild(el("line", {
          x1: xc - 6, y1: py(v), x2: xc + 6, y2: py(v), stroke: "#334155", "stroke-width": 1.5,
        }));
      }
    }
    if (options.valeursAffichees !== false && donnees.length <= 20) {
      c.svg.appendChild(texte(nb(d.valeur), x + largeurBarre / 2,
        Math.min(y, y0) - 5 - (d.erreur ? 12 : 0), { taille: 10, gras: true }));
    }
  });
  return c.svg;
}

/* ===================== Barres empilées / groupées ===================== */

export function barresGroupees(categories, series, options = {}) {
  // series : [{ nom, valeurs: [], couleur? }]
  const margeLegende = largeurLegende(series.map(s => s.nom));
  const c = cadre({ ...options, marges: { droite: margeLegende + 10, ...(options.marges || {}) } });
  const empile = options.empile;
  const totaux = categories.map((_, i) =>
    empile ? series.reduce((a, s) => a + (s.valeurs[i] || 0), 0)
      : Math.max(...series.map(s => s.valeurs[i] || 0)));
  const yEch = echelle(0, Math.max(...totaux));
  const { g, py } = axes(c, null, yEch, {
    libelleX: options.libelleX, libelleY: options.libelleY, xCategories: categories,
  });
  c.svg.appendChild(g);

  const pas = c.l / categories.length;
  const largeurGroupe = pas * 0.75;
  const largeurBarre = empile ? largeurGroupe : largeurGroupe / series.length;

  categories.forEach((cat, i) => {
    let cumul = 0;
    series.forEach((s, j) => {
      const v = s.valeurs[i] || 0;
      const couleur = s.couleur || PALETTE[j % PALETTE.length];
      const x = empile
        ? c.m.gauche + pas * (i + 0.5) - largeurGroupe / 2
        : c.m.gauche + pas * (i + 0.5) - largeurGroupe / 2 + j * largeurBarre;
      const y = empile ? py(cumul + v) : py(v);
      const hauteur = empile ? py(cumul) - py(cumul + v) : py(0) - py(v);
      const rect = el("rect", {
        x, y, width: Math.max(1, largeurBarre - (empile ? 0 : 2)),
        height: Math.max(0, hauteur), fill: couleur, rx: 2,
      });
      c.svg.appendChild(bulle(rect, `${cat} — ${s.nom} : ${nb(v)}`));
      cumul += v;
    });
  });

  c.svg.appendChild(legende(series.map((s, j) => ({
    nom: s.nom, couleur: s.couleur || PALETTE[j % PALETTE.length],
  })), c.largeur - margeLegende, c.m.haut));
  return c.svg;
}

function legende(entrees, x, y) {
  const g = el("g", { class: "legende" });
  entrees.forEach((e, i) => {
    const yy = y + i * 20;
    g.appendChild(el("rect", { x, y: yy, width: 12, height: 12, fill: e.couleur, rx: 2 }));
    g.appendChild(texte(e.nom, x + 18, yy + 10, { ancre: "start", taille: 10 }));
  });
  return g;
}

// Largeur à réserver à droite pour qu'aucun libellé de série ne soit tronqué.
// Estimation à 5,6 px par caractère pour une police de 10 px, plus la pastille.
function largeurLegende(noms) {
  const plusLong = Math.max(0, ...noms.map(n => String(n).length));
  return Math.min(220, Math.max(90, 30 + plusLong * 5.6));
}

/* ===================== Courbes ===================== */

export function lignes(series, options = {}) {
  // series : [{ nom, points: [{x, y}], couleur?, pointille? }]
  const margeLegende = largeurLegende(series.map(s => s.nom));
  const c = cadre({ ...options,
    marges: { droite: series.length > 1 ? margeLegende + 10 : 24, ...(options.marges || {}) } });
  const tousX = series.flatMap(s => s.points.map(p => p.x));
  const tousY = series.flatMap(s => s.points.map(p => p.y));
  const xEch = options.xCategories ? null : echelle(Math.min(...tousX), Math.max(...tousX));
  const yEch = echelle(options.yMin ?? Math.min(...tousY), options.yMax ?? Math.max(...tousY));
  const { g, px, py } = axes(c, xEch, yEch, {
    libelleX: options.libelleX, libelleY: options.libelleY, xCategories: options.xCategories,
  });
  c.svg.appendChild(g);

  const posX = options.xCategories
    ? i => c.m.gauche + (c.l / options.xCategories.length) * (i + 0.5)
    : v => px(v);

  series.forEach((s, si) => {
    const couleur = s.couleur || PALETTE[si % PALETTE.length];
    const d = s.points.map((p, i) =>
      `${i ? "L" : "M"}${(options.xCategories ? posX(i) : posX(p.x)).toFixed(2)},${py(p.y).toFixed(2)}`).join(" ");
    c.svg.appendChild(el("path", {
      d, fill: "none", stroke: couleur, "stroke-width": 2.2,
      "stroke-linejoin": "round", "stroke-linecap": "round",
      "stroke-dasharray": s.pointille ? "6 4" : null,
    }));
    if (options.points !== false && s.points.length <= 60) {
      s.points.forEach((p, i) => {
        const cercle = el("circle", {
          cx: options.xCategories ? posX(i) : posX(p.x), cy: py(p.y), r: 3.5,
          fill: "#fff", stroke: couleur, "stroke-width": 2,
        });
        c.svg.appendChild(bulle(cercle, `${s.nom} — ${p.label ?? nb(p.x)} : ${nb(p.y)}`));
      });
    }
  });

  // Lignes de référence (valeurs normales, seuils d'alerte)
  for (const ref of options.references || []) {
    c.svg.appendChild(el("line", {
      x1: c.m.gauche, y1: py(ref.valeur), x2: c.m.gauche + c.l, y2: py(ref.valeur),
      stroke: ref.couleur || COULEURS.critique, "stroke-width": 1.4, "stroke-dasharray": "5 4",
    }));
    if (ref.label) {
      c.svg.appendChild(texte(ref.label, c.m.gauche + c.l - 4, py(ref.valeur) - 5, {
        ancre: "end", taille: 9, couleur: ref.couleur || COULEURS.critique,
      }));
    }
  }
  // Zone de normalité
  if (options.zoneNormale) {
    const { min, max } = options.zoneNormale;
    c.svg.insertBefore(el("rect", {
      x: c.m.gauche, y: py(max), width: c.l, height: Math.abs(py(min) - py(max)),
      fill: COULEURS.normal, opacity: 0.09,
    }), c.svg.firstChild);
  }

  if (series.length > 1) {
    c.svg.appendChild(legende(series.map((s, i) => ({
      nom: s.nom, couleur: s.couleur || PALETTE[i % PALETTE.length],
    })), c.largeur - margeLegende, c.m.haut));
  }
  return c.svg;
}

/* ===================== Secteurs et anneau ===================== */

export function secteurs(donnees, options = {}) {
  const largeur = options.largeur || 520, hauteur = options.hauteur || 320;
  const svg = el("svg", { viewBox: `0 0 ${largeur} ${hauteur}`, class: "graphique", role: "img" });
  if (options.titre) svg.appendChild(texte(options.titre, largeur / 2, 20, { taille: 13, gras: true, couleur: "#1e293b" }));

  const total = donnees.reduce((a, d) => a + d.valeur, 0);
  if (!total) return svg;
  const cx = 150, cy = hauteur / 2 + 10;
  const r = Math.min(110, hauteur / 2 - 30);
  const rInterne = options.anneau ? r * 0.58 : 0;

  let angle = -Math.PI / 2;
  donnees.forEach((d, i) => {
    const part = d.valeur / total;
    const fin = angle + part * 2 * Math.PI;
    const couleur = d.couleur || PALETTE[i % PALETTE.length];
    const grand = part > 0.5 ? 1 : 0;
    const x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle);
    const x2 = cx + r * Math.cos(fin), y2 = cy + r * Math.sin(fin);

    let d2;
    if (part >= 0.9999) {
      // Un secteur unique à 100 % : l'arc dégénère, on trace deux demi-cercles
      d2 = `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy} Z`;
    } else if (rInterne) {
      const xi1 = cx + rInterne * Math.cos(fin), yi1 = cy + rInterne * Math.sin(fin);
      const xi2 = cx + rInterne * Math.cos(angle), yi2 = cy + rInterne * Math.sin(angle);
      d2 = `M ${x1} ${y1} A ${r} ${r} 0 ${grand} 1 ${x2} ${y2} L ${xi1} ${yi1} A ${rInterne} ${rInterne} 0 ${grand} 0 ${xi2} ${yi2} Z`;
    } else {
      d2 = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${grand} 1 ${x2} ${y2} Z`;
    }
    const secteur = el("path", { d: d2, fill: couleur, stroke: "#fff", "stroke-width": 2 });
    svg.appendChild(bulle(secteur, `${d.label} : ${nb(d.valeur)} (${nb(part * 100, 1)} %)`));

    // Pourcentage inscrit dans le secteur s'il est assez grand
    if (part > 0.06) {
      const milieu = angle + part * Math.PI;
      const rt = rInterne ? (r + rInterne) / 2 : r * 0.65;
      svg.appendChild(texte(`${nb(part * 100, 0)} %`,
        cx + rt * Math.cos(milieu), cy + rt * Math.sin(milieu) + 4,
        { taille: 11, gras: true, couleur: "#fff" }));
    }
    angle = fin;
  });

  if (options.anneau && options.centre) {
    svg.appendChild(texte(options.centre.valeur, cx, cy - 2, { taille: 22, gras: true, couleur: "#1e293b" }));
    svg.appendChild(texte(options.centre.libelle, cx, cy + 18, { taille: 10 }));
  }

  // Légende détaillée à droite
  const gl = el("g");
  donnees.forEach((d, i) => {
    const y = cy - (donnees.length * 22) / 2 + i * 22;
    gl.appendChild(el("rect", { x: 300, y: y - 9, width: 12, height: 12,
      fill: d.couleur || PALETTE[i % PALETTE.length], rx: 2 }));
    gl.appendChild(texte(`${d.label}`, 320, y + 1, { ancre: "start", taille: 11 }));
    gl.appendChild(texte(`${nb(d.valeur)} (${nb(d.valeur / total * 100, 1)} %)`,
      largeur - 20, y + 1, { ancre: "end", taille: 10, couleur: "#64748b" }));
  });
  svg.appendChild(gl);
  return svg;
}

/* ===================== Nuage de points ===================== */

export function nuage(points, options = {}) {
  // points : [{ x, y, groupe?, label? }]
  const groupes = [...new Set(points.map(p => p.groupe).filter(Boolean))];
  const margeLegende = largeurLegende(groupes);
  const c = cadre({ ...options,
    marges: { droite: groupes.length ? margeLegende + 10 : 24, ...(options.marges || {}) } });
  const xEch = echelle(Math.min(...points.map(p => p.x)), Math.max(...points.map(p => p.x)));
  const yEch = echelle(Math.min(...points.map(p => p.y)), Math.max(...points.map(p => p.y)));
  const { g, px, py } = axes(c, xEch, yEch, { libelleX: options.libelleX, libelleY: options.libelleY });
  c.svg.appendChild(g);

  // Droite de régression, si demandée
  if (options.regression) {
    const n = points.length;
    const mx = points.reduce((a, p) => a + p.x, 0) / n;
    const my = points.reduce((a, p) => a + p.y, 0) / n;
    let sxy = 0, sxx = 0;
    for (const p of points) { sxy += (p.x - mx) * (p.y - my); sxx += (p.x - mx) ** 2; }
    if (sxx) {
      const pente = sxy / sxx, ord = my - pente * mx;
      c.svg.appendChild(el("line", {
        x1: px(xEch.min), y1: py(ord + pente * xEch.min),
        x2: px(xEch.max), y2: py(ord + pente * xEch.max),
        stroke: COULEURS.critique, "stroke-width": 2, "stroke-dasharray": "6 4",
      }));
    }
  }

  points.forEach(p => {
    const gi = groupes.indexOf(p.groupe);
    const couleur = p.couleur || (gi >= 0 ? PALETTE[gi % PALETTE.length] : COULEURS.accent);
    const cercle = el("circle", {
      cx: px(p.x), cy: py(p.y), r: options.rayon || 4.5,
      fill: couleur, "fill-opacity": 0.65, stroke: couleur, "stroke-width": 1,
    });
    c.svg.appendChild(bulle(cercle, `${p.label ? p.label + " — " : ""}${nb(p.x)} ; ${nb(p.y)}`));
  });

  if (groupes.length) {
    c.svg.appendChild(legende(groupes.map((nom, i) => ({ nom, couleur: PALETTE[i % PALETTE.length] })),
      c.largeur - margeLegende, c.m.haut));
  }
  return c.svg;
}

/* ===================== Histogramme ===================== */

export function histogramme(classes, options = {}) {
  // classes : [{ from, to, count }]
  const c = cadre(options);
  const yEch = echelle(0, Math.max(...classes.map(b => b.count)));
  const xEch = { min: classes[0].from, max: classes[classes.length - 1].to, ticks: [] };
  const nbTicks = Math.min(8, classes.length + 1);
  for (let i = 0; i <= nbTicks; i++) {
    xEch.ticks.push(xEch.min + (xEch.max - xEch.min) * i / nbTicks);
  }
  const { g, px, py } = axes(c, xEch, yEch, {
    libelleX: options.libelleX || "Valeur", libelleY: options.libelleY || "Effectif",
  });
  c.svg.appendChild(g);

  for (const b of classes) {
    const x = px(b.from), largeur = Math.max(1, px(b.to) - px(b.from) - 1);
    const rect = el("rect", {
      x, y: py(b.count), width: largeur, height: py(0) - py(b.count),
      fill: options.couleur || COULEURS.accent, "fill-opacity": 0.82,
      stroke: "#fff", "stroke-width": 0.5,
    });
    c.svg.appendChild(bulle(rect, `[${nb(b.from)} ; ${nb(b.to)}[ : ${b.count}`));
  }

  // Courbe de densité superposée (estimation par noyau)
  if (options.densite?.length) {
    const maxD = Math.max(...options.densite.map(p => p.y));
    const echelleD = yEch.max / maxD;
    const d = options.densite
      .filter(p => p.x >= xEch.min && p.x <= xEch.max)
      .map((p, i) => `${i ? "L" : "M"}${px(p.x).toFixed(2)},${py(p.y * echelleD).toFixed(2)}`).join(" ");
    c.svg.appendChild(el("path", { d, fill: "none", stroke: "#dd6b20", "stroke-width": 2 }));
  }
  // Repère de la moyenne
  if (Number.isFinite(options.moyenne)) {
    c.svg.appendChild(el("line", {
      x1: px(options.moyenne), y1: c.m.haut, x2: px(options.moyenne), y2: c.m.haut + c.h,
      stroke: COULEURS.critique, "stroke-width": 2, "stroke-dasharray": "5 4",
    }));
    c.svg.appendChild(texte(`moyenne = ${nb(options.moyenne)}`, px(options.moyenne), c.m.haut - 4,
      { taille: 9, couleur: COULEURS.critique }));
  }
  return c.svg;
}

/* ===================== Boîtes à moustaches ===================== */

export function boites(groupes, options = {}) {
  // groupes : [{ label, min, q1, median, q3, max, whiskerLow, whiskerHigh, outliers, mean }]
  const c = cadre(options);
  const toutes = groupes.flatMap(g2 => [g2.whiskerLow, g2.whiskerHigh, ...(g2.outliers || [])]);
  const yEch = echelle(Math.min(...toutes), Math.max(...toutes));
  const { g, py } = axes(c, null, yEch, {
    libelleY: options.libelleY, libelleX: options.libelleX,
    xCategories: groupes.map(x => x.label),
  });
  c.svg.appendChild(g);

  const pas = c.l / groupes.length;
  const largeur = Math.min(pas * 0.55, 58);
  groupes.forEach((b, i) => {
    const xc = c.m.gauche + pas * (i + 0.5);
    const couleur = b.couleur || PALETTE[i % PALETTE.length];

    // Moustaches
    c.svg.appendChild(el("line", { x1: xc, y1: py(b.whiskerLow), x2: xc, y2: py(b.q1), stroke: "#475569", "stroke-width": 1.4 }));
    c.svg.appendChild(el("line", { x1: xc, y1: py(b.q3), x2: xc, y2: py(b.whiskerHigh), stroke: "#475569", "stroke-width": 1.4 }));
    for (const v of [b.whiskerLow, b.whiskerHigh]) {
      c.svg.appendChild(el("line", {
        x1: xc - largeur / 4, y1: py(v), x2: xc + largeur / 4, y2: py(v), stroke: "#475569", "stroke-width": 1.4,
      }));
    }
    // Boîte interquartile
    const rect = el("rect", {
      x: xc - largeur / 2, y: py(b.q3), width: largeur, height: Math.max(1, py(b.q1) - py(b.q3)),
      fill: couleur, "fill-opacity": 0.35, stroke: couleur, "stroke-width": 1.8, rx: 2,
    });
    c.svg.appendChild(bulle(rect,
      `${b.label}\nMédiane : ${nb(b.median)}\nQ1 : ${nb(b.q1)} — Q3 : ${nb(b.q3)}\n` +
      `Moustaches : ${nb(b.whiskerLow)} – ${nb(b.whiskerHigh)}`));
    // Médiane
    c.svg.appendChild(el("line", {
      x1: xc - largeur / 2, y1: py(b.median), x2: xc + largeur / 2, y2: py(b.median),
      stroke: couleur, "stroke-width": 3,
    }));
    // Moyenne (losange), pour distinguer moyenne et médiane d'un coup d'œil
    if (Number.isFinite(b.mean)) {
      const y = py(b.mean);
      c.svg.appendChild(el("polygon", {
        points: `${xc},${y - 5} ${xc + 5},${y} ${xc},${y + 5} ${xc - 5},${y}`,
        fill: "#fff", stroke: couleur, "stroke-width": 1.6,
      }));
    }
    // Valeurs aberrantes
    for (const o of b.outliers || []) {
      c.svg.appendChild(bulle(el("circle", {
        cx: xc, cy: py(o), r: 3, fill: "none", stroke: COULEURS.critique, "stroke-width": 1.4,
      }), `Valeur aberrante : ${nb(o)}`));
    }
  });
  return c.svg;
}

/* ===================== Courbe ROC ===================== */

export function courbeROC(roc, options = {}) {
  const c = cadre({
    largeur: options.largeur || 440, hauteur: options.hauteur || 420,
    titre: options.titre || "Courbe ROC",
    sousTitre: `AUC = ${nb(roc.auc, 3)} (IC 95 % : ${nb(roc.ci.lower, 3)} – ${nb(roc.ci.upper, 3)})`,
    marges: { droite: 24, gauche: 58, bas: 52 },
  });
  const ech = { min: 0, max: 1, ticks: [0, 0.2, 0.4, 0.6, 0.8, 1] };
  const { g, px, py } = axes(c, ech, ech, {
    libelleX: "1 − spécificité (faux positifs)", libelleY: "Sensibilité",
  });
  c.svg.appendChild(g);

  // Diagonale de non-discrimination
  c.svg.appendChild(el("line", {
    x1: px(0), y1: py(0), x2: px(1), y2: py(1),
    stroke: COULEURS.neutre, "stroke-width": 1.4, "stroke-dasharray": "5 4",
  }));

  const pts = [...roc.points].sort((a, b) => a.fpr - b.fpr || a.sensitivity - b.sensitivity);
  // Aire sous la courbe, remplie
  const aire = `M ${px(0)},${py(0)} ` +
    pts.map(p => `L ${px(p.fpr).toFixed(2)},${py(p.sensitivity).toFixed(2)}`).join(" ") +
    ` L ${px(1)},${py(0)} Z`;
  c.svg.appendChild(el("path", { d: aire, fill: COULEURS.accent, opacity: 0.13 }));
  const trace = pts.map((p, i) =>
    `${i ? "L" : "M"}${px(p.fpr).toFixed(2)},${py(p.sensitivity).toFixed(2)}`).join(" ");
  c.svg.appendChild(el("path", { d: trace, fill: "none", stroke: COULEURS.accent, "stroke-width": 2.4 }));

  // Seuil optimal de Youden
  const best = roc.optimalThreshold?.youden;
  if (best) {
    const p = pts.find(x => Math.abs(x.sensitivity - best.sensitivity) < 1e-9 &&
      Math.abs(x.specificity - best.specificity) < 1e-9);
    if (p) {
      c.svg.appendChild(bulle(el("circle", {
        cx: px(p.fpr), cy: py(p.sensitivity), r: 6,
        fill: COULEURS.critique, stroke: "#fff", "stroke-width": 2,
      }), `Seuil optimal : ${nb(best.value)}\nSe = ${nb(best.sensitivity * 100, 1)} % — Sp = ${nb(best.specificity * 100, 1)} %`));
      c.svg.appendChild(texte(`seuil ${nb(best.value)}`, px(p.fpr) + 10, py(p.sensitivity) + 4,
        { ancre: "start", taille: 9, couleur: COULEURS.critique }));
    }
  }
  return c.svg;
}

/* ===================== Courbe de survie (Kaplan-Meier) ===================== */

export function courbeSurvie(courbes, options = {}) {
  // courbes : [{ label, steps, couleur? }]
  const c = cadre({
    ...options, titre: options.titre || "Courbe de survie de Kaplan-Meier",
    marges: { droite: courbes.length > 1
      ? largeurLegende(courbes.map(k => `${k.label} (n = ${k.n ?? "?"})`)) + 10 : 24,
      ...(options.marges || {}) },
  });
  const maxT = Math.max(...courbes.flatMap(k => k.steps.map(s => s.time)));
  const xEch = echelle(0, maxT);
  const yEch = { min: 0, max: 1, ticks: [0, 0.2, 0.4, 0.6, 0.8, 1] };
  const { g, px, py } = axes(c, xEch, yEch, {
    libelleX: options.libelleX || "Délai", libelleY: "Probabilité de survie",
  });
  c.svg.appendChild(g);

  courbes.forEach((k, i) => {
    const couleur = k.couleur || PALETTE[i % PALETTE.length];
    // Tracé en escalier : la survie est constante entre deux événements
    let d = `M ${px(0)},${py(1)}`;
    let precedent = 1;
    for (const s of k.steps) {
      d += ` L ${px(s.time).toFixed(2)},${py(precedent).toFixed(2)}`;
      d += ` L ${px(s.time).toFixed(2)},${py(s.survival).toFixed(2)}`;
      precedent = s.survival;
    }
    d += ` L ${px(maxT).toFixed(2)},${py(precedent).toFixed(2)}`;

    // Bande d'intervalle de confiance
    if (options.ic !== false) {
      let haut = `M ${px(0)},${py(1)}`, bas = "";
      let ph = 1, pb = 1;
      for (const s of k.steps) {
        haut += ` L ${px(s.time)},${py(ph)} L ${px(s.time)},${py(s.upper)}`;
        ph = s.upper;
      }
      haut += ` L ${px(maxT)},${py(ph)}`;
      const inverse = [...k.steps].reverse();
      bas = ` L ${px(maxT)},${py(inverse[0]?.lower ?? 1)}`;
      for (const s of inverse) {
        bas += ` L ${px(s.time)},${py(s.lower)}`;
        pb = s.lower;
      }
      bas += ` L ${px(0)},${py(1)} Z`;
      c.svg.appendChild(el("path", { d: haut + bas, fill: couleur, opacity: 0.12 }));
    }

    c.svg.appendChild(el("path", { d, fill: "none", stroke: couleur, "stroke-width": 2.4 }));
    // Marques de censure
    for (const s of k.steps) {
      if (s.censored > 0) {
        c.svg.appendChild(bulle(el("line", {
          x1: px(s.time), y1: py(s.survival) - 5, x2: px(s.time), y2: py(s.survival) + 5,
          stroke: couleur, "stroke-width": 1.8,
        }), `${s.censored} censuré(s) à ${nb(s.time)}`));
      }
    }
  });

  // Repère de la survie médiane
  c.svg.appendChild(el("line", {
    x1: c.m.gauche, y1: py(0.5), x2: c.m.gauche + c.l, y2: py(0.5),
    stroke: COULEURS.neutre, "stroke-width": 1, "stroke-dasharray": "3 3",
  }));

  if (courbes.length > 1) {
    c.svg.appendChild(legende(courbes.map((k, i) => ({
      nom: `${k.label} (n = ${k.n ?? "?"})`, couleur: k.couleur || PALETTE[i % PALETTE.length],
    })), c.largeur - largeurLegende(courbes.map(k => `${k.label} (n = ${k.n ?? "?"})`)), c.m.haut));
  }
  if (options.pLogRank !== undefined && options.pLogRank !== null) {
    c.svg.appendChild(texte(
      `Log-rank : p ${options.pLogRank < 0.001 ? "< 0,001" : "= " + nb(options.pLogRank, 3)}`,
      c.m.gauche + 10, c.m.haut + 16, { ancre: "start", taille: 11, gras: true }));
  }
  return c.svg;
}

/* ===================== Graphique en forêt ===================== */

// Représentation des rapports de cotes ou de risques avec leurs intervalles —
// le graphique de référence des méta-analyses et des analyses multivariées.
export function foret(entrees, options = {}) {
  // entrees : [{ label, estimation, bas, haut, poids?, significatif? }]
  const hauteurLigne = 26;
  const hauteur = 70 + entrees.length * hauteurLigne;
  const largeur = options.largeur || 660;
  const mGauche = 210, mDroite = 110;
  const svg = el("svg", { viewBox: `0 0 ${largeur} ${hauteur}`, class: "graphique", role: "img" });
  if (options.titre) svg.appendChild(texte(options.titre, largeur / 2, 18, { taille: 13, gras: true, couleur: "#1e293b" }));

  const log = options.echelleLog !== false;
  const tr = v => (log ? Math.log(Math.max(1e-6, v)) : v);
  const bornes = entrees.flatMap(e => [e.bas, e.haut]).filter(Number.isFinite);
  const refValeur = options.reference ?? (log ? 1 : 0);
  const min = tr(Math.min(...bornes, refValeur)), max = tr(Math.max(...bornes, refValeur));
  const marge = (max - min) * 0.1 || 1;
  const px = v => mGauche + ((tr(v) - min + marge) / (max - min + 2 * marge)) * (largeur - mGauche - mDroite);

  const yHaut = 40;
  // Ligne de valeur nulle (OR = 1, ou différence = 0)
  svg.appendChild(el("line", {
    x1: px(refValeur), y1: yHaut - 8, x2: px(refValeur), y2: yHaut + entrees.length * hauteurLigne,
    stroke: "#94a3b8", "stroke-width": 1.4, "stroke-dasharray": "4 3",
  }));

  entrees.forEach((e, i) => {
    const y = yHaut + i * hauteurLigne + hauteurLigne / 2;
    const significatif = e.significatif ?? (e.bas > refValeur || e.haut < refValeur);
    const couleur = significatif ? COULEURS.accent : COULEURS.neutre;

    svg.appendChild(texte(e.label, mGauche - 12, y + 4, { ancre: "end", taille: 11, gras: significatif }));
    // Intervalle de confiance
    svg.appendChild(el("line", {
      x1: px(e.bas), y1: y, x2: px(e.haut), y2: y, stroke: couleur, "stroke-width": 1.8,
    }));
    for (const v of [e.bas, e.haut]) {
      svg.appendChild(el("line", { x1: px(v), y1: y - 4, x2: px(v), y2: y + 4, stroke: couleur, "stroke-width": 1.8 }));
    }
    // Estimation ponctuelle, taille proportionnelle au poids
    const taille = 4 + (e.poids ? Math.min(6, e.poids * 6) : 2);
    svg.appendChild(bulle(el("rect", {
      x: px(e.estimation) - taille / 2, y: y - taille / 2, width: taille, height: taille,
      fill: couleur, transform: `rotate(45 ${px(e.estimation)} ${y})`,
    }), `${e.label} : ${nb(e.estimation, 2)} [${nb(e.bas, 2)} ; ${nb(e.haut, 2)}]`));
    // Valeur chiffrée à droite
    svg.appendChild(texte(`${nb(e.estimation, 2)} [${nb(e.bas, 2)} ; ${nb(e.haut, 2)}]`,
      largeur - 8, y + 4, { ancre: "end", taille: 9, couleur: "#475569" }));
  });

  // Axe gradué
  const yAxe = yHaut + entrees.length * hauteurLigne + 6;
  svg.appendChild(el("line", { x1: mGauche, y1: yAxe, x2: largeur - mDroite, y2: yAxe, stroke: COULEURS.axe }));
  const graduations = log ? [0.1, 0.25, 0.5, 1, 2, 4, 10] : echelle(min, max, 5).ticks;
  for (const t of graduations) {
    if (tr(t) < min - marge || tr(t) > max + marge) continue;
    svg.appendChild(el("line", { x1: px(t), y1: yAxe, x2: px(t), y2: yAxe + 4, stroke: COULEURS.axe }));
    svg.appendChild(texte(nb(t, t < 1 ? 2 : 0), px(t), yAxe + 16, { taille: 9 }));
  }
  svg.appendChild(texte(options.libelleX || (log ? "Rapport de cotes (échelle logarithmique)" : "Effet"),
    (mGauche + largeur - mDroite) / 2, hauteur - 6, { taille: 10, gras: true }));
  return svg;
}

/* ===================== Carte de chaleur ===================== */

export function carteChaleur(matrice, libellesLignes, libellesColonnes, options = {}) {
  const taille = options.taille || 34;
  const mGauche = options.margeGauche || 130, mHaut = options.margeHaut || 110;
  const largeur = mGauche + libellesColonnes.length * taille + 90;
  const hauteur = mHaut + libellesLignes.length * taille + 30;
  const svg = el("svg", { viewBox: `0 0 ${largeur} ${hauteur}`, class: "graphique", role: "img" });
  if (options.titre) svg.appendChild(texte(options.titre, largeur / 2, 18, { taille: 13, gras: true, couleur: "#1e293b" }));

  const valeurs = matrice.flat().filter(Number.isFinite);
  const min = options.min ?? Math.min(...valeurs);
  const max = options.max ?? Math.max(...valeurs);
  const divergente = options.divergente ?? (min < 0 && max > 0);

  // Échelle divergente pour les corrélations (bleu ↔ blanc ↔ rouge),
  // séquentielle sinon (blanc → bleu foncé).
  const couleur = v => {
    if (!Number.isFinite(v)) return "#f1f5f9";
    if (divergente) {
      const b = Math.max(Math.abs(min), Math.abs(max)) || 1;
      const t = v / b;
      return t >= 0
        ? `rgb(${Math.round(255 - 200 * t)},${Math.round(255 - 175 * t)},${Math.round(255 - 90 * t)})`
        : `rgb(${Math.round(255 - 30 * -t)},${Math.round(255 - 130 * -t)},${Math.round(255 - 60 * -t)})`;
    }
    const t = max === min ? 0.5 : (v - min) / (max - min);
    return `rgb(${Math.round(247 - 204 * t)},${Math.round(250 - 148 * t)},${Math.round(252 - 76 * t)})`;
  };

  libellesColonnes.forEach((c, j) => {
    const x = mGauche + j * taille + taille / 2;
    const t = texte(c, x, mHaut - 8, { taille: 10, ancre: "start" });
    t.setAttribute("transform", `rotate(-55 ${x} ${mHaut - 8})`);
    svg.appendChild(t);
  });

  libellesLignes.forEach((l, i) => {
    svg.appendChild(texte(l, mGauche - 8, mHaut + i * taille + taille / 2 + 4, { ancre: "end", taille: 10 }));
    libellesColonnes.forEach((c, j) => {
      const v = matrice[i][j];
      const rect = el("rect", {
        x: mGauche + j * taille, y: mHaut + i * taille,
        width: taille - 1.5, height: taille - 1.5, fill: couleur(v), rx: 2,
      });
      svg.appendChild(bulle(rect, `${l} × ${c} : ${nb(v, 2)}`));
      if (Number.isFinite(v) && taille >= 30) {
        const clair = Math.abs(v) / (Math.max(Math.abs(min), Math.abs(max)) || 1) > 0.6;
        svg.appendChild(texte(nb(v, 2),
          mGauche + j * taille + taille / 2, mHaut + i * taille + taille / 2 + 4,
          { taille: 9, couleur: clair ? "#fff" : "#334155" }));
      }
    });
  });

  // Échelle de couleurs
  const xEch = mGauche + libellesColonnes.length * taille + 22;
  const hEch = Math.min(160, libellesLignes.length * taille);
  for (let i = 0; i < 40; i++) {
    const v = max - (i / 39) * (max - min);
    svg.appendChild(el("rect", {
      x: xEch, y: mHaut + (i / 40) * hEch, width: 14, height: hEch / 40 + 0.5, fill: couleur(v),
    }));
  }
  svg.appendChild(texte(nb(max, 2), xEch + 18, mHaut + 8, { ancre: "start", taille: 9 }));
  svg.appendChild(texte(nb(min, 2), xEch + 18, mHaut + hEch, { ancre: "start", taille: 9 }));
  return svg;
}

/* ===================== Diagramme de Pareto ===================== */

// Barres décroissantes et courbe de cumul : identifie les causes principales.
export function pareto(donnees, options = {}) {
  const tri = [...donnees].sort((a, b) => b.valeur - a.valeur);
  const total = tri.reduce((a, d) => a + d.valeur, 0);
  const c = cadre({ ...options, marges: { droite: 58, ...(options.marges || {}) } });
  const yEch = echelle(0, Math.max(...tri.map(d => d.valeur)));
  const { g, py } = axes(c, null, yEch, {
    libelleY: options.libelleY || "Effectif", xCategories: tri.map(d => d.label),
  });
  c.svg.appendChild(g);

  const pas = c.l / tri.length;
  const largeur = Math.min(pas * 0.72, 60);
  let cumul = 0;
  const pointsCumul = [];
  tri.forEach((d, i) => {
    const x = c.m.gauche + pas * (i + 0.5) - largeur / 2;
    c.svg.appendChild(bulle(el("rect", {
      x, y: py(d.valeur), width: largeur, height: py(0) - py(d.valeur),
      fill: COULEURS.accent, rx: 2,
    }), `${d.label} : ${nb(d.valeur)} (${nb(d.valeur / total * 100, 1)} %)`));
    cumul += d.valeur;
    pointsCumul.push({ x: c.m.gauche + pas * (i + 0.5), y: cumul / total });
  });

  const pyCumul = v => c.m.haut + c.h - v * c.h;
  c.svg.appendChild(el("path", {
    d: pointsCumul.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(2)},${pyCumul(p.y).toFixed(2)}`).join(" "),
    fill: "none", stroke: "#dd6b20", "stroke-width": 2.4,
  }));
  pointsCumul.forEach((p, i) => {
    c.svg.appendChild(bulle(el("circle", {
      cx: p.x, cy: pyCumul(p.y), r: 4, fill: "#fff", stroke: "#dd6b20", "stroke-width": 2,
    }), `Cumul : ${nb(p.y * 100, 1)} %`));
  });
  // Repère des 80 %
  c.svg.appendChild(el("line", {
    x1: c.m.gauche, y1: pyCumul(0.8), x2: c.m.gauche + c.l, y2: pyCumul(0.8),
    stroke: "#dd6b20", "stroke-width": 1.2, "stroke-dasharray": "5 4", opacity: 0.7,
  }));
  for (const p of [0, 0.25, 0.5, 0.75, 1]) {
    c.svg.appendChild(texte(`${p * 100} %`, c.m.gauche + c.l + 8, pyCumul(p) + 4,
      { ancre: "start", taille: 9, couleur: "#dd6b20" }));
  }
  return c.svg;
}

/* ===================== Jauge ===================== */

export function jauge(valeur, { min = 0, max = 100, seuils = [], titre = "", unite = "" } = {}) {
  const largeur = 240, hauteur = 150;
  const svg = el("svg", { viewBox: `0 0 ${largeur} ${hauteur}`, class: "graphique", role: "img" });
  const cx = largeur / 2, cy = 112, r = 82;
  const angle = v => Math.PI * (1 + Math.min(1, Math.max(0, (v - min) / (max - min))));
  const point = (a, rr) => [cx + rr * Math.cos(a), cy + rr * Math.sin(a)];

  // Fond segmenté par seuils
  const segments = seuils.length ? seuils : [{ jusqua: max, couleur: COULEURS.accent }];
  let depuis = min;
  for (const s of segments) {
    const [x1, y1] = point(angle(depuis), r);
    const [x2, y2] = point(angle(s.jusqua), r);
    svg.appendChild(el("path", {
      d: `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`,
      fill: "none", stroke: s.couleur, "stroke-width": 16, "stroke-linecap": "butt",
    }));
    depuis = s.jusqua;
  }

  // Aiguille
  const a = angle(valeur);
  const [xa, ya] = point(a, r - 14);
  svg.appendChild(el("line", { x1: cx, y1: cy, x2: xa, y2: ya, stroke: "#1e293b", "stroke-width": 3, "stroke-linecap": "round" }));
  svg.appendChild(el("circle", { cx, cy, r: 6, fill: "#1e293b" }));
  svg.appendChild(texte(nb(valeur, 1) + (unite ? " " + unite : ""), cx, cy - 22,
    { taille: 22, gras: true, couleur: "#1e293b" }));
  if (titre) svg.appendChild(texte(titre, cx, hauteur - 8, { taille: 11 }));
  svg.appendChild(texte(nb(min), cx - r, cy + 16, { taille: 9 }));
  svg.appendChild(texte(nb(max), cx + r, cy + 16, { taille: 9 }));
  return svg;
}

/* ===================== Courbe en entonnoir / mini-graphique ===================== */

// Sparkline : tendance compacte, insérable dans une cellule de tableau
export function miniCourbe(valeurs, { largeur = 90, hauteur = 26, couleur = null } = {}) {
  const svg = el("svg", { viewBox: `0 0 ${largeur} ${hauteur}`, class: "mini-courbe" });
  if (valeurs.length < 2) return svg;
  const min = Math.min(...valeurs), max = Math.max(...valeurs);
  const etendue = max - min || 1;
  const px = i => (i / (valeurs.length - 1)) * (largeur - 4) + 2;
  const py = v => hauteur - 3 - ((v - min) / etendue) * (hauteur - 6);
  const c = couleur || (valeurs[valeurs.length - 1] >= valeurs[0] ? COULEURS.normal : COULEURS.critique);
  svg.appendChild(el("path", {
    d: valeurs.map((v, i) => `${i ? "L" : "M"}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(" "),
    fill: "none", stroke: c, "stroke-width": 1.6, "stroke-linejoin": "round",
  }));
  svg.appendChild(el("circle", {
    cx: px(valeurs.length - 1), cy: py(valeurs[valeurs.length - 1]), r: 2.4, fill: c,
  }));
  return svg;
}

/* ===================== Export d'un graphique ===================== */

export function svgVersTexte(svg) {
  const clone = svg.cloneNode(true);
  clone.setAttribute("xmlns", NS);
  if (!clone.getAttribute("width")) {
    const vb = (clone.getAttribute("viewBox") || "0 0 640 400").split(/\s+/);
    clone.setAttribute("width", vb[2]);
    clone.setAttribute("height", vb[3]);
  }
  // Fond blanc explicite : sans lui, l'image exportée est transparente et
  // devient illisible une fois collée dans un document.
  const fond = el("rect", { x: 0, y: 0, width: "100%", height: "100%", fill: "#ffffff" });
  clone.insertBefore(fond, clone.firstChild);
  return new XMLSerializer().serializeToString(clone);
}

// Conversion en PNG haute résolution, pour insertion dans un rapport
export function svgVersPNG(svg, { echelle = 2 } = {}) {
  return new Promise((resolve, reject) => {
    const texteSvg = svgVersTexte(svg);
    const vb = (svg.getAttribute("viewBox") || "0 0 640 400").split(/\s+/);
    const l = Number(vb[2]) * echelle, h2 = Number(vb[3]) * echelle;
    const img = new Image();
    const url = URL.createObjectURL(new Blob([texteSvg], { type: "image/svg+xml;charset=utf-8" }));
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = l; canvas.height = h2;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, l, h2);
      ctx.drawImage(img, 0, 0, l, h2);
      URL.revokeObjectURL(url);
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error("Conversion PNG impossible."))), "image/png");
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Rendu du graphique impossible.")); };
    img.src = url;
  });
}
