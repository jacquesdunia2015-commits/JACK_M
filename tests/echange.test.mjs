#!/usr/bin/env node
// tests/echange.test.mjs — sortir les données de QualiCode.
//
// L'export est la seule vraie sauvegarde d'un chercheur, et la seule porte de
// sortie vers Word, Excel, R, MAXQDA ou NVivo. Un fichier corrompu ne se
// découvre qu'au moment où l'on en a besoin — au dépôt du mémoire. Ces
// vérifications relisent donc chaque fichier produit comme le ferait le
// logiciel de destination.

import { installerTout, telechargements, texteDe } from "./faux-navigateur.mjs";
installerTout();

import { verifier, egal, memeContenu, titre, bilan } from "./aide.mjs";
import { lireZip, xmlBienForme, lireCsv, commenceParBom } from "./aide-fichiers.mjs";
const { state, emptyProject, normalizeProject, addDocument, addCode, addSegment, clearUndoHistory } =
  await import("../js/state.js");
const { flatCodes } = await import("../js/analysis.js");
const { t } = await import("../js/i18n.js");
const {
  exportProject, exportSegmentsCsv, exportCodeSystem, exportMatrixCsv, exportReportDocx,
} = await import("../js/export.js");
const { buildRefiQdpx } = await import("../js/refi.js");

/* ---------- Un projet d'essai qui contient tous les pièges ---------- */
state.project = emptyProject("Mémoire : « terrain » 2026 / v2");
clearUndoHistory();
state.project.memo = "Mémo du projet & remarques <importantes>.";
state.project.variables.push("sexe");
const doc1 = addDocument("Entretien 01", "Le travail de nuit est pénible.\nOn s'habitue, mais pas vraiment.");
const doc2 = addDocument("Entretien 02", "Les horaires changent chaque semaine.");
doc1.variables = { sexe: "Femme" };
doc2.variables = { sexe: "Homme" };
const parent = addCode("Conditions & pénibilité");
const enfant = addCode("Horaires", parent.id);
// Les bornes sont CALCULÉES à partir du texte : un décalage dans le jeu
// d'essai lui-même transformerait un vrai défaut en test au vert.
function coder(doc, code, extrait) {
  const i = doc.text.indexOf(extrait);
  if (i < 0) throw new Error("extrait introuvable dans le jeu d'essai : " + extrait);
  return addSegment(doc.id, code.id, i, i + extrait.length, extrait);
}
const seg1 = coder(doc1, parent, "Le travail de nuit est pénible.");
const seg2 = coder(doc1, enfant, "On s'habitue, mais pas vraiment.");
const seg3 = coder(doc2, enfant, "Les horaires changent chaque semaine.");
// Un commentaire qui contient les trois caractères qui cassent un CSV.
seg1.comment = 'Note ; avec "guillemets"\net retour à la ligne';

/* ================== Fichier projet (.projx) ================== */
titre("Export du projet (.projx) — la sauvegarde du chercheur");
exportProject();
const dernier = telechargements[telechargements.length - 1];
egal("le nom de fichier est assaini", dernier.nom, "Mémoire_terrain_2026_v2.projx");
const brut = await texteDe(".projx");
let relu = null;
try { relu = JSON.parse(brut); } catch { /* laissé à null */ }
verifier("le fichier est un JSON valide", relu !== null);
egal("le format est reconnaissable", relu.format, "qualicode-projx");
egal("les documents y sont", relu.documents.length, 2);
egal("les codes y sont", relu.codes.length, 2);
egal("les segments y sont", relu.segments.length, 3);
egal("le texte intégral est conservé", relu.documents[0].text, doc1.text);
egal("les variables sont conservées", relu.documents[0].variables.sexe, "Femme");
egal("le mémo est conservé", relu.memo, state.project.memo);
const rouvert = normalizeProject(relu);
egal("le fichier se rouvre sans perte", rouvert.segments.length, 3);
egal("les liens code ↔ segment survivent au voyage",
  rouvert.segments.filter(s => s.codeId === parent.id).length, 1);

/* ================== Segments codés (.csv) ================== */
titre("Export des segments codés (.csv)");
exportSegmentsCsv(state.project.segments);
const csv = await texteDe("_segments.csv");
const table = lireCsv(csv);
egal("une ligne d'en-tête et trois segments", table.length, 4);
egal("sept colonnes en en-tête", table[0].length, 7);
verifier("le séparateur est le point-virgule (Excel francophone)", csv.split("\r\n")[0].includes(";"));
verifier("les en-têtes sont traduits, pas laissés en clés",
  ![t("document"), t("code"), t("segment")].some(x => /^[a-z_]+$/.test(x)));
verifier("le fichier commence par un BOM pour Excel",
  await commenceParBom(telechargements[telechargements.length - 1].blob));

// Le champ piégé : point-virgule, guillemets ET saut de ligne dans le même
// commentaire. Mal échappé, il décale toutes les colonnes suivantes — et
// personne ne s'en aperçoit avant d'avoir compté les lignes dans Excel.
verifier("aucune ligne n'est décalée par l'échappement",
  table.every(r => r.length === 7), table.map(r => r.length).join(" / "));
egal("le commentaire piégé est restitué caractère pour caractère", table[1][4], seg1.comment);
egal("le texte du segment est exporté tel quel", table[1][2], seg1.text);
egal("le nom du document accompagne chaque segment", table[1][0], "Entretien 01");
egal("les bornes du segment sont exportées",
  [table[1][5], table[1][6]].join("-"), `${seg1.start}-${seg1.end}`);

/* ================== Système de codes (.csv) ================== */
titre("Export du système de codes (.csv)");
exportCodeSystem();
const codesCsv = (await texteDe("_codes.csv")).split("\r\n");
egal("une ligne par code", codesCsv.length, 3);
verifier("le code parent est au niveau 1", codesCsv[1].includes(";1;"));
verifier("le sous-code est au niveau 2", codesCsv[2].includes(";2;"));
verifier("le sous-code est indenté", /^"?\s{2}Horaires/.test(codesCsv[2]));
verifier("la fréquence du code parent est exacte", codesCsv[1].trim().endsWith(";1"));

/* ================== Matrice (.csv) ================== */
titre("Export de la matrice codes × documents (.csv)");
exportMatrixCsv();
const matCsv = (await texteDe("_matrice.csv")).split("\r\n");
verifier("les documents sont en colonnes",
  matCsv[0].includes("Entretien 01") && matCsv[0].includes("Entretien 02"));
egal("la ligne du code parent porte son total", matCsv[1].split(";").pop(), "1");
egal("la ligne du sous-code porte son total", matCsv[2].split(";").pop(), "2");

/* ================== Rapport Word (.docx) ================== */
titre("Rapport Word (.docx) — une vraie archive Office");
exportReportDocx(state.project.segments);
const docx = telechargements[telechargements.length - 1];
egal("le fichier porte le bon nom", docx.nom, "Mémoire_terrain_2026_v2_rapport.docx");
const zipDocx = await lireZip(docx.blob);
verifier("l'archive se relit intégralement", zipDocx.nombre > 0);
verifier("toutes les sommes de contrôle CRC sont justes", zipDocx.crcValides);
verifier("le corps du document est présent", zipDocx.entrees.has("word/document.xml"));
verifier("le type de contenu est déclaré", zipDocx.entrees.has("[Content_Types].xml"));
verifier("la relation racine est déclarée", zipDocx.entrees.has("_rels/.rels"));
const corpsDocx = zipDocx.entrees.get("word/document.xml");
egal("le XML du document est bien formé", xmlBienForme(corpsDocx), null);
verifier("le titre du projet y figure", corpsDocx.includes("Mémoire"));
verifier("les caractères réservés sont échappés", corpsDocx.includes("Conditions &amp; pénibilité"));
verifier("un extrait codé y figure", corpsDocx.includes("Le travail de nuit est pénible."));

/* ================== REFI-QDA (.qdpx) ================== */
titre("Export REFI-QDA (.qdpx) — passerelle vers MAXQDA, NVivo, ATLAS.ti");
const qdpx = await lireZip(buildRefiQdpx(state.project));
verifier("toutes les sommes de contrôle CRC sont justes", qdpx.crcValides);
verifier("le projet XML est présent", qdpx.entrees.has("project.qde"));
const qde = qdpx.entrees.get("project.qde");
egal("le XML du projet est bien formé", xmlBienForme(qde), null);
verifier("l'espace de noms du standard est déclaré", qde.includes('xmlns="urn:QDA-XML:project:1.0"'));

const guids = [...qde.matchAll(/guid="([^"]*)"/g)].map(m => m[1]);
verifier("tous les GUID respectent le format hexadécimal exigé",
  guids.length > 0 && guids.every(g => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(g)),
  guids.find(g => !/^[0-9a-f-]{36}$/.test(g)) || "");
verifier("les GUID sont uniques", new Set(guids).size === guids.length);

verifier("la hiérarchie des codes est imbriquée",
  /<Code [^>]*name="Conditions &amp; pénibilité"[^>]*>\s*<Code [^>]*name="Horaires"/.test(qde));
verifier("la variable déclarée est présente", qde.includes('name="sexe"'));
verifier("sa valeur est rattachée à un cas", qde.includes("<TextValue>Femme</TextValue>"));

// Chaque source annonce un fichier texte : s'il manque de l'archive, MAXQDA
// ouvre le projet avec des documents vides — et tous les codages décalés.
const chemins = [...qde.matchAll(/plainTextPath="internal:\/\/([^"]+)"/g)].map(m => m[1]);
egal("un fichier source est annoncé par document", chemins.length, 2);
verifier("chaque fichier annoncé est réellement dans l'archive",
  chemins.every(c => qdpx.entrees.has(c)), chemins.filter(c => !qdpx.entrees.has(c)).join(", "));
egal("le texte du premier entretien est intact dans l'archive",
  qdpx.entrees.get(chemins[0]), doc1.text);

// Le point le plus fragile de tout l'export : les bornes de codage. Si elles
// se décalent d'un caractère, chaque citation importée est fausse.
const selections = [...qde.matchAll(/startPosition="(\d+)" endPosition="(\d+)"/g)]
  .map(m => [Number(m[1]), Number(m[2])]);
egal("les trois codages sont exportés", selections.length, 3);
const texteSource = qdpx.entrees.get(chemins[0]);
egal("le premier codage désigne exactement le bon passage",
  texteSource.slice(selections[0][0], selections[0][1]), seg1.text);
egal("le deuxième aussi", texteSource.slice(selections[1][0], selections[1][1]), seg2.text);
egal("le troisième, dans l'autre document, aussi",
  qdpx.entrees.get(chemins[1]).slice(selections[2][0], selections[2][1]), seg3.text);

verifier("le mémo du projet devient une note", qde.includes("Mémo du projet &amp; remarques &lt;importantes&gt;."));

titre("Cas limites de l'export");
state.project = emptyProject("Projet vide");
clearUndoHistory();
const vide = await lireZip(buildRefiQdpx(state.project));
verifier("un projet vide produit une archive valide", vide.entrees.has("project.qde"));
egal("son XML reste bien formé", xmlBienForme(vide.entrees.get("project.qde")), null);
exportSegmentsCsv([]);
egal("un export sans segment ne produit que l'en-tête",
  lireCsv(await texteDe("_segments.csv")).length, 1);

bilan("Exports et interopérabilité");
