// medistat/js/modules/catalogue.js
// Paramétrage du laboratoire (article 7.1) : catégories d'examens, catalogue
// des tests, valeurs de référence, unités et seuils d'alerte.
// C'est ce paramétrage qui rend possible l'interprétation automatique des
// résultats et le déclenchement des alertes sur valeurs critiques.

import { h, fmt, tableau, badge, modale, confirmer, erreur, succes, alerte,
  etatVide, formulaire, carteStat } from "../core/ui.js";
import * as store from "../core/store.js";
import { autorise } from "../core/auth.js";
import { CATEGORIES_TESTS, VALIDATEURS, interpreterResultat } from "../core/model.js";
import { LOINC_COURANTS, telecharger, versCSV, depuisCSV } from "../core/export.js";
import { referenceInterval } from "../stats/diagnostic.js";
import { COULEURS } from "../core/charts.js";
import * as desc from "../stats/descriptive.js";

export async function vue_catalogue({ rafraichir }) {
  const tests = await store.depots.testsCatalogue.lister({
    tri: (a, b) => (a.nom || "").localeCompare(b.nom || "", "fr"),
  });
  const actifs = tests.filter(t => t.actif !== false);

  const colonnes = [
    { cle: "code", titre: "Code", rendu: t => h("code.texte-mono", { texte: t.code }) },
    { cle: "nom", titre: "Analyse" },
    { cle: "categorie", titre: "Discipline", rendu: t => {
      const c = CATEGORIES_TESTS.find(x => x.code === t.categorie);
      return badge(c ? `${c.icon} ${c.label}` : t.categorie || "—");
    } },
    { cle: "loinc", titre: "LOINC", rendu: t => t.loinc
      ? h("code.texte-mono", { style: { fontSize: ".78rem" }, texte: t.loinc })
      : h("span.texte-secondaire", { texte: "—" }) },
    { cle: "unite", titre: "Unité", valeur: t => t.unite || "—" },
    { cle: "reference", titre: "Valeurs de référence", aligne: "centre",
      valeur: t => (Number.isFinite(Number(t.valeurRefMin)) && Number.isFinite(Number(t.valeurRefMax)))
        ? `${fmt.nombre(t.valeurRefMin)} – ${fmt.nombre(t.valeurRefMax)}`
        : t.type === "qualitatif" ? "qualitatif" : "—" },
    { cle: "critique", titre: "Seuils d'alerte", aligne: "centre",
      rendu: t => {
        const bas = Number.isFinite(Number(t.seuilCritiqueMin));
        const haut = Number.isFinite(Number(t.seuilCritiqueMax));
        if (!bas && !haut) return h("span.texte-secondaire", { texte: "—" });
        return badge(`${bas ? "≤" + fmt.nombre(t.seuilCritiqueMin) : ""}${bas && haut ? " / " : ""}${haut ? "≥" + fmt.nombre(t.seuilCritiqueMax) : ""}`,
          COULEURS.critique);
      } },
    { cle: "delai", titre: "Délai", aligne: "droite",
      valeur: t => t.delaiRenduHeures ? `${t.delaiRenduHeures} h` : "—" },
    { cle: "actif", titre: "État", rendu: t => t.actif === false
      ? badge("désactivé", COULEURS.neutre) : badge("actif", COULEURS.normal) },
  ];

  return h("div", [
    h("div.page-entete", [
      h("div.page-entete__titre", [
        h("h1", { texte: "Catalogue des tests" }),
        h("p.texte-secondaire", {
          texte: `${fmt.nombre(actifs.length)} analyse(s) active(s) sur ${fmt.nombre(tests.length)}.`,
        }),
      ]),
      h("div.page-entete__actions", [
        autorise("testCatalogue", "creation") ? h("button.btn", { texte: "📚 Amorcer depuis LOINC",
          onclick: () => amorcerCatalogue(tests, rafraichir) }) : null,
        autorise("testCatalogue", "creation") ? h("button.btn", { texte: "📂 Importer",
          onclick: () => importerCatalogue(rafraichir) }) : null,
        h("button.btn", { texte: "⬇ Exporter", onclick: () => exporterCatalogue(tests) }),
        autorise("testCatalogue", "creation")
          ? h("button.btn.btn--primaire", { texte: "＋ Nouveau test",
              onclick: () => formulaireTest(null, rafraichir) })
          : null,
      ].filter(Boolean)),
    ]),

    tests.length ? h("div.grille.grille--4", { style: { marginBottom: "16px" } },
      CATEGORIES_TESTS.map(c => {
        const n = tests.filter(t => t.categorie === c.code && t.actif !== false).length;
        return n ? carteStat({ libelle: c.label, valeur: n, icone: c.icon }) : null;
      }).filter(Boolean)) : null,

    tests.length
      ? tableau(colonnes, tests, {
          parPage: 30, compact: true,
          surLigne: t => autorise("testCatalogue", "modification")
            ? formulaireTest(t, rafraichir) : detailTest(t),
          vide: "Aucun test paramétré.",
        })
      : etatVide({
          icone: "🧪", titre: "Catalogue vide",
          message: "Le catalogue recense les analyses réalisables, leurs unités, leurs valeurs de " +
            "référence et leurs seuils d'alerte. Amorcez-le à partir du référentiel LOINC.",
          action: autorise("testCatalogue", "creation")
            ? { libelle: "Amorcer depuis LOINC", action: () => amorcerCatalogue(tests, rafraichir) }
            : null,
        }),
  ]);
}

/* ===================== Création et modification ===================== */

async function formulaireTest(test, apres) {
  const modification = !!test;
  const form = formulaire([
    { type: "separateur", libelle: "Identification" },
    { cle: "code", libelle: "Code interne", obligatoire: true, placeholder: "GLY",
      aide: "Court et sans espace : il figure sur les demandes." },
    { cle: "nom", libelle: "Libellé de l'analyse", obligatoire: true, pleineLargeur: true },
    { cle: "categorie", libelle: "Discipline", type: "select", obligatoire: true, vide: "— Choisir —",
      options: CATEGORIES_TESTS.map(c => ({ valeur: c.code, libelle: c.label })) },
    { cle: "loinc", libelle: "Code LOINC", placeholder: "2345-7",
      aide: "Nécessaire à l'interopérabilité HL7 FHIR." },
    { cle: "type", libelle: "Nature du résultat", type: "select", vide: false,
      options: [{ valeur: "numerique", libelle: "Numérique" },
        { valeur: "qualitatif", libelle: "Qualitatif (texte)" }] },
    { cle: "unite", libelle: "Unité de mesure", placeholder: "g/L" },
    { type: "separateur", libelle: "Valeurs de référence" },
    { cle: "valeurRefMin", libelle: "Référence basse", type: "number", pas: "any" },
    { cle: "valeurRefMax", libelle: "Référence haute", type: "number", pas: "any" },
    { cle: "seuilCritiqueMin", libelle: "Seuil critique bas", type: "number", pas: "any",
      aide: "En deçà : alerte immédiate au prescripteur." },
    { cle: "seuilCritiqueMax", libelle: "Seuil critique haut", type: "number", pas: "any",
      aide: "Au-delà : alerte immédiate au prescripteur." },
    { type: "separateur", libelle: "Exploitation" },
    { cle: "delaiRenduHeures", libelle: "Délai de rendu (heures)", type: "number", min: 0 },
    { cle: "prix", libelle: "Tarif", type: "number", min: 0 },
    { cle: "methode", libelle: "Méthode ou automate" },
    { cle: "actif", libelle: "Analyse active", type: "checkbox", defaut: true },
  ], test || { type: "numerique", actif: true });
  form.classList.add("formulaire--grille");

  const resultat = await modale({
    titre: modification ? `Modifier — ${test.nom}` : "Nouvelle analyse",
    contenu: form, largeur: "780px",
    actions: [
      { libelle: "Annuler", type: "neutre", valeur: null },
      modification && autorise("testCatalogue", "suppression")
        ? { libelle: "Supprimer", type: "danger", action: async () => {
            if (!(await confirmer(`Supprimer l'analyse « ${test.nom} » du catalogue ?`,
              { danger: true, detail: "Les résultats déjà enregistrés sont conservés." }))) return false;
            await store.depots.testsCatalogue.supprimer(test.id);
            return "supprime";
          } }
        : null,
      { libelle: modification ? "Enregistrer" : "Créer", type: "primaire", action: async () => {
        const v = form.valeurs();
        const erreurs = VALIDATEURS.testCatalogue(v);
        if (erreurs.length) { erreur(erreurs.join(" ")); return false; }
        try {
          return modification
            ? await store.depots.testsCatalogue.modifier(test.id, v)
            : await store.depots.testsCatalogue.creer(v);
        } catch (e) { erreur(e.message); return false; }
      } },
    ].filter(Boolean),
  });

  if (resultat === "supprime") { succes("Analyse retirée du catalogue."); apres?.(); }
  else if (resultat) { succes(modification ? "Analyse mise à jour." : "Analyse ajoutée."); apres?.(); }
}

function detailTest(test) {
  return modale({
    titre: test.nom, largeur: "480px",
    contenu: h("div", [
      h("div.resultat-test__stat", [
        h("div.stat-bloc", [h("span.stat-bloc__libelle", { texte: "Code" }),
          h("span.stat-bloc__valeur", { texte: test.code })]),
        h("div.stat-bloc", [h("span.stat-bloc__libelle", { texte: "Unité" }),
          h("span.stat-bloc__valeur", { texte: test.unite || "—" })]),
        h("div.stat-bloc", [h("span.stat-bloc__libelle", { texte: "LOINC" }),
          h("span.stat-bloc__valeur", { texte: test.loinc || "—" })]),
      ]),
      h("p.texte-secondaire", {
        texte: (Number.isFinite(Number(test.valeurRefMin)) && Number.isFinite(Number(test.valeurRefMax)))
          ? `Valeurs de référence : ${test.valeurRefMin} – ${test.valeurRefMax} ${test.unite || ""}`
          : "Aucune valeur de référence définie.",
      }),
    ]),
    actions: [{ libelle: "Fermer", type: "neutre" }],
  });
}

/* ===================== Amorçage LOINC ===================== */

async function amorcerCatalogue(existants, apres) {
  const codesExistants = new Set(existants.map(t => t.code));
  const nouveaux = LOINC_COURANTS.filter(t => !codesExistants.has(t.code));
  if (!nouveaux.length) return alerte("Toutes les analyses du référentiel sont déjà au catalogue.");

  const ok = await confirmer(
    `Ajouter ${nouveaux.length} analyse(s) courantes au catalogue ?`,
    { titre: "Amorcer le catalogue",
      detail: "Codes LOINC, unités et valeurs de référence usuelles sont pré-remplis. " +
        "Adaptez ensuite les valeurs de référence à votre population et à vos automates : " +
        "celles fournies sont indicatives." });
  if (!ok) return;

  let n = 0;
  for (const t of nouveaux) {
    await store.depots.testsCatalogue.creer({
      code: t.code, loinc: t.loinc, nom: t.nom, categorie: t.categorie,
      unite: t.unite || "", type: t.type || "numerique",
      valeurRefMin: t.min ?? null, valeurRefMax: t.max ?? null,
      seuilCritiqueMin: t.critMin ?? null, seuilCritiqueMax: t.critMax ?? null,
      delaiRenduHeures: t.categorie === "MICROBIO" ? 72 : t.categorie === "SEROLOGIE" ? 24 : 6,
      actif: true,
    });
    n++;
  }
  succes(`${n} analyses ajoutées au catalogue.`);
  apres?.();
}

/* ===================== Import et export ===================== */

function exporterCatalogue(tests) {
  const lignes = tests.map(t => ({
    Code: t.code, LOINC: t.loinc || "", Nom: t.nom, Categorie: t.categorie,
    Type: t.type || "numerique", Unite: t.unite || "",
    RefMin: t.valeurRefMin ?? "", RefMax: t.valeurRefMax ?? "",
    CritiqueMin: t.seuilCritiqueMin ?? "", CritiqueMax: t.seuilCritiqueMax ?? "",
    DelaiHeures: t.delaiRenduHeures ?? "", Prix: t.prix ?? "",
    Methode: t.methode || "", Actif: t.actif === false ? "non" : "oui",
  }));
  telecharger(versCSV(lignes), "catalogue-tests.csv", "text/csv");
  succes(`${tests.length} analyses exportées.`);
}

async function importerCatalogue(apres) {
  const input = h("input", { type: "file", accept: ".csv", hidden: true });
  document.body.appendChild(input);
  input.click();
  input.onchange = async () => {
    const fichier = input.files[0];
    input.remove();
    if (!fichier) return;
    try {
      const lu = depuisCSV(await fichier.text());
      if (!lu.objets.length) throw new Error("Fichier vide ou illisible.");
      const requis = ["Code", "Nom", "Categorie"];
      const manquants = requis.filter(c => !lu.entetes.includes(c));
      if (manquants.length) {
        throw new Error(`Colonnes manquantes : ${manquants.join(", ")}. ` +
          `Exportez d'abord le catalogue pour obtenir le format attendu.`);
      }
      const ok = await confirmer(`Importer ${lu.objets.length} analyse(s) ?`,
        { titre: "Importer le catalogue",
          detail: "Les analyses dont le code existe déjà seront mises à jour." });
      if (!ok) return;

      const existants = await store.depots.testsCatalogue.lister({});
      let crees = 0, majs = 0;
      const nombre = v => { const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : null; };
      for (const o of lu.objets) {
        const donnees = {
          code: String(o.Code).trim(), loinc: o.LOINC || "", nom: o.Nom,
          categorie: o.Categorie, type: o.Type || "numerique", unite: o.Unite || "",
          valeurRefMin: nombre(o.RefMin), valeurRefMax: nombre(o.RefMax),
          seuilCritiqueMin: nombre(o.CritiqueMin), seuilCritiqueMax: nombre(o.CritiqueMax),
          delaiRenduHeures: nombre(o.DelaiHeures), prix: nombre(o.Prix),
          methode: o.Methode || "", actif: String(o.Actif || "oui").toLowerCase() !== "non",
        };
        const erreurs = VALIDATEURS.testCatalogue(donnees);
        if (erreurs.length) continue;
        const existant = existants.find(t => t.code === donnees.code);
        if (existant) { await store.depots.testsCatalogue.modifier(existant.id, donnees); majs++; }
        else { await store.depots.testsCatalogue.creer(donnees); crees++; }
      }
      succes(`${crees} analyse(s) créée(s), ${majs} mise(s) à jour.`);
      apres?.();
    } catch (e) { erreur("Import impossible : " + e.message); }
  };
}
