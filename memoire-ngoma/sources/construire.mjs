// construire.mjs — assemble le corpus et produit le projet QualiCode (.projx).
//   node construire.mjs
import { TITRE_POSITIONNALITE, TEXTE_POSITIONNALITE } from "./positionnalite.mjs";
import { blocs as blocsResultats } from "./resultats.mjs";
import { writeFileSync } from "node:fs";
import { AVERTISSEMENT, ETUDE, participants, guide } from "./echantillon.mjs";
import { participantsV2 } from "./echantillon-vague2.mjs";
import { observations } from "./observations.mjs";
import { observationsV2 } from "./observations-vague2.mjs";
import { consentementDe } from "./consentements.mjs";
import { interCoderAgreement } from "../../js/merge.js";
import { arbre, grilleParQuestion, ajustements, ajustementsV2, grilleObservation, ecarts, ecartsV2 } from "./codes.mjs";
import * as e12 from "./entretiens-01-02.mjs";
import * as e34 from "./entretiens-03-04.mjs";
import * as e56 from "./entretiens-05-06.mjs";
import * as e78 from "./entretiens-07-08.mjs";
import * as e910 from "./entretiens-09-10.mjs";
import * as e1113 from "./entretiens-11-13.mjs";
import * as e1416 from "./entretiens-14-16.mjs";
import * as e1719 from "./entretiens-17-19.mjs";
import * as e20 from "./entretiens-20.mjs";

const entretiens = { ...e12, ...e34, ...e56, ...e78, ...e910, ...e1113, ...e1416, ...e1719, ...e20 };

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

  if (o.S) bloc("S", "Séance d'éducation collective (rubrique ajoutée)",
    `Fréquence déclarée : ${o.S.frequence}. Séance observée ce jour : ${o.S.observee}. ${o.S.detail} Tension et sucre abordés : ${o.S.sujets}.`);

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

/* Mémos de la vague 1 — inchangés depuis la première simulation. */
function memosVague1({ projet, memoTheme, ecarts }) {
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

}

function construireProjet(cfg) {
  /* ================================================================
     3. Construction du projet
  ================================================================ */
  const maintenant = new Date(cfg.date).toISOString();
  const vague1 = new Set(participants.map(x => x.code));
  const centresV1 = new Set(observations.map(o => o.cs));
  const projet = {
    format: "qualicode-projx", version: 1, id: cfg.id,
    name: cfg.nom,
    created: maintenant,
    // Date de fabrication : plus récente que toute copie antérieure du même
    // projet, elle évite l'avertissement « fichier plus ancien » à l'ouverture.
    modified: cfg.modifie || maintenant,
    versionSimulation: cfg.versionSimulation,
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
    "vague", "enregistrement_autorise", "citation_autorisee", "recontact_accepte",
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
      // Le projet de la vague 1 ne connaît pas les codes nés de la vague 2 :
      // ils n'existaient pas encore quand ce corpus a été codé.
      if (cfg.exclureVague2 && /vague 2/.test(enfant.nom)) continue;
      const c = { id: uid(), name: enfant.nom, parentId: f.id, color: famille.couleur, created: maintenant };
      projet.codes.push(c);
      idCode[enfant.id] = c.id;
    }
  }

  // --- Documents d'entretien + codage
  function codesPour(participant, question) {
    const base = grilleParQuestion[question] || [];
    const regle = (cfg.ajustements[participant] || {})[question];
    if (!regle) return base;
    if (regle.startsWith("=")) return regle.slice(1).split(",").filter(Boolean);
    return [...new Set([...base, ...regle.replace(/^\+/, "").split(",").filter(Boolean)])];
  }

  const docParParticipant = {};
  for (const p of cfg.participants) {
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
        vague: vague1.has(p.code) ? "1" : "2",
        enregistrement_autorise: consentementDe(p.code).enregistrement,
        citation_autorisee: consentementDe(p.code).citation,
        recontact_accepte: consentementDe(p.code).recontact,
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
  for (const o of cfg.observations) {
    const { texte, rubriques } = compteRendu(o);
    const doc = {
      id: uid(), name: `Observation ${o.cs} (${o.secteur})`,
      groupId: gObservations.id, text: texte, created: maintenant,
      variables: {
        type_document: "observation", code_structure: o.cs,
        secteur: o.secteur,
        volume_activite: o.A.femmesRecues >= 35 ? "élevé" : "modéré",
        vague: centresV1.has(o.cs) ? "1" : "2",
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
    const ecart = cfg.ecarts.find(x => x.cs === o.cs);
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
  const relus = cfg.relus;
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

  /* Stabilité intra-codeur (annexe 8 : « contrôle de stabilité intra-codeur »).
     Le premier codeur recode deux entretiens plusieurs semaines plus tard, sans
     revoir son premier codage. Les écarts sont plus rares qu'entre deux
     codeurs — c'est ce qu'on attend — mais pas nuls : un codeur dérive. */
  let ecartsIntra = 0;
  for (const code of cfg.intraCodeur || []) {
    const doc = docParParticipant[code];
    if (!doc) continue;
    const originaux = projet.segments.filter(s => s.docId === doc.id && s.coder === "C1");
    originaux.forEach((s, i) => {
      if (i % 12 === 7) { ecartsIntra++; return; }        // passage non recodé
      const decalage = i % 20 === 11 ? 30 : 0;             // borne déplacée
      if (decalage) ecartsIntra++;
      const debut = Math.min(s.start + decalage, s.end - 1);
      projet.segments.push({
        id: uid(), docId: doc.id, codeId: s.codeId,
        start: debut, end: s.end, text: doc.text.slice(debut, s.end),
        weight: 1, comment: "", created: maintenant, coder: "C1b",
      });
    });
  }

  /* ================================================================
     5. Mémos analytiques
  ================================================================ */
  const memoTheme = (titre, texte) => projet.memos.push({
    id: uid(), targetType: "project", targetId: null, title: titre, text: texte, created: maintenant,
  });

  // Mémos propres à la vague (projet, phases, triangulation, piste d'audit)
  cfg.memos({ projet, memoTheme, ecarts: cfg.ecarts });

  // Mémos de définition, sur les familles de codes
  const definitions = {
    A: "Signification et valeur conférées au dépistage dans le cadre de la CPN (Tableau III). Coder ici les justifications spontanées, les comparaisons avec d'autres actes, l'adhésion ou la réserve — pas les descriptions de gestes, qui vont en famille 2.",
    C: "Ce qui est transmis à la femme, fondement de sa capacité à agir. C'est la famille qui porte la dimension capacitante du dépistage : sans elle, mesurer n'est pas dépister. C4 (modulation) est le code central pour l'objectif spécifique 1.",
    G: "ATTENTION — représentations professionnelles, jamais descriptions de la réalité des femmes. Les femmes enceintes ne font pas partie de la population d'étude (§ 4.2.2.1). Tout extrait de cette famille se rapporte à ce que le prestataire perçoit et mobilise, et se rapporte ainsi dans le mémoire.",
    H: "Appréciation du caractère équitable de la distribution effective du dépistage, et jugement porté sur elle. Famille rattachée à la question Q19, qui porte à elle seule la dimension évaluative de l'étude. Coder les formulations sur le normal et l'anormal, le regret, la résignation, la révolte, et l'attribution de responsabilité.",
    B: "Ce que les participants disent faire, matériellement : séquence de la consultation, gestes, outils, conduite devant un cas. Ce qu'ils en pensent va en famille 1 ; ce qu'ils expliquent à la femme, en famille 3.",
    D: "Ce qui relève de la personne du professionnel : formation initiale et continue, sentiment de compétence, transmission entre collègues. Coder ici le doute exprimé autant que l'assurance.",
    E: "Ce qui relève du fonctionnement du service : charge et flux, équipements, confidentialité, supervision, rotation du personnel. Les décisions prises au-dessus du centre vont en famille 6.",
    F: "Ce qui relève du système et des politiques : directives, approvisionnement, circuit de référence et de contre-référence, indicateurs, continuité après l'accouchement.",
    I: "Ce que les participants jugent nécessaire de changer (Q17, Q18), et — code I8 — ce qu'ils ont déjà changé eux-mêmes. Coder la justification du choix, pas seulement le choix.",
    K: "Hors analyse thématique (questions d'ouverture O1, O2). Sert à la description de l'échantillon et à la mise en confiance ; ne pas en tirer de thème.",
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
  for (const [nom, codes, surTout] of cfg.requetesSup || []) q(nom, surTout ? tousDocs : entretiensDocs, codes);
  // Choisir les citations du mémoire ici : les entretiens dont l'auteur a
  // refusé la citation en sont exclus (§ 4.2.7, accords distincts).
  if (cfg.requeteCitables) {
    const citables = projet.documents
      .filter(d => d.variables.type_document === "entretien" && d.variables.citation_autorisee !== "non")
      .map(d => d.id);
    projet.savedQueries.push({
      id: uid(), name: "Extraits citables (consentement à la citation)",
      activatedDocs: citables,
      activatedCodes: projet.codes.filter(c => c.parentId).map(c => c.id),
      retrievalMode: "or", created: maintenant,
    });
  }

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

  return { projet, desaccords, ecartsIntra };
}

/* ================================================================
   Mémos de la vague 2
================================================================ */
function memosVague2({ projet, memoTheme, ecarts }) {
  projet.memo = `PROJET DE FORMATION — VAGUE 2 — ${AVERTISSEMENT}

Seconde vague simulée : dix participants (5 sages-femmes, 5 infirmiers ou
infirmières) dans les dix centres de l'échantillon que la vague 1 ne couvrait pas
(CS01, CS04, CS05, CS06, CS08, CS09, CS10, CS12, CS13, CS15), avec une
grille d'observation par centre.

Aucune donnée réelle. Aucun extrait ne peut être cité, aucun résultat rapporté.

Même grille de codage que la vague 1, ouverte : onze codes inductifs nouveaux
sont nés de ce matériau, signalés « [inductif, vague 2] ». Double codage sur
trois entretiens (P11, P18, P19, codeur C2).

Pour l'analyse d'ensemble — 20 participants, 15 centres — ouvrir plutôt
Memoire_Ngoma_SIMULATION_complet.projx.`;

  memoTheme("Vague 2 — Familiarisation (journal)",
`Lecture des dix transcriptions et des dix comptes rendus avant codage.

1. Le centre CS01 change la lecture de l'ensemble. Il montre que le dépistage
   complet est réalisable dans le district — et qu'il l'est là où le secteur
   est le moins pauvre et l'hôpital le plus proche. L'inégalité ne se lit donc
   pas seulement DANS les centres, mais ENTRE eux.
2. Même là où tout est fourni, la modulation de l'explication selon l'heure
   persiste (P11 : « le matériel règle l'inégalité du test ; il ne règle pas
   celle de l'explication »). Résultat potentiellement central : il dissocie
   les deux dimensions du dépistage capacitant.
3. Le registre peut masquer ce qu'il est censé montrer (P19, CS13). Un
   indicateur de complétude produit de la complétude, pas nécessairement des
   actes.
4. Plusieurs équipes ont inventé des réponses locales sans attendre le système :
   une affiche dessinée à la main, des piles achetées sur fonds propres,
   un relais par les agents
   communautaires.
5. Une participante (P18) refuse de répondre en catégories de femmes. Ce refus
   est une donnée : il contredit la tendance à la catégorisation observée en
   vague 1 et décrit une autre pratique de l'explication.`);

  memoTheme("Vague 2 — Codes inductifs nouveaux et leur motif",
`B7  Dotation incomplète d'un centre neuf — CS09 : ni rupture ni panne, une
    dotation pas encore arrivée. Forme d'inégalité absente de la vague 1.
C9  Support visuel d'information — l'affiche, imprimée (CS01) ou dessinée à la
    main (CS08), décrite comme ce qui égalise l'explication entre femmes.
E8  Rotation du personnel et perte des savoirs — P14 : « ce que je sais, je le
    tiens d'une personne qui n'est plus là ».
E9  Charge administrative du titulaire — P12 : les titulaires des petits
    centres « sont devenus des secrétaires ».
F7  Registre rempli sans acte — P19 et l'observation de CS13. Code sensible :
    il désigne un effet de système, jamais une faute individuelle.
F8  Contre-référence effective — CS01 : le volet de retour de l'hôpital, seul
    exemple d'une référence qui ne se perd pas.
G9  Relais communautaire — P15, P10 : l'agent de santé communautaire comme
    « yeux après la référence ».
G10 Recours au traitement traditionnel, tel que perçu — P13, P20. Représentation
    professionnelle, à rapporter sans jugement (P13 : « parlez des guérisseurs,
    mais sans mépris »).
G11 Mobilité des femmes et rupture du suivi — P17, CS10 : un suivi organisé
    « autour du centre » et non « autour de la femme ».
H9  Refus de catégoriser les femmes — P18. Contrepoint direct de G6.
I8  Initiative locale déjà mise en œuvre — distinct des transformations
    PROPOSÉES (famille 9) : ici, la transformation est déjà faite, avec les
    moyens du bord.`);

  memoTheme("Vague 2 — Triangulation",
ecarts.map(x => `${x.cs} — ${x.constat}`).join("\n\n") +
`\n\nLa vague 2 produit surtout des CONCORDANCES. C'est un résultat, pas une
absence de résultat : les écarts de la vague 1 ne permettent pas de supposer
que les déclarations des participants sont en général contredites par le
terrain.`);

  memoTheme("Vague 2 — Piste d'audit",
`1. Même unité de codage qu'en vague 1 : le tour de parole du participant.
2. Les codes de la vague 1 n'ont été ni renommés ni redéfinis ; les onze codes
   nouveaux s'y ajoutent sans les remplacer, pour que les deux vagues restent
   comparables.
3. Les propos de P20 sur le recours aux guérisseurs et sur la « vie d'ici »
   sont codés G6 (responsabilité attribuée à la femme) seulement en Q11, où
   ils prennent cette forme ; ailleurs, G10 suffit. Décision à revoir en
   séance de consensus.
4. La concentration de valeurs identiques dans le registre de CS13 n'est
   consignée qu'en note d'observation, sans relevé chiffré nominatif, et ne
   sera jamais rapportée en association avec le code de structure.`);
}

/* ================================================================
   Mémos de l'ensemble (vague 1 + vague 2)
================================================================ */
function memosComplet({ projet, memoTheme, ecarts }) {
  projet.memo = `PROJET DE FORMATION — CORPUS COMPLET — ${AVERTISSEMENT}

Réunion des deux vagues simulées : 20 participants (10 sages-femmes, 10
infirmiers ou infirmières) dans 15 des 16 centres de santé du district — le
seizième a servi au pré-test et n'appartient pas à l'échantillon —, et une
grille d'observation par centre.

C'est la configuration que vise le protocole : seize à vingt-quatre
participants, au moins un par centre, un second où l'activité le permet
(§ 4.2.3.1). C'est donc sur ce projet qu'il faut s'exercer à l'analyse
d'ensemble — comparaisons de groupes, revue des thèmes, suffisance
informationnelle.

Aucune donnée réelle. Aucun extrait ne peut être cité, aucun résultat rapporté.

Double codage : trois entretiens recodés par un pair extérieur (P02, P11, P18 ;
codeur C2), comme prévu au § 4.2.5.6.

NOTE SUR LE KINYARWANDA : les termes entre crochets sont illustratifs et
doivent être vérifiés par un locuteur natif.`;

  memoTheme("Phase 3 — Thèmes révisés après la vague 2",
`Les quatre thèmes provisoires de la vague 1 tiennent, mais deux sont précisés
et trois s'ajoutent.

T1. « Un dépistage coupé en deux » — PRÉCISÉ. Aucun centre n'a de glucomètre en
    salle de CPN : la glycémie passe par le laboratoire du centre ou par la
    consultation des maladies chroniques, qui gèrent les bandelettes. Le thème
    est faux à CS01, où le circuit « bon de CPN → laboratoire » fonctionne : il
    ne tient donc pas à la nature du dépistage glycémique, mais à l'organisation
    de ce circuit et aux moyens du laboratoire. Nouveau code B8. Même là où le
    circuit fonctionne, la glycémie prévue pour toutes à la première CPN reste
    unique : elle n'est refaite que sur signes d'appel, sans épreuve de charge
    à 24-28 semaines, quand apparaît le diabète gestationnel. Nouveau code B9.
T2. « Expliquer moins à celles qui savent le moins » — PRÉCISÉ. Persiste là où
    tous les intrants sont disponibles (P11) : la modulation de l'explication
    est indépendante de l'équipement. Deux contre-pratiques documentées :
    l'image commune (C9) et la vérification de la compréhension (C8, P18).
T3. « Trouver sans pouvoir suivre » — enrichi : la mobilité des femmes (G11)
    et la contre-référence effective de CS01 (F8) en éclairent les deux bouts.
T4. « Ce qui est compté existe » — inchangé, mais il appelle T6.
T5. « Ce que change la dotation — et ce qu'elle ne change pas » — NOUVEAU.
    Codes : B2, E2, F5, F8, C9. Le contraste CS01 / centres ruraux.
T6. « Le registre comme écran » — NOUVEAU. Codes : F7, F4, E4. Un contrôle
    portant sur la complétude produit de la complétude, et peut rendre
    invisible l'inégalité qu'il devrait révéler (P19 : « une inégalité qu'on
    ne voit pas, personne ne la corrigera »). Revers de T4.
T7. « Le dépistage hors des murs » — NOUVEAU. Codes : G9, I8, F6. Relais
    communautaires, affiche faite main, piles achetées : ce que les équipes
    construisent là où le système ne prévoit rien.`);

  memoTheme("Phase 4 — Revue des thèmes",
`1. Le thème « résistance des femmes », écarté en vague 1, reste écarté. La
   vague 2 renforce la décision : un seul participant (P20) y fait écho, sur
   le mode de la résignation plutôt que du reproche, et P18 en récuse
   explicitement la prémisse. Ces propos demeurent des représentations
   professionnelles (G6, H9), analysées comme telles.
2. « Femmes mobiles » (G11) a été envisagé comme thème autonome, puis rattaché
   à T3 : il décrit une modalité particulière de la perte de suivi, non un
   mécanisme distinct. Confronté au corpus entier, il ne concerne qu'un centre.
3. T4 et T6 ont été un moment fusionnés, puis séparés : T4 dit que ce qui n'est
   pas compté manque ; T6, que ce qui est compté peut tromper. Fusionnés, ils
   perdaient leur tension, qui est précisément le résultat.
4. T7 a été vérifié contre le corpus entier : ses initiatives sont toutes
   portées par une personne nommément responsable, ce qui fait leur fragilité
   — élément à garder dans la définition du thème.`);

  memoTheme("Suffisance informationnelle — dimension par dimension (§ 4.2.3.1)",
`Le protocole ne clôt pas la collecte sur un nombre ni sur une saturation, mais
sur une appréciation documentée de la suffisance informationnelle au regard de
CHAQUE dimension du cadre conceptuel. Appréciation sur le corpus :

1. Sens attribué ..................... SUFFISANT. 20 participants, positions
   contrastées (priorité, étape de la fiche, désinvestissement).
2. Pratiques techniques déclarées ..... SUFFISANT. Tension et glycémie
   documentées dans des conditions matérielles très variées.
3. Pratique informative et éducative .. SUFFISANT. Modulation décrite, contre-
   pratiques décrites (image commune, vérification de la compréhension).
4. Conditions individuelles ........... SUFFISANT. Formés et non formés,
   jeunes et anciens, transmission informelle.
5. Conditions organisationnelles ...... SUFFISANT. Charge, équipement,
   rotation, charge administrative.
6. Conditions systémiques ............. SUFFISANT, avec une réserve : la
   maintenance des appareils n'est évoquée que par cinq participants.
7. Conditions sociales perçues ........ SUFFISANT pour les représentations des
   prestataires — ce que l'étude vise. Le point de vue des femmes reste hors
   champ, limite assumée au § 4.2.6.
8. Portée reconnue en équité .......... SUFFISANT. Jugements contrastés :
   inacceptable, résignation, refus de juger, responsabilité reconnue.
9. Transformations proposées .......... SUFFISANT ; enrichi en vague 2 par des
   transformations DÉJÀ réalisées (I8).

Conclusion de l'exercice : la collecte pourrait être close à 20 participants.
Dans la collecte réelle, cette conclusion devra être argumentée sur les
données, dimension par dimension, et non reprise de ce modèle.`);

  memoTheme("Triangulation — ensemble des deux vagues",
ecarts.map(x => `${x.cs} — ${x.constat}`).join("\n\n") +
`\n\nSur quinze centres, ${ecarts.length} ont fait l'objet d'un constat consigné : ` +
`${ecarts.filter(x => x.nature === "écart").length} écarts et ${ecarts.filter(x => x.nature === "concordance").length} concordances. Aucun
écart n'est imputé à une intention du participant (§ 4.2.6).`);

  memoTheme("Piste d'audit — révision du cadre conceptuel",
`${arbre.flatMap(f => f.enfants).filter(e => /inductif/.test(e.nom)).length} codes inductifs sur ${arbre.length + arbre.flatMap(f => f.enfants).length} : ${arbre.flatMap(f => f.enfants).filter(e => /\[inductif\]/.test(e.nom)).length} nés de la vague 1, ${arbre.flatMap(f => f.enfants).filter(e => /vague 2/.test(e.nom)).length} de la vague 2, ${arbre.flatMap(f => f.enfants).filter(e => /révision/.test(e.nom)).length} de la révision
faite à la lecture des grilles d'observation (glycémie hors de la CPN). Le § 3.2
prévoit que le cadre est « heuristique et révisable » ; ces codes appellent
trois révisions possibles, à discuter en supervision :

1. Ajouter au niveau organisationnel la distinction entre un intrant PRÉSENT,
   un intrant UTILISABLE (CS05 : bandelettes périmées, glucomètre en état) et
   un intrant ACCESSIBLE À LA CPN (glucomètre au laboratoire, bandelettes
   réservées à la consultation des maladies chroniques : code B8) et un test
   FAIT AU BON MOMENT (glycémie unique à la première CPN, non refaite à
   24-28 semaines : code B9).
2. Ajouter un niveau ou une articulation « communautaire » entre le service et
   le social perçu : les relais communautaires (G9) prolongent le dépistage
   hors du centre, ce que le cadre actuel ne prévoit pas.
3. Faire apparaître le dispositif de contrôle lui-même (indicateurs,
   complétude des registres) comme une condition systémique à part entière,
   puisqu'il oriente l'attention (T4) et peut masquer l'inégalité (T6).

Ces propositions sont des exercices : elles devront naître, dans l'étude
réelle, du matériau réel.`);

  memoTheme(TITRE_POSITIONNALITE, TEXTE_POSITIONNALITE);
}

/* ================================================================
   Mémos du projet unique — les deux vagues réunies
   Les mémos déjà écrits sont REPRIS, pas réécrits : la piste d'audit garde
   ainsi la trace de l'évolution de l'analyse (thèmes provisoires après la
   vague 1, révisés après la vague 2). S'y ajoutent les étapes du § 4.2.6 que
   la simulation n'avait pas encore documentées.
================================================================ */
function memosUnique({ projet, memoTheme, ecarts }) {
  const recueillis = new Map();
  const renommer = {
    "Phase 1 — Familiarisation (journal)": "Phase 1 — Familiarisation, vague 1 (journal)",
    "Vague 2 — Familiarisation (journal)": "Phase 1 — Familiarisation, vague 2 (journal)",
    "Vague 2 — Codes inductifs nouveaux et leur motif": "Phase 2 — Codes inductifs nés de la vague 2",
    "Phase 3 — Thèmes provisoires": "Phase 3 — Thèmes provisoires (après la vague 1)",
    "Phase 4 — Revue : un thème écarté": "Phase 4 — Revue après la vague 1 : un thème écarté",
    "Phase 4 — Revue des thèmes": "Phase 4 — Revue des thèmes après la vague 2",
    "Piste d'audit — décisions de codage": "Piste d'audit 1 — décisions de codage (vague 1)",
    "Vague 2 — Piste d'audit": "Piste d'audit 2 — décisions de codage (vague 2)",
    "Piste d'audit — révision du cadre conceptuel": "Piste d'audit 3 — révision du cadre conceptuel",
  };
  // Remplacés par le mémo de triangulation de l'ensemble : les garder ferait
  // trois versions du même constat.
  const ignorer = new Set(["Triangulation — écarts déclaré / constaté", "Vague 2 — Triangulation"]);
  const collecte = (titre, texte) => {
    if (ignorer.has(titre)) return;
    recueillis.set(renommer[titre] || titre, texte);
  };
  const brouillon = { memo: "" };
  memosVague1({ projet: brouillon, memoTheme: collecte, ecarts });
  memosVague2({ projet: brouillon, memoTheme: collecte, ecarts });
  memosComplet({ projet: brouillon, memoTheme: collecte, ecarts });

  /* ---------- Étapes ajoutées ---------- */
  const entretiens = projet.documents.filter(d => d.variables.type_document === "entretien");
  const inutilises = projet.codes.filter(c => c.parentId && !projet.segments.some(x => x.codeId === c.id)).map(c => c.name);
  const inductifs = projet.codes.filter(c => /inductif/.test(c.name));

  collecte("Phase 2 — Codage initial : grille déductive et ouverture inductive",
`Grille initiale dérivée du Tableau III (« Grille d'opérationnalisation des
concepts ») : une famille par concept — sens attribué, pratiques techniques,
pratique informative, conditions individuelles, organisationnelles,
systémiques, sociales perçues, portée en équité, transformations — plus le
corpus d'observation (famille 10) et le parcours, hors analyse thématique
(famille 0).

La correspondance question → codes attendus (colonne « Source » du Tableau III,
annexe 8) a servi de point de départ, jamais de carcan : elle est complétée ou
remplacée entretien par entretien quand le matériau l'impose.

Unité de codage : le tour de parole du participant. Un même passage peut porter
plusieurs codes ; c'est ce qui rend les co-occurrences interprétables.

Ouverture inductive : ${inductifs.length} codes sur ${projet.codes.length} n'étaient pas dans la grille
(${inductifs.filter(c => !/vague 2|relecture/.test(c.name)).length} nés de la vague 1 ou de la révision sur la glycémie, motifs dans la piste d'audit 1 ;
${inductifs.filter(c => /vague 2/.test(c.name)).length} nés de la vague 2, motifs dans le mémo suivant ;
${inductifs.filter(c => /relecture/.test(c.name)).length} nés de la relecture du corpus à la lumière des réalités rwandaises, motifs dans la piste d'audit 4).

Codes jamais utilisés à l'issue des deux vagues : ${inutilises.length ? inutilises.join(" ; ") : "aucun"}.
« Utilité perçue pour la femme » était vide après la vague 1 et ne l'est plus
après la vague 2 : un code vide n'est pas forcément un mauvais code, il peut
attendre son matériau.`);

  const kinyarwanda = entretiens.filter(d => d.variables.langue_entretien === "kinyarwanda");
  const verifies = ["P01", "P04", "P06", "P10", "P13", "P17", "P20"];
  collecte("Contrôle de fidélité des transcriptions (§ 4.2.6)",
`Deux niveaux, comme prévu au protocole.

1. Sondage par le chercheur contre l'enregistrement : un passage de cinq
   minutes tiré au hasard dans chacun des ${entretiens.length} entretiens, réécouté et
   comparé à la transcription. Écarts relevés dans 9 entretiens :
   pour l'essentiel des hésitations et deux silences non notés, corrigés.

2. Vérification indépendante par une personne bilingue extérieure, liée par
   l'engagement de l'annexe 7, sur des passages prélevés dans un tiers des
   entretiens conduits en kinyarwanda : ${verifies.join(", ")} (${verifies.length} sur ${kinyarwanda.length}).
   Six passages discutés : quatre tranchés en faveur de la traduction du
   chercheur, deux corrigés. Exemple qui montre pourquoi ce contrôle compte :
   dans l'entretien de P10, une première traduction attribuait à la femme la
   décision d'attendre ; la vérification a rétabli que c'est le mari qui
   décide. Le codage en dépend (G4, marge de décision de la femme) : passage
   corrigé et recodé. La transcription du projet est la version corrigée.

Les écarts, la manière dont ils ont été tranchés et par qui sont consignés ici,
comme l'exige le protocole.

NOTE : dans l'étude réelle, ce contrôle porte sur les notes en kinyarwanda ;
la version d'entraînement ne contient que le rendu français.`);

  collecte("Phase 5 — Définition et dénomination des thèmes",
`Sept thèmes, chacun défini par ce qu'il est, ce qu'il n'est pas, et les codes
qui le composent. OS1 et OS2 renvoient aux objectifs spécifiques du protocole.

T1. UN DÉPISTAGE COUPÉ EN DEUX (OS1)
    La mesure de la tension est un geste intégré à la CPN presque partout ; la
    recherche du diabète se fait hors de la CPN — au laboratoire du centre ou à
    la consultation des maladies chroniques — et dépend de bandelettes que la
    CPN ne gère pas. Là où ce circuit n'est pas ouvert à la femme enceinte,
    elle cesse d'être pensée.
    N'est pas : un défaut de connaissance des professionnels.
    Codes : B1, B2, B6, B7, B8, E2, F5, A5, D5 ; après relecture, F9
    (campagnes de dépistage des MNT hors de la CPN, sans lien avec elle).

T2. EXPLIQUER MOINS À CELLES QUI SAVENT LE MOINS (OS1)
    L'explication qui suit la mesure varie selon l'heure, la charge et l'idée
    que le soignant se fait de la femme — à l'inverse des besoins. Elle
    persiste là où tous les intrants sont disponibles. Contre-pratiques
    documentées : l'image commune, la vérification de la compréhension, le
    refus de catégoriser.
    N'est pas : une faute individuelle ; les participants la décrivent eux-mêmes.
    Codes : C4, C5, C6, C8, C9, G3, G7, H5, H9 ; après relecture, C10 et C11.
    Sous-thème né de la relecture : LA SÉANCE COLLECTIVE, ÉGALE POUR LES
    PRÉSENTES, MUETTE SUR LE RÉSULTAT. La séance d'éducation donne à toutes les
    femmes présentes la même information générale ; elle manque celles qui
    arrivent après elle, parle peu de la tension et presque jamais du sucre, et
    sert parfois de substitut à la restitution individuelle du résultat.

T3. TROUVER SANS POUVOIR SUIVRE (OS2)
    La détection ne devient une prise en charge que si la référence aboutit
    (transport, décision familiale) et si l'information revient ; elle
    s'interrompt à l'accouchement et quand la femme se déplace.
    Codes : B4, F2, F3, F6, F8, G2, G4, G11, I6 ; après relecture, G12 (une
    première CPN retardée dans l'attente du conjoint retarde aussi la
    glycémie) et G13 (les ménages les plus pauvres, aidés, reviennent ; ceux
    juste au-dessus du seuil se perdent).

T4. CE QUI EST COMPTÉ EXISTE (OS2)
    Intrants, maintenance et attention suivent les indicateurs ; le dépistage
    n'en fait pas partie.
    Codes : E4, E7, F4, I5.

T5. CE QUE CHANGE LA DOTATION, ET CE QU'ELLE NE CHANGE PAS (OS2)
    L'équipement supprime l'inégalité du test, pas celle de l'explication ; et
    il est réparti au bénéfice des centres déjà les mieux placés.
    Codes : B2, E2, F5, F8, C9, H8.

T6. LE REGISTRE COMME ÉCRAN (OS2 et portée en équité)
    Un contrôle portant sur la complétude produit de la complétude, et peut
    rendre invisible l'inégalité qu'il devrait révéler.
    Précaution : effet de système, jamais faute individuelle ; jamais rapporté
    en association avec un code de structure.
    Codes : F7, F4, E4.

T7. LE DÉPISTAGE HORS DES MURS (OS2 et transformations)
    Relais communautaires et initiatives locales prolongent le dépistage là où
    le système ne prévoit rien. Elles reposent sur une personne : c'est leur
    force et leur fragilité.
    Codes : G9, I8, F6 ; après relecture, G14 (l'alerte par téléphone des
    ASM organise l'urgence, pas le contrôle) et I9 (passer par l'umugoroba
    w'ababyeyi pour atteindre les maris et les familles).

La portée reconnue en équité (famille 8) n'est pas un thème : c'est le lieu où
T2, T4, T5 et T6 se rejoignent dans le jugement des participants (Q19).`);

  const citables = entretiens.filter(d => d.variables.citation_autorisee !== "non").length;
  collecte("Phase 6 — Production du rapport : plan du chapitre Résultats",
`Plan proposé, aligné sur les objectifs du protocole :

  Résultats 1. Participants et centres — tableau descriptif (annexes 3 et 9),
               sans croisement de caractéristiques qui identifierait quelqu'un.
  Résultats 2. Objectif spécifique 1 — T1, T2.
  Résultats 3. Objectif spécifique 2 — T3 à T7, dans l'ordre des niveaux du
               cadre : individuel, organisationnel, systémique, communautaire.
  Résultats 4. Portée reconnue en équité (Q19) : la distribution des jugements
               et leurs justifications.
  Résultats 5. Transformations proposées, et transformations déjà réalisées.
  Résultats 6. Triangulation avec l'observation : écarts et concordances.

Règles de citation :
  · deux langues pour les entretiens conduits en kinyarwanda (§ 4.2.6) ;
  · code du participant seul, jamais associé au code de structure ni à plus
    d'une caractéristique (§ 4.2.7) ;
  · P05 a refusé la citation : ses propos sont rapportés de façon agrégée,
    jamais cités ;
  · P19 : aucune citation contenant un élément qui identifierait son centre ;
  · choisir les citations dans la requête « Extraits citables »
    (${citables} entretiens sur ${entretiens.length}).

Dans QualiCode : Rapports ▸ Rapport Word (.docx) à partir de chaque requête de
thème ; Rapports ▸ Segments (CSV) pour le tableau de codage annexé ; Rapports ▸
Système de codes pour l'arbre final ; Rapports ▸ REFI-QDA pour l'archivage.`);

  const kInter = interCoderAgreement(projet, "C1", "C2");
  const kIntra = interCoderAgreement(projet, "C1", "C1b");
  collecte("Double codage et stabilité intra-codeur",
`ACCORD INTER-CODEURS — ${kInter.sharedDocs} entretiens sur ${entretiens.length}, comme prévu au § 4.2.5.6,
recodés à l'aveugle par un pair extérieur (codeur C2), un par profil :
sage-femme de la vague 1, sage-femme du centre le mieux doté, infirmière de la vague 2.
  κ = ${kInter.overall.kappa.toFixed(3).replace(".", ",")} (accord observé ${(kInter.overall.po * 100).toFixed(1).replace(".", ",")} %), sur ${kInter.units} paragraphes.
  Dans l'application : Analyse ▸ Accord inter-codeurs (κ), C1 contre C2.

STABILITÉ INTRA-CODEUR (§ 4.2.5.6, annexe 8) — ${kIntra.sharedDocs} entretiens recodés par le
premier codeur quatre semaines après, sans revoir son codage (étiquette C1b).
  κ = ${kIntra.overall.kappa.toFixed(3).replace(".", ",")} (accord observé ${(kIntra.overall.po * 100).toFixed(1).replace(".", ",")} %), sur ${kIntra.units} paragraphes.
  Dans l'application : Analyse ▸ Accord inter-codeurs (κ), C1 contre C1b.

LECTURE. Le kappa est calculé par paragraphe ; la plupart des paragraphes ne
portant pas un code donné, ces accords « négatifs » le tirent vers le haut.
Rapporter toujours la valeur AVEC l'unité d'analyse, la part du corpus recodée
et la manière dont les désaccords ont été tranchés.

DÉSACCORDS À TRANCHER en séance de consensus : passages non retenus, bornes
déplacées, codes voisins (C4/C6, G3/G7, H2/H4…), et un code H5 posé par C2
seul à la fin de chaque entretien recodé. Les décisions sont consignées dans la
piste d'audit.`);

  const recontact = entretiens.filter(d => d.variables.recontact_accepte === "oui");
  const refus = entretiens.filter(d => d.variables.recontact_accepte !== "oui").map(d => d.name.match(/P\d+/)[0]);
  collecte("Vérification des interprétations auprès des participants",
`Procédure (§ 4.2.5.6 ; annexe 1, clôture ; annexe 8, crédibilité) : en fin
d'analyse, TROIS participants volontaires, choisis parmi ceux qui avaient
accepté d'être recontactés, reçoivent un résumé des thèmes et sont invités à
dire s'ils s'y reconnaissent. Les trois couvrent les deux qualifications, les
deux vagues, un centre urbain et un centre rural.

Recontact accepté : ${recontact.length} sur ${entretiens.length} (refus ou indisponibilité : ${refus.join(", ")}).
Volontaires retenus : P02, P09, P11.

Retours :
  · P02 confirme T2 et demande que la modulation de l'explication ne soit pas
    présentée comme une faute individuelle — formulation retenue.
  · P09 confirme T4 ; précise que les observations écrites dans le rapport
    mensuel ont été lues une fois, sans suite.
  · P11 nuance T5 : son centre a lui aussi connu des ruptures, avant 2025.

Ces retours changent des formulations, pas la structure des thèmes. Les
désaccords éventuels se rapportent tels quels, sans être tranchés en faveur du
chercheur.`);

  /* ---------- Relecture du corpus à la lumière des réalités rwandaises ---------- */
  const nbParCode = id => {
    const c = projet.codes.find(x => x.name === arbre.flatMap(f => f.enfants).find(e => e.id === id).nom);
    const ids = new Set(entretiens.map(d => d.id));
    return new Set(projet.segments.filter(x => x.codeId === c.id && x.coder === "C1" && ids.has(x.docId)).map(x => x.docId)).size;
  };
  collecte("Phase 1 — Familiarisation, relecture (réalités rwandaises)",
`Relecture intégrale des ${entretiens.length} entretiens et des ${projet.documents.length - entretiens.length} comptes rendus après une
recherche documentaire sur l'organisation réelle des CPN au Rwanda (sources dans
l'annexe 9, « Repères réels »). Question de relecture : qu'est-ce que le cadre
conceptuel, construit hors du Rwanda, ne m'a pas fait voir ?

Ce qui apparaît à la relecture :
  · la SÉANCE D'ÉDUCATION COLLECTIVE, deux à trois fois par semaine, avant les
    consultations. Plusieurs participants la décrivent dès qu'on les relance ;
    l'observation la confirme dans ${projet.documents.filter(d => /Séance observée ce jour : oui/.test(d.text)).length} centres le jour de la visite ;
  · la VENUE DU CONJOINT à la première CPN (test VIH du couple), vécue comme une
    condition d'accueil, qui retarde la première visite ;
  · les CATÉGORIES UBUDEHE : mutuelle payée par l'État et farine Shisha Kibondo
    pour les ménages les plus pauvres, qui reviennent ; les ménages juste
    au-dessus du seuil, qu'on perd ;
  · le SIGNALEMENT PAR TÉLÉPHONE des ASM (enregistrement des grossesses,
    alerte rouge et ambulance) ;
  · les CAMPAGNES DE DÉPISTAGE DES MNT, hors de la CPN et sans lien avec elle ;
  · l'UMUGOROBA W'ABABYEYI, forum villageois des parents, proposé comme relais.

Première impression : la séance collective est l'endroit où le service parle
le plus aux femmes, et celui où il parle le moins de la tension et du sucre.`);

  collecte("Phase 2 — Codes inductifs nés de la relecture",
`Sept codes créés à la relecture, chacun parce qu'aucun code existant ne
contenait le passage sans le déformer. Nombre de participants concernés entre
parenthèses (entretiens, codeur C1). C10 est codé en plus sur la rubrique
ajoutée des comptes rendus d'observation.

C10 Séance d'éducation collective en CPN (${nbParCode("C10")}) — organisation, contenu, fréquence,
    supports (boîte à images), femmes qui la manquent.
C11 Séance collective et restitution individuelle du résultat (${nbParCode("C11")}) — le
    débat entre complément (« la séance prépare le terrain ») et substitut
    (« tu as entendu à la séance »). Distinct de C7 : ici, l'explication n'est
    pas renvoyée à un collègue mais à un moment collectif.
F9  Campagnes de dépistage des MNT hors de la CPN (${nbParCode("F9")}) — deux dépistages
    de la même femme qui ne communiquent pas.
G12 Attente du conjoint pour la première CPN (${nbParCode("G12")}) — distinct de G4 (marge de
    décision) : ce n'est pas le conjoint qui refuse, c'est la femme qui croit
    ne pas pouvoir venir seule.
G13 Catégorie ubudehe et aides liées à la grossesse (${nbParCode("G13")}) — l'aide ciblée
    fidélise les plus pauvres ; la difficulté se déplace juste au-dessus du
    seuil. Distinct de G1 (moyens) parce qu'il décrit un effet de seuil.
G14 Signalement des grossesses et alertes par téléphone des ASM (${nbParCode("G14")}) — distinct
    de G9 (relais humain) : c'est l'outil, qui ne prévoit que l'urgence.
I9  Relais par les forums communautaires (${nbParCode("I9")}) — proposition, pas pratique
    existante : à ne pas confondre avec I8.

Règle maintenue : famille 7 = représentations professionnelles. G12 et G13
disent ce que les prestataires perçoivent des femmes, pas ce qu'elles vivent.`);

  collecte("Phase 3 — Thèmes candidats après la relecture",
`Trois pistes ouvertes, enregistrées en requêtes :
  1. « L'éducation collective : un canal universel qui ne parle pas du
     résultat » (C10, C11, C4, H7) — candidate au statut de thème propre.
  2. « Les dispositifs rwandais qui retardent ou rapprochent la femme du
     dépistage » (G12, G13, G14) — conjoint, ubudehe, alerte téléphonique.
  3. « Le dépistage en dehors de la CPN » (F9, I9, A4) — campagnes et
     forums villageois.

Matrice des codes : C10 est dense et réparti dans les deux vagues et les deux
qualifications ; C11 est porté surtout par des centres à forte affluence.
Co-occurrences : C10 avec C4 (modulation) et avec E1 (charge) ; G12 avec G5
(recours tardif).`);

  collecte("Phase 4 — Revue après la relecture : thème propre ou sous-thème ?",
`Piste 1 confrontée à l'ensemble des extraits de T2 puis au corpus entier.
Décision : PAS DE HUITIÈME THÈME. La séance collective obéit au même mécanisme
que T2 — l'information se distribue selon l'heure d'arrivée, la charge et le
moment — et le nourrit. Elle devient le sous-thème « la séance collective,
égale pour les présentes, muette sur le résultat ».
  Argument décisif : les femmes qui manquent la séance sont celles des collines
  éloignées (P03), celles-là mêmes qui reçoivent le moins d'explication à la
  table (T2) ; et la séance sert parfois d'explication pour toutes (P08).
  Contre-argument retenu : la séance est aussi, pour plusieurs participants,
  la seule forme d'information vraiment égale (P01, P20) ; le sous-thème garde
  cette ambivalence.

Piste 2 : éclatée. G12 et G13 rejoignent T3 (trouver sans pouvoir suivre) ;
G14 rejoint T7 (hors des murs). Pas de thème « dispositifs rwandais » : ce
serait un thème par l'objet, non par le sens.
Piste 3 : F9 rejoint T1 (un dépistage coupé en deux — ici en trois) ; I9 va
aux transformations proposées.

Triangulation : la concordance relevée à CS10 (séance sur les signes de danger,
planche de la boîte à images sans image du diabète) et, dans un centre rural,
neuf femmes arrivées après la séance appuient le sous-thème.`);

  collecte("Phase 6 — Ce que la relecture ajoute au chapitre 5",
`Ajouts intégrés au chapitre 5, au chapitre 6, au rapport et au mémoire :

5.2, thème 2 — paragraphe à ajouter après la définition :
  « Trois matins par semaine au plus, une séance d'éducation collective réunit
  les femmes présentes avant les consultations. ${nbParCode("C10")} participants la
  décrivent : elle donne à toutes la même information générale, mais la tension
  n'y apparaît qu'à travers les signes de danger et le sucre presque jamais ;
  elle manque les femmes arrivées après elle ; et ${nbParCode("C11")} participants
  discutent de son usage comme substitut de la restitution individuelle. »
  Citations possibles : P07 (« La séance prépare le terrain ; elle ne remplace
  pas la restitution du résultat »), P03 (les femmes des collines du fond).

5.3, thème 3 — ajouter : l'attente du conjoint pour la première CPN
  (${nbParCode("G12")} participantes) et l'effet de seuil de l'ubudehe (${nbParCode("G13")} participants).
5.3, thème 7 — ajouter : l'alerte par téléphone des ASM, qui organise
  l'urgence et non le contrôle (${nbParCode("G14")} participants).
5.3, thème 1 — ajouter : les campagnes de dépistage des MNT hors CPN (${nbParCode("F9")}).
5.4, transformations — ajouter : la séance comme lieu d'un message sur la
  tension et le sucre (P16) et l'umugoroba w'ababyeyi (${nbParCode("I9")} participants).
5.5, triangulation — un constat de plus (concordance à CS10).

Chiffres du projet après relecture : ${projet.codes.length} codes, ${projet.segments.length} segments.`);

  collecte("Piste d'audit 4 — relecture du corpus (réalités rwandaises)",
`Date : après la vague 2. Déclencheur : recherche documentaire sur
l'organisation réelle des CPN au Rwanda et information de terrain de l'auteur
(séances d'éducation collectives deux à trois fois par semaine).

Décisions :
  1. Relecture complète du corpus, pas seulement des entretiens où le sujet
     apparaissait : un code créé tard doit être cherché partout.
  2. Ajout à la grille d'observation d'une rubrique « Séance d'éducation
     collective » (fréquence, observation du jour, thème, tension et sucre
     abordés, femmes arrivées après). Écart à l'annexe 2 du protocole : à
     faire valider par la direction de mémoire ; ajoutée aussi aux outils
     vierges pour la collecte réelle.
  3. Sept codes inductifs (piste dans le mémo de phase 2 correspondant).
  4. Aucun thème nouveau ; sous-thème de T2 et rattachements à T1, T3, T7
     (mémo de phase 4).
  5. Termes kinyarwanda (ubudehe, umugoroba w'ababyeyi, Shisha Kibondo) :
     vérifiés dans des sources publiées ; les catégories ubudehe ont été
     réformées en 2020 : les participants parlent des « catégories les plus
     pauvres » sans numéro.

Ce que la relecture enseigne pour la collecte réelle : ajouter une relance
sur la séance collective (« Et à la séance d'éducation, qu'en dites-vous ? »)
après Q4 et Q6, sans modifier les questions du guide.`);

  /* ---------- Ordre de présentation ---------- */
  // Piste d'audit de la rédaction : chaque citation du chapitre 5 renvoie à
  // son participant et aux codes sous lesquels elle a été trouvée. Le texte
  // du chapitre et ses contrôles sont dans resultats.mjs et faire-resultats.mjs.
  {
    const lignes = [];
    let section = "";
    for (const b of blocsResultats) {
      if (b.h2 || b.h3) section = b.h2 || b.h3;
      if (!b.cite) continue;
      if (section) { lignes.push("", section); section = ""; }
      const extrait = b.t.length > 90 ? b.t.slice(0, 90).replace(/\s+\S*$/, "") + "…" : b.t;
      const noms = b.codes.map(id => arbre.flatMap(f => f.enfants).find(e => e.id === id).nom.replace(/\s*\[inductif[^\]]*\]/, ""));
      lignes.push(`  · ${b.cite} — « ${extrait} »\n      codé : ${noms.join(" ; ")}`);
    }
    const cites = blocsResultats.filter(b => b.cite);
    collecte("Phase 6 — Rédaction du chapitre 5 : d'où vient chaque citation",
`Le chapitre 5 (Chapitre_5_Resultats.docx) cite ${cites.length} extraits de
${new Set(cites.map(b => b.cite)).size} participants. Chacun a été vérifié automatiquement à la
production du document : il figure mot pour mot dans un passage du participant
codé (codeur C1) avec l'un des codes indiqués sous l'extrait. P05 n'est jamais cité ;
les extraits de P19 ne portent ni code de centre ni caractéristique.

Pour retrouver un extrait : Recherche ▸ coller quelques mots, ou Requêtes ▸
activer le participant et le code.
${lignes.join("\n")}`);
  }

  const ordre = [
    "Phase 1 — Familiarisation, vague 1 (journal)",
    "Phase 1 — Familiarisation, vague 2 (journal)",
    "Phase 1 — Familiarisation, relecture (réalités rwandaises)",
    "Contrôle de fidélité des transcriptions (§ 4.2.6)",
    "Phase 2 — Codage initial : grille déductive et ouverture inductive",
    "Phase 2 — Codes inductifs nés de la vague 2",
    "Phase 2 — Codes inductifs nés de la relecture",
    "Phase 3 — Thèmes provisoires (après la vague 1)",
    "Phase 3 — Thèmes révisés après la vague 2",
    "Phase 3 — Thèmes candidats après la relecture",
    "Phase 4 — Revue après la vague 1 : un thème écarté",
    "Phase 4 — Revue des thèmes après la vague 2",
    "Phase 4 — Revue après la relecture : thème propre ou sous-thème ?",
    "Phase 5 — Définition et dénomination des thèmes",
    "Phase 6 — Production du rapport : plan du chapitre Résultats",
    "Phase 6 — Rédaction du chapitre 5 : d'où vient chaque citation",
    "Phase 6 — Ce que la relecture ajoute au chapitre 5",
    "Double codage et stabilité intra-codeur",
    "Triangulation — ensemble des deux vagues",
    "Vérification des interprétations auprès des participants",
    "Suffisance informationnelle — dimension par dimension (§ 4.2.3.1)",
    "Piste d'audit 1 — décisions de codage (vague 1)",
    "Piste d'audit 2 — décisions de codage (vague 2)",
    "Piste d'audit 3 — révision du cadre conceptuel",
    "Piste d'audit 4 — relecture du corpus (réalités rwandaises)",
    TITRE_POSITIONNALITE,
  ];
  const oublies = [...recueillis.keys()].filter(k => !ordre.includes(k));
  const absents = ordre.filter(k => !recueillis.has(k));
  if (oublies.length || absents.length) {
    throw new Error(`mémos non placés : ${oublies.join(" | ")} ; mémos attendus absents : ${absents.join(" | ")}`);
  }
  for (const titre of ordre) memoTheme(titre, recueillis.get(titre));

  projet.memo = `MÉMOIRE NGOMA — MUKAKI DUNIA Jacques
${AVERTISSEMENT}

Ce projet reproduit, de bout en bout, le traitement prévu au § 4.2.6 du
protocole de recherche « ${ETUDE.titre} » (${ETUDE.chercheur}, ${ETUDE.institution}).

Il réunit deux vagues : ${entretiens.length} entretiens (variable « vague » = 1
ou 2) et ${projet.documents.length - entretiens.length} comptes rendus d'observation, soit quinze des seize centres de santé du
district, le seizième ayant servi au pré-test — la configuration visée par le § 4.2.3.1.

Les entretiens et observations sont construits sur les réalités du district
(organisation des CPN, séances d'éducation collective, ASM, mutuelle et
ubudehe). Pour la collecte, ouvrez le projet vierge « Mémoire Ngoma — Données
réelles » : n'ajoutez jamais un entretien réel dans ce projet d'entraînement.

Les mémos suivent les six phases de l'analyse thématique (Braun & Clarke),
puis les étapes de rigueur du protocole : fidélité des transcriptions, double
codage et stabilité intra-codeur, triangulation, vérification des
interprétations, suffisance informationnelle, piste d'audit. La note de
positionnalité est un MODÈLE D'EXERCICE : les passages entre crochets sont
des hypothèses à remplacer par votre situation réelle.

Variables de consentement : « citation_autorisee » (P05 a refusé la citation,
P19 l'a acceptée sans élément identifiant son centre) et « recontact_accepte ».

NOTE SUR LE KINYARWANDA : les termes entre crochets sont illustratifs et
doivent être vérifiés par un locuteur natif avant tout usage.`;
}

/* ================================================================
   Requêtes complémentaires (thèmes nés de la vague 2)
================================================================ */
const requetesV2 = [
  ["T5 — Ce que change la dotation, et ce qu'elle ne change pas", ["B2", "E2", "F5", "F8", "C9"]],
  ["T6 — Le registre comme écran", ["F7", "F4", "E4"]],
  ["T7 — Le dépistage hors des murs", ["G9", "I8", "F6"]],
  ["Femmes mobiles et rupture du suivi", ["G11"]],
  ["Recours au traitement traditionnel (représentations)", ["G10"]],
  ["Codes inductifs nés de la vague 2", ["B7", "C9", "E8", "E9", "F7", "F8", "G9", "G10", "G11", "H9", "I8"]],
  ["T2 (sous-thème) — La séance collective, égale pour les présentes, muette sur le résultat", ["C10", "C11"], true],
  ["Dispositifs rwandais : conjoint, ubudehe, alerte des ASM", ["G12", "G13", "G14"]],
  ["Dépistage hors de la CPN : campagnes et forums villageois", ["F9", "I9"]],
  ["Codes inductifs nés de la relecture (réalités rwandaises)", ["C10", "C11", "F9", "G12", "G13", "G14", "I9"], true],
];

/* ================================================================
   9. Écriture des trois projets
================================================================ */
// UN SEUL PROJET : celui qui porte déjà ce nom et cet identifiant dans
// l'application. Ouvert par « Accueil ▸ Ouvrir (.projx) », il REMPLACE la
// version antérieure (vague 1 seule) au lieu de s'y ajouter en double.
const projets = [
  {
    fichier: "MEMOIRE_NGOMA_MUKAKI_DUNIA_Jacques.projx",
    cfg: {
      id: "memoire-ngoma-simulation", nom: "MÉMOIRE NGOMA — MUKAKI DUNIA Jacques",
      date: "2026-09-20T09:00:00Z", modifie: new Date().toISOString(),
      versionSimulation: "entrainement-relecture-rwanda-2026-10",
      participants: [...participants, ...participantsV2],
      observations: [...observations, ...observationsV2].sort((x, y) => x.cs.localeCompare(y.cs)),
      ajustements: { ...ajustements, ...ajustementsV2 },
      ecarts: [...ecarts, ...ecartsV2],
      // § 4.2.5.6 du protocole : double codage indépendant de TROIS entretiens
      // par un pair extérieur ; recodage de TROIS entretiens après quatre semaines.
      relus: ["P02", "P11", "P18"],
      intraCodeur: ["P04", "P13", "P15"],
      memos: memosUnique, requetesSup: requetesV2, requeteCitables: true,
    },
  },
];

const dossier = process.argv[2] || ".";
for (const { fichier, cfg } of projets) {
  const { projet, desaccords, ecartsIntra } = construireProjet(cfg);
  writeFileSync(`${dossier}/${fichier}`, JSON.stringify(projet, null, 2), "utf8");
  const parCoder = projet.segments.reduce((a, s) => { a[s.coder] = (a[s.coder] || 0) + 1; return a; }, {});
  const ent = projet.documents.filter(d => d.variables.type_document === "entretien").length;
  const obs = projet.documents.filter(d => d.variables.type_document === "observation").length;
  console.log(`\n${fichier}`);
  console.log(`  ${projet.documents.length} documents (${ent} entretiens, ${obs} observations) · ${projet.codes.length} codes`);
  console.log(`  ${projet.segments.length} segments — par codeur : ${JSON.stringify(parCoder)} · désaccords inter-codeurs : ${desaccords} · écarts intra-codeur : ${ecartsIntra}`);
  console.log(`  ${projet.memos.length} mémos · ${projet.savedQueries.length} requêtes · ${projet.documents.reduce((t, d) => t + d.text.length, 0).toLocaleString("fr-FR")} caractères`);
}
