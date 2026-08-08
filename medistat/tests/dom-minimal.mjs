// medistat/tests/dom-minimal.mjs
// Bac à sable DOM minimal, juste assez pour exécuter le constructeur
// d'éléments et le constructeur de formulaires hors navigateur.
//
// Ce n'est pas une implémentation du DOM et cela n'a pas vocation à le
// devenir : pas de mise en page, pas de style calculé, pas d'événements
// remontants. C'est le strict nécessaire pour vérifier la logique des
// formulaires — quels contrôles sont enregistrés, quelles valeurs sont
// relues — sans embarquer de dépendance.
//
// Une dépendance de plus, dans un projet médical, c'est une surface
// d'attaque de plus et une mise à jour de plus à suivre. Soixante lignes
// écrites ici coûtent moins cher.

class Noeud {
  constructor() { this.childNodes = []; this.parentNode = null; }
  appendChild(enfant) {
    enfant.parentNode = this;
    this.childNodes.push(enfant);
    return enfant;
  }
  get children() { return this.childNodes.filter(n => n instanceof Element); }
}

class TexteNoeud extends Noeud {
  constructor(texte) { super(); this.nodeValue = String(texte); }
  get textContent() { return this.nodeValue; }
}

class ListeClasses {
  constructor() { this._ = new Set(); }
  add(c) { if (c) this._.add(c); }
  remove(c) { this._.delete(c); }
  contains(c) { return this._.has(c); }
  toggle(c) { this._.has(c) ? this._.delete(c) : this._.add(c); }
  get value() { return [...this._].join(" "); }
}

class Element extends Noeud {
  constructor(balise) {
    super();
    this.tagName = String(balise).toUpperCase();
    this.classList = new ListeClasses();
    this.dataset = {};
    this.style = {};
    this.attributes = {};
    this.ecouteurs = {};
    this._texte = "";
    this._value = "";
    this.checked = false;
    this.disabled = false;
    this.hidden = false;
    this.selected = false;
    this.id = "";
  }

  // Un navigateur convertit toujours `value` en chaîne : sans cela, un
  // champ numérique alimenté par un nombre casse `valeurs()`, qui appelle
  // `trim()` dessus. Reproduire cette conversion évite un faux vert.
  set value(v) {
    this._value = v === null || v === undefined ? "" : String(v);
    // Affecter la valeur d'une liste déroulante y sélectionne l'option
    // correspondante, comme le fait un navigateur.
    if (this.tagName === "SELECT") {
      for (const o of this.descendants()) {
        if (o.tagName === "OPTION") o.selected = o.value === this._value;
      }
    }
  }
  get value() {
    // La valeur d'une liste déroulante est celle de son option sélectionnée,
    // pas une propriété indépendante. Sans cette règle, un formulaire rouvert
    // sur des données existantes renverrait une chaîne vide et l'écran de
    // paramétrage perdrait silencieusement chaque liste à l'enregistrement.
    if (this.tagName === "SELECT") {
      const options = this.descendants().filter(o => o.tagName === "OPTION");
      const choisie = options.find(o => o.selected) || options[0];
      return choisie ? choisie.value : "";
    }
    return this._value;
  }

  setAttribute(nom, valeur) {
    this.attributes[nom] = String(valeur);
    // `type` et `name` sont lus comme propriétés par le code testé.
    if (nom === "type" || nom === "name" || nom === "placeholder") this[nom] = String(valeur);
  }
  getAttribute(nom) { return nom in this.attributes ? this.attributes[nom] : null; }
  hasAttribute(nom) { return nom in this.attributes; }
  removeAttribute(nom) { delete this.attributes[nom]; }
  addEventListener(type, f) { (this.ecouteurs[type] ||= []).push(f); }
  removeEventListener(type, f) {
    this.ecouteurs[type] = (this.ecouteurs[type] || []).filter(g => g !== f);
  }
  // Déclenchement synchrone, sans propagation : suffisant pour vérifier
  // qu'un gestionnaire est bien branché.
  dispatchEvent(evenement) {
    for (const f of this.ecouteurs[evenement.type] || []) f.call(this, evenement);
    return true;
  }

  set textContent(v) { this._texte = String(v); this.childNodes = []; }
  get textContent() {
    if (this._texte) return this._texte;
    return this.childNodes.map(n => n.textContent).join("");
  }

  // `innerHTML` n'est jamais interprété : le seul usage utile en test est de
  // vérifier qu'aucune balise n'a été injectée par du texte.
  set innerHTML(v) { this._html = String(v); }
  get innerHTML() {
    if (this._html !== undefined) return this._html;
    return this.childNodes
      .map(n => n instanceof Element ? `<${n.tagName.toLowerCase()}>` : n.textContent)
      .join("");
  }

  descendants() {
    const out = [];
    for (const enfant of this.children) { out.push(enfant, ...enfant.descendants()); }
    return out;
  }

  // Sélecteurs pris en charge : balise, `.classe`, `#id`, `[attribut]`,
  // `input:checked` et les listes séparées par des virgules. Cela couvre
  // tout ce que ui.js utilise.
  querySelectorAll(selecteur) {
    const motifs = String(selecteur).split(",").map(s => s.trim()).filter(Boolean);
    return this.descendants().filter(el => motifs.some(m => correspond(el, m)));
  }
  querySelector(selecteur) { return this.querySelectorAll(selecteur)[0] || null; }
}

function correspond(el, motif) {
  const pseudoCoche = motif.endsWith(":checked");
  if (pseudoCoche) { motif = motif.slice(0, -":checked".length); if (!el.checked) return false; }
  const attribut = motif.match(/^([^[]*)\[([^\]=]+)(?:="?([^"\]]*)"?)?\]$/);
  if (attribut) {
    const [, base, nom, valeur] = attribut;
    if (base && !correspond(el, base)) return false;
    if (!(nom in el.attributes)) return false;
    return valeur === undefined || el.attributes[nom] === valeur;
  }
  if (motif.startsWith(".")) return el.classList.contains(motif.slice(1));
  if (motif.startsWith("#")) return el.id === motif.slice(1);
  if (motif === "*" || motif === "") return true;
  return el.tagName === motif.toUpperCase();
}

export function installerDOM() {
  if (typeof globalThis.document !== "undefined" && globalThis.document.createElement) return;
  const racine = new Element("body");
  globalThis.Node = Noeud;
  globalThis.Element = Element;
  globalThis.document = {
    body: racine,
    documentElement: new Element("html"),
    createElement: b => new Element(b),
    createTextNode: t => new TexteNoeud(t),
    querySelector: s => racine.querySelector(s),
    querySelectorAll: s => racine.querySelectorAll(s),
    addEventListener() {},
    activeElement: null,
  };
  return globalThis.document;
}
