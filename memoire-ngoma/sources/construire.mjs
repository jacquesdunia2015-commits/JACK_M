// construire.mjs — assemble le corpus et produit le projet QualiCode (.projx).
//   node construire.mjs
import { writeFileSync } from "node:fs";
import { AVERTISSEMENT, ETUDE, participants, guide } from "./echantillon.mjs";
import { observations } from "./observations.mjs";
import { arbre, grilleParQuestion, ajustements, grilleObservation, ecarts } from "./codes.mjs";
import * as e12 from "./entretiens-01-02.mjs";
import * as e34 from "./entretiens-03-04.mjs";
import * as e56 from "./entretiens-05-06.mjs";
import * as e78 from "./entretiens-07-08.mjs";
import * as e910 from "./entretiens-09-10.mjs";

const entretiens = { ...e12, ...e34, ...e56, ...e78, ...e910 };

let compteur = 0;
const uid = () => "s" + (++compteur).toString(36).padStart(5, "0");

/* ================================================================
   1. Texte des transcriptions
   On mémorise la position exacte de chaque tour de parole : c'est ce qui
   permet au codage de désigner le passage au caractère près, comme le fait
   une sélection à la souris dans l'application.
================================================================ */
function transcription(p) {
  const e = entretiens[p.code];
  let texte = "";
  const tours = []; // {question, debut, fin}
  const ajouter = s => { texte += s; };

  ajouter(`TRANSCRIPTION D'ENTRETIEN — ${p.code} (${p.cs})\n`);
  ajouter(`${AVERTISSEMENT}\n\n`);
  ajouter(`Date : ${p.date} · Durée : ${p.duree} · Langue de l'entretien : ${p.langue}\n`);
  ajouter(`Qualification : ${p.qualif} · Niveau : ${p.niveau} · Sexe : ${p.sexe} · Âge : ${p.age}\n`);
  ajouter(`Ancienneté totale : ${p.ancTotale} · Ancienneté en CPN : ${p.ancCpn} · Titulaire : ${p.titulaire ? "oui" : "non"}\n`);
  ajouter(`Formation sur les MNT : ${p.formationMnt}${p.anneeFormation ? " (" + p.anneeFormation + ")" : ""}\n`);
  ajouter(`Secteur : ${p.secteur} · Distance à l'hôpital : ${p.distanceHopital} · Volume d'activité : ${p.volume}\n\n`);
  if (p.langue === "kinyarwanda") {
    ajouter(`Transcription verbatim en kinyarwanda par le collaborateur trilingue, puis traduction française par le chercheur (§ 4.2.6). Les termes propres au discours du participant sont conservés en kinyarwanda entre crochets.\n\n`);
  } else {
    ajouter(`Entretien conduit en ${p.langue} et transcrit directement par le chercheur, sans traduction (§ 4.2.6).\n\n`);
  }
  ajouter(`${"=".repeat(64)}\n\n`);

  let axeCourant = "";
  for (const q of guide) {
    if (q.axe !== axeCourant) {
      axeCourant = q.axe;
      ajouter(`--- ${axeCourant.toUpperCase()} ---\n\n`);
    }
    ajouter(`${q.id}. ${q.texte}\n`);
    for (const [qui, prop] of e.reponses[q.id]) {
      if (qui === "E") {
        ajouter(`E : ${prop}\n`);
      } else {
        const etiquette = `${p.code} : `;
        ajouter(etiquette);
        const debut = texte.length;
        ajouter(prop);
        tours.push({ question: q.id, debut, fin: texte.length });
        ajouter("\n");
      }
    }
    ajouter("\n");
  }
  return { texte, tours };
}

/* ================================================================
   2. Texte des comptes rendus d'observation
   « Les notes d'observation sont traitées comme un corpus secondaire :
   saisies en comptes rendus structurés suivant les rubriques du guide »
   (§ 4.2.6).
================================================================ */
function compteRendu(o) {
  let texte = "";
  const rubriques = []; // {lettre, debut, fin}
  const ajouter = s => { texte += s; };
  const bloc = (lettre, titre, corps) => {
    ajouter(`${lettre}. ${titre}\n`);
    const debut = texte.length;
    ajouter(corps.trim());
    rubriques.push({ lettre, debut, fin: texte.length });
    ajouter("\n\n");
  };

  ajouter(`COMPTE RENDU D'OBSERVATION — ${o.cs}\n`);
  ajouter(`${AVERTISSEMENT}\n\n`);
  ajouter(`Code de structure : ${o.cs} · Secteur : ${o.secteur}\n`);
  ajouter(`Date : ${o.date} · Heure de début et de fin : ${o.heures}\n`);
  ajouter(`Observation non participante, portant sur le service et non sur les personnes. Aucun nom de personne, aucune donnée de patiente.\n\n`);
  ajouter(`${"=".repeat(64)}\n\n`);

  bloc("A", "Espace et flux",
    `Nombre de salles affectées à la CPN : ${o.A.sallesCpn}. Espace permettant un échange non entendu : ${o.A.echangeNonEntendu}. ${o.A.detail} ` +
    `Nombre de femmes reçues durant la période : ${o.A.femmesRecues}. Nombre de professionnels assurant la consultation : ${o.A.professionnels}. ` +
    `Poste distinct pour la prise des constantes : ${o.A.posteConstantes}. Durée moyenne observée entre entrée et sortie : ${o.A.dureeMoyenne}.`);

  bloc("B", "Équipements et consommables",
    o.B.map(x => `${x.item} — présent : ${x.present}${x.nombre !== null && x.nombre !== undefined ? `, nombre : ${x.nombre}` : ""}, état : ${x.etat}.${x.obs ? " " + x.obs : ""}`).join("\n") +
    `\nRupture de stock signalée au cours des trois derniers mois : ${o.ruptureTroisMois}.`);

  bloc("C", "Protocoles et supports",
    o.C.map(x => `${x.item} — présent : ${x.present}, accessible au poste de travail : ${x.accessible}.${x.obs ? " " + x.obs : ""}`).join("\n"));

  bloc("D", "Enregistrement des données (supports agrégés uniquement)",
    `Rubrique prévue pour la tension artérielle : ${o.D.rubriqueTa}. Rubrique prévue pour la glycémie : ${o.D.rubriqueGlycemie}. ` +
    `${o.D.renseignement} Traçage des cas orientés vers l'hôpital : ${o.D.tracageReference}.`);

  bloc("E", "Notes contextuelles libres", o.E);
  bloc("F", "Réflexivité", o.F);

  return { texte, rubriques };
}

/* ================================================================
   3. Construction du projet
================================================================ */
const maintenant = new Date("2026-09-20T09:00:00Z").toISOString();
const projet = {
  format: "qualicode-projx", version: 1, id: "memoire-ngoma-simulation",
  name: "Mémoire Ngoma — SIMULATION de formation",
  created: maintenant, modified: maintenant,
  memo: "", documentGroups: [], documents: [], codes: [], segments: [],
  memos: [], variables: [], trash: { documents: [], codes: [] },
  savedQueries: [], conceptMaps: [], bibliography: [],
};

// --- Variables de document (permettent les comparaisons de groupes)
projet.variables = [
  "type_document", "code_structure", "qualification", "sexe", "tranche_age",
  "niveau_formation", "anciennete_totale", "anciennete_cpn", "titulaire",
  "formation_mnt", "secteur", "distance_hopital", "volume_activite",
  "pauvrete_secteur", "langue_entretien",
];

// --- Groupes de documents
const gEntretiens = { id: uid(), name: "Entretiens (corpus principal)" };
const gObservations = { id: uid(), name: "Observations (corpus secondaire)" };
projet.documentGroups.push(gEntretiens, gObservations);

// --- Codes (arbre à deux niveaux)
const idCode = {};
for (const famille of arbre) {
  const f = { id: uid(), name: famille.nom, parentId: null, color: famille.couleur, created: maintenant };
  projet.codes.push(f);
  idCode[famille.id] = f.id;
  for (const enfant of famille.enfants) {
    const c = { id: uid(), name: enfant.nom, parentId: f.id, color: famille.couleur, created: maintenant };
    projet.codes.push(c);
    idCode[enfant.id] = c.id;
  }
}

// --- Documents d'entretien + codage
function codesPour(participant, question) {
  const base = grilleParQuestion[question] || [];
  const regle = (ajustements[participant] || {})[question];
  if (!regle) return base;
  if (regle.startsWith("=")) return regle.slice(1).split(",").filter(Boolean);
  return [...new Set([...base, ...regle.replace(/^\+/, "").split(",").filter(Boolean)])];
}

const docParParticipant = {};
for (const p of participants) {
  const { texte, tours } = transcription(p);
  const doc = {
    id: uid(), name: `Entretien ${p.code} — ${p.cs} (${p.qualif})`,
    groupId: gEntretiens.id, text: texte, created: maintenant,
    variables: {
      type_document: "entretien", code_structure: p.cs, qualification: p.qualif,
      sexe: p.sexe, tranche_age: p.age, niveau_formation: p.niveau,
      anciennete_totale: p.ancTotale, anciennete_cpn: p.ancCpn,
      titulaire: p.titulaire ? "oui" : "non",
      formation_mnt: p.formationMnt, secteur: p.secteur,
      distance_hopital: p.distanceHopital, volume_activite: p.volume,
      pauvrete_secteur: p.pauvreteSecteur, langue_entretien: p.langue,
    },
  };
  projet.documents.push(doc);
  docParParticipant[p.code] = doc;

  for (const tour of tours) {
    for (const c of codesPour(p.code, tour.question)) {
      if (!idCode[c]) throw new Error(`code inconnu : ${c} (${p.code}/${tour.question})`);
      projet.segments.push({
        id: uid(), docId: doc.id, codeId: idCode[c],
        start: tour.debut, end: tour.fin,
        text: texte.slice(tour.debut, tour.fin),
        weight: 1, comment: "", created: maintenant, coder: "C1",
      });
    }
  }

  // Journal de bord → mémo de document
  projet.memos.push({
    id: uid(), targetType: "document", targetId: doc.id,
    title: "Journal de bord — conditions de l'entretien",
    text: entretiens[p.code].journal, created: maintenant,
  });
}

// --- Documents d'observation + codage
const docParCentre = {};
for (const o of observations) {
  const { texte, rubriques } = compteRendu(o);
  const doc = {
    id: uid(), name: `Observation ${o.cs} (${o.secteur})`,
    groupId: gObservations.id, text: texte, created: maintenant,
    variables: {
      type_document: "observation", code_structure: o.cs,
      secteur: o.secteur,
      volume_activite: o.A.femmesRecues >= 35 ? "élevé" : "modéré",
    },
  };
  projet.documents.push(doc);
  docParCentre[o.cs] = doc;

  for (const r of rubriques) {
    for (const c of grilleObservation[r.lettre] || []) {
      projet.segments.push({
        id: uid(), docId: doc.id, codeId: idCode[c],
        start: r.debut, end: r.fin, text: texte.slice(r.debut, r.fin),
        weight: 1, comment: "", created: maintenant, coder: "C1",
      });
    }
  }

  // Écart déclaré / constaté : codé sur la rubrique F (réflexivité), avec le
  // constat en commentaire de segment — c'est là que la triangulation se lit.
  const ecart = ecarts.find(x => x.cs === o.cs);
  if (ecart) {
    const rF = rubriques.find(r => r.lettre === "F");
    projet.segments.push({
      id: uid(), docId: doc.id, codeId: idCode["J5"],
      start: rF.debut, end: rF.fin, text: texte.slice(rF.debut, rF.fin),
      weight: 3, comment: ecart.constat, created: maintenant, coder: "C1",
    });
  }
}

/* ================================================================
   4. Double codage (§ 4.2.6 : dépendabilité)
   Un second codeur reprend trois entretiens à l'aveugle. L'accord n'est pas
   total — c'est précisément ce que le kappa doit mesurer. Sans désaccord, le
   contrôle ne contrôlerait rien.
================================================================ */
const relus = ["P02", "P06", "P09"];
let desaccords = 0;
for (const code of relus) {
  const doc = docParParticipant[code];
  const originaux = projet.segments.filter(s => s.docId === doc.id && s.coder === "C1");
  // Les désaccords sont de trois natures, celles qu'on rencontre réellement :
  // un passage non retenu, une borne placée ailleurs, et un code voisin choisi
  // à la place d'un autre. Un second codage qui reproduirait le premier à
  // l'identique donnerait un kappa proche de 1 et ne contrôlerait rien.
  const freres = { C4: "C6", G3: "G7", H2: "H4", E2: "E7", B2: "B6", F2: "F3", D2: "D4", A3: "A5" };
  const idVers = Object.fromEntries(Object.entries(idCode).map(([k, v]) => [v, k]));
  originaux.forEach((s, i) => {
    if (i % 5 === 2) { desaccords++; return; }            // passage non retenu
    const decalage = i % 8 === 5 ? 60 : 0;                 // borne déplacée
    let codeId = s.codeId;
    const cle = idVers[s.codeId];
    if (i % 10 === 4 && freres[cle]) { codeId = idCode[freres[cle]]; desaccords++; } // code voisin
    if (decalage) desaccords++;
    const debut = Math.min(s.start + decalage, s.end - 1);
    projet.segments.push({
      id: uid(), docId: doc.id, codeId,
      start: debut, end: s.end, text: doc.text.slice(debut, s.end),
      weight: 1, comment: "", created: maintenant, coder: "C2",
    });
  });
  // Et il ajoute un code que le premier codeur n'avait pas vu.
  const rF = originaux[originaux.length - 1];
  projet.segments.push({
    id: uid(), docId: doc.id, codeId: idCode["H5"],
    start: rF.start, end: rF.end, text: doc.text.slice(rF.start, rF.end),
    weight: 1, comment: "Codé par C2 uniquement — à discuter en séance de consensus.",
    created: maintenant, coder: "C2",
  });
  desaccords++;
}

/* ================================================================
   5. Mémos analytiques
================================================================ */
projet.memo = `PROJET DE FORMATION — ${AVERTISSEMENT}

Ce projet reproduit, de bout en bout, le traitement prévu au § 4.2.6 du protocole
de recherche « ${ETUDE.titre} » (${ETUDE.chercheur}, ${ETUDE.institution}).

Il ne contient AUCUNE donnée réelle. Les dix entretiens et les cinq observations
ont été entièrement simulés pour permettre d'apprendre à manipuler l'outil avant
la collecte. Aucun extrait ne peut être cité, aucun résultat ne peut être
rapporté.

Composition (Tableau II du protocole) : 5 infirmiers, 5 sages-femmes, 5 centres
de santé codés, couvrant les sept dimensions de variation — qualification,
fonction, ancienneté en CPN, secteur, distance à l'hôpital, volume d'activité,
profil socio-économique du secteur.

Analyse : analyse thématique en six phases (Braun & Clarke), approche hybride.
La grille initiale dérive du Tableau III ; 21 des 79 codes sont inductifs et
signalés « [inductif] » dans leur intitulé. Les notes d'observation forment un
corpus secondaire intégré au même arbre.

Double codage : trois entretiens (P02, P06, P09) ont été recodés par un second
codeur (étiquette C2) pour permettre le calcul du kappa de Cohen — Analyse ▸
Accord inter-codeurs.

NOTE SUR LE KINYARWANDA : les termes insérés entre crochets sont illustratifs et
doivent être vérifiés par un locuteur natif avant tout usage. Ils montrent où
placer ces termes, non comment les écrire.`;

const memoTheme = (titre, texte) => projet.memos.push({
  id: uid(), targetType: "project", targetId: null, title: titre, text: texte, created: maintenant,
});

memoTheme("Phase 1 — Familiarisation (journal)",
`Lecture intégrale des dix transcriptions et des cinq comptes rendus avant tout codage.

Premières impressions, notées avant d'ouvrir l'arbre de codes :

1. La tension artérielle et la glycémie ne sont pas un seul objet. La première est
   un geste intégré, presque irréfléchi ; la seconde a quitté le champ du possible
   et, avec lui, le champ de la pensée. Plusieurs participants le disent presque
   mot pour mot : ce qu'on ne peut pas faire, on cesse d'y penser.
2. Le mot « équité » n'est jamais prononcé par l'enquêteur, conformément au guide.
   Deux participantes l'introduisent d'elles-mêmes (P09, P10) — à signaler dans
   les résultats, car cela renseigne sur la disponibilité du concept chez les
   professionnels.
3. La modulation de l'information selon la femme est reconnue spontanément par
   plusieurs participants, et reconnue comme allant à l'inverse de ce qu'il
   faudrait. C'est le mécanisme d'inégalité le plus directement documenté.
4. Le facteur qui revient le plus souvent n'est ni la formation ni l'équipement :
   c'est l'heure d'arrivée de la femme. Cela ne figurait pas dans le cadre
   conceptuel.`);

memoTheme("Phase 3 — Thèmes provisoires",
`Quatre thèmes candidats, issus du regroupement des codes :

T1. « Un dépistage coupé en deux » — la tension mesurée, le sucre absent.
    Codes : B1, B2, B6, E2, F5, A5, D5.
T2. « Expliquer moins à celles qui savent le moins » — la modulation de
    l'information comme mécanisme d'inégalité produit par le service.
    Codes : C4, C5, C6, C8, G3, G7, H5.
T3. « Trouver sans pouvoir suivre » — la détection sans circuit effectif :
    référence sans retour, transport introuvable, disparition après
    l'accouchement. Codes : B4, F2, F3, F6, G2, G4, I6.
T4. « Ce qui est compté existe » — l'absence d'indicateur comme cause première
    de l'absence d'intrants, de maintenance et d'attention.
    Codes : E4, E7, F4, I5.

À vérifier en phase 4 : T2 et T4 se recoupent-ils ? Non — T2 se joue dans
l'interaction, T4 dans le système. Ils se rejoignent seulement dans le jugement
d'équité (famille H), qui n'est donc pas un thème mais le lieu de leur
articulation.`);

memoTheme("Phase 4 — Revue : un thème écarté",
`Le thème provisoire « résistance des femmes » a été ÉCARTÉ, et la trace de ce
retrait importe autant que les thèmes retenus.

Il reposait sur les propos d'un seul participant (P05, codes G6) attribuant le
non-recours à la « mentalité » des femmes. Confronté à l'ensemble des extraits
codés puis au corpus entier, ce thème ne tenait pas : les autres participants
expliquent le non-recours par la distance, le coût, la charge domestique et,
pour deux d'entre eux, par les ruptures du service lui-même (G8).

Conformément au § 4.2.7, ces propos ne sont pas écartés du corpus ni corrigés :
ils sont analysés comme une REPRÉSENTATION PROFESSIONNELLE (code G6), jamais
comme une description de la réalité des femmes. Ils restent un résultat — sur
les prestataires, non sur les patientes.`);

memoTheme("Triangulation — écarts déclaré / constaté",
ecarts.map(x => `${x.cs} — ${x.constat}`).join("\n\n") +
`\n\nAucun de ces écarts n'est imputé à une intention du participant : ils
informent sur l'écart entre la norme énoncée et la condition d'exercice
(§ 4.2.6). Le cas de CS14 est une CONCORDANCE, consignée au même titre.`);

memoTheme("Piste d'audit — décisions de codage",
`1. Les tours de parole du participant sont l'unité de codage. Les relances de
   l'enquêteur ne sont pas codées : elles ne sont pas des données.
2. Un segment peut porter plusieurs codes (codage multiple). Les co-occurrences
   qui en résultent sont interprétables — voir Analyse ▸ Co-occurrences.
3. Les segments d'observation sont codés par rubrique entière (A à F), la
   rubrique étant l'unité de sens de la grille.
4. Les écarts déclaré/constaté portent un poids de 3, pour les retrouver
   immédiatement par tri.
5. Créations inductives notables, avec leur motif :
   • H7 « l'heure d'arrivée comme facteur d'inégalité » — cinq participants
     décrivent une inégalité produite par le moment de la venue, absente du
     cadre conceptuel.
   • F4 « ce qui est compté existe » — formulation de P09, reprise parce
     qu'elle nomme un mécanisme que quatre autres décrivent sans le nommer.
   • F6 « discontinuité après l'accouchement » — soulevée spontanément en Q20
     par quatre participants, alors que le guide ne l'aborde pas.
   • G8 « le service comme cause du non-retour » — renverse la question Q14 :
     ce ne sont pas seulement les femmes qui ne reviennent pas, c'est le
     service qui les décourage.
   Ces quatre codes appellent une révision du cadre conceptuel, prévue comme
   possible au § 3.2 (« le cadre est heuristique et révisable »).`);

// Mémos de définition, sur les familles de codes
const definitions = {
  A: "Signification et valeur conférées au dépistage dans le cadre de la CPN (Tableau III). Coder ici les justifications spontanées, les comparaisons avec d'autres actes, l'adhésion ou la réserve — pas les descriptions de gestes, qui vont en famille 2.",
  C: "Ce qui est transmis à la femme, fondement de sa capacité à agir. C'est la famille qui porte la dimension capacitante du dépistage : sans elle, mesurer n'est pas dépister. C4 (modulation) est le code central pour l'objectif spécifique 1.",
  G: "ATTENTION — représentations professionnelles, jamais descriptions de la réalité des femmes. Les femmes enceintes ne font pas partie de la population d'étude (§ 4.2.2.1). Tout extrait de cette famille se rapporte à ce que le prestataire perçoit et mobilise, et se rapporte ainsi dans le mémoire.",
  H: "Appréciation du caractère équitable de la distribution effective du dépistage, et jugement porté sur elle. Famille rattachée à la question Q19, qui porte à elle seule la dimension évaluative de l'étude. Coder les formulations sur le normal et l'anormal, le regret, la résignation, la révolte, et l'attribution de responsabilité.",
  J: "Corpus secondaire. Sert de contexte et de contrepoint, non de preuve de ce que font les personnes : l'observation ne porte jamais sur un professionnel ni sur le contenu d'une consultation (annexe 2).",
};
for (const [famille, texte] of Object.entries(definitions)) {
  projet.memos.push({
    id: uid(), targetType: "code", targetId: idCode[famille],
    title: "Définition et règle d'application", text: texte, created: maintenant,
  });
}

/* ================================================================
   6. Requêtes sauvegardées
================================================================ */
const tousDocs = projet.documents.map(d => d.id);
const entretiensDocs = projet.documents.filter(d => d.variables.type_document === "entretien").map(d => d.id);
const q = (name, docs, codes, mode = "or") => projet.savedQueries.push({
  id: uid(), name, activatedDocs: docs, activatedCodes: codes.map(c => idCode[c]),
  retrievalMode: mode, created: maintenant,
});
q("T2 — Modulation de l'information (mécanisme d'inégalité)", entretiensDocs, ["C4", "C5", "C6", "C8", "G3"]);
q("T1 — Le dépistage coupé en deux", entretiensDocs, ["B1", "B2", "B6", "E2", "F5"]);
q("T3 — Trouver sans pouvoir suivre", entretiensDocs, ["B4", "F2", "F3", "F6", "I6"]);
q("T4 — Ce qui est compté existe", entretiensDocs, ["E4", "E7", "F4", "I5"]);
q("Q19 — Jugements d'équité", entretiensDocs, ["H1", "H2", "H3", "H4", "H5", "H6", "H7", "H8"]);
q("Représentations sur les femmes (à manier avec précaution)", entretiensDocs, ["G6", "G3", "G4"]);
q("Écarts déclaré / constaté", tousDocs, ["J5"]);
q("Codes inductifs — révision du cadre", entretiensDocs, ["H7", "F4", "F6", "G8", "A5", "D5"]);

/* ================================================================
   7. Carte conceptuelle (figure 1 du protocole, version codée)
================================================================ */
projet.conceptMaps.push({
  id: uid(), name: "Cadre conceptuel — articulation des deux ensembles",
  nodes: [
    { id: "n1", label: "Charte d'Ottawa\n(justice sociale, équité)", x: 320, y: 20, color: "#17334f", width: 230, height: 60 },
    { id: "n2", label: "ENSEMBLE 1\nSens attribué et pratiques déclarées\n(OS1)", x: 60, y: 140, color: "#4e79a7", width: 250, height: 70 },
    { id: "n3", label: "ENSEMBLE 2\nConditions perçues (4 niveaux)\n(OS2)", x: 560, y: 140, color: "#e15759", width: 250, height: 70 },
    { id: "n4", label: "Sens attribué", x: 40, y: 250, color: "#4e79a7", width: 140, height: 44 },
    { id: "n5", label: "Pratiques techniques", x: 190, y: 250, color: "#59a14f", width: 150, height: 44 },
    { id: "n6", label: "Pratique informative\n(capacitation)", x: 115, y: 320, color: "#f28e2b", width: 170, height: 50 },
    { id: "n7", label: "Individuel /\nprofessionnel", x: 520, y: 250, color: "#b07aa1", width: 130, height: 44 },
    { id: "n8", label: "Organisationnel", x: 660, y: 250, color: "#e15759", width: 130, height: 44 },
    { id: "n9", label: "Systémique /\npolitique", x: 520, y: 320, color: "#76b7b2", width: 130, height: 44 },
    { id: "n10", label: "Social perçu", x: 660, y: 320, color: "#edc948", width: 130, height: 44 },
    { id: "n11", label: "Portée reconnue\nen équité (Q19)", x: 330, y: 420, color: "#9c755f", width: 180, height: 50 },
    { id: "n12", label: "Transformations\nproposées", x: 560, y: 420, color: "#ff9da7", width: 160, height: 50 },
    { id: "n13", label: "ÉQUITÉ D'ACCÈS AU DÉPISTAGE CAPACITANT\n(construction commune, non mesurée)", x: 240, y: 520, color: "#17334f", width: 380, height: 60 },
  ],
  edges: [
    { id: "e1", from: "n1", to: "n2", label: "cadre mobilisé" },
    { id: "e2", from: "n1", to: "n3", label: "cadre mobilisé" },
    { id: "e3", from: "n2", to: "n4", label: "" },
    { id: "e4", from: "n2", to: "n5", label: "" },
    { id: "e5", from: "n2", to: "n6", label: "" },
    { id: "e6", from: "n3", to: "n7", label: "" },
    { id: "e7", from: "n3", to: "n8", label: "" },
    { id: "e8", from: "n3", to: "n9", label: "" },
    { id: "e9", from: "n3", to: "n10", label: "" },
    { id: "e10", from: "n2", to: "n3", label: "articulation bidirectionnelle" },
    { id: "e11", from: "n3", to: "n11", label: "" },
    { id: "e12", from: "n11", to: "n12", label: "" },
    { id: "e13", from: "n6", to: "n13", label: "" },
    { id: "e14", from: "n11", to: "n13", label: "" },
  ],
});

/* ================================================================
   8. Bibliographie méthodologique
   Références réelles, à recouper avec la liste du protocole avant citation.
================================================================ */
const ref = (o) => projet.bibliography.push({ id: uid(), ...o });
ref({ type: "article", authors: "Braun V, Clarke V", year: "2006", title: "Using thematic analysis in psychology", container: "Qualitative Research in Psychology, 3(2), 77-101", doi: "10.1191/1478088706qp063oa", notes: "Les six phases suivies au § 4.2.6." });
ref({ type: "article", authors: "Braun V, Clarke V", year: "2021", title: "To saturate or not to saturate? Questioning data saturation as a useful concept for thematic analysis and sample-size rationales", container: "Qualitative Research in Sport, Exercise and Health, 13(2), 201-216", doi: "10.1080/2159676X.2019.1704846", notes: "Mise en question de la saturation comme justification d'effectif (§ 4.2.3.1)." });
ref({ type: "article", authors: "Malterud K, Siersma VD, Guassora AD", year: "2016", title: "Sample size in qualitative interview studies: guided by information power", container: "Qualitative Health Research, 26(13), 1753-1760", doi: "10.1177/1049732315617444", notes: "Principe de puissance informationnelle retenu pour la taille de l'échantillon." });
ref({ type: "article", authors: "Tong A, Sainsbury P, Craig J", year: "2007", title: "Consolidated criteria for reporting qualitative research (COREQ): a 32-item checklist for interviews and focus groups", container: "International Journal for Quality in Health Care, 19(6), 349-357", doi: "10.1093/intqhc/mzm042", notes: "Grille de rapportage annoncée en annexe 8." });
ref({ type: "article", authors: "Landis JR, Koch GG", year: "1977", title: "The measurement of observer agreement for categorical data", container: "Biometrics, 33(1), 159-174", doi: "10.2307/2529310", notes: "Interprétation du kappa employée par l'application." });
ref({ type: "rapport", authors: "Organisation mondiale de la Santé", year: "1986", title: "Charte d'Ottawa pour la promotion de la santé", container: "Première Conférence internationale sur la promotion de la santé, Ottawa", doi: "", notes: "Cadre théorique de l'étude (§ 3.1.1)." });

/* ================================================================
   9. Écriture
================================================================ */
writeFileSync("Memoire_Ngoma_SIMULATION.projx", JSON.stringify(projet, null, 2), "utf8");

const parCoder = projet.segments.reduce((a, s) => { a[s.coder] = (a[s.coder] || 0) + 1; return a; }, {});
console.log(`Projet écrit : Memoire_Ngoma_SIMULATION.projx`);
console.log(`  ${projet.documents.length} documents (${projet.documents.filter(d => d.variables.type_document === "entretien").length} entretiens, ${projet.documents.filter(d => d.variables.type_document === "observation").length} observations)`);
console.log(`  ${projet.codes.length} codes (${projet.codes.filter(c => !c.parentId).length} familles)`);
console.log(`  ${projet.segments.length} segments codés — par codeur : ${JSON.stringify(parCoder)}`);
console.log(`  ${projet.memos.length} mémos · ${projet.savedQueries.length} requêtes · ${projet.variables.length} variables · ${projet.bibliography.length} références`);
console.log(`  ${projet.documents.reduce((s, d) => s + d.text.length, 0).toLocaleString("fr-FR")} caractères de corpus`);
console.log(`  désaccords introduits volontairement pour le double codage : ${desaccords}`);
