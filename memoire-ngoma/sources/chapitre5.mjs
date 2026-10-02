// chapitre5.mjs — le chapitre 5 (Résultats) sous forme d'éléments Word,
// utilisé par le document séparé (faire-resultats.mjs) et par le mémoire
// complet (faire-memoire.mjs). Les citations sont vérifiées ici.
import { titre1, titre2, titre3, tableau, Paragraph, TextRun, AlignmentType } from "./mise-en-page.mjs";
import { participants } from "./echantillon.mjs";
import { arbre } from "./codes.mjs";
import { parCentre, SOURCE as SOURCE_ROUTINE } from "./donnees-routine.mjs";
import { TITRE_CHAPITRE, blocs, constatsChapitre, THEMES } from "./resultats.mjs";
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

  function tableauParticipants() {
    const lignes = [["Caractéristique", "Modalité", "Effectif"]];
    const ajouter = (titre, paires) => paires.forEach(([k, n], i) => lignes.push([i === 0 ? titre : "", k, String(n)]));
    ajouter("Qualification", effectifs(tous.map(x => ({ q: libelleQualif(x) })), "q", ["infirmier", "infirmière", "sage-femme"]));
    ajouter("Sexe", effectifs(tous, "sexe", ["féminin", "masculin"]));
    ajouter("Tranche d'âge", effectifs(tous, "age", ["20-29", "30-39", "40-49", "50 et plus"]));
    ajouter("Ancienneté totale", effectifs(tous, "ancTotale", ["< 5 ans", "5-10 ans", "> 10 ans"]));
    ajouter("Ancienneté en CPN", effectifs(tous, "ancCpn", ["6 mois-2 ans", "> 2 ans"]));
    ajouter("Fonction", [["titulaire", tous.filter(x => x.titulaire).length], ["prestataire", tous.filter(x => !x.titulaire).length]]);
    ajouter("Formation MNT reçue", effectifs(tous, "formationMnt", ["oui", "non", "ne sait pas"]));
    ajouter("Langue de l'entretien", effectifs(tous, "langue", ["kinyarwanda", "français", "anglais"]));
    ajouter("Vague de collecte", [["vague 1", tous.filter(x => vague1.has(x.code)).length], ["vague 2", tous.filter(x => !vague1.has(x.code)).length]]);
    return [legende(`Tableau IV. Caractéristiques des participants (n = ${tous.length})`), tableau(lignes, [2800, 4226, 2000]), source("fiches sociodémographiques (annexe 3)")];
  }

  function tableauCentres() {
    const parCs = new Map(tous.map(x => [x.cs, x]));
    const centres = obsTous.map(o => ({ ...o, distance: parCs.get(o.cs)?.distanceHopital, volume: parCs.get(o.cs)?.volume, pauvrete: parCentre.find(r => r.cs === o.cs)?.pauvrete }));
    const lignes = [["Caractéristique", "Modalité", "Centres"]];
    const ajouter = (titre, paires) => paires.forEach(([k, n], i) => lignes.push([i === 0 ? titre : "", k, String(n)]));
    ajouter("Secteur d'implantation", effectifs(centres, "secteur", ["urbain", "rural périphérique"]));
    ajouter("Distance à l'hôpital", effectifs(centres, "distance", ["proche", "éloignée"]));
    ajouter("Volume d'activité prénatale", effectifs(centres, "volume", ["élevé", "modéré"]));
    ajouter("Profil de pauvreté du secteur", effectifs(centres, "pauvrete", ["plus faible", "plus élevée"]));
    ajouter("Glycémie pour une femme enceinte, le jour de l'observation", [
      ["réalisable au laboratoire, sur bon de la CPN", valeurs.glycPossible],
      ["glucomètre réservé à la consultation des maladies chroniques", valeurs.glycMnt],
      ["impossible (appareil en panne, bandelettes absentes ou périmées)", valeurs.glucoInutilisable],
      ["pas de glucomètre", valeurs.glucoAbsent]]);
    lignes.push(["Glucomètre en salle de CPN", "présent", String(valeurs.glucoEnCpn)]);
    const femmes = obsTous.map(o => o.A.femmesRecues);
    lignes.push(["Femmes reçues pendant la demi-journée observée", "étendue", `${Math.min(...femmes)} à ${Math.max(...femmes)}`]);
    return [legende(`Tableau V. Caractéristiques des centres de santé (n = ${obsTous.length})`), tableau(lignes, [2800, 4226, 2000]), source("grilles d'observation (annexe 2), données de routine (annexe 9)")];
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

  function tableauTransformations() {
    const lignes = [enteteQualif("Transformation proposée")];
    for (const id of ["I1", "I2", "I3", "I4", "I5", "I6"]) lignes.push(ligneCodes(id));
    lignes.push(ligneCodes("I8", "Initiative locale déjà mise en œuvre"));
    return [legende("Tableau VII. Transformations proposées par les participants"), tableau(lignes, [4626, 1500, 1500, 1400]),
      source("codage des réponses aux questions 17 et 18 ; un participant peut relever de plusieurs lignes")];
  }

  function tableauTriangulation() {
    const lignes = [["N°", "Nature", "Constat"]];
    const ordonnes = [...constats.filter(x => x.nature === "écart"), ...constats.filter(x => x.nature === "concordance")];
    ordonnes.forEach((x, i) => {
      if (!constatsChapitre[x.cs]) throw new Error(`constat ${x.cs} sans formulation pour le chapitre (resultats.mjs, constatsChapitre)`);
      lignes.push([String(i + 1), x.nature, constatsChapitre[x.cs]]);
    });
    return [legende("Tableau VIII. Confrontation des propos et de l'observation"), tableau(lignes, [700, 1400, 6926]),
      source("mémo « Triangulation — ensemble des deux vagues » du projet QualiCode, reformulé sans code de centre (§ 4.2.7)")];
  }

  function tableauRoutine() {
    const lignes = [["Profil de pauvreté du secteur", "Centres", "Nouvelles inscrites (CPN1)", "CPN4 / CPN1", "1er contact au 1er trimestre (médiane)", "Références pour HTA pour 100 inscrites"]];
    const mediane = v => { const t = [...v].sort((a, b) => a - b); const m = Math.floor(t.length / 2); return t.length % 2 ? t[m] : (t[m - 1] + t[m]) / 2; };
    const fr = n => n.toLocaleString("fr-FR", { maximumFractionDigits: 1 });
    for (const cat of ["plus faible", "plus élevée"]) {
      const r = parCentre.filter(x => x.pauvrete === cat);
      const cpn1 = r.reduce((a, x) => a + x.cpn1, 0), cpn4 = r.reduce((a, x) => a + x.cpn4, 0), ref = r.reduce((a, x) => a + x.refHta, 0);
      lignes.push([cat, String(r.length), fr(cpn1), `${fr(100 * cpn4 / cpn1)} %`, `${fr(mediane(r.map(x => x.t1)))} %`, fr(100 * ref / cpn1)]);
    }
    return [legende("Tableau IX. Données de routine du district selon le profil de pauvreté du secteur"), tableau(lignes, [1900, 900, 1500, 1300, 1800, 1626]),
      source(`${SOURCE_ROUTINE} ; valeurs agrégées, aucune donnée par centre n'est rapportée ici`)];
  }

  function tableauThemes() {
    return [legende("Tableau X. Synthèse des thèmes"), tableau([["Thème", "Objectif", "Énoncé"], ...THEMES], [3200, 1500, 4326]),
      source("mémo « Phase 5 — Définition et dénomination des thèmes » du projet QualiCode")];
  }

  const tableaux = {
    participants: tableauParticipants, centres: tableauCentres, equite: tableauEquite,
    transformations: tableauTransformations, triangulation: tableauTriangulation, routine: tableauRoutine, themes: tableauThemes,
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
