// medistat/js/modules/donnees.js
// Jeux de données destinés à l'analyse.
// Deux sources : l'extraction du dossier médical et du laboratoire (le SaaS
// devient alors son propre entrepôt de données), et l'import de fichiers
// externes (CSV, Excel, texte). Le typage des variables est déduit puis
// modifiable, car c'est lui qui conditionne les analyses proposées.

import { h, fmt, tableau, badge, modale, erreur, succes, alerte, etatVide,
  formulaire, remplacer, confirmer, carteStat } from "../core/ui.js";
import * as store from "../core/store.js";
import { autorise, utilisateurCourant } from "../core/auth.js";
import { nouvelId, calculerAge, interpreterResultat } from "../core/model.js";
import { pseudonymiser } from "../core/crypto.js";
import { depuisCSV, versCSV, telecharger, exportStatistique, versXLSX } from "../core/export.js";
import * as desc from "../stats/descriptive.js";
import { COULEURS } from "../core/charts.js";

/* ===================== Accès aux jeux de données ===================== */

export async function chargerJeux() {
  const u = utilisateurCourant();
  const tous = await store.lireTout("jeuxDonnees");
  return tous
    .filter(j => !j._supprime && (!j.etablissementId || j.etablissementId === u?.etablissementId))
    .sort((a, b) => (a.dateCreation < b.dateCreation ? 1 : -1));
}

let jeuActifId = null;
export function definirJeuActif(id) { jeuActifId = id; }
export function jeuActif(jeux) {
  return jeux.find(j => j.id === jeuActifId) || jeux[0];
}

/* ===================== Typage des variables ===================== */

// Le type détermine les analyses possibles. On le déduit du contenu, puis
// l'utilisateur peut le corriger : une variable codée 0/1 peut être un
// indicateur binaire ou un simple comptage, et seul l'utilisateur le sait.
export function deduireType(valeurs) {
  const nonVides = valeurs.filter(v => v !== null && v !== undefined && String(v).trim() !== "");
  if (!nonVides.length) return { type: "vide", modalites: 0 };

  const modalites = new Set(nonVides.map(v => String(v).trim()));
  const numeriques = nonVides.filter(v =>
    Number.isFinite(Number(String(v).replace(",", ".")))).length;
  const partNumerique = numeriques / nonVides.length;

  // Une variable ne prenant que deux valeurs est traitée comme binaire :
  // c'est ce qui permet les régressions logistiques et les mesures de risque.
  if (modalites.size === 2) {
    const vals = [...modalites].map(v => v.toLowerCase());
    const binaireConnu = vals.every(v =>
      ["0", "1", "oui", "non", "positif", "négatif", "negatif", "vrai", "faux",
       "true", "false", "présent", "present", "absent", "m", "f"].includes(v));
    if (binaireConnu || partNumerique === 1) return { type: "binaire", modalites: 2 };
  }
  if (partNumerique >= 0.9 && modalites.size > 8) return { type: "numerique", modalites: modalites.size };
  if (partNumerique >= 0.9 && modalites.size > 2) {
    // Peu de valeurs distinctes mais numériques : probablement un score ordinal
    return { type: "numerique", modalites: modalites.size };
  }
  // Une date reconnaissable
  if (nonVides.slice(0, 20).every(v => !Number.isNaN(Date.parse(String(v)))) &&
      String(nonVides[0]).length >= 8) {
    return { type: "date", modalites: modalites.size };
  }
  return { type: "categoriel", modalites: modalites.size };
}

// Colonnes typées d'un jeu, telles que les proposent les écrans d'analyse
export function colonnesTypees(jeu) {
  return (jeu.variables || []).map(v => {
    const valeurs = jeu.lignes.map(l => l[v.cle]);
    const deduit = deduireType(valeurs);
    return {
      cle: v.cle,
      nom: v.nom || v.cle,
      type: v.type || deduit.type,
      modalites: deduit.modalites,
      manquants: valeurs.filter(x => x === null || x === undefined || String(x).trim() === "").length,
    };
  }).filter(c => c.type !== "vide");
}

/* ===================== Vue principale ===================== */

export async function vue_jeux_donnees({ naviguer, rafraichir, segments }) {
  if (segments?.[0]) return detailJeu(segments[0], { naviguer, rafraichir });

  const jeux = await chargerJeux();

  return h("div", [
    h("div.page-entete", [
      h("div.page-entete__titre", [
        h("h1", { texte: "Jeux de données" }),
        h("p.texte-secondaire", {
          texte: "Constituez les tableaux de données à analyser, à partir du dossier médical " +
            "ou d'un fichier externe.",
        }),
      ]),
      h("div.page-entete__actions", [
        h("button.btn.btn--primaire", { texte: "🏥 Extraire du dossier médical",
          onclick: () => assistantExtraction(rafraichir) }),
        h("button.btn", { texte: "📂 Importer un fichier", onclick: () => importerFichier(rafraichir) }),
      ]),
    ]),

    jeux.length
      ? h("div.grille.grille--3", jeux.map(j => h("div.carte-stat.carte-stat--cliquable", {
          onclick: () => naviguer(`jeux-donnees/${j.id}`),
        }, [
          h("div.carte-stat__icone", { texte: j.source === "extraction" ? "🏥" : "📂" }),
          h("div.carte-stat__corps", [
            h("div", { style: { fontWeight: "650" }, texte: j.nom }),
            h("div.carte-stat__libelle", {
              texte: `${fmt.nombre(j.lignes.length)} observations — ${j.variables.length} variables`,
            }),
            h("div.carte-stat__detail", { texte: `Créé ${fmt.relatif(j.dateCreation)}` }),
            j.anonymise ? h("div", { style: { marginTop: "4px" } }, [badge("pseudonymisé", COULEURS.normal)]) : null,
          ]),
        ])))
      : etatVide({
          icone: "🗃️", titre: "Aucun jeu de données",
          message: "Extrayez les données du dossier médical et du laboratoire, ou importez un fichier " +
            "CSV ou Excel provenant d'une autre source.",
          action: { libelle: "Extraire du dossier médical", action: () => assistantExtraction(rafraichir) },
        }),

    h("div.carte", { style: { marginTop: "20px" } }, [
      h("h3", { texte: "Comment se constitue un jeu de données ?" }),
      h("p.texte-secondaire", {
        texte: "Un jeu de données est un tableau rectangulaire : une ligne par patient (ou par examen), " +
          "une colonne par variable. C'est le format attendu par tous les logiciels statistiques. " +
          "L'extraction depuis le dossier médical met automatiquement les résultats de laboratoire " +
          "en colonnes, ce qui évite la ressaisie et ses erreurs.",
      }),
      h("p.texte-secondaire", {
        texte: "La pseudonymisation remplace l'identité par un code stable et irréversible : elle est " +
          "vivement recommandée dès lors que les données quittent l'établissement ou servent à la recherche.",
      }),
    ]),
  ]);
}

/* ===================== Extraction depuis le dossier médical ===================== */

async function assistantExtraction(apres) {
  const form = formulaire([
    { cle: "nom", libelle: "Nom du jeu de données", obligatoire: true, pleineLargeur: true,
      defaut: `Extraction du ${new Date().toLocaleDateString("fr-FR")}` },
    { type: "separateur", libelle: "Contenu" },
    { cle: "demographie", libelle: "Données démographiques (âge, sexe, ville)", type: "checkbox", defaut: true },
    { cle: "clinique", libelle: "Données cliniques (diagnostic, constantes)", type: "checkbox", defaut: true },
    { cle: "laboratoire", libelle: "Résultats de laboratoire (une colonne par analyse)", type: "checkbox", defaut: true },
    { cle: "verbatims", libelle: "Commentaires libres (pour l'analyse qualitative)", type: "checkbox", defaut: true },
    { type: "separateur", libelle: "Portée" },
    { cle: "unite", libelle: "Une ligne par", type: "select", vide: false,
      options: [
        { valeur: "patient", libelle: "Patient (dernière valeur de chaque analyse)" },
        { valeur: "consultation", libelle: "Consultation" },
      ] },
    { cle: "depuis", libelle: "Depuis le", type: "date" },
    { cle: "jusqua", libelle: "Jusqu'au", type: "date" },
    { type: "separateur", libelle: "Confidentialité" },
    { cle: "anonymise", libelle: "Pseudonymiser les identités", type: "checkbox", defaut: true,
      aide: "Remplace nom, prénom et IPP par un code stable. Recommandé pour toute analyse." },
  ]);
  form.classList.add("formulaire--grille");

  const lancer = await modale({
    titre: "Extraire les données du dossier médical",
    contenu: form, largeur: "720px",
    actions: [
      { libelle: "Annuler", type: "neutre", valeur: null },
      { libelle: "Extraire", type: "primaire", action: () => form.valeurs() },
    ],
  });
  if (!lancer) return;

  try {
    const jeu = await extraire(lancer);
    succes(`Jeu créé : ${jeu.lignes.length} observations, ${jeu.variables.length} variables.`);
    apres?.();
  } catch (e) { erreur("Extraction impossible : " + e.message); }
}

async function extraire(options) {
  const [patients, consultations, resultats, tests] = await Promise.all([
    store.depots.patients.lister({ filtre: p => !p._supprime }),
    store.depots.consultations.lister({ filtre: c => !c._supprime }).catch(() => []),
    store.depots.resultats.lister({ filtre: r => !r._supprime }).catch(() => []),
    store.lireTout("testsCatalogue"),
  ]);

  const depuis = options.depuis ? new Date(options.depuis).getTime() : -Infinity;
  const jusqua = options.jusqua ? new Date(options.jusqua).getTime() + 86400000 : Infinity;
  const sel = await store.parametre("selAnonymisation", "medistat");

  const variables = [];
  const ajouterVariable = (cle, nom, type) => {
    if (!variables.some(v => v.cle === cle)) variables.push({ cle, nom, type });
  };

  // Les analyses réellement présentes deviennent autant de colonnes
  const codesPresents = [...new Set(resultats.map(r => r.testCode))];
  const testsPresents = codesPresents
    .map(c => tests.find(t => t.code === c) || { code: c, nom: c, type: "numerique" })
    .sort((a, b) => (a.nom || "").localeCompare(b.nom || "", "fr"));

  const lignes = [];

  if (options.unite === "consultation") {
    for (const c of consultations) {
      const t = new Date(c.date).getTime();
      if (t < depuis || t > jusqua) continue;
      const p = patients.find(x => x.id === c.patientId);
      if (!p) continue;
      lignes.push(await construireLigne(p, c, resultats, testsPresents, options, sel, c.date));
    }
  } else {
    for (const p of patients) {
      const cons = consultations
        .filter(c => c.patientId === p.id)
        .filter(c => { const t = new Date(c.date).getTime(); return t >= depuis && t <= jusqua; })
        .sort((a, b) => (a.date < b.date ? 1 : -1));
      if (options.depuis || options.jusqua) { if (!cons.length) continue; }
      lignes.push(await construireLigne(p, cons[0] || null, resultats, testsPresents, options, sel, null));
    }
  }

  // Déclaration des variables, dans l'ordre où elles apparaissent
  ajouterVariable("id", "Identifiant", "categoriel");
  if (options.demographie) {
    ajouterVariable("age", "Âge (années)", "numerique");
    ajouterVariable("sexe", "Sexe", "binaire");
    ajouterVariable("ville", "Ville", "categoriel");
    ajouterVariable("groupeSanguin", "Groupe sanguin", "categoriel");
  }
  if (options.clinique) {
    ajouterVariable("service", "Service", "categoriel");
    ajouterVariable("diagnostic", "Diagnostic", "categoriel");
    ajouterVariable("cim10", "Code CIM-10", "categoriel");
    ajouterVariable("temperature", "Température (°C)", "numerique");
    ajouterVariable("tensionSystolique", "Tension systolique (mmHg)", "numerique");
    ajouterVariable("tensionDiastolique", "Tension diastolique (mmHg)", "numerique");
    ajouterVariable("pouls", "Pouls (/min)", "numerique");
    ajouterVariable("poids", "Poids (kg)", "numerique");
    ajouterVariable("taille", "Taille (cm)", "numerique");
    ajouterVariable("imc", "Indice de masse corporelle", "numerique");
    ajouterVariable("saturation", "Saturation en oxygène (%)", "numerique");
  }
  if (options.laboratoire) {
    for (const t of testsPresents) {
      ajouterVariable(`lab_${t.code}`,
        `${t.nom}${t.unite ? ` (${t.unite})` : ""}`,
        t.type === "qualitatif" ? "categoriel" : "numerique");
      // Indicateur d'anomalie : permet les analyses de risque sans retraitement
      ajouterVariable(`anomalie_${t.code}`, `${t.nom} — hors normes`, "binaire");
    }
  }
  if (options.verbatims) {
    ajouterVariable("verbatim", "Commentaire du patient", "texte");
  }

  const jeu = {
    id: nouvelId("jeu"),
    nom: options.nom,
    source: "extraction",
    unite: options.unite,
    anonymise: !!options.anonymise,
    variables,
    lignes,
    dateCreation: new Date().toISOString(),
    creePar: utilisateurCourant()?.id,
    etablissementId: utilisateurCourant()?.etablissementId,
  };
  await store.ecrire("jeuxDonnees", jeu);
  await store.tracer("export", "analyse", jeu.id,
    `Extraction d'un jeu de données : ${lignes.length} observations${options.anonymise ? " (pseudonymisé)" : ""}`);
  return jeu;
}

async function construireLigne(patient, consultation, resultats, testsPresents, options, sel, dateReference) {
  const ligne = {};
  ligne.id = options.anonymise
    ? await pseudonymiser(patient.id, sel)
    : patient.ipp;

  if (options.demographie) {
    ligne.age = calculerAge(patient.dateNaissance)?.annees ?? null;
    ligne.sexe = patient.sexe || null;
    ligne.ville = patient.ville || null;
    ligne.groupeSanguin = patient.groupeSanguin || null;
  }
  if (options.clinique && consultation) {
    const cst = consultation.constantes || {};
    ligne.service = consultation.service || null;
    ligne.diagnostic = consultation.diagnostic || null;
    ligne.cim10 = consultation.cim10 || null;
    ligne.temperature = cst.temperature ?? null;
    ligne.tensionSystolique = cst.tensionSystolique ?? null;
    ligne.tensionDiastolique = cst.tensionDiastolique ?? null;
    ligne.pouls = cst.pouls ?? null;
    ligne.poids = cst.poids ?? null;
    ligne.taille = cst.taille ?? null;
    // L'IMC est calculé plutôt que ressaisi : moins d'erreurs, plus de données
    ligne.imc = (cst.poids && cst.taille)
      ? Number((cst.poids / ((cst.taille / 100) ** 2)).toFixed(1)) : null;
    ligne.saturation = cst.saturation ?? null;
  }

  if (options.laboratoire) {
    const siens = resultats.filter(r => r.patientId === patient.id);
    for (const t of testsPresents) {
      // Le résultat retenu est le plus proche de la date de référence,
      // ou le plus récent lorsqu'on raisonne par patient.
      const candidats = siens.filter(r => r.testCode === t.code &&
        (r.valeur !== null || r.valeurTexte));
      if (!candidats.length) { ligne[`lab_${t.code}`] = null; ligne[`anomalie_${t.code}`] = null; continue; }
      candidats.sort((a, b) => {
        const da = new Date(a.dateValidation || a.dateSaisie).getTime();
        const db = new Date(b.dateValidation || b.dateSaisie).getTime();
        if (dateReference) {
          const ref = new Date(dateReference).getTime();
          return Math.abs(da - ref) - Math.abs(db - ref);
        }
        return db - da;
      });
      const r = candidats[0];
      ligne[`lab_${t.code}`] = r.valeurTexte ?? r.valeur;
      ligne[`anomalie_${t.code}`] = r.horsNorme ? 1 : 0;
    }
  }

  if (options.verbatims && consultation?.commentairePatient) {
    ligne.verbatim = consultation.commentairePatient;
  } else if (options.verbatims) {
    ligne.verbatim = null;
  }
  return ligne;
}

/* ===================== Import de fichier ===================== */

async function importerFichier(apres) {
  const input = h("input", { type: "file", accept: ".csv,.txt,.tsv,.json", hidden: true });
  document.body.appendChild(input);
  input.click();
  input.onchange = async () => {
    const fichier = input.files[0];
    input.remove();
    if (!fichier) return;
    try {
      const texte = await fichier.text();
      let entetes, lignesBrutes;

      if (fichier.name.endsWith(".json")) {
        const donnees = JSON.parse(texte);
        const tableauJson = Array.isArray(donnees) ? donnees : donnees.lignes || donnees.data;
        if (!Array.isArray(tableauJson) || !tableauJson.length) {
          throw new Error("Le fichier JSON ne contient pas de tableau d'objets.");
        }
        entetes = [...new Set(tableauJson.flatMap(o => Object.keys(o)))];
        lignesBrutes = tableauJson;
      } else {
        const lu = depuisCSV(texte);
        if (!lu.entetes.length) throw new Error("Aucune colonne n'a été détectée.");
        entetes = lu.entetes;
        lignesBrutes = lu.objets;
      }

      await confirmerImport(fichier.name, entetes, lignesBrutes, apres);
    } catch (e) { erreur("Import impossible : " + e.message); }
  };
}

async function confirmerImport(nomFichier, entetes, lignesBrutes, apres) {
  // Typage proposé, corrigeable avant validation : c'est le moment où
  // l'utilisateur redresse ce que la déduction automatique a mal jugé.
  const types = {};
  const selecteurs = entetes.map(e => {
    const valeurs = lignesBrutes.map(l => l[e]);
    const deduit = deduireType(valeurs);
    types[e] = deduit.type;
    const select = h("select.champ", { style: { minWidth: "150px" } },
      [["numerique", "Quantitative"], ["categoriel", "Qualitative"], ["binaire", "Binaire (0/1)"],
       ["date", "Date"], ["texte", "Texte libre"], ["ignorer", "Ne pas importer"]]
        .map(([v, l]) => h("option", { value: v, texte: l, selected: v === deduit.type })));
    select.addEventListener("change", () => { types[e] = select.value; });
    return h("tr", [
      h("td", [h("strong", { texte: e })]),
      h("td", { texte: String(valeurs.find(v => v !== null && String(v).trim() !== "") ?? "—").slice(0, 30) }),
      h("td", { style: { textAlign: "right" },
        texte: `${deduit.modalites} valeur(s) distincte(s)` }),
      h("td", [select]),
    ]);
  });

  const nom = h("input.champ", { value: nomFichier.replace(/\.[^.]+$/, "") });

  const valide = await modale({
    titre: "Vérifier l'import",
    largeur: "820px",
    contenu: h("div", [
      h("p.texte-secondaire", {
        texte: `${lignesBrutes.length} ligne(s) et ${entetes.length} colonne(s) détectées. ` +
          `Vérifiez le type attribué à chaque variable : il détermine les analyses qui vous seront proposées.`,
      }),
      h("div.champ-groupe", [h("label.champ-libelle", { texte: "Nom du jeu de données" }), nom]),
      h("div.tableau-defilement", { style: { maxHeight: "50vh" } }, [
        h("table.tableau.tableau--compact", [
          h("thead", [h("tr", [h("th", "Colonne"), h("th", "Exemple"),
            h("th", { style: { textAlign: "right" } }, "Diversité"), h("th", "Type")])]),
          h("tbody", selecteurs),
        ]),
      ]),
    ]),
    actions: [
      { libelle: "Annuler", type: "neutre", valeur: null },
      { libelle: "Importer", type: "primaire", valeur: true },
    ],
  });
  if (!valide) return;

  const variables = entetes.filter(e => types[e] !== "ignorer")
    .map(e => ({ cle: e, nom: e, type: types[e] }));
  const lignes = lignesBrutes.map(l => {
    const out = {};
    for (const v of variables) {
      const brut = l[v.cle];
      if (v.type === "numerique" || v.type === "binaire") {
        const n = Number(String(brut ?? "").replace(",", ".").trim());
        out[v.cle] = Number.isFinite(n) ? n : (v.type === "binaire" ? brut : null);
      } else out[v.cle] = brut ?? null;
    }
    return out;
  });

  const jeu = {
    id: nouvelId("jeu"), nom: nom.value.trim() || nomFichier,
    source: "import", fichier: nomFichier, anonymise: false,
    variables, lignes,
    dateCreation: new Date().toISOString(),
    creePar: utilisateurCourant()?.id,
    etablissementId: utilisateurCourant()?.etablissementId,
  };
  await store.ecrire("jeuxDonnees", jeu);
  await store.tracer("creation", "analyse", jeu.id,
    `Import d'un jeu de données depuis « ${nomFichier} » : ${lignes.length} observations`);
  succes(`${lignes.length} observations importées.`);
  apres?.();
}

/* ===================== Détail d'un jeu ===================== */

async function detailJeu(id, { naviguer, rafraichir }) {
  const jeu = (await chargerJeux()).find(j => j.id === id);
  if (!jeu) return etatVide({ icone: "🔍", titre: "Jeu de données introuvable",
    action: { libelle: "Retour", action: () => naviguer("jeux-donnees") } });

  const colonnes = colonnesTypees(jeu);
  const quanti = colonnes.filter(c => c.type === "numerique");
  const quali = colonnes.filter(c => c.type === "categoriel" || c.type === "binaire");

  // Aperçu : les 100 premières lignes suffisent à contrôler la structure
  const apercu = tableau(
    colonnes.slice(0, 12).map(c => ({
      cle: c.cle, titre: c.nom,
      aligne: c.type === "numerique" ? "droite" : "gauche",
      valeur: l => {
        const v = l[c.cle];
        if (v === null || v === undefined || String(v).trim() === "") return "—";
        return c.type === "numerique" ? fmt.nombre(v) : String(v).slice(0, 40);
      },
    })),
    jeu.lignes.slice(0, 100), { parPage: 15, compact: true });

  // Qualité des données : le premier réflexe avant toute analyse
  const qualite = colonnes.map(c => ({
    ...c,
    tauxManquants: jeu.lignes.length ? (c.manquants / jeu.lignes.length) * 100 : 0,
  })).sort((a, b) => b.tauxManquants - a.tauxManquants);

  return h("div", [
    h("button.btn.btn--fin", { texte: "‹ Retour aux jeux de données",
      onclick: () => naviguer("jeux-donnees") }),
    h("div.page-entete", [
      h("div.page-entete__titre", [
        h("h1", { texte: jeu.nom }),
        h("p.texte-secondaire", {
          texte: `${jeu.source === "extraction" ? "Extraction du dossier médical" : `Import de « ${jeu.fichier} »`}` +
            ` — créé ${fmt.relatif(jeu.dateCreation)}`,
        }),
      ]),
      h("div.page-entete__actions", [
        h("button.btn.btn--primaire", { texte: "📈 Analyser",
          onclick: () => { definirJeuActif(jeu.id); naviguer("statistiques"); } }),
        h("button.btn", { texte: "⬇ Exporter", onclick: () => menuExport(jeu) }),
        h("button.btn.btn--danger", { texte: "Supprimer", onclick: async () => {
          if (!(await confirmer(`Supprimer le jeu « ${jeu.nom} » ?`,
            { danger: true, detail: "Les données sources du dossier médical ne sont pas affectées." }))) return;
          await store.supprimer("jeuxDonnees", jeu.id);
          await store.tracer("suppression", "analyse", jeu.id, `Suppression du jeu « ${jeu.nom} »`);
          succes("Jeu supprimé.");
          naviguer("jeux-donnees");
        } }),
      ]),
    ]),

    h("div.grille.grille--4", [
      carteStat({ libelle: "Observations", valeur: fmt.nombre(jeu.lignes.length), icone: "📋" }),
      carteStat({ libelle: "Variables", valeur: fmt.nombre(colonnes.length), icone: "📊" }),
      carteStat({ libelle: "Quantitatives", valeur: fmt.nombre(quanti.length), icone: "🔢",
        couleur: COULEURS.accent }),
      carteStat({ libelle: "Qualitatives", valeur: fmt.nombre(quali.length), icone: "🏷️",
        couleur: "#7c3aed" }),
    ]),

    jeu.anonymise
      ? h("div.interpretation", { style: { marginBottom: "14px" },
          texte: "Ce jeu est pseudonymisé : les identités sont remplacées par un code stable et irréversible. " +
            "Il peut être partagé à des fins d'analyse ou de recherche." })
      : h("div.avertissement", { style: { marginBottom: "14px" },
          texte: "Ce jeu n'est pas pseudonymisé : il peut contenir des données directement identifiantes. " +
            "Ne le diffusez pas hors de l'établissement." }),

    h("div.carte", [
      h("div.carte__entete", [h("h3", { texte: "Qualité des données" })]),
      h("p.texte-secondaire", {
        texte: "Une variable comportant plus de 20 % de valeurs manquantes doit être utilisée avec prudence : " +
          "les analyses porteront sur un sous-échantillon, potentiellement non représentatif.",
      }),
      tableau([
        { cle: "nom", titre: "Variable" },
        { cle: "type", titre: "Type", rendu: c => badge(
          { numerique: "quantitative", categoriel: "qualitative", binaire: "binaire",
            date: "date", texte: "texte libre" }[c.type] || c.type,
          c.type === "numerique" ? COULEURS.accent : c.type === "binaire" ? "#7c3aed" : null) },
        { cle: "modalites", titre: "Valeurs distinctes", aligne: "droite",
          valeur: c => fmt.nombre(c.modalites) },
        { cle: "manquants", titre: "Manquants", aligne: "droite", valeur: c => fmt.nombre(c.manquants) },
        { cle: "taux", titre: "% manquants", aligne: "droite",
          rendu: c => h("span", {
            style: { color: c.tauxManquants > 20 ? "var(--danger)"
              : c.tauxManquants > 5 ? "var(--alerte)" : "var(--succes)", fontWeight: "600" },
            texte: fmt.nombre(c.tauxManquants, 1) + " %",
          }),
          triSur: c => c.tauxManquants },
      ], qualite, { parPage: 20, compact: true }),
    ]),

    h("div.carte", [
      h("div.carte__entete", [
        h("h3", { texte: "Aperçu des données" }),
        h("span.texte-secondaire", {
          texte: colonnes.length > 12
            ? `12 premières colonnes sur ${colonnes.length}, 100 premières lignes`
            : "100 premières lignes",
        }),
      ]),
      apercu,
    ]),
  ]);
}

async function menuExport(jeu) {
  const colonnes = colonnesTypees(jeu);
  const choix = await modale({
    titre: "Exporter le jeu de données",
    largeur: "460px",
    contenu: h("div", [
      h("p.texte-secondaire", {
        texte: "Le format CSV s'ouvre dans Excel, R, SPSS, Stata et jamovi. " +
          "L'export vers R inclut un script d'analyse prêt à exécuter.",
      }),
      h("div", { style: { display: "flex", flexDirection: "column", gap: "8px" } }, [
        h("button.btn", { texte: "📊  CSV (Excel, SPSS, Stata)", onclick: () => choisir("csv") }),
        h("button.btn", { texte: "📗  Classeur Excel (.xlsx)", onclick: () => choisir("xlsx") }),
        h("button.btn", { texte: "📐  CSV + script R", onclick: () => choisir("r") }),
        h("button.btn", { texte: "🔢  Syntaxe SPSS", onclick: () => choisir("spss") }),
        h("button.btn", { texte: "🗂️  JSON", onclick: () => choisir("json") }),
      ]),
    ]),
    actions: [{ libelle: "Annuler", type: "neutre", valeur: null }],
  });
  function choisir(type) {
    document.querySelector(".modale__fond")?.remove();
    exporter(type, jeu, colonnes);
  }
  return choix;
}

async function exporter(type, jeu, colonnes) {
  const base = jeu.nom.replace(/[^\w\-]+/g, "_").toLowerCase().slice(0, 40) || "jeu";
  const cles = colonnes.map(c => c.cle);
  try {
    if (type === "csv") {
      telecharger(versCSV(jeu.lignes, cles), `${base}.csv`, "text/csv");
    } else if (type === "xlsx") {
      const blob = versXLSX([
        { nom: "Données", entetes: colonnes.map(c => c.nom),
          lignes: jeu.lignes.map(l => cles.map(k => l[k])) },
        { nom: "Variables", entetes: ["Clé", "Libellé", "Type", "Manquants"],
          lignes: colonnes.map(c => [c.cle, c.nom, c.type, c.manquants]) },
      ]);
      telecharger(blob, `${base}.xlsx`);
    } else if (type === "json") {
      telecharger(JSON.stringify({ nom: jeu.nom, variables: colonnes, lignes: jeu.lignes }, null, 1),
        `${base}.json`, "application/json");
    } else {
      const ex = exportStatistique(jeu.lignes, colonnes, { nom: base, anonymise: jeu.anonymise });
      telecharger(ex.csv, `${base}.csv`, "text/csv");
      // Le script est téléchargé séparément, pour être ouvert dans R ou SPSS
      setTimeout(() => {
        telecharger(type === "r" ? ex.script : ex.syntaxeSPSS,
          type === "r" ? `${base}.R` : `${base}.sps`, "text/plain");
      }, 400);
    }
    await store.tracer("export", "analyse", jeu.id,
      `Export du jeu « ${jeu.nom} » au format ${type.toUpperCase()}`);
    succes("Export réalisé.");
  } catch (e) { erreur("Export impossible : " + e.message); }
}
