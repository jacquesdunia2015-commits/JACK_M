// faire-docx.mjs — produit les livrables Word éditables.
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle, PageBreak,
} = require("docx");

import { AVERTISSEMENT, ETUDE, participants, guide } from "./echantillon.mjs";
import { observations } from "./observations.mjs";
import { participantsV2 } from "./echantillon-vague2.mjs";
import { observationsV2 } from "./observations-vague2.mjs";
import * as e12 from "./entretiens-01-02.mjs";
import * as e34 from "./entretiens-03-04.mjs";
import * as e56 from "./entretiens-05-06.mjs";
import * as e78 from "./entretiens-07-08.mjs";
import * as e910 from "./entretiens-09-10.mjs";
import * as e1113 from "./entretiens-11-13.mjs";
import * as e1416 from "./entretiens-14-16.mjs";
import * as e1719 from "./entretiens-17-19.mjs";
import * as e2021 from "./entretiens-20-21.mjs";
const entretiens = { ...e12, ...e34, ...e56, ...e78, ...e910, ...e1113, ...e1416, ...e1719, ...e2021 };

const LARGEUR = 9026; // A4 moins les marges, en DXA
const p = (text, opts = {}) => new Paragraph({ children: [new TextRun({ text, ...opts.run })], ...opts });
const titre1 = t => new Paragraph({ text: t, heading: HeadingLevel.HEADING_1, spacing: { before: 280, after: 160 } });
const titre2 = t => new Paragraph({ text: t, heading: HeadingLevel.HEADING_2, spacing: { before: 220, after: 120 } });
const titre3 = t => new Paragraph({ text: t, heading: HeadingLevel.HEADING_3, spacing: { before: 180, after: 100 } });
const vide = () => new Paragraph({ text: "" });
const saut = () => new Paragraph({ children: [new PageBreak()] });

const cellule = (texte, { gras = false, fond = null, largeur, italique = false } = {}) => new TableCell({
  width: { size: largeur, type: WidthType.DXA },
  shading: fond ? { type: ShadingType.CLEAR, fill: fond, color: "auto" } : undefined,
  margins: { top: 60, bottom: 60, left: 100, right: 100 },
  children: String(texte).split("\n").map(l =>
    new Paragraph({ children: [new TextRun({ text: l, bold: gras, italics: italique, size: 19 })] })),
});

const tableau = (lignes, largeurs, { entete = true } = {}) => new Table({
  width: { size: LARGEUR, type: WidthType.DXA },
  columnWidths: largeurs,
  rows: lignes.map((ligne, i) => new TableRow({
    tableHeader: entete && i === 0,
    children: ligne.map((c, j) => cellule(c, {
      gras: entete && i === 0, fond: entete && i === 0 ? "E8EDF2" : null, largeur: largeurs[j],
    })),
  })),
});

const bandeau = () => new Table({
  width: { size: LARGEUR, type: WidthType.DXA },
  columnWidths: [LARGEUR],
  borders: {
    top: { style: BorderStyle.SINGLE, size: 12, color: "C0392B" },
    bottom: { style: BorderStyle.SINGLE, size: 12, color: "C0392B" },
    left: { style: BorderStyle.SINGLE, size: 12, color: "C0392B" },
    right: { style: BorderStyle.SINGLE, size: 12, color: "C0392B" },
  },
  rows: [new TableRow({ children: [new TableCell({
    width: { size: LARGEUR, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill: "FDEDEC", color: "auto" },
    margins: { top: 140, bottom: 140, left: 160, right: 160 },
    children: [
      new Paragraph({ children: [new TextRun({ text: "⚠ DONNÉES ENTIÈREMENT SIMULÉES — EXERCICE DE FORMATION", bold: true, color: "C0392B", size: 22 })] }),
      new Paragraph({ children: [new TextRun({ text: "Aucun entretien n'a été conduit. Aucun centre de santé n'a été visité. Aucune des personnes décrites n'existe. Ce document sert exclusivement à apprendre à manipuler l'outil d'analyse avant la collecte réelle.", size: 19 })] }),
      new Paragraph({ children: [new TextRun({ text: "Il ne peut être cité, ni figurer dans le mémoire, ni servir de résultat, ni être présenté à un comité d'éthique ou à un jury comme une donnée de terrain.", bold: true, size: 19 })] }),
    ],
  })] })],
});

const pageDeGarde = (sousTitre, description, echantillon) => [
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 400, after: 100 },
    children: [new TextRun({ text: "UNIVERSITÉ DE PARAKOU — ENATSE", bold: true, size: 22 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 300 },
    children: [new TextRun({ text: "Master en Santé publique — Promotion de la santé", size: 20 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 },
    children: [new TextRun({ text: ETUDE.titre, italics: true, size: 22 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200, after: 200 },
    children: [new TextRun({ text: sousTitre, bold: true, size: 32 })] }),
  vide(), bandeau(), vide(),
  ...description.split("\n").map(l => p(l, { run: { size: 20 }, spacing: { after: 80 } })),
  vide(),
  ...tableauInfos(echantillon),
];

const tableauInfos = (echantillon) => [tableau([
  ["Chercheur", ETUDE.chercheur],
  ["Institution", ETUDE.institution],
  ["Direction", ETUDE.directrice],
  ["Période simulée", ETUDE.periodeSimulee],
  ["Échantillon simulé", echantillon],
], [2400, 6626], { entete: false })];

/* ================================================================
   Couverture du Tableau II, calculée.
   Les effectifs ne sont jamais saisis à la main : une liste de participants
   qui change ne doit pas laisser un tableau de couverture périmé.
================================================================ */
function resume(liste, critere, libelle) {
  const ok = liste.filter(critere);
  return `${ok.length} ${libelle} (${ok.map(x => x.code).join(", ")})`;
}
function couverture(liste) {
  const centres = (crit) => [...new Set(liste.filter(crit).map(x => x.cs))].sort().join(", ");
  const urb = x => x.secteur === "urbain";
  return [
    ["Dimension (Tableau II)", "Modalités recherchées", "Couverture dans l'échantillon simulé"],
    ["Qualification", "Infirmiers ; sages-femmes",
      resume(liste, x => x.qualif === "infirmier", "infirmiers ou infirmières") + " · " +
      resume(liste, x => x.qualif === "sage-femme", "sages-femmes")],
    ["Fonction", "Prestataires ; infirmiers titulaires",
      resume(liste, x => x.titulaire, "titulaires") + ` · ${liste.filter(x => !x.titulaire).length} prestataires`],
    ["Ancienneté en CPN", "6 mois-2 ans ; plus de 2 ans",
      resume(liste, x => x.ancCpn === "6 mois-2 ans", "de 6 mois à 2 ans") + ` · ${liste.filter(x => x.ancCpn === "> 2 ans").length} de plus de 2 ans`],
    ["Secteur d'implantation", "Urbain ; rural périphérique",
      `${liste.filter(urb).length} urbains (${centres(urb)}) · ${liste.filter(x => !urb(x)).length} ruraux (${centres(x => !urb(x))})`],
    ["Distance à l'hôpital", "Proche ; éloignée",
      `${liste.filter(x => x.distanceHopital === "proche").length} proches · ${liste.filter(x => x.distanceHopital === "éloignée").length} éloignés`],
    ["Volume d'activité prénatale", "Élevé ; modéré",
      `${liste.filter(x => x.volume === "élevé").length} en volume élevé · ${liste.filter(x => x.volume === "modéré").length} en volume modéré`],
    ["Profil socio-économique du secteur", "Pauvreté plus élevée ; plus faible",
      `${liste.filter(x => x.pauvreteSecteur === "plus élevée").length} en secteur de pauvreté plus élevée · ${liste.filter(x => x.pauvreteSecteur === "plus faible").length} en secteur de pauvreté plus faible`],
  ];
}

/* ================================================================
   Document — Annexes remplies
================================================================ */
function documentAnnexes(cfg) {
  const { participants, observations } = cfg;
  const enfants = [
    ...pageDeGarde(cfg.titre,
      "Ce document contient les outils de collecte du protocole renseignés par des données simulées :\n" +
      `· Annexe 3 — fiche de données sociodémographiques et professionnelles (${cfg.nbFiches} fiches)\n` +
      `· Annexe 2 — guide d'observation du service (${cfg.nbGrilles} grilles)\n` +
      "· Synthèse de l'échantillon au regard du Tableau II (matrice de variation)\n\n" +
      "Tous les champs sont éditables : le document est destiné à servir de gabarit pour la collecte réelle.", cfg.echantillon),
    saut(),

    titre1("1. Synthèse de l'échantillon simulé"),
    p("Le protocole (§ 4.2.3.2, Tableau II) prescrit un échantillonnage raisonné à variation maximale portant sur sept dimensions. Le tableau ci-dessous récapitule l'échantillon simulé et permet de vérifier, d'un coup d'œil, que chaque modalité est représentée — c'est le contrôle à faire pendant la collecte réelle, après chaque entretien.", { run: { size: 20 } }),
    vide(),
    tableau([
      ["Code", "Structure", "Qualification", "Titulaire", "Anc. CPN", "Secteur", "Hôpital", "Volume", "Form. MNT", "Langue"],
      ...participants.map(x => [x.code, x.cs, x.qualif, x.titulaire ? "oui" : "non", x.ancCpn,
        x.secteur === "urbain" ? "urbain" : "rural", x.distanceHopital, x.volume, x.formationMnt, x.langue.slice(0, 5) + "."]),
    ], [700, 800, 1200, 800, 1000, 900, 900, 826, 1000, 900]),
    vide(),
    titre2(cfg.titreCouverture),
    tableau(couverture(participants), [2200, 2400, 4426]),
    vide(),
    ...(cfg.couvertureEnsemble ? [
      titre2("Couverture de l'ensemble des deux vagues (21 participants, 16 centres)"),
      p("C'est ce tableau-là que le protocole demande de remplir : la vague 2 a été composée pour compléter les modalités et couvrir les seize centres du district.", { run: { size: 20 } }),
      vide(),
      tableau(couverture(cfg.couvertureEnsemble), [2200, 2400, 4426]),
      vide(),
    ] : []),
    p(cfg.vigilance, { run: { size: 20, italics: true } }),
    saut(),

    titre1("2. Annexe 3 — Fiches de données sociodémographiques et professionnelles"),
    p("Renseignée en début d'entretien. Aucun nom, aucune fonction nominative, aucun nom de structure. Le code de structure est conservé sur un document séparé sous la seule responsabilité du chercheur. Les tranches sont préférées aux valeurs exactes : dans des équipes réduites, une combinaison âge-qualification-ancienneté exacte permettrait d'identifier une personne.", { run: { size: 19, italics: true } }),
  ];

  const coche = (valeur, attendu) => (valeur === attendu ? "☒" : "☐");
  for (const x of participants) {
    enfants.push(vide(), titre3(`Fiche ${x.code} — structure ${x.cs}`));
    enfants.push(tableau([
      ["Rubrique", "Réponse"],
      ["Code du participant / de structure", `${x.code} / ${x.cs}`],
      ["Sexe", `${coche(x.sexe, "féminin")} féminin   ${coche(x.sexe, "masculin")} masculin`],
      ["Tranche d'âge", ["20-29", "30-39", "40-49", "50 et plus"].map(t => `${coche(x.age, t)} ${t}`).join("   ")],
      ["Qualification", `${coche(x.qualif, "infirmier")} infirmier   ${coche(x.qualif, "sage-femme")} sage-femme   ☐ autre : ……`],
      ["Niveau de formation", ["A2", "A1", "A0"].map(t => `${coche(x.niveau, t)} ${t}`).join("   ") + "   ☐ autre : ……"],
      ["Ancienneté professionnelle totale", ["< 5 ans", "5-10 ans", "> 10 ans"].map(t => `${coche(x.ancTotale, t)} ${t}`).join("   ")],
      ["Ancienneté en consultation prénatale", ["6 mois-2 ans", "> 2 ans"].map(t => `${coche(x.ancCpn, t)} ${t}`).join("   ")],
      ["Fonction de titulaire de centre", `${x.titulaire ? "☒" : "☐"} oui   ${x.titulaire ? "☐" : "☒"} non`],
      ["Formation reçue sur les MNT", ["oui", "non", "ne sait pas"].map(t => `${coche(x.formationMnt, t)} ${t}`).join("   ") + `  — année : ${x.anneeFormation || "……"}`],
      ["Secteur d'implantation du centre", `${coche(x.secteur, "urbain")} urbain   ${coche(x.secteur, "rural périphérique")} rural périphérique`],
      ["Langue de l'entretien", ["kinyarwanda", "français", "anglais"].map(t => `${coche(x.langue, t)} ${t}`).join("   ")],
      ["Date et durée de l'entretien", `${x.date} — ${x.duree}`],
    ], [3000, 6026]));
  }

  enfants.push(saut(), titre1("3. Annexe 2 — Guides d'observation du service remplis"));
  enfants.push(p("Observation non participante, portant sur le service et non sur les personnes. Jamais observé ni consigné : identité ou performance individuelle d'un professionnel, contenu des échanges entre un prestataire et une femme enceinte, toute donnée permettant d'identifier une patiente, tout jugement de conformité d'un geste à une norme. Aucune présence dans la salle pendant l'examen clinique. Une demi-journée par centre.", { run: { size: 19, italics: true } }));

  for (const o of observations) {
    enfants.push(vide(), titre2(`Centre ${o.cs} — secteur ${o.secteur}`));
    enfants.push(tableau([
      ["Code de structure", o.cs, "Date", o.date, "Heures", o.heures],
    ], [1700, 1100, 800, 1400, 900, 3126], { entete: false }));

    enfants.push(vide(), titre3("A. Espace et flux"));
    enfants.push(tableau([
      ["Salles affectées à la CPN", String(o.A.sallesCpn)],
      ["Espace permettant un échange non entendu", `${o.A.echangeNonEntendu} — ${o.A.detail}`],
      ["Femmes reçues durant la période", String(o.A.femmesRecues)],
      ["Professionnels assurant la consultation", String(o.A.professionnels)],
      ["Poste distinct pour la prise des constantes", o.A.posteConstantes],
      ["Durée moyenne entre entrée et sortie", o.A.dureeMoyenne],
    ], [3400, 5626], { entete: false }));

    enfants.push(vide(), titre3("B. Équipements et consommables"));
    enfants.push(tableau([
      ["Élément", "Présent", "Nombre", "État de fonctionnement", "Observations"],
      ...o.B.map(x => [x.item, x.present, x.nombre === null || x.nombre === undefined ? "—" : String(x.nombre), x.etat, x.obs || "—"]),
      ["Rupture de stock signalée au cours des trois derniers mois", "", "", "", o.ruptureTroisMois],
    ], [1900, 900, 800, 2400, 3026]));

    enfants.push(vide(), titre3("C. Protocoles et supports"));
    enfants.push(tableau([
      ["Élément", "Présent", "Accessible au poste", "Observations"],
      ...o.C.map(x => [x.item, x.present, x.accessible, x.obs || "—"]),
    ], [2600, 1000, 1500, 3926]));

    enfants.push(vide(), titre3("D. Enregistrement des données (supports agrégés uniquement)"));
    enfants.push(tableau([
      ["Rubrique prévue pour la tension artérielle", o.D.rubriqueTa],
      ["Rubrique prévue pour la glycémie", o.D.rubriqueGlycemie],
      ["Ces rubriques sont-elles renseignées régulièrement ?", o.D.renseignement],
      ["Les cas orientés vers l'hôpital sont-ils tracés ?", o.D.tracageReference],
    ], [3400, 5626], { entete: false }));

    enfants.push(vide(), titre3("E. Notes contextuelles libres"));
    enfants.push(p(o.E, { run: { size: 20 } }));
    enfants.push(vide(), titre3("F. Réflexivité"));
    enfants.push(p(o.F, { run: { size: 20 } }));
    enfants.push(saut());
  }
  enfants.pop(); // pas de saut de page final

  return new Document({ styles: stylesCommuns(), sections: [{ children: enfants }] });
}

/* ================================================================
   Document 2 — Transcriptions verbatim
================================================================ */
function documentTranscriptions(cfg) {
  const { participants } = cfg;
  const enfants = [
    ...pageDeGarde(cfg.titre,
      `${cfg.nbTranscriptions} transcriptions d'entretiens simulés, présentées question par question selon l'annexe 1 du protocole (guide d'entretien semi-structuré).\n\n` +
      "Chaque transcription est précédée de la fiche du participant et du journal de bord de l'entretien (§ 4.2.6 : « consigner au journal de bord les conditions du déroulement, éléments non verbaux, interruptions et réflexions du chercheur »).\n\n" +
      "Les entretiens simulés en kinyarwanda sont présentés dans leur rendu français, les termes propres au discours du participant étant conservés entre crochets.\n\n" +
      "« E : » désigne l'enquêteur (relances) ; le code du participant désigne ses tours de parole.", cfg.echantillon),
    saut(),
    titre1("Note sur les insertions en kinyarwanda"),
    p("Les termes placés entre crochets dans les transcriptions (par exemple [umuvuduko w'amaraso], [kugagara], [ubukene]) sont ILLUSTRATIFS. Ils montrent où et comment le protocole demande de conserver les termes propres au discours du participant — ils ne constituent pas une traduction vérifiée. Avant tout usage, faites-les relire par un locuteur natif, et notamment par le collaborateur trilingue prévu au § 4.2.6 pour la transcription.", { run: { size: 20 } }),
    vide(),
    p("Cette précaution n'est pas une formalité : dans une analyse qualitative, le terme en langue source est ce qui permet au jury et au lecteur de contrôler la traduction. Un terme approximatif fragilise la chaîne entière.", { run: { size: 20, italics: true } }),
    saut(),
  ];

  for (const x of participants) {
    const e = entretiens[x.code];
    enfants.push(titre1(`Entretien ${x.code} — structure ${x.cs}`));
    enfants.push(tableau([
      ["Qualification", x.qualif, "Niveau", x.niveau, "Sexe", x.sexe],
      ["Tranche d'âge", x.age, "Anc. totale", x.ancTotale, "Anc. CPN", x.ancCpn],
      ["Titulaire", x.titulaire ? "oui" : "non", "Formation MNT", x.formationMnt + (x.anneeFormation ? ` (${x.anneeFormation})` : ""), "Secteur", x.secteur],
      ["Date", x.date, "Durée", x.duree, "Langue", x.langue],
    ], [1500, 1500, 1500, 1600, 1200, 1726], { entete: false }));
    enfants.push(vide());
    enfants.push(titre3("Journal de bord"));
    enfants.push(p(e.journal, { run: { size: 19, italics: true } }));
    enfants.push(vide());

    let axe = "";
    for (const q of guide) {
      if (q.axe !== axe) { axe = q.axe; enfants.push(titre2(axe === "Axe 1" ? "Axe 1 — Pratiques, transmission et significations (objectif spécifique 1)" : axe === "Axe 2" ? "Axe 2 — Conditions de réalisation, transformations et jugement de valeur (objectif spécifique 2)" : axe === "Ouverture" ? "Axe d'ouverture — parcours professionnel" : "Clôture")); }
      enfants.push(new Paragraph({ spacing: { before: 160, after: 60 },
        children: [new TextRun({ text: `${q.id}. ${q.texte}`, bold: true, size: 20 })] }));
      for (const [qui, texte] of e.reponses[q.id]) {
        enfants.push(new Paragraph({ spacing: { after: 60 }, indent: { left: 220 }, children: [
          new TextRun({ text: qui === "E" ? "E : " : `${x.code} : `, bold: true, size: 20, color: qui === "E" ? "7F8C8D" : "1A5276" }),
          new TextRun({ text: texte, size: 20, italics: qui === "E" }),
        ] }));
      }
    }
    enfants.push(saut());
  }
  enfants.pop();
  return new Document({ styles: stylesCommuns(), sections: [{ children: enfants }] });
}

function stylesCommuns() {
  return {
    default: { document: { run: { font: "Calibri", size: 21 }, paragraph: { spacing: { line: 276 } } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 30, bold: true, color: "17334F" }, paragraph: { spacing: { before: 320, after: 160 } } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 25, bold: true, color: "26567D" }, paragraph: { spacing: { before: 260, after: 120 } } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 22, bold: true, color: "2E6DA4" }, paragraph: { spacing: { before: 200, after: 100 } } },
    ],
  };
}

const ecrire = async (doc, nom) => {
  writeFileSync(nom, await Packer.toBuffer(doc));
  console.log("écrit :", nom);
};

const dossier = process.argv[2] || ".";
const ech1 = "5 infirmiers et 5 sages-femmes, 5 centres de santé codés (CS02, CS03, CS07, CS11, CS14)";
const ech2 = "5 infirmiers ou infirmières et 6 sages-femmes, 11 centres de santé codés " +
  "(CS01, CS04, CS05, CS06, CS08, CS09, CS10, CS12, CS13, CS15, CS16)";

// Vague 1
await ecrire(documentAnnexes({
  participants, observations, echantillon: ech1, nbFiches: "dix", nbGrilles: "cinq",
  titre: "Annexes de collecte remplies",
  titreCouverture: "Couverture des sept dimensions de variation",
  vigilance: "Point de vigilance pour la collecte réelle : l'effectif retenu au protocole est de seize à vingt-quatre participants, à raison d'un à deux par centre sur les seize centres du district. Les dix participants simulés ici ne satisfont donc PAS le critère de suffisance informationnelle du § 4.2.3.1 ; ils suffisent à l'apprentissage de l'outil, pas à une analyse.",
}), `${dossier}/1_Annexes_remplies_SIMULATION.docx`);
await ecrire(documentTranscriptions({
  participants, echantillon: ech1, nbTranscriptions: "Dix", titre: "Transcriptions verbatim",
}), `${dossier}/2_Transcriptions_verbatim_SIMULATION.docx`);

// Vague 2
await ecrire(documentAnnexes({
  participants: participantsV2, observations: observationsV2, echantillon: ech2,
  nbFiches: "onze", nbGrilles: "onze",
  titre: "Annexes de collecte remplies — vague 2",
  titreCouverture: "Couverture des sept dimensions — vague 2 seule",
  couvertureEnsemble: [...participants, ...participantsV2],
  vigilance: "Avec la première vague, l'ensemble atteint 21 participants sur les 16 centres du district, dans la fourchette de seize à vingt-quatre du § 4.2.3.1. Le protocole ne clôt pourtant pas la collecte sur un nombre : la suffisance informationnelle doit être argumentée dimension par dimension. Le projet « complet » contient un mémo qui s'y exerce.",
}), `${dossier}/4_Annexes_remplies_SIMULATION_vague2.docx`);
await ecrire(documentTranscriptions({
  participants: participantsV2, echantillon: ech2, nbTranscriptions: "Onze",
  titre: "Transcriptions verbatim — vague 2",
}), `${dossier}/5_Transcriptions_verbatim_SIMULATION_vague2.docx`);
