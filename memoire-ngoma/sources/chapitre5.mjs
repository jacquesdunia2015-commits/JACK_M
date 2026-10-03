// chapitre5.mjs — le chapitre 5 (Résultats) sous forme d'éléments Word,
// utilisé par le document séparé (faire-resultats.mjs) et par le mémoire
// complet (faire-memoire.mjs). Les citations sont vérifiées ici.
import { titre1, titre2, titre3, tableau, Paragraph, TextRun, AlignmentType } from "./mise-en-page.mjs";
import { participants } from "./echantillon.mjs";
import { arbre } from "./codes.mjs";
import { parCentre } from "./donnees-routine.mjs";
import { TITRE_CHAPITRE, blocs, THEMES } from "./resultats.mjs";
import { legende, source, tableauSections, rendu } from "./rendu.mjs";

export function chapitre5(calc, { refs = null } = {}) {
  const { tous, obsTous, constats, participantsAvec, valeurs, remplir, verifierCitation, etiquette } = calc;
  for (const b of blocs) if (b.cite) verifierCitation(b);
  const { paragraphe, citation, encadre } = rendu({ remplir, refs, etiquette });

  /* ---------- Tableaux calculés ---------- */
  const effectifs = (liste, cle, ordre) => {
    const m = new Map();
    for (const x of liste) m.set(x[cle], (m.get(x[cle]) || 0) + 1);
    return (ordre || [...m.keys()]).filter(k => m.has(k)).map(k => [k, m.get(k)]);
  };
  const libelleQualif = x => x.qualif === "infirmier" ? (x.sexe === "féminin" ? "infirmière" : "infirmier") : "sage-femme";
  const vague1 = new Set(participants.map(x => x.code));

  // Une ligne par caractéristique, les modalités et leurs effectifs dans la même cellule.
  const enLigne = paires => paires.map(([k, n]) => `${k} : ${n}`).join(" ; ");
  function tableauParticipants() {
    const lignes = [["Caractéristique", "Modalités (effectif)"],
      ["Qualification", enLigne(effectifs(tous.map(x => ({ q: libelleQualif(x) })), "q", ["infirmier", "infirmière", "sage-femme"]))],
      ["Sexe", enLigne(effectifs(tous, "sexe", ["féminin", "masculin"]))],
      ["Tranche d'âge (ans)", enLigne(effectifs(tous, "age", ["20-29", "30-39", "40-49", "50 et plus"]))],
      ["Ancienneté totale", enLigne(effectifs(tous, "ancTotale", ["< 5 ans", "5-10 ans", "> 10 ans"]))],
      ["Ancienneté en CPN", enLigne(effectifs(tous, "ancCpn", ["6 mois-2 ans", "> 2 ans"]))],
      ["Fonction", enLigne([["titulaire", tous.filter(x => x.titulaire).length], ["prestataire", tous.filter(x => !x.titulaire).length]])],
      ["Formation MNT reçue", enLigne(effectifs(tous, "formationMnt", ["oui", "non", "ne sait pas"]))],
      ["Langue de l'entretien", enLigne(effectifs(tous, "langue", ["kinyarwanda", "français", "anglais"]))],
      ["Vague de collecte", enLigne([["vague 1", tous.filter(x => vague1.has(x.code)).length], ["vague 2", tous.filter(x => !vague1.has(x.code)).length]])],
    ];
    return [legende(`Tableau IV. Caractéristiques des participants (n = ${tous.length})`), tableau(lignes, [3000, 6026]), source("fiches sociodémographiques (annexe 3)")];
  }

  function tableauCentres() {
    const parCs = new Map(tous.map(x => [x.cs, x]));
    const centres = obsTous.map(o => ({ ...o, distance: parCs.get(o.cs)?.distanceHopital, volume: parCs.get(o.cs)?.volume, pauvrete: parCentre.find(r => r.cs === o.cs)?.pauvrete }));
    const femmes = obsTous.map(o => o.A.femmesRecues);
    const lignes = [["Caractéristique", "Modalités (nombre de centres)"],
      ["Secteur d'implantation", enLigne(effectifs(centres, "secteur", ["urbain", "rural périphérique"]))],
      ["Distance à l'hôpital", enLigne(effectifs(centres, "distance", ["proche", "éloignée"]))],
      ["Volume d'activité prénatale", enLigne(effectifs(centres, "volume", ["élevé", "modéré"]))],
      ["Profil de pauvreté du secteur", enLigne(effectifs(centres, "pauvrete", ["plus faible", "plus élevée"]))],
      ["Glucomètre du laboratoire", enLigne([["en état", valeurs.glucoLaboEnEtat], ["en panne", valeurs.glucoLaboPanne]])],
      ["Glucomètre propre à la CPN (urgences)", enLigne([["oui", valeurs.glucoCpnUrgence], ["non", obsTous.length - valeurs.glucoCpnUrgence]])],
      ["Glycémie de la première CPN (demandée en CPN, faite au laboratoire) le jour de l'observation", enLigne([["faite à toutes", valeurs.glycFaite],
        ["non faite : rupture de bandelettes", valeurs.glycRupture], ["non faite : glucomètre en panne", valeurs.glycPanne],
        ["non faite : laborantin absent", valeurs.glycAbsence]])],
      ["Rupture de bandelettes de glycémie (trois derniers mois)", enLigne([["oui", valeurs.glycRupture3Mois], ["non", obsTous.length - valeurs.glycRupture3Mois]])],
      ["Test manqué noté pour être refait", enLigne([["oui", valeurs.glycRattrapage], ["non", obsTous.length - valeurs.glycRattrapage]])],
      ["Glycémie refaite systématiquement à 24-28 semaines", enLigne([["oui", valeurs.glycT3Systematique], ["non (sur facteurs de risque au mieux)", obsTous.length - valeurs.glycT3Systematique]])],
      ["Femmes reçues pendant la demi-journée", `${Math.min(...femmes)} à ${Math.max(...femmes)}`],
    ];
    return [legende(`Tableau V. Caractéristiques des centres de santé (n = ${obsTous.length})`), tableau(lignes, [3000, 6026]), source("grilles d'observation (annexe 2) et données de routine du district")];
  }

  const nomCode = id => arbre.flatMap(f => f.enfants).find(e => e.id === id).nom.replace(/\s*\[inductif[^\]]*\]/, "");
  const infirmiers = new Set(tous.filter(x => x.qualif === "infirmier").map(x => x.code));
  function ligneCodes(id, libelle) {
    const qui = participantsAvec([id]);
    return [libelle || nomCode(id), String(qui.filter(c => infirmiers.has(c)).length), String(qui.filter(c => !infirmiers.has(c)).length), String(qui.length)];
  }
  const enteteQualif = titre => [titre, `Infirmiers (n = ${infirmiers.size})`, `Sages-femmes (n = ${tous.length - infirmiers.size})`, `Total (n = ${tous.length})`];

  function tableauEquite() {
    const lignes = [enteteQualif("Catégorie (codes de la famille 8)")];
    lignes.push(["Jugement porté sur les différences décrites", "", "", ""]);
    for (const id of ["H2", "H3", "H6"]) lignes.push(ligneCodes(id));
    lignes.push(["Attribution de la responsabilité", "", "", ""]);
    for (const id of ["H4", "H5"]) lignes.push(ligneCodes(id));
    lignes.push(["Facteurs d'inégalité nés du codage inductif", "", "", ""]);
    for (const id of ["H7", "H8", "H9"]) lignes.push(ligneCodes(id));
    return [legende("Tableau VI. Portée reconnue en équité : jugements et attributions"), tableauSections(lignes, [4626, 1500, 1500, 1400]),
      source("codage des entretiens (Q19 et recoupements Q11 à Q14) ; un participant peut relever de plusieurs lignes")];
  }

  function tableauThemes() {
    return [legende("Tableau VI. Synthèse des thèmes"), tableau([["Thème", "Objectif", "Énoncé"], ...THEMES], [3200, 1500, 4326]),
      source("mémo « Phase 5 — Définition et dénomination des thèmes » du projet QualiCode")];
  }

  const tableaux = {
    participants: tableauParticipants, centres: tableauCentres, equite: tableauEquite,
    themes: tableauThemes,
  };


  const enfants = [titre1(TITRE_CHAPITRE)];
  for (const b of blocs) {
    if (b.h2) enfants.push(titre2(b.h2));
    else if (b.h3) enfants.push(titre3(b.h3));
    else if (b.p) enfants.push(paragraphe(b.p));
    else if (b.cite) enfants.push(...citation(b));
    else if (b.encadre) enfants.push(...encadre(b.encadre, b.t));
    else if (b.tableau) enfants.push(...tableaux[b.tableau]());
    else throw new Error(`bloc inconnu : ${JSON.stringify(b).slice(0, 80)}`);
  }

  return { enfants, nbCitations: blocs.filter(b => b.cite).length };
}
