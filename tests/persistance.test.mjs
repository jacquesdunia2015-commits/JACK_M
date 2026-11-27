#!/usr/bin/env node
// tests/persistance.test.mjs — la suite qui compte le plus.
//
// Tout le reste de QualiCode peut se réparer ; un corpus perdu, non. Ces
// vérifications portent donc sur une seule question : ce que l'utilisateur a
// saisi se retrouve-t-il intact au rechargement, et l'application prévient-elle
// quand ce n'est pas le cas ?

import { installerTout, panneStockage } from "./faux-navigateur.mjs";
installerTout(); // AVANT l'import des modules : ils lisent le stockage au chargement.

import { verifier, egal, memeContenu, titre, bilan } from "./aide.mjs";
const S = await import("../js/state.js");
const {
  state, emptyProject, normalizeProject, persistNow, loadPersisted, loadProjectById,
  listProjects, deleteProjectById, addDocument, addCode, addSegment,
  demanderStockageDurable, estimationStockage, setOnSaveError, setOnSaved,
} = S;

/* ================== 1. Aller-retour élémentaire ================== */
titre("Aller-retour d'un projet complet");

state.project = emptyProject("Mémoire — terrain 2026");
const doc = addDocument("Entretien 01 — Marie", "Je travaille ici depuis dix ans.\nC'est difficile.");
const code = addCode("Ancienneté");
const seg = addSegment(doc.id, code.id, 0, 31, "Je travaille ici depuis dix ans.");
state.project.variables.push("sexe");
doc.variables.sexe = "F";
state.project.memo = "Premier terrain, avril.";

const okSauvegarde = await persistNow();
verifier("l'enregistrement rend la main sans erreur", okSauvegarde !== false);

const relu = await loadProjectById(state.project.id);
verifier("le projet est relu depuis IndexedDB", !!relu);
egal("le nom est conservé", relu.name, "Mémoire — terrain 2026");
egal("le document est conservé", relu.documents.length, 1);
egal("le texte du document est intact", relu.documents[0].text, doc.text);
egal("la variable du document est conservée", relu.documents[0].variables.sexe, "F");
egal("le code est conservé", relu.codes[0].name, "Ancienneté");
egal("le segment est conservé", relu.segments.length, 1);
egal("le segment pointe le bon document", relu.segments[0].docId, doc.id);
memeContenu("les bornes du segment sont exactes",
  [relu.segments[0].start, relu.segments[0].end], [seg.start, seg.end]);
egal("le mémo de projet est conservé", relu.memo, "Premier terrain, avril.");

/* ================== 2. Ce qui est écrit est une copie ================== */
titre("Indépendance de la copie enregistrée");
// Si la base conservait une référence vivante, une modification NON enregistrée
// se retrouverait quand même au rechargement — et, symétriquement, une
// sauvegarde apparemment réussie pourrait ne rien avoir écrit du tout.
state.project.name = "Renommé sans enregistrer";
const relu2 = await loadProjectById(state.project.id);
egal("une modification non enregistrée n'atteint pas la base", relu2.name, "Mémoire — terrain 2026");
state.project.name = "Mémoire — terrain 2026";

/* ================== 3. Index de la bibliothèque ================== */
titre("Index de la bibliothèque de projets");
await persistNow();
const index = listProjects();
egal("le projet figure dans l'index", index[0].id, state.project.id);
egal("l'index compte les documents", index[0].documents, 1);
egal("l'index compte les segments", index[0].segments, 1);
verifier("l'index porte une date de modification", !!Date.parse(index[0].modified));

/* ================== 4. Plusieurs projets coexistent ================== */
titre("Plusieurs projets");
const idPremier = state.project.id;
state.project = emptyProject("Second terrain");
addDocument("Entretien 02", "Autre entretien.");
await persistNow();
const idSecond = state.project.id;

verifier("les deux projets ont des identifiants distincts", idPremier !== idSecond);
egal("l'index contient deux projets", listProjects().length, 2);
egal("le plus récent est en tête", listProjects()[0].id, idSecond);
const premier = await loadProjectById(idPremier);
egal("le premier projet est toujours lisible", premier.name, "Mémoire — terrain 2026");
egal("les projets ne se mélangent pas", premier.documents[0].name, "Entretien 01 — Marie");

/* ================== 5. Redémarrage de l'application ================== */
titre("Redémarrage : le travail est retrouvé");
state.project = emptyProject("projet vide de démarrage");
const retrouve = await loadPersisted();
verifier("un projet est retrouvé au démarrage", retrouve === true);
egal("c'est le dernier projet ouvert", state.project.id, idSecond);
egal("son contenu est intact", state.project.documents[0].text, "Autre entretien.");

/* ================== 6. Migration des anciens projets ================== */
titre("Migration des projets enregistrés par les anciennes versions");
const ancien = normalizeProject({
  format: "qualicode-projx", version: 1, id: "ancien-projet",
  name: "Projet de 2025", documents: [{ id: "d1", name: "Vieux doc", text: "Texte ancien", variables: {} }],
  codes: [], segments: [],
});
localStorage.setItem("qualicode.project", JSON.stringify(ancien));
state.project = emptyProject("vide");
await loadPersisted();
egal("l'ancienne clé localStorage a été vidée", localStorage.getItem("qualicode.project"), null);
const migre = await loadProjectById("ancien-projet");
verifier("l'ancien projet est désormais dans IndexedDB", !!migre);
egal("son contenu a survécu à la migration", migre.documents[0].text, "Texte ancien");
egal("il est devenu le projet courant", state.project.id, "ancien-projet");

/* ================== 7. Suppression ================== */
titre("Suppression d'un projet");
deleteProjectById("ancien-projet");
verifier("il disparaît de l'index", !listProjects().some(e => e.id === "ancien-projet"));
await new Promise(r => queueMicrotask(r));
egal("il disparaît de la base", await loadProjectById("ancien-projet"), null);
const restant = await loadProjectById(idPremier);
verifier("les autres projets sont intacts", !!restant && restant.documents.length === 1);

/* ================== 8. Réparation d'un fichier incomplet ================== */
titre("Projet incomplet ou venu d'une autre version");
const repare = normalizeProject({ format: "qualicode-projx", name: "Bancal", documents: [], codes: [] });
verifier("un identifiant est attribué", !!repare.id);
memeContenu("la corbeille est reconstruite", repare.trash, { documents: [], codes: [] });
memeContenu("les listes manquantes sont créées",
  [repare.memos, repare.variables, repare.savedQueries, repare.conceptMaps, repare.bibliography],
  [[], [], [], [], []]);
egal("les segments manquants deviennent une liste vide", repare.segments.length, 0);

/* ================== 9. Corpus réaliste de mémoire ================== */
titre("Corpus de la taille d'un mémoire");
state.project = emptyProject("Corpus complet");
const codes = Array.from({ length: 40 }, (_, i) => addCode("Code " + i));
for (let d = 0; d < 60; d++) {
  const texte = ("Paragraphe d'entretien numéro " + d + ". ").repeat(400); // ≈ 13 000 caractères
  const dd = addDocument("Entretien " + String(d + 1).padStart(2, "0"), texte);
  for (let k = 0; k < 50; k++) {
    addSegment(dd.id, codes[k % codes.length].id, k * 60, k * 60 + 40, texte.slice(k * 60, k * 60 + 40));
  }
}
const octets = JSON.stringify(state.project).length;
const debut = Date.now();
await persistNow();
const dureeEcriture = Date.now() - debut;
const gros = await loadProjectById(state.project.id);
egal("60 entretiens sont relus", gros.documents.length, 60);
egal("3 000 segments sont relus", gros.segments.length, 3000);
egal("40 codes sont relus", gros.codes.length, 40);
egal("le texte du dernier entretien est intact",
  gros.documents[59].text.length, state.project.documents[59].text.length);
verifier(`l'enregistrement d'un corpus de ${(octets / 1e6).toFixed(1)} Mo reste rapide (${dureeEcriture} ms)`,
  dureeEcriture < 3000, `durée mesurée : ${dureeEcriture} ms`);

/* ================== 10. Une sauvegarde qui échoue doit se voir ================== */
titre("Échec de sauvegarde : l'utilisateur doit être prévenu");
// C'est le scénario noir du travail de terrain : le disque sature, le
// navigateur refuse d'écrire, et l'utilisateur continue de coder pendant une
// heure en croyant son travail enregistré. Le silence est ici le vrai défaut.
let alerte = null;
setOnSaveError(e => { alerte = e; });
let sauvegardeAnnoncee = null;
setOnSaved(() => { sauvegardeAnnoncee = true; });

panneStockage.ecriture = "QuotaExceededError";
sauvegardeAnnoncee = null;
const journal = console.error;
console.error = () => {}; // la panne est voulue : on n'encombre pas la sortie
const resultat = await persistNow();
console.error = journal;
panneStockage.ecriture = null;

verifier("l'échec d'écriture déclenche une alerte", alerte !== null);
egal("persistNow signale l'échec à l'appelant", resultat, false);
verifier("l'échec n'est PAS annoncé comme une sauvegarde réussie", sauvegardeAnnoncee === null);
verifier("le projet reste marqué comme non enregistré", state.ui.dirty === true);
setOnSaveError(null);
setOnSaved(null);

// …et la sauvegarde suivante doit repartir normalement.
const apres = await persistNow();
verifier("une fois la panne passée, l'enregistrement reprend", apres !== false);
egal("le projet est de nouveau marqué enregistré", state.ui.dirty, false);

/* ================== 11. Stockage durable ================== */
titre("Demande de stockage durable");
const sansApi = await demanderStockageDurable();
memeContenu("sans l'API, la demande échoue proprement", sansApi, { supporte: false, accorde: false });
egal("l'estimation renvoie null sans l'API", await estimationStockage(), null);

Object.defineProperty(navigator, "storage", {
  configurable: true,
  value: {
    persisted: async () => false,
    persist: async () => true,
    estimate: async () => ({ usage: 1234, quota: 5e9 }),
  },
});
memeContenu("le navigateur accorde le stockage durable",
  await demanderStockageDurable(), { supporte: true, accorde: true });
memeContenu("l'espace occupé est remonté",
  await estimationStockage(), { utilise: 1234, quota: 5e9 });

Object.defineProperty(navigator, "storage", {
  configurable: true,
  value: { persisted: async () => { throw new Error("refus"); } },
});
memeContenu("une API capricieuse ne fait pas planter le démarrage",
  await demanderStockageDurable(), { supporte: false, accorde: false });

bilan("Persistance");
