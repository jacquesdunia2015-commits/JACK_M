// faire-docx.mjs — produit les livrables Word éditables.
import {
  Document, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle,
  LARGEUR, p, titre1, titre2, titre3, vide, saut, tableau, pageDeGarde, encadreRouge, stylesCommuns, ecrire,
} from "./mise-en-page.mjs";

import { AVERTISSEMENT, ETUDE, participants, guide } from "./echantillon.mjs";
import { observations } from "./observations.mjs";
import { participantsV2 } from "./echantillon-vague2.mjs";
import { observationsV2 } from "./observations-vague2.mjs";
import { consentementDe } from "./consentements.mjs";
import { TEXTE_POSITIONNALITE } from "./positionnalite.mjs";
import { parCentre, fileActiveMnt, SOURCE as SOURCE_ROUTINE, RESERVE } from "./donnees-routine.mjs";
import { REPERES } from "./donnees-rwanda.mjs";
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
    ["Dimension (Tableau II)", "Modalités recherchées", "Couverture dans l'échantillon"],
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
  const nbV1 = participants.filter(x => cfg.vague1.has(x.code)).length;
  const enfants = [
    { partie: "suivi" },
    titre1("Suivi de l'échantillon au regard du Tableau II"),
    p(`Deux vagues : la vague 1 (${nbV1} participants, 5 centres) puis la vague 2 (${participants.length - nbV1} participants, les ${observations.length - 5} autres centres). Ensemble, elles couvrent ${observations.length} des seize centres de santé du district (le seizième a servi au pré-test), dans la fourchette de seize à vingt-quatre participants du § 4.2.3.1.`, { run: { size: 20 } }),
    p("Le protocole (§ 4.2.3.2, Tableau II) prescrit un échantillonnage raisonné à variation maximale portant sur sept dimensions. Le tableau de couverture ci-dessous est CALCULÉ à partir des fiches : c'est le contrôle à refaire pendant la collecte réelle, après chaque entretien.", { run: { size: 20 } }),
    vide(),
    tableau([
      ["Code", "Vague", "Structure", "Qualification", "Titulaire", "Anc. CPN", "Secteur", "Hôpital", "Volume", "Langue"],
      ...participants.map(x => [x.code, cfg.vague1.has(x.code) ? "1" : "2", x.cs, x.qualif, x.titulaire ? "oui" : "non", x.ancCpn,
        x.secteur === "urbain" ? "urbain" : "rural", x.distanceHopital, x.volume, x.langue.slice(0, 5) + "."]),
    ], [650, 650, 800, 1250, 850, 1000, 850, 900, 876, 1200]),
    vide(),
    titre2("Couverture des sept dimensions de variation (Tableau II)"),
    tableau(couverture(participants), [2200, 2400, 4426]),
    vide(),
    p("Le protocole ne clôt pas la collecte sur un nombre : la suffisance informationnelle s'argumente dimension par dimension. Le projet QualiCode contient un mémo qui s'y exerce.", { run: { size: 20, italics: true } }),

    /* ---------- Annexe 1 ---------- */
    { partie: "a1" },
    titre1("Index des entretiens conduits"),
    p("Le guide d'entretien se « remplit » par l'entretien lui-même : ses vingt-deux questions ont été posées aux participants ci-dessous, et leurs réponses sont reproduites intégralement, question par question, dans la suite de ce document. Le journal de bord de chaque entretien précède ses réponses.", { run: { size: 20 } }),
    vide(),
    tableau([
      ["Code", "Structure", "Date", "Durée", "Langue", "Traitement de la transcription (§ 4.2.6)"],
      ...participants.map(x => [x.code, x.cs, x.date, x.duree, x.langue,
        x.langue === "kinyarwanda" ? "Transcription en kinyarwanda, traduction française par le chercheur" : "Transcription directe par le chercheur"]),
    ], [700, 900, 1150, 900, 1300, 4076]),

    /* ---------- Annexe 2 ---------- */
    { partie: "a2" },
    p("Observation non participante, portant sur le service et non sur les personnes. Jamais observé ni consigné : identité ou performance individuelle d'un professionnel, contenu des échanges entre un prestataire et une femme enceinte, toute donnée permettant d'identifier une patiente, tout jugement de conformité d'un geste à une norme. Aucune présence dans la salle pendant l'examen clinique. Une demi-journée par centre.", { run: { size: 19, italics: true } }),
  ];

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

    if (o.S) {
      enfants.push(vide(), titre3("A bis. Séance d'éducation collective (rubrique ajoutée à la grille)"));
      enfants.push(tableau([
        ["Fréquence déclarée", o.S.frequence],
        ["Séance observée ce jour", o.S.observee],
        ["Déroulement et contenu", o.S.detail],
        ["Tension et sucre abordés", o.S.sujets],
      ], [3400, 5626], { entete: false }));
    }

    enfants.push(vide(), titre3("B. Équipements et consommables"));
    enfants.push(tableau([
      ["Élément", "Présent", "Nombre", "État de fonctionnement", "Observations"],
      ...o.B.map(x => [x.item, x.present, x.nombre === null || x.nombre === undefined ? "—" : String(x.nombre), x.etat, x.obs || "—"]),
      ["Rupture de stock signalée au cours des trois derniers mois", "", "", "", o.ruptureTroisMois],
    ], [1800, 1050, 1050, 2200, 2926]));

    enfants.push(vide(), titre3("B bis. Glycémie de la première CPN (rubrique ajoutée à la grille)"));
    const motif = { faite: "faite à toutes les femmes de première CPN reçues", rupture: "NON faite — rupture de bandelettes",
      panne: "NON faite — glucomètre en panne", "non formé": "NON faite — aucun prestataire formé au glucomètre présent" };
    enfants.push(tableau([
      ["Glycémie de la première CPN ce jour", motif[o.glycemieCpn]],
      ["Test manqué noté pour être refait au rendez-vous suivant", o.rattrapage],
      ["Glycémie refaite à 24-28 semaines", o.glycemieT3],
    ], [3400, 5626], { entete: false }));

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
    if (o !== observations[observations.length - 1]) enfants.push(saut());
  }

  /* ---------- Annexe 3 ---------- */
  enfants.push({ partie: "a3" });
  enfants.push(p("Renseignée en début d'entretien. Aucun nom, aucune fonction nominative, aucun nom de structure. Le code de structure est conservé sur un document séparé sous la seule responsabilité du chercheur. Les tranches sont préférées aux valeurs exactes : dans des équipes réduites, une combinaison âge-qualification-ancienneté exacte permettrait d'identifier une personne.", { run: { size: 19, italics: true } }));
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

  /* ---------- Annexe 4 ---------- */
  enfants.push({ partie: "a4" });
  enfants.push(p("Le formulaire d'information et de consentement (annexe 4) est remis en deux exemplaires et signé par chaque participant. Le § 4.2.7 prévoit que l'enregistrement et la citation d'extraits font l'objet d'accords DISTINCTS : ce registre les suit un par un, pour que l'analyse puisse en tenir compte.", { run: { size: 20 } }));
  enfants.push(vide());
  enfants.push(bandeauSignature());
  enfants.push(vide());
  enfants.push(tableau([
    ["Code", "Date", "Langue du formulaire", "Consentement écrit", "Enregistrement", "Citation d'extraits", "Recontact (vérification)", "Signature"],
    ...participants.map(x => {
      const c = consentementDe(x.code);
      return [x.code, x.date, x.langue, c.ecrit, c.enregistrement, c.citation, c.recontact, "sur le formulaire papier"];
    }),
  ], [650, 1000, 1150, 1050, 1150, 1500, 1250, 1276]));
  const notes = participants.map(x => [x.code, consentementDe(x.code).note]).filter(([, n]) => n);
  if (notes.length) {
    enfants.push(vide(), titre3("Particularités à respecter dans l'analyse"));
    enfants.push(tableau([["Code", "Accord particulier"], ...notes], [1000, 8026]));
  }

  /* ---------- Annexe 9 ---------- */
  enfants.push({ partie: "a9" });
  enfants.push(p("Valeurs d'entraînement, construites pour rester cohérentes avec les grilles d'observation et les entretiens, et calées sur les repères réels présentés en fin d'annexe. Elles ne décrivent aucun centre réel.", { run: { size: 19, italics: true } }));
  enfants.push(p(`Source et période : ${SOURCE_ROUTINE}. Les secteurs administratifs ne sont pas nommés : ils sont désignés par le code du centre qu'ils abritent, pour qu'aucun chiffre fictif ne puisse être attribué à un lieu réel.`, { run: { size: 19, italics: true } }));
  enfants.push(vide());
  enfants.push(tableau([
    ["Centre", "CPN1", "CPN4", "CPN4 / CPN1", "1er contact au 1er trim.", "Référées HTA / prééclampsie", "Effectif CPN", "Séances d'éducation / semaine"],
    ...parCentre.map(c => [c.cs, String(c.cpn1), String(c.cpn4), `${Math.round(100 * c.cpn4 / c.cpn1)} %`, `${c.t1} %`, String(c.refHta), String(c.effectif), c.seances]),
  ], [800, 800, 800, 1000, 1400, 1600, 1100, 1526]));
  enfants.push(vide());
  enfants.push(tableau([
    ["Centre", "Glycémies de première CPN (part des CPN1)", "Ruptures de bandelettes (mois)", "Secteur : pauvreté", "Taux fictif"],
    ...parCentre.map(c => [c.cs, c.glyc, c.rupt, c.pauvrete, `${c.tauxPauvrete} %`]),
  ], [900, 3300, 1900, 1700, 1226]));
  enfants.push(vide());
  enfants.push(tableau([["File active des consultations dédiées aux MNT (district)", fileActiveMnt]], [3400, 5626], { entete: false }));
  const notesRoutine = parCentre.filter(c => c.note);
  if (notesRoutine.length) {
    enfants.push(vide(), titre3("Notes de lecture"));
    enfants.push(tableau([["Centre", "Note"], ...notesRoutine.map(c => [c.cs, c.note])], [1000, 8026]));
  }
  enfants.push(vide());
  enfants.push(p(RESERVE, { run: { size: 19, italics: true } }));

  // Repères RÉELS : ils situent les valeurs d'entraînement sans s'y mêler.
  const totalCpn1 = parCentre.reduce((t, c) => t + c.cpn1, 0);
  const totalCpn4 = parCentre.reduce((t, c) => t + c.cpn4, 0);
  enfants.push(vide(), titre3("Repères réels (sources vérifiables)"));
  enfants.push(p(`Les valeurs ci-dessus ont été calées sur ces données publiées : ${totalCpn1.toLocaleString("fr-FR")} premières CPN pour les ${parCentre.length} centres (environ 11 800 naissances attendues par an dans le district, CPN assurée par les seuls centres de santé), ${Math.round(100 * totalCpn4 / totalCpn1)} % de quatrièmes visites, premier contact au premier trimestre et pauvreté sectorielle répartis autour des valeurs de la province de l'Est et du district. Contrairement au reste de l'annexe, chaque ligne de ce tableau est réelle et vérifiable dans sa source.`, { run: { size: 19, italics: true } }));
  enfants.push(tableau([["Repère", "Valeur publiée", "Source"], ...REPERES], [2600, 3000, 3426]));

  // Découpage : une sentinelle { partie } ouvre chaque document séparé.
  const parties = {};
  let courant = null;
  for (const e of enfants) {
    if (e && e.partie) { courant = parties[e.partie] = []; continue; }
    courant.push(e);
  }
  return parties;
}

const bandeauSignature = () => p("Les formulaires signés sont des pièces du dossier éthique : ils sont recueillis sur le terrain, en deux exemplaires, et conservés sur papier. Ce registre ne fait que suivre les accords ; il ne reproduit aucune signature.", { run: { size: 19, italics: true } });

/* ================================================================
   Document 2 — Transcriptions verbatim
================================================================ */
function documentTranscriptions(cfg) {
  const { participants } = cfg;
  const enfants = [
    p("Chaque entretien est précédé de la fiche du participant et du journal de bord (§ 4.2.6 : « consigner au journal de bord les conditions du déroulement, éléments non verbaux, interruptions et réflexions du chercheur »). « E : » désigne l'enquêteur (relances) ; le code du participant désigne ses réponses. Les entretiens conduits en kinyarwanda sont présentés dans leur rendu français, les termes propres au discours du participant étant conservés entre crochets.", { run: { size: 20 } }),
    vide(),
    titre2("Note sur les insertions en kinyarwanda"),
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
  return enfants;
}

/* Note de positionnalité : même texte que le mémo du projet, mis en page.
   Les passages entre crochets (hypothèses à remplacer) sont surlignés pour
   qu'aucun ne soit oublié lors de la réécriture. */
function documentPositionnalite(cfg) {
  const enfants = [...pageDeGarde("Note de positionnalité — modèle d'exercice",
    "Modèle rédigé pour s'entraîner. Il suit le protocole (annexe 8 : « journal réflexif et note de positionnalité », au titre de la confirmabilité) et les items 1 à 8 de la grille COREQ.\n\n" +
    "Les éléments biographiques viennent du protocole corrigé (page de garde, § 4.2.5.6). Les passages SURLIGNÉS entre crochets sont des hypothèses : ce que le protocole ne dit pas, à préciser. Remplacez-les par votre situation réelle. Les exemples de la partie 5 viennent des journaux de bord de l'entraînement.\n\n" +
    "Ce même texte figure dans le projet QualiCode, parmi les mémos de projet.", cfg.echantillon), saut()];
  const segments = texte => texte.split(/(\[[^\]]*\])/).filter(Boolean).map(t => t.startsWith("[")
    ? new TextRun({ text: t, size: 21, highlight: "yellow" }) : new TextRun({ text: t, size: 21 }));
  const blocs = TEXTE_POSITIONNALITE.split(/\n\s*\n/);
  for (const bloc of blocs) {
    const lignes = bloc.split("\n");
    if (lignes.some(l => /^─+$/.test(l))) {
      const t = lignes.find(l => l.trim() && !/^─+$/.test(l));
      if (t) enfants.push(titre1(t.trim()));
      continue;
    }
    if (/^\d\. [A-ZÀ-Ý' ,()]+/.test(lignes[0])) {
      enfants.push(titre2(lignes[0]));
      lignes.shift();
      if (!lignes.length) continue;
    }
    // Puces « · » ; les lignes en retrait prolongent la puce précédente.
    const items = [];
    for (const l of lignes) {
      if (l.startsWith("· ")) items.push({ puce: true, t: l.slice(2) });
      else if (items.length && items[items.length - 1].puce && /^  \S/.test(l)) items[items.length - 1].t += " " + l.trim();
      else if (items.length && !items[items.length - 1].puce) items[items.length - 1].t += " " + l.trim();
      else items.push({ puce: false, t: l.trim() });
    }
    for (const it of items) {
      enfants.push(new Paragraph({ spacing: { after: 100 }, ...(it.puce ? { bullet: { level: 0 } } : {}),
        children: segments(it.t) }));
    }
  }
  return new Document({ styles: stylesCommuns(), sections: [{ children: enfants }] });
}



const dossier = process.argv[2] || ".";
const tous = [...participants, ...participantsV2];
const obsTous = [...observations, ...observationsV2].sort((x, y) => x.cs.localeCompare(y.cs));
const vague1 = new Set(participants.map(x => x.code));
const echantillon = `${tous.filter(x => x.qualif === "infirmier").length} infirmiers ou infirmières et ` +
  `${tous.filter(x => x.qualif === "sage-femme").length} sages-femmes, ${obsTous.length} centres de santé codés (CS01 à CS${String(obsTous.length).padStart(2, "0")}), en deux vagues`;

const parties = documentAnnexes({ participants: tous, observations: obsTous, vague1, echantillon });
const docSepare = (titre, description, contenu) =>
  new Document({ styles: stylesCommuns(), sections: [{ children: [...pageDeGarde(titre, description, echantillon), saut(), ...contenu] }] });
const n = tous.length;
const fichiers = [
  ["Annexe_1_Entretiens_remplis.docx", "Annexe 1 — Guide d'entretien rempli",
    `Les ${n} entretiens semi-structurés conduits auprès des infirmiers et sages-femmes de CPN, présentés question par question selon le guide de l'annexe 1 : index des entretiens, puis, pour chacun, la fiche du participant, le journal de bord et les réponses.`,
    [...parties.a1, saut(), ...documentTranscriptions({ participants: tous })]],
  ["Annexe_2_Grilles_observation_remplies.docx", "Annexe 2 — Guides d'observation du service remplis",
    `${obsTous.length} grilles d'observation non participante, une par centre de santé, avec la rubrique ajoutée sur la séance d'éducation collective des femmes enceintes.`, parties.a2],
  ["Annexe_3_Fiches_sociodemographiques_remplies.docx", "Annexe 3 — Fiches de données sociodémographiques et professionnelles",
    `${n} fiches, une par participant, renseignées en début d'entretien.`, parties.a3],
  ["Annexe_4_Registre_des_consentements.docx", "Annexe 4 — Registre de suivi des consentements",
    `Suivi, participant par participant, des accords distincts prévus au § 4.2.7.`, parties.a4],
  ["Annexe_9_Donnees_de_routine_du_district.docx", "Annexe 9 — Données de routine du district",
    `Indicateurs de CPN des ${parCentre.length} centres, ruptures d'intrants, séances d'éducation collective, et repères réels sourcés sur le district de Ngoma et le Rwanda.`, parties.a9],
  ["Suivi_de_l_echantillon_Tableau_II.docx", "Suivi de l'échantillon — matrice de variation (Tableau II)",
    "Couverture des sept dimensions de variation, calculée à partir des fiches.", parties.suivi],
];
for (const [nom, titre, description, contenu] of fichiers) {
  await ecrire(docSepare(titre, description, contenu), `${dossier}/${nom}`);
}
await ecrire(documentPositionnalite({ echantillon }), `${dossier}/Note_de_positionnalite_modele.docx`);
