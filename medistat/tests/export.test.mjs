#!/usr/bin/env node
// medistat/tests/export.test.mjs
// Contrôles de la couche d'export et d'interopérabilité (articles 8.3 et 18) :
// CSV, Excel XLSX, PDF et HL7 FHIR R4.
//
// Les fichiers produits sont écrits dans tests/sorties/ afin de pouvoir être
// ouverts et vérifiés à la main dans Excel, LibreOffice ou un lecteur PDF.
// Lancement :  node tests/export.test.mjs

import * as E from "../js/core/export.js";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ici = dirname(fileURLToPath(import.meta.url));
const sorties = join(ici, "sorties");
mkdirSync(sorties, { recursive: true });

let passed = 0, failed = 0;
const failures = [];
const t = (nom, condition, detail = "") => {
  if (condition) passed++;
  else { failed++; failures.push(nom + (detail ? `\n     ${detail}` : "")); }
};
const section = titre => console.log(`\n\x1b[1m── ${titre}\x1b[0m`);

/* ===================================================================== */
section("CSV — aller-retour et cas limites");

{
  // Les trois pièges classiques : séparateur, guillemets et saut de ligne
  const lignes = [
    { nom: "Tshibangu; Alice", age: 36, note: 'dit "bonjour"' },
    { nom: "Kabeya", age: 52, note: "ligne\nmultiple" },
    { nom: "Résultat élevé", age: null, note: "" },
  ];
  const csv = E.versCSV(lignes);
  const relu = E.depuisCSV(csv);
  t("entêtes préservés", JSON.stringify(relu.entetes) === JSON.stringify(["nom", "age", "note"]));
  t("séparateur point-virgule détecté", relu.separateur === ";");
  t("point-virgule dans une valeur échappé", relu.objets[0].nom === "Tshibangu; Alice");
  t("guillemets échappés", relu.objets[0].note === 'dit "bonjour"');
  t("saut de ligne préservé", relu.objets[1].note === "ligne\nmultiple");
  t("valeur nulle rendue vide", relu.objets[2].age === "");
  t("accents intacts", relu.objets[2].nom === "Résultat élevé");
  // BOM UTF-8 : sans lui, Excel en configuration française casse les accents
  t("BOM UTF-8 présent", csv.charCodeAt(0) === 0xfeff);
  t("fins de ligne CRLF", csv.includes("\r\n"));
  writeFileSync(join(sorties, "export.csv"), csv, "utf8");
}
{
  t("virgule détectée", E.depuisCSV("a,b,c\n1,2,3").separateur === ",");
  t("tabulation détectée", E.depuisCSV("a\tb\tc\n1\t2\t3").separateur === "\t");
  t("fichier vide géré", E.depuisCSV("").objets.length === 0);
  t("entêtes seuls gérés", E.depuisCSV("a;b").objets.length === 0);
}

/* ===================================================================== */
section("Excel XLSX — archive OOXML");

{
  const blob = E.versXLSX([
    {
      nom: "Résultats",
      entetes: ["Analyse", "Valeur", "Unité", "Statut"],
      lignes: [
        ["Glycémie", 1.26, "g/L", "Élevé"],
        ["Hémoglobine", 13.5, "g/dL", "Normal"],
        ["Créatinine", "9,4", "mg/L", "Normal"],
      ],
    },
    { nom: "Journal", entetes: ["Date", "Action"], lignes: [["2026-07-27", "Validation"]] },
  ]);
  const buf = Buffer.from(await blob.arrayBuffer());
  writeFileSync(join(sorties, "export.xlsx"), buf);
  t("signature ZIP « PK »", buf[0] === 0x50 && buf[1] === 0x4b);
  t("fin d'archive présente", buf.includes(Buffer.from([0x50, 0x4b, 0x05, 0x06])));
  t("taille plausible", buf.length > 1500, `${buf.length} octets`);
  t("type MIME Excel", blob.type.includes("spreadsheetml"));
  // Contrôle du contenu XML : les nombres doivent être typés comme tels,
  // sans quoi Excel les traite comme du texte et aucun calcul n'est possible.
  const texte = buf.toString("latin1");
  t("nombre stocké en numérique", texte.includes("<v>1.26</v>"));
  t("« 9,4 » converti en nombre", texte.includes("<v>9.4</v>"));
  t("texte stocké en chaîne", texte.includes("inlineStr"));
  t("deux feuilles déclarées", (texte.match(/<sheet /g) || []).length === 2);
}

/* ===================================================================== */
section("PDF — document conforme");

{
  const pdf = new E.DocumentPDF({ titre: "Compte rendu d'analyses", auteur: "CHU de Kinshasa" });
  pdf.ligne("COMPTE RENDU D'ANALYSES", { taille: 14, gras: true });
  pdf.paragraphe(
    "Le présent document restitue les résultats validés par le biologiste. " +
    "Les valeurs hors normes sont signalées par une flèche, les valeurs critiques en rouge.",
    { taille: 9 });
  pdf.espace(10);
  pdf.tableau(
    ["Analyse", "Résultat", "Unité", "Références"],
    [
      ["Glycémie à jeun", { texte: "1,26", gras: true, couleur: [0.85, 0.5, 0.05] }, "g/L", "0,70 – 1,10"],
      ["Hémoglobine", "13,5", "g/dL", "12,0 – 16,0"],
      ["Créatinine", "9,4", "mg/L", "6,0 – 12,0"],
    ],
    { largeurs: [180, 90, 80, 145], alignements: ["gauche", "droite", "gauche", "centre"] });
  const blob = pdf.produire();
  const buf = Buffer.from(await blob.arrayBuffer());
  writeFileSync(join(sorties, "export.pdf"), buf);

  t("en-tête %PDF-1.4", buf.subarray(0, 8).toString("latin1") === "%PDF-1.4");
  t("marqueur de fin %%EOF", buf.subarray(-6).toString("latin1").includes("%%EOF"));
  const texte = buf.toString("latin1");
  t("table de références croisées", texte.includes("xref") && texte.includes("startxref"));
  t("catalogue de document", texte.includes("/Type /Catalog"));
  t("arbre de pages", texte.includes("/Type /Pages"));
  t("polices standard déclarées", texte.includes("/Helvetica") && texte.includes("/Helvetica-Bold"));
  t("encodage WinAnsi (accents)", texte.includes("/WinAnsiEncoding"));
  // Les accents doivent être encodés en octal WinAnsi, pas en UTF-8 brut :
  // c'est ce qui garantit qu'ils s'affichent dans tous les lecteurs.
  t("« é » encodé en octal WinAnsi", texte.includes("\\351"));
  t("taille plausible", buf.length > 1200, `${buf.length} octets`);
}
{
  // Pagination automatique : un tableau long doit produire plusieurs pages
  const pdf = new E.DocumentPDF({ titre: "Long" });
  pdf.tableau(["N°", "Analyse"], Array.from({ length: 120 }, (_, i) => [String(i + 1), `Analyse ${i + 1}`]));
  const buf = Buffer.from(await pdf.produire().arrayBuffer());
  const pages = (buf.toString("latin1").match(/\/Type \/Page[^s]/g) || []).length;
  t("pagination automatique", pages >= 3, `${pages} pages`);
}
{
  // Troncature : une valeur trop longue ne doit pas déborder de sa colonne
  const pdf = new E.DocumentPDF({});
  pdf.tableau(["Court"], [["Un libellé beaucoup trop long pour tenir dans cette colonne étroite"]],
    { largeurs: [80] });
  t("colonne étroite gérée sans erreur", pdf.produire().size > 500);
}

/* ===================================================================== */
section("Compte rendu de laboratoire complet");

{
  const etablissement = { id: "e1", code: "CHU", nom: "CHU de Kinshasa",
    adresse: "Avenue de l'Hôpital", ville: "Kinshasa", telephone: "+243 900 000 000" };
  const patient = { id: "p1", ipp: "CHU26000001", nom: "Tshibangu", prenom: "Alice",
    sexe: "F", dateNaissance: "1990-05-12" };
  const demande = { id: "d1", numero: "D2026000042", date: "2026-07-27T08:00:00Z",
    datePrelevement: "2026-07-27T08:15:00Z", prescripteurNom: "Dr Mukendi" };
  const tests = [
    { code: "GLY", nom: "Glycémie à jeun", unite: "g/L", categorie: "BIOCHIM",
      valeurRefMin: 0.7, valeurRefMax: 1.1, seuilCritiqueMax: 3 },
    { code: "K", nom: "Potassium", unite: "mmol/L", categorie: "BIOCHIM",
      valeurRefMin: 3.5, valeurRefMax: 5.1, seuilCritiqueMax: 6.5 },
    { code: "HB", nom: "Hémoglobine", unite: "g/dL", categorie: "HEMATO",
      valeurRefMin: 12, valeurRefMax: 16 },
  ];
  const resultats = [
    { id: "r1", testCode: "GLY", valeur: 1.26, statut: "valide" },
    { id: "r2", testCode: "K", valeur: 6.9, statut: "valide",
      commentaireBiologiste: "Hyperkaliémie majeure : contrôle immédiat recommandé." },
    { id: "r3", testCode: "HB", valeur: 13.5, statut: "valide" },
  ];
  const signature = { signataireNom: "Marie Ilunga", signataireRole: "biologiste",
    date: "2026-07-27T10:30:00Z", empreinteContenu: "a".repeat(64) };

  const cr = E.compteRenduLaboratoire({ etablissement, patient, demande, resultats, tests, signature });
  const buf = Buffer.from(await cr.blob.arrayBuffer());
  writeFileSync(join(sorties, "compte-rendu.pdf"), buf);

  t("PDF de compte rendu produit", buf.subarray(0, 8).toString("latin1") === "%PDF-1.4");
  t("anomalies dénombrées", cr.anomalies === 2, `${cr.anomalies} anomalies (attendu 2)`);
  t("valeur critique détectée", cr.critiques === 1, `${cr.critiques} critique (attendu 1)`);
  const texte = buf.toString("latin1");
  t("identité du patient présente", texte.includes("TSHIBANGU"));
  t("numéro de demande présent", texte.includes("D2026000042"));
  t("signataire mentionné", texte.includes("Marie Ilunga"));
  t("alerte critique affichée", texte.includes("CRITIQUE"));
}
{
  // Sans signature, le document doit porter une mention explicite
  const cr = E.compteRenduLaboratoire({
    etablissement: { nom: "X" },
    patient: { id: "p", ipp: "1", nom: "A", prenom: "B", sexe: "M", dateNaissance: "1990-01-01" },
    demande: { id: "d", numero: "D1", date: "2026-01-01" },
    resultats: [{ testCode: "GLY", valeur: 1, statut: "saisi" }],
    tests: [{ code: "GLY", nom: "Glycémie", categorie: "BIOCHIM" }],
    signature: null,
  });
  const texte = Buffer.from(await cr.blob.arrayBuffer()).toString("latin1");
  t("mention « non validé » sans signature", texte.includes("NON VALID"));
}

/* ===================================================================== */
section("HL7 FHIR R4");

{
  const patient = { id: "p1", ipp: "CHU26000001", nom: "Tshibangu", prenom: "Alice",
    sexe: "F", dateNaissance: "1990-05-12", telephone: "+243900000000", email: "a@b.cd" };
  const f = E.patientVersFHIR(patient, { id: "e1", code: "CHU", nom: "CHU de Kinshasa" });
  t("ressource Patient", f.resourceType === "Patient");
  t("genre traduit", f.gender === "female");
  t("nom officiel structuré", f.name[0].family === "Tshibangu" && f.name[0].given[0] === "Alice");
  t("IPP porté par un identifier", f.identifier[0].value === "CHU26000001");
  t("télécom renseigné", f.telecom.length === 2);
  t("organisation de rattachement", f.managingOrganization.reference === "Organization/e1");
}
{
  const test = { code: "GLY", loinc: "2345-7", nom: "Glucose sérique", unite: "g/L",
    valeurRefMin: 0.7, valeurRefMax: 1.1, seuilCritiqueMax: 3 };
  const patient = { id: "p1", nom: "T", prenom: "A" };

  const obs = E.resultatVersFHIR({ id: "r1", testCode: "GLY", valeur: 1.26, statut: "valide" }, test, patient, {});
  t("ressource Observation", obs.resourceType === "Observation");
  t("statut final", obs.status === "final");
  t("catégorie laboratoire", obs.category[0].coding[0].code === "laboratory");
  t("codification LOINC", obs.code.coding[0].system === "http://loinc.org" && obs.code.coding[0].code === "2345-7");
  t("valeur quantitative typée", obs.valueQuantity.value === 1.26 && obs.valueQuantity.unit === "g/L");
  t("interprétation « High »", obs.interpretation[0].coding[0].code === "H");
  t("intervalle de référence", obs.referenceRange[0].low.value === 0.7 && obs.referenceRange[0].high.value === 1.1);

  const critique = E.resultatVersFHIR({ id: "r2", testCode: "GLY", valeur: 3.5, statut: "valide" }, test, patient, {});
  t("valeur critique codée « HH »", critique.interpretation[0].coding[0].code === "HH");

  const bas = E.resultatVersFHIR({ id: "r3", testCode: "GLY", valeur: 0.5, statut: "valide" }, test, patient, {});
  t("valeur basse codée « L »", bas.interpretation[0].coding[0].code === "L");

  const texte = E.resultatVersFHIR({ id: "r4", testCode: "PALU", valeurTexte: "Positif", statut: "saisi" },
    { code: "PALU", nom: "Goutte épaisse" }, patient, {});
  t("résultat qualitatif en valueString", texte.valueString === "Positif");
  t("statut préliminaire", texte.status === "preliminary");

  const corrige = E.resultatVersFHIR({ id: "r5", testCode: "GLY", valeur: 1, statut: "corrige" }, test, patient, {});
  t("statut corrigé", corrige.status === "corrected");
}
{
  const demande = { id: "d1", numero: "D1", date: "2026-01-01", statut: "rendue", urgence: "vital" };
  const sr = E.demandeVersFHIR(demande, { id: "p1" });
  t("ressource ServiceRequest", sr.resourceType === "ServiceRequest");
  t("statut « completed »", sr.status === "completed");
  t("urgence vitale → priorité « stat »", sr.priority === "stat");
}
{
  const lot = E.lotFHIR([{ resourceType: "Patient", id: "p1" }, { resourceType: "Observation", id: "r1" }]);
  t("ressource Bundle", lot.resourceType === "Bundle");
  t("total cohérent", lot.total === 2 && lot.entry.length === 2);
  t("horodatage ISO", !Number.isNaN(Date.parse(lot.timestamp)));
  // Un lot FHIR doit rester sérialisable tel quel pour être transmis
  t("sérialisation JSON valide", JSON.parse(JSON.stringify(lot)).entry.length === 2);
  writeFileSync(join(sorties, "lot-fhir.json"), JSON.stringify(lot, null, 2), "utf8");
}
{
  t("catalogue LOINC fourni", E.LOINC_COURANTS.length >= 20);
  t("tous les codes LOINC renseignés", E.LOINC_COURANTS.every(x => /^\d+-\d$/.test(x.loinc)));
  t("catégories cohérentes", E.LOINC_COURANTS.every(x => x.categorie && x.nom && x.code));
}

/* ===================================================================== */
section("Export vers logiciels statistiques");

{
  const variables = [
    { code: "age", type: "numerique" },
    { code: "sexe", type: "categoriel" },
    { code: "glycemie", type: "numerique" },
  ];
  const lignes = [
    { age: 36, sexe: "F", glycemie: 1.26 },
    { age: 52, sexe: "M", glycemie: 0.95 },
  ];
  const ex = E.exportStatistique(lignes, variables, { nom: "cohorte" });
  t("CSV produit", ex.csv.includes("age;sexe;glycemie"));
  t("script R produit", ex.script.includes("read.csv2") && ex.script.includes("cohorte.csv"));
  t("typage R des variables", ex.script.includes("as.numeric") && ex.script.includes("as.factor"));
  t("syntaxe SPSS produite", ex.syntaxeSPSS.includes("GET DATA") && ex.syntaxeSPSS.includes("DESCRIPTIVES"));
  t("nom de fichier cohérent", ex.nomFichier === "cohorte.csv");
  writeFileSync(join(sorties, "cohorte.csv"), ex.csv, "utf8");
  writeFileSync(join(sorties, "cohorte.R"), ex.script, "utf8");
}

/* ===================================================================== */
console.log(`\n${"═".repeat(62)}`);
if (failed === 0) {
  console.log(`\x1b[32m✓ ${passed} contrôles réussis, aucun échec.\x1b[0m`);
  console.log(`  Fichiers produits dans tests/sorties/ (ouvrables dans Excel et un lecteur PDF).`);
} else {
  console.log(`\x1b[31m✗ ${failed} échec(s) sur ${passed + failed} contrôles :\x1b[0m`);
  failures.forEach((f, i) => console.log(`\n  ${i + 1}. ${f}`));
}
console.log(`${"═".repeat(62)}\n`);
process.exit(failed === 0 ? 0 : 1);
