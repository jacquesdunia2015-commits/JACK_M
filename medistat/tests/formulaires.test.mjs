#!/usr/bin/env node
// medistat/tests/formulaires.test.mjs
// Contrôles du constructeur de formulaires déclaratifs.
//
// Ce fichier existe à cause d'un défaut réel : la branche « case à cocher »
// de `formulaire()` rendait son propre gabarit et sortait par un `return`
// avant d'enregistrer le contrôle. Rien ne se voyait — la case s'affichait,
// se cochait, se décochait — mais `valeurs()` ne la retrouvait plus et
// renvoyait toujours `undefined`, donc « décoché ». Chaque interrupteur de
// la Solution était donc mort : modules à activer au premier lancement,
// notification des patients, jeu de démonstration.
//
// Un test unitaire l'aurait attrapé en une seconde. Il a fallu un parcours
// complet en navigateur. D'où ce fichier, et le bac à sable DOM minimal
// qu'il embarque : les formulaires méritent d'être contrôlés hors navigateur.
//
// Lancement :  node tests/formulaires.test.mjs

import { installerDOM } from "./dom-minimal.mjs";
installerDOM();

const { formulaire, h } = await import("../js/core/ui.js");

let passed = 0, failed = 0;
const failures = [];
const t = (nom, condition, detail = "") => {
  if (condition) passed++;
  else { failed++; failures.push(nom + (detail ? `\n     ${detail}` : "")); }
};
const check = (nom, got, exp) => t(nom, got === exp, `obtenu ${JSON.stringify(got)}, attendu ${JSON.stringify(exp)}`);
const section = titre => console.log(`\n\x1b[1m── ${titre}\x1b[0m`);

/* ===================================================================== */
section("Construction d'éléments");

const div = h("div.carte.carte--large#monId", { texte: "Bonjour" });
check("balise", div.tagName, "DIV");
check("identifiant", div.id, "monId");
t("classes appliquées", div.classList.contains("carte") && div.classList.contains("carte--large"));
check("texte", div.textContent, "Bonjour");

// Le texte passe par textContent : un libellé venant de la base ne peut pas
// injecter de balise dans la page.
const injection = h("div", { texte: "<script>alert(1)</script>" });
check("aucune injection possible par le texte",
  injection.innerHTML.includes("<script>"), false);

/* ===================================================================== */
section("Restitution des valeurs");

const form = formulaire([
  { type: "separateur", libelle: "Section" },
  { cle: "nom", libelle: "Nom" },
  { cle: "age", libelle: "Âge", type: "number" },
  { cle: "notes", libelle: "Notes", type: "textarea" },
  { cle: "categorie", libelle: "Catégorie", type: "select",
    options: [{ valeur: "a", libelle: "A" }, { valeur: "b", libelle: "B" }] },
  { cle: "actif", libelle: "Actif", type: "checkbox" },
  { cle: "prevenir", libelle: "Prévenir", type: "checkbox", defaut: true },
], { nom: "Tshibangu", age: 42, notes: "rien à signaler", categorie: "b" });

const v0 = form.valeurs();
check("champ texte restitué", v0.nom, "Tshibangu");
check("champ numérique typé", v0.age, 42);
check("zone de texte restituée", v0.notes, "rien à signaler");
check("liste déroulante restituée", v0.categorie, "b");

// Le cœur du défaut : une case à cocher doit figurer dans `valeurs()`, et
// sa valeur doit refléter l'état réel de la case, pas `undefined`.
t("une case à cocher figure dans les valeurs", "actif" in v0,
  `clés : ${Object.keys(v0).join(", ")}`);
check("case non cochée par défaut", v0.actif, false);
check("case cochée par sa valeur par défaut", v0.prevenir, true);

form.controles.actif.checked = true;
form.controles.prevenir.checked = false;
const v1 = form.valeurs();
check("cocher une case se répercute", v1.actif, true);
check("décocher une case se répercute", v1.prevenir, false);

// Une valeur explicite l'emporte sur le défaut : c'est ce qui permet de
// rouvrir un écran de paramétrage sur l'état réellement enregistré.
const form2 = formulaire([
  { cle: "actif", libelle: "Actif", type: "checkbox", defaut: true },
], { actif: false });
check("la valeur enregistrée prime sur le défaut", form2.valeurs().actif, false);

const form3 = formulaire([
  { cle: "actif", libelle: "Actif", type: "checkbox", defaut: false },
], { actif: true });
check("une case enregistrée à vrai est rouverte cochée", form3.valeurs().actif, true);

/* ===================================================================== */
section("Tous les types déclarés sont restitués");

// Contrôle générique : quel que soit le type, la clé doit apparaître dans
// `valeurs()`. C'est exactement l'invariant que la case à cocher violait.
const TYPES = ["text", "number", "textarea", "select", "checkbox", "radio",
  "date", "email", "tel", "password"];
const champsTousTypes = TYPES.map(type => ({
  cle: `c_${type}`, libelle: type, type,
  options: [{ valeur: "x", libelle: "X" }, { valeur: "y", libelle: "Y" }],
}));
const formTous = formulaire(champsTousTypes);
const vTous = formTous.valeurs();
const absents = TYPES.filter(type => !(`c_${type}` in vTous));
t("aucun type de champ n'est perdu à la lecture", absents.length === 0,
  `types absents : ${absents.join(", ")}`);

const nonEnregistres = TYPES.filter(type => !formTous.controles[`c_${type}`]);
t("chaque champ enregistre son contrôle", nonEnregistres.length === 0,
  `non enregistrés : ${nonEnregistres.join(", ")}`);

// Le séparateur n'est pas un champ : il ne doit rien ajouter aux valeurs.
const formSep = formulaire([{ type: "separateur", libelle: "Titre" }, { cle: "a", libelle: "A" }]);
check("un séparateur n'ajoute pas de valeur", Object.keys(formSep.valeurs()).length, 1);

/* ===================================================================== */
console.log(`\n${"─".repeat(62)}`);
if (failed === 0) {
  console.log(`\x1b[32m\x1b[1m✓ ${passed} contrôles au vert.\x1b[0m`);
} else {
  console.log(`\x1b[31m\x1b[1m✗ ${failed} échec(s) sur ${passed + failed} contrôles :\x1b[0m`);
  for (const f of failures) console.log(`   • ${f}`);
}
process.exit(failed === 0 ? 0 : 1);
