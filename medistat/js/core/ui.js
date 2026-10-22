// medistat/js/core/ui.js
// Boîte à outils d'interface — article 11.
// Interface simple, rapide et claire, utilisable sur ordinateur, tablette et
// téléphone. Aucun cadre applicatif externe : des fonctions de construction du
// DOM, un système de notifications, des fenêtres modales et des tableaux.

/* ===================== Construction du DOM ===================== */

// h("div.classe#id", { attributs }, [enfants]) — création concise d'éléments.
// Le contenu textuel passe systématiquement par textContent : aucune
// interpolation de HTML, donc aucune injection possible depuis les données.
export function h(selecteur, attributs = {}, enfants = []) {
  const [avantId, id] = String(selecteur).split("#");
  const parts = avantId.split(".");
  const balise = parts[0] || "div";
  const el = document.createElement(balise);
  for (const c of parts.slice(1)) if (c) el.classList.add(c);
  if (id) el.id = id;

  if (attributs && !Array.isArray(attributs) && typeof attributs === "object") {
    for (const [k, v] of Object.entries(attributs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === "class") { for (const c of String(v).split(/\s+/)) if (c) el.classList.add(c); }
      else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
      else if (k === "dataset") Object.assign(el.dataset, v);
      else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === "texte") el.textContent = String(v);
      else if (k === "html") el.innerHTML = v;         // réservé aux gabarits internes
      else if (k === "value") el.value = v;
      else if (k === "checked" || k === "disabled" || k === "hidden" || k === "selected") el[k] = !!v;
      else el.setAttribute(k, v === true ? "" : String(v));
    }
  } else if (Array.isArray(attributs)) {
    enfants = attributs;
  } else if (typeof attributs === "string") {
    el.textContent = attributs;
  }

  const liste = Array.isArray(enfants) ? enfants : [enfants];
  for (const enfant of liste.flat(3)) {
    if (enfant === null || enfant === undefined || enfant === false) continue;
    el.appendChild(enfant instanceof Node ? enfant : document.createTextNode(String(enfant)));
  }
  return el;
}

export const $ = (sel, racine = document) => racine.querySelector(sel);
export const $$ = (sel, racine = document) => [...racine.querySelectorAll(sel)];

export function vider(el) {
  while (el && el.firstChild) el.removeChild(el.firstChild);
  return el;
}

export function remplacer(el, ...contenu) {
  vider(el);
  for (const c of contenu.flat(3)) {
    if (c === null || c === undefined || c === false) continue;
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

/* ===================== Formatage ===================== */

export const fmt = {
  // Nombre à la française : virgule décimale, espace fine comme séparateur
  // de milliers. « 1 234,57 » plutôt que « 1234.57 ».
  nombre(v, decimales = null) {
    if (v === null || v === undefined || v === "") return "—";
    const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
    if (!Number.isFinite(n)) return String(v);
    const d = decimales ?? (Number.isInteger(n) ? 0 : Math.abs(n) < 1 ? 3 : 2);
    return n.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
  },
  pourcent(v, decimales = 1) {
    if (!Number.isFinite(Number(v))) return "—";
    return fmt.nombre(Number(v), decimales) + " %";
  },
  // Valeur p au format des publications scientifiques
  valeurP(p) {
    if (p === null || p === undefined || Number.isNaN(p)) return "—";
    if (p < 0.001) return "< 0,001";
    return p.toFixed(3).replace(".", ",");
  },
  date(d, { heure = false, longue = false } = {}) {
    if (!d) return "—";
    const date = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(date.getTime())) return String(d);
    const opts = longue
      ? { day: "numeric", month: "long", year: "numeric" }
      : { day: "2-digit", month: "2-digit", year: "numeric" };
    if (heure) { opts.hour = "2-digit"; opts.minute = "2-digit"; }
    return date.toLocaleDateString("fr-FR", opts);
  },
  // Durée relative : « il y a 3 heures », « dans 2 jours »
  relatif(d) {
    if (!d) return "—";
    const delta = (new Date(d) - Date.now()) / 1000;
    const abs = Math.abs(delta);
    const rtf = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });
    if (abs < 60) return rtf.format(Math.round(delta), "second");
    if (abs < 3600) return rtf.format(Math.round(delta / 60), "minute");
    if (abs < 86400) return rtf.format(Math.round(delta / 3600), "hour");
    if (abs < 2592000) return rtf.format(Math.round(delta / 86400), "day");
    if (abs < 31536000) return rtf.format(Math.round(delta / 2592000), "month");
    return rtf.format(Math.round(delta / 31536000), "year");
  },
  duree(heures) {
    if (!Number.isFinite(heures)) return "—";
    if (heures < 1) return `${Math.round(heures * 60)} min`;
    if (heures < 24) return `${Math.floor(heures)} h ${String(Math.round((heures % 1) * 60)).padStart(2, "0")}`;
    return `${Math.floor(heures / 24)} j ${Math.round(heures % 24)} h`;
  },
  octets(n) {
    if (!Number.isFinite(n)) return "—";
    const u = ["o", "Ko", "Mo", "Go"];
    let i = 0;
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
    return `${fmt.nombre(n, i ? 1 : 0)} ${u[i]}`;
  },
  intervalle(bas, haut, decimales = 2) {
    if (!Number.isFinite(bas) || !Number.isFinite(haut)) return "—";
    return `[${fmt.nombre(bas, decimales)} ; ${fmt.nombre(haut, decimales)}]`;
  },
};

/* ===================== Notifications ===================== */

let zoneNotifications = null;

export function notifier(message, type = "info", { duree = 4500, action = null } = {}) {
  if (!zoneNotifications) {
    zoneNotifications = h("div.notifications", { role: "status", "aria-live": "polite" });
    document.body.appendChild(zoneNotifications);
  }
  const icones = { info: "ℹ️", succes: "✅", alerte: "⚠️", erreur: "⛔", critique: "🚨" };
  const el = h(`div.notification.notification--${type}`, [
    h("span.notification__icone", { texte: icones[type] || "ℹ️" }),
    h("div.notification__corps", [
      h("div.notification__message", { texte: message }),
      action ? h("button.notification__action", {
        texte: action.libelle,
        onclick: () => { action.action(); el.remove(); },
      }) : null,
    ]),
    h("button.notification__fermer", {
      texte: "✕", "aria-label": "Fermer", onclick: () => el.remove(),
    }),
  ]);
  zoneNotifications.appendChild(el);
  // Les alertes critiques restent affichées jusqu'à acquittement : en
  // contexte médical, une alerte qui disparaît toute seule est une alerte
  // manquée.
  if (duree && type !== "critique") setTimeout(() => el.remove(), duree);
  return el;
}

export const info = (m, o) => notifier(m, "info", o);
export const succes = (m, o) => notifier(m, "succes", o);
export const alerte = (m, o) => notifier(m, "alerte", o);
export const erreur = (m, o) => notifier(m, "erreur", o);
export const critique = (m, o) => notifier(m, "critique", { duree: 0, ...o });

/* ===================== Fenêtres modales ===================== */

export function modale({ titre, contenu, actions = [], largeur = "560px", fermable = true }) {
  return new Promise(resolve => {
    const fermer = valeur => { fond.remove(); document.removeEventListener("keydown", surTouche); resolve(valeur); };
    const surTouche = e => {
      if (e.key === "Escape" && fermable) fermer(null);
      if (e.key === "Tab") piegerFocus(e);
    };

    const boutons = actions.map(a => h(`button.btn.btn--${a.type || "neutre"}`, {
      texte: a.libelle,
      onclick: async () => {
        if (a.action) {
          const r = await a.action(dialogue);
          if (r === false) return;   // l'action a refusé la fermeture
          fermer(r ?? a.valeur ?? true);
        } else fermer(a.valeur ?? true);
      },
    }));

    const dialogue = h("div.modale", { style: { maxWidth: largeur }, role: "dialog", "aria-modal": "true" }, [
      h("header.modale__entete", [
        h("h2.modale__titre", { texte: titre }),
        fermable ? h("button.modale__fermer", { texte: "✕", "aria-label": "Fermer", onclick: () => fermer(null) }) : null,
      ]),
      h("div.modale__corps", [contenu]),
      boutons.length ? h("footer.modale__pied", boutons) : null,
    ]);

    const fond = h("div.modale__fond", {
      onclick: e => { if (e.target === fond && fermable) fermer(null); },
    }, [dialogue]);

    // Piège de focus : le clavier ne doit pas sortir de la fenêtre modale
    const focusables = () => $$(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', dialogue)
      .filter(el => !el.disabled && el.offsetParent !== null);
    const piegerFocus = e => {
      const liste = focusables();
      if (!liste.length) return;
      const premier = liste[0], dernier = liste[liste.length - 1];
      if (e.shiftKey && document.activeElement === premier) { e.preventDefault(); dernier.focus(); }
      else if (!e.shiftKey && document.activeElement === dernier) { e.preventDefault(); premier.focus(); }
    };

    document.body.appendChild(fond);
    document.addEventListener("keydown", surTouche);
    setTimeout(() => (focusables()[0] || dialogue).focus(), 50);
  });
}

export function confirmer(message, { titre = "Confirmation", danger = false, detail = null } = {}) {
  return modale({
    titre,
    contenu: h("div", [
      h("p", { texte: message }),
      detail ? h("p.texte-secondaire", { texte: detail }) : null,
    ]),
    actions: [
      { libelle: "Annuler", type: "neutre", valeur: false },
      { libelle: danger ? "Confirmer la suppression" : "Confirmer", type: danger ? "danger" : "primaire", valeur: true },
    ],
    largeur: "440px",
  });
}

// Demande un mot de passe — utilisé pour la signature et le déverrouillage
export function demanderMotDePasse({ titre = "Confirmation d'identité", message = "" } = {}) {
  const champ = h("input.champ", { type: "password", autocomplete: "current-password",
    placeholder: "Mot de passe", required: true });
  return modale({
    titre,
    contenu: h("div.formulaire", [
      message ? h("p", { texte: message }) : null,
      h("label.champ-groupe", [h("span.champ-libelle", { texte: "Mot de passe" }), champ]),
    ]),
    actions: [
      { libelle: "Annuler", type: "neutre", valeur: null },
      { libelle: "Valider", type: "primaire", action: () => champ.value || false },
    ],
    largeur: "420px",
  });
}

/* ===================== Composants ===================== */

export function badge(texte, couleur = null, { pastille = false } = {}) {
  return h("span.badge", {
    texte,
    style: couleur ? {
      backgroundColor: couleur + "1f", color: couleur,
      borderColor: couleur + "55",
    } : {},
    class: pastille ? "badge--pastille" : "",
  });
}

export function carteStat({ libelle, valeur, detail = null, icone = null, couleur = null, onclick = null }) {
  const carte = h("div.carte-stat", { class: onclick ? "carte-stat--cliquable" : "" }, [
    icone ? h("div.carte-stat__icone", { texte: icone, style: couleur ? { color: couleur } : {} }) : null,
    h("div.carte-stat__corps", [
      h("div.carte-stat__valeur", { texte: String(valeur), style: couleur ? { color: couleur } : {} }),
      h("div.carte-stat__libelle", { texte: libelle }),
      detail ? h("div.carte-stat__detail", { texte: detail }) : null,
    ]),
  ]);
  if (onclick) { carte.addEventListener("click", onclick); carte.tabIndex = 0; carte.setAttribute("role", "button"); }
  return carte;
}

// Tableau triable, filtrable et paginé
export function tableau(colonnes, lignes, {
  vide = "Aucune donnée à afficher.",
  parPage = 25,
  triInitial = null,
  surLigne = null,
  compact = false,
} = {}) {
  let tri = triInitial;   // { colonne, sens }
  let page = 1;
  let filtre = "";

  const conteneur = h("div.tableau-conteneur");

  const donneesFiltrees = () => {
    let d = lignes;
    if (filtre) {
      const q = filtre.toLowerCase();
      d = d.filter(l => colonnes.some(c => {
        const v = typeof c.valeur === "function" ? c.valeur(l) : l[c.cle];
        return String(v ?? "").toLowerCase().includes(q);
      }));
    }
    if (tri) {
      const col = colonnes.find(c => c.cle === tri.colonne);
      if (col) {
        d = [...d].sort((a, b) => {
          const va = typeof col.triSur === "function" ? col.triSur(a)
            : typeof col.valeur === "function" ? col.valeur(a) : a[col.cle];
          const vb = typeof col.triSur === "function" ? col.triSur(b)
            : typeof col.valeur === "function" ? col.valeur(b) : b[col.cle];
          const na = Number(va), nb = Number(vb);
          const cmp = Number.isFinite(na) && Number.isFinite(nb)
            ? na - nb
            : String(va ?? "").localeCompare(String(vb ?? ""), "fr", { numeric: true });
          return tri.sens === "desc" ? -cmp : cmp;
        });
      }
    }
    return d;
  };

  const rendre = () => {
    const d = donneesFiltrees();
    const pages = Math.max(1, Math.ceil(d.length / parPage));
    page = Math.min(page, pages);
    const visibles = d.slice((page - 1) * parPage, page * parPage);

    const thead = h("thead", [h("tr", colonnes.map(c => {
      const actif = tri?.colonne === c.cle;
      return h("th", {
        class: [c.triable !== false ? "triable" : "", actif ? "trie" : "",
          c.aligne === "droite" ? "aligne-droite" : c.aligne === "centre" ? "aligne-centre" : ""]
          .filter(Boolean).join(" "),
        onclick: c.triable === false ? null : () => {
          tri = actif && tri.sens === "asc" ? { colonne: c.cle, sens: "desc" } : { colonne: c.cle, sens: "asc" };
          rendre();
        },
      }, [c.titre, actif ? h("span.tri-fleche", { texte: tri.sens === "asc" ? " ▲" : " ▼" }) : null]);
    }))]);

    const tbody = h("tbody", visibles.length
      ? visibles.map(l => {
        const tr = h("tr", { class: surLigne ? "cliquable" : "" }, colonnes.map(c => {
          const contenu = typeof c.rendu === "function" ? c.rendu(l)
            : typeof c.valeur === "function" ? c.valeur(l) : l[c.cle];
          return h("td", {
            class: c.aligne === "droite" ? "aligne-droite" : c.aligne === "centre" ? "aligne-centre" : "",
            "data-libelle": c.titre,
          }, [contenu instanceof Node ? contenu : String(contenu ?? "—")]);
        }));
        if (surLigne) tr.addEventListener("click", () => surLigne(l));
        return tr;
      })
      : [h("tr", [h("td.tableau-vide", { colspan: colonnes.length, texte: vide })])]);

    const pagination = pages > 1 ? h("div.pagination", [
      h("button.btn.btn--fin", { texte: "‹ Précédent", disabled: page === 1,
        onclick: () => { page--; rendre(); } }),
      h("span.pagination__info", { texte: `Page ${page} sur ${pages} — ${d.length} enregistrement(s)` }),
      h("button.btn.btn--fin", { texte: "Suivant ›", disabled: page === pages,
        onclick: () => { page++; rendre(); } }),
    ]) : d.length ? h("div.pagination__info", { texte: `${d.length} enregistrement(s)` }) : null;

    remplacer(conteneur,
      lignes.length > 10 ? h("div.tableau-filtre", [
        h("input.champ.champ--recherche", {
          type: "search", placeholder: "Filtrer…", value: filtre,
          oninput: e => { filtre = e.target.value; page = 1; rendre(); },
        }),
      ]) : null,
      h("div.tableau-defilement", [
        h(`table.tableau${compact ? ".tableau--compact" : ""}`, [thead, tbody]),
      ]),
      pagination);
  };

  rendre();
  return conteneur;
}

/* ===================== Formulaires ===================== */

// Construit un formulaire à partir d'une description déclarative
export function formulaire(champs, valeurs = {}) {
  const controles = {};
  const el = h("form.formulaire", { onsubmit: e => e.preventDefault() },
    champs.map(c => {
      if (c.type === "separateur") return h("div.formulaire__separateur", { texte: c.libelle || "" });
      const id = `champ_${c.cle}`;
      let controle;
      const valeur = valeurs[c.cle] ?? c.defaut ?? "";

      if (c.type === "select") {
        controle = h("select.champ", { id, name: c.cle, required: c.obligatoire },
          [c.vide !== false ? h("option", { value: "", texte: c.vide || "— Choisir —" }) : null,
            ...(c.options || []).map(o => h("option", {
              value: o.valeur ?? o, texte: o.libelle ?? o, selected: String(o.valeur ?? o) === String(valeur),
            }))]);
      } else if (c.type === "textarea") {
        controle = h("textarea.champ", { id, name: c.cle, rows: c.lignes || 3,
          placeholder: c.placeholder || "", required: c.obligatoire });
        controle.value = valeur;
      } else if (c.type === "checkbox") {
        controle = h("input", { type: "checkbox", id, name: c.cle, checked: !!valeur });
        // Cette branche rend son propre gabarit et sort par un `return` : elle
        // doit donc enregistrer le contrôle elle-même. L'oublier ne casse
        // rien de visible — la case s'affiche et se coche — mais `valeurs()`
        // ne la retrouve plus et renvoie systématiquement `undefined`, donc
        // « décoché », quoi que l'utilisateur ait fait.
        controles[c.cle] = controle;
        return h("label.champ-groupe.champ-groupe--case", [
          controle, h("span.champ-libelle", { texte: c.libelle }),
          c.aide ? h("span.champ-aide", { texte: c.aide }) : null,
        ]);
      } else if (c.type === "radio") {
        const groupe = h("div.champ-radios", (c.options || []).map(o =>
          h("label.radio", [
            h("input", { type: "radio", name: c.cle, value: o.valeur ?? o,
              checked: String(o.valeur ?? o) === String(valeur) }),
            h("span", { texte: o.libelle ?? o }),
          ])));
        controles[c.cle] = { type: "radio", el: groupe, nom: c.cle };
        return h("div.champ-groupe", [
          h("span.champ-libelle", { texte: c.libelle + (c.obligatoire ? " *" : "") }),
          groupe,
          c.aide ? h("span.champ-aide", { texte: c.aide }) : null,
        ]);
      } else {
        controle = h("input.champ", {
          type: c.type || "text", id, name: c.cle, value: valeur,
          placeholder: c.placeholder || "", required: c.obligatoire,
          min: c.min, max: c.max, step: c.pas, maxlength: c.longueurMax,
          autocomplete: c.autocomplete || "off",
        });
      }
      controles[c.cle] = controle;
      return h("div.champ-groupe", { class: c.pleineLargeur ? "champ-groupe--large" : "" }, [
        h("label.champ-libelle", { for: id, texte: c.libelle + (c.obligatoire ? " *" : "") }),
        controle,
        c.aide ? h("span.champ-aide", { texte: c.aide }) : null,
      ]);
    }));

  // Récupère les valeurs saisies, typées selon la description
  el.valeurs = () => {
    const out = {};
    for (const c of champs) {
      if (c.type === "separateur") continue;
      const ctrl = controles[c.cle];
      if (!ctrl) continue;
      if (ctrl.type === "radio") {
        out[c.cle] = ctrl.el.querySelector("input:checked")?.value ?? null;
      } else if (ctrl.type === "checkbox") {
        out[c.cle] = ctrl.checked;
      } else if (c.type === "number") {
        const v = ctrl.value.trim().replace(",", ".");
        out[c.cle] = v === "" ? null : Number(v);
      } else {
        out[c.cle] = typeof ctrl.value === "string" ? ctrl.value.trim() : ctrl.value;
      }
    }
    return out;
  };
  el.controles = controles;
  el.marquerErreurs = erreurs => {
    $$(".champ--erreur", el).forEach(x => x.classList.remove("champ--erreur"));
    for (const cle of erreurs) controles[cle]?.classList?.add("champ--erreur");
  };
  return el;
}

/* ===================== États d'affichage ===================== */

export function chargement(message = "Chargement…") {
  return h("div.etat-vide", [
    h("div.chargeur", { "aria-hidden": "true" }),
    h("p", { texte: message }),
  ]);
}

export function etatVide({ icone = "📭", titre, message = "", action = null }) {
  return h("div.etat-vide", [
    h("div.etat-vide__icone", { texte: icone }),
    h("h3", { texte: titre }),
    message ? h("p", { texte: message }) : null,
    action ? h("button.btn.btn--primaire", { texte: action.libelle, onclick: action.action }) : null,
  ]);
}

export function etatErreur(message, reessayer = null) {
  return h("div.etat-vide.etat-vide--erreur", [
    h("div.etat-vide__icone", { texte: "⛔" }),
    h("h3", { texte: "Une erreur est survenue" }),
    h("p", { texte: message }),
    reessayer ? h("button.btn.btn--primaire", { texte: "Réessayer", onclick: reessayer }) : null,
  ]);
}

/* ===================== Barre de progression ===================== */

export function progression(valeur, max = 100, { couleur = null, libelle = null } = {}) {
  const pct = max ? Math.min(100, Math.max(0, (valeur / max) * 100)) : 0;
  return h("div.progression", { role: "progressbar", "aria-valuenow": valeur, "aria-valuemax": max }, [
    h("div.progression__barre", {
      style: { width: pct + "%", backgroundColor: couleur || "var(--accent)" },
    }),
    libelle ? h("span.progression__libelle", { texte: libelle }) : null,
  ]);
}

/* ===================== Onglets ===================== */

export function onglets(definitions, { defaut = 0 } = {}) {
  const corps = h("div.onglets__corps");
  const boutons = definitions.map((d, i) => h("button.onglet", {
    texte: d.libelle, role: "tab",
    onclick: () => activer(i),
  }));
  const activer = async i => {
    boutons.forEach((b, j) => b.classList.toggle("onglet--actif", i === j));
    remplacer(corps, chargement());
    const contenu = typeof definitions[i].contenu === "function"
      ? await definitions[i].contenu()
      : definitions[i].contenu;
    remplacer(corps, contenu);
  };
  const el = h("div.onglets", [h("div.onglets__barre", { role: "tablist" }, boutons), corps]);
  el.activer = activer;
  activer(defaut);
  return el;
}

/* ===================== Divers ===================== */

// Empêche une fonction coûteuse d'être appelée à chaque frappe
export function antirebond(fn, delai = 300) {
  let minuteur;
  return (...args) => {
    clearTimeout(minuteur);
    minuteur = setTimeout(() => fn(...args), delai);
  };
}

export async function copier(texte) {
  try {
    await navigator.clipboard.writeText(texte);
    succes("Copié dans le presse-papiers.");
    return true;
  } catch {
    // Repli pour les contextes non sécurisés, où l'API n'est pas disponible
    const ta = h("textarea", { style: { position: "fixed", opacity: "0" } });
    ta.value = texte;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand?.("copy");
    ta.remove();
    if (ok) succes("Copié dans le presse-papiers.");
    else erreur("La copie automatique n'est pas disponible sur cet appareil.");
    return !!ok;
  }
}

// Met en évidence les occurrences d'un terme, sans jamais injecter de HTML
export function surligner(texte, terme) {
  if (!terme) return document.createTextNode(texte);
  const frag = document.createDocumentFragment();
  const bas = String(texte).toLowerCase();
  const q = terme.toLowerCase();
  let i = 0, idx;
  while ((idx = bas.indexOf(q, i)) !== -1) {
    if (idx > i) frag.appendChild(document.createTextNode(texte.slice(i, idx)));
    frag.appendChild(h("mark", { texte: texte.slice(idx, idx + terme.length) }));
    i = idx + terme.length;
  }
  if (i < texte.length) frag.appendChild(document.createTextNode(texte.slice(i)));
  return frag;
}

export function initiales(nom, prenom = "") {
  return ((prenom[0] || "") + (nom[0] || "")).toUpperCase() || "?";
}

// Couleur stable dérivée d'une chaîne — pastilles d'avatar cohérentes
export function couleurDepuisTexte(texte) {
  let h2 = 0;
  for (const c of String(texte)) h2 = (h2 * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h2}, 55%, 45%)`;
}
