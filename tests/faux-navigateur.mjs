// tests/faux-navigateur.mjs — le strict minimum de navigateur pour exécuter
// la logique de QualiCode sous Node.
//
// Ce n'est pas une émulation : c'est une doublure des trois seules choses que
// le code demande au navigateur hors interface — le stockage local, IndexedDB
// et le déclenchement d'un téléchargement. Tout le reste (DOM, rendu, events)
// est vérifié dans le vrai navigateur par tests/navigateur.html.
//
// IndexedDB est doublé avec `structuredClone`, exactement comme le fait un
// navigateur : ce qui est écrit est une COPIE. Sans cela, un test pourrait
// passer au vert en relisant l'objet vivant en mémoire alors que rien n'a
// jamais été réellement enregistré.

/* ---------- localStorage ---------- */
export function installerStockageLocal() {
  const carte = new Map();
  globalThis.localStorage = {
    get length() { return carte.size; },
    key: i => [...carte.keys()][i] ?? null,
    getItem: k => (carte.has(String(k)) ? carte.get(String(k)) : null),
    setItem: (k, v) => { carte.set(String(k), String(v)); },
    removeItem: k => { carte.delete(String(k)); },
    clear: () => carte.clear(),
  };
  return globalThis.localStorage;
}

/* ---------- IndexedDB ---------- */
class Requete {
  constructor() { this.onsuccess = null; this.onerror = null; this.onupgradeneeded = null; this.result = null; this.error = null; }
}

/** Contrôle des pannes simulées : quota dépassé, disque plein, base fermée. */
export const panneStockage = { ecriture: null, lecture: null };

export function installerIndexedDB() {
  const bases = new Map(); // nom → Map(magasin → Map(clé → valeur))

  const fabriquerMagasin = (donnees, tx) => ({
    put(valeur, cle) {
      const rq = new Requete();
      if (panneStockage.ecriture) { tx._erreur = new Error(panneStockage.ecriture); return rq; }
      try { donnees.set(String(cle), structuredClone(valeur)); }
      catch (e) { tx._erreur = e; }
      return rq;
    },
    get(cle) {
      const rq = new Requete();
      queueMicrotask(() => {
        if (panneStockage.lecture) {
          rq.error = new Error(panneStockage.lecture);
          if (rq.onerror) rq.onerror({ target: rq });
          return;
        }
        const v = donnees.get(String(cle));
        rq.result = v === undefined ? undefined : structuredClone(v);
        if (rq.onsuccess) rq.onsuccess({ target: rq });
      });
      return rq;
    },
    delete(cle) {
      const rq = new Requete();
      if (panneStockage.ecriture) { tx._erreur = new Error(panneStockage.ecriture); return rq; }
      donnees.delete(String(cle));
      return rq;
    },
  });

  globalThis.indexedDB = {
    open(nom) {
      const rq = new Requete();
      queueMicrotask(() => {
        const neuve = !bases.has(nom);
        if (neuve) bases.set(nom, new Map());
        const magasins = bases.get(nom);
        const db = {
          createObjectStore(nomMagasin) {
            magasins.set(nomMagasin, new Map());
            return fabriquerMagasin(magasins.get(nomMagasin), {});
          },
          transaction(nomMagasin) {
            const tx = { oncomplete: null, onerror: null, error: null, _erreur: null };
            tx.objectStore = n => {
              if (!magasins.has(n)) throw new Error("magasin inconnu : " + n);
              return fabriquerMagasin(magasins.get(n), tx);
            };
            // Le navigateur termine la transaction après le bloc synchrone en
            // cours : les gestionnaires posés juste après `put()` sont donc
            // bien en place quand elle se conclut.
            queueMicrotask(() => {
              if (tx._erreur) { tx.error = tx._erreur; if (tx.onerror) tx.onerror({ target: tx }); }
              else if (tx.oncomplete) tx.oncomplete({ target: tx });
            });
            return tx;
          },
          close() {},
        };
        rq.result = db;
        if (neuve && rq.onupgradeneeded) rq.onupgradeneeded({ target: rq });
        if (rq.onsuccess) rq.onsuccess({ target: rq });
      });
      return rq;
    },
  };
  return { bases, vider: () => bases.clear() };
}

/* ---------- Téléchargements ---------- */
/** Fichiers « téléchargés » pendant le test : [{ nom, blob }]. */
export const telechargements = [];

export function installerTelechargements() {
  telechargements.length = 0;
  const corps = { appendChild() {}, removeChild() {} };
  globalThis.document = {
    body: corps,
    documentElement: { lang: "fr", dir: "ltr" },
    createElement() {
      return {
        href: "", download: "", style: {},
        click() { telechargements.push({ nom: this.download, blob: fichiers.get(this.href) }); },
        remove() {},
      };
    },
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null,
  };
  const fichiers = new Map();
  let n = 0;
  globalThis.URL.createObjectURL = blob => { const u = "blob:test/" + (++n); fichiers.set(u, blob); return u; };
  globalThis.URL.revokeObjectURL = u => { fichiers.delete(u); };
  return telechargements;
}

/** Contenu texte du dernier fichier téléchargé (BOM Excel retiré). */
export async function dernierTexte() {
  const d = telechargements[telechargements.length - 1];
  if (!d || !d.blob) return "";
  return (await d.blob.text()).replace(/^﻿/, "");
}

/** Contenu du fichier téléchargé portant ce suffixe de nom. */
export async function texteDe(suffixe) {
  const d = [...telechargements].reverse().find(x => x.nom.endsWith(suffixe));
  if (!d || !d.blob) return "";
  return (await d.blob.text()).replace(/^﻿/, "");
}

/** Installe tout d'un coup. À appeler AVANT d'importer les modules testés. */
export function installerTout() {
  installerStockageLocal();
  const idb = installerIndexedDB();
  installerTelechargements();
  // Node expose déjà `navigator` en lecture seule : on ne le remplace pas.
  return idb;
}
