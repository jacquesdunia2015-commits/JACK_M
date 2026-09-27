#!/usr/bin/env node
// tests/codage.test.mjs — le geste quotidien du chercheur.
//
// Importer un entretien, créer un code, surligner un passage, se tromper,
// annuler, supprimer, restaurer. Ce sont les opérations répétées des centaines
// de fois pendant une collecte : une erreur ici se paie en heures de recodage.

import { installerTout } from "./faux-navigateur.mjs";
installerTout();

import { verifier, egal, memeContenu, titre, bilan } from "./aide.mjs";
const {
  state, emptyProject, CODE_COLORS,
  addDocument, addGroup, addCode, addSegment, deleteSegment,
  trashDocument, trashCode, restoreTrashedDoc, restoreTrashedCode,
  segmentsOfCode, segmentsOfDoc, codeWithDescendants, childCodes,
  undoAction, redoAction, canUndo, canRedo, clearUndoHistory,
  upsertMemo, getMemo, saveQuery, deleteQuery, getDoc, getCode,
} = await import("../js/state.js");

const neuf = () => { state.project = emptyProject("Essai"); clearUndoHistory(); };

/* ================== Création ================== */
titre("Création des documents, groupes et codes");
neuf();
const groupe = addGroup("Entretiens directeurs");
const d1 = addDocument("Entretien 01", "Ligne un.\nLigne deux.\nLigne trois.", groupe.id);
const d2 = addDocument("Entretien 02", "Autre entretien complet.");

egal("le document est rattaché à son groupe", d1.groupId, groupe.id);
egal("un document sans groupe reste à la racine", d2.groupId, null);
verifier("chaque document porte un identifiant distinct", d1.id !== d2.id);
memeContenu("un document neuf n'a pas de variables", d1.variables, {});

const parent = addCode("Conditions de travail");
const enfant = addCode("Horaires", parent.id);
const petitEnfant = addCode("Nuit", enfant.id);
const autre = addCode("Rémunération");

egal("le code enfant connaît son parent", enfant.parentId, parent.id);
egal("les couleurs sont attribuées dans l'ordre du nuancier", parent.color, CODE_COLORS[0]);
verifier("deux codes voisins n'ont pas la même couleur", parent.color !== enfant.color);
egal("les enfants directs sont retrouvés", childCodes(parent.id).length, 1);
memeContenu("la descendance complète est retrouvée",
  codeWithDescendants(parent.id), [parent.id, enfant.id, petitEnfant.id]);

/* ================== Codage ================== */
titre("Codage de segments");
const s1 = addSegment(d1.id, parent.id, 0, 9, "Ligne un.");
const s2 = addSegment(d1.id, enfant.id, 10, 21, "Ligne deux.");
const s3 = addSegment(d2.id, petitEnfant.id, 0, 5, "Autre");

egal("trois segments sont enregistrés", state.project.segments.length, 3);
egal("un segment neuf a un poids de 1", s1.weight, 1);

const doublon = addSegment(d1.id, parent.id, 0, 9, "Ligne un.");
egal("coder deux fois le même passage ne crée pas de doublon", state.project.segments.length, 3);
egal("le segment existant est renvoyé tel quel", doublon.id, s1.id);

const chevauchant = addSegment(d1.id, parent.id, 0, 21, "Ligne un.\nLigne deux.");
verifier("un passage plus large est bien un nouveau segment", chevauchant.id !== s1.id);
egal("quatre segments désormais", state.project.segments.length, 4);
deleteSegment(chevauchant.id);

memeContenu("les segments d'un code sont retrouvés",
  segmentsOfCode(parent.id).map(s => s.id), [s1.id]);
memeContenu("avec ses sous-codes, la remontée est complète",
  segmentsOfCode(parent.id, true).map(s => s.id), [s1.id, s2.id, s3.id]);
memeContenu("les segments d'un document sont retrouvés",
  segmentsOfDoc(d1.id).map(s => s.id), [s1.id, s2.id]);

/* ================== Annuler / rétablir ================== */
titre("Annuler et rétablir");
neuf();
const doc = addDocument("Entretien", "Un texte d'entretien assez long pour être codé.");
const code = addCode("Thème");
const seg = addSegment(doc.id, code.id, 0, 8, "Un texte");
egal("trois actions sont annulables", canUndo(), true);

undoAction();
egal("annuler retire le dernier segment", state.project.segments.length, 0);
egal("le document et le code sont toujours là", state.project.documents.length + state.project.codes.length, 2);
verifier("le rétablissement est proposé", canRedo() === true);

redoAction();
egal("rétablir remet le segment", state.project.segments.length, 1);
egal("le segment rétabli est bien le même", state.project.segments[0].id, seg.id);

undoAction(); undoAction();
egal("deux annulations retirent aussi le code", state.project.codes.length, 0);
egal("le document survit", state.project.documents.length, 1);
egal("le texte du document est intact après annulation",
  state.project.documents[0].text, "Un texte d'entretien assez long pour être codé.");

undoAction();
egal("une troisième annulation retire le document", state.project.documents.length, 0);
egal("plus rien à annuler", canUndo(), false);
egal("annuler dans le vide ne casse rien", undoAction(), false);

// Une nouvelle action après une annulation efface la pile de rétablissement :
// sans cela, « rétablir » réinjecterait un état incompatible avec le présent.
redoAction();
addCode("Code frais");
egal("une action neuve annule le rétablissement en attente", canRedo(), false);

titre("Profondeur de l'historique");
neuf();
for (let i = 0; i < 45; i++) addCode("Code " + i);
let annulations = 0;
while (undoAction()) annulations++;
egal("l'historique est borné à 30 pas", annulations, 30);
egal("les 15 codes les plus anciens restent en place", state.project.codes.length, 15);

/* ================== Corbeille ================== */
titre("Corbeille : supprimer sans perdre");
neuf();
const dA = addDocument("À supprimer", "Texte A à coder.");
const dB = addDocument("À garder", "Texte B à coder.");
const cA = addCode("Code A");
const cB = addCode("Code B");
addSegment(dA.id, cA.id, 0, 6, "Texte ");
addSegment(dA.id, cB.id, 6, 12, "A à co");
addSegment(dB.id, cA.id, 0, 6, "Texte ");

trashDocument(dA.id);
egal("le document quitte la liste", state.project.documents.length, 1);
egal("ses segments partent avec lui", state.project.segments.length, 1);
egal("les segments des autres documents restent", state.project.segments[0].docId, dB.id);
egal("le document est dans la corbeille", state.project.trash.documents.length, 1);
egal("ses segments y sont conservés", state.project.trash.documents[0].segments.length, 2);

restoreTrashedDoc(0);
egal("le document revient", state.project.documents.length, 2);
egal("ses deux segments reviennent avec lui", segmentsOfDoc(dA.id).length, 2);
egal("la corbeille est vidée de cette entrée", state.project.trash.documents.length, 0);

// Cas piégeux : le code a été supprimé pendant que le document dormait dans la
// corbeille. Restaurer un segment qui pointe vers un code disparu laisserait un
// codage fantôme, invisible dans l'arbre mais compté dans les matrices.
trashDocument(dA.id);
trashCode(cB.id);
restoreTrashedDoc(0);
egal("le document revient encore", state.project.documents.length, 2);
egal("seul le segment dont le code existe encore est restauré", segmentsOfDoc(dA.id).length, 1);
verifier("aucun codage orphelin n'est réintroduit",
  state.project.segments.every(s => state.project.codes.some(c => c.id === s.codeId)));

titre("Corbeille : suppression d'un code et de sa descendance");
neuf();
const racine = addCode("Racine");
const fils = addCode("Fils", racine.id);
const doc2 = addDocument("Doc", "Un texte pour coder ici même.");
addSegment(doc2.id, racine.id, 0, 2, "Un");
addSegment(doc2.id, fils.id, 3, 8, "texte");

trashCode(racine.id);
egal("le code et son enfant partent ensemble", state.project.codes.length, 0);
egal("leurs segments partent aussi", state.project.segments.length, 0);
restoreTrashedCode(0);
egal("les deux codes reviennent", state.project.codes.length, 2);
egal("les deux segments reviennent", state.project.segments.length, 2);
verifier("la hiérarchie est reconstituée", getCode(fils.id).parentId === racine.id);

/* ================== Mémos et requêtes ================== */
titre("Mémos et requêtes sauvegardées");
neuf();
const docM = addDocument("Doc", "Texte.");
upsertMemo("document", docM.id, "Première impression.", "Terrain");
egal("le mémo est créé", state.project.memos.length, 1);
upsertMemo("document", docM.id, "Impression corrigée.");
egal("le mémo est mis à jour, pas dupliqué", state.project.memos.length, 1);
egal("le nouveau texte est pris en compte", getMemo("document", docM.id).text, "Impression corrigée.");
egal("le titre existant est conservé", getMemo("document", docM.id).title, "Terrain");
egal("un mémo inexistant renvoie undefined", getMemo("code", "inconnu"), undefined);

const req = saveQuery("Femmes × pénibilité", new Set([docM.id]), new Set(["c1", "c2"]), "and");
egal("la requête est enregistrée", state.project.savedQueries.length, 1);
memeContenu("les ensembles sont convertis en listes", req.activatedCodes, ["c1", "c2"]);
egal("le mode de recherche est conservé", req.retrievalMode, "and");
deleteQuery(req.id);
egal("la requête est supprimée", state.project.savedQueries.length, 0);

bilan("Codage");
