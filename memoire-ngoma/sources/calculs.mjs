// calculs.mjs — ce que les chapitres rédigés (5, 6…) lisent dans le projet.
//
// Un seul endroit calcule les effectifs, les valeurs et les contrôles de
// citation : deux chapitres ne peuvent pas annoncer deux chiffres différents
// pour la même chose.
//   · participantsAvec(codes) : participants ayant au moins un passage C1 codé ;
//   · remplir(texte) : remplace {N}, {n:CODE[+CODE…]} et {v:clé} par leur valeur,
//     en lettres en début de phrase ;
//   · verifierCitation(bloc) : refuse une citation absente du passage codé, ou
//     d'un participant qui a refusé la citation ;
//   · etiquette(code) : « (P07, sage-femme) », sans caractéristique pour une
//     citation sous condition.
import { readFileSync } from "node:fs";
import { participants } from "./echantillon.mjs";
import { participantsV2 } from "./echantillon-vague2.mjs";
import { observations } from "./observations.mjs";
import { observationsV2 } from "./observations-vague2.mjs";
import { arbre, ecarts, ecartsV2 } from "./codes.mjs";
import { consentementDe } from "./consentements.mjs";
import { SOURCE as SOURCE_ROUTINE, RESERVE, parCentre as routine } from "./donnees-routine.mjs";
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

export async function calculs(dossier) {
  const projet = JSON.parse(readFileSync(`${dossier}/MEMOIRE_NGOMA_MUKAKI_DUNIA_Jacques.projx`, "utf8"));
  const tous = [...participants, ...participantsV2];
  const obsTous = [...observations, ...observationsV2].sort((x, y) => x.cs.localeCompare(y.cs));
  const constats = [...ecarts, ...ecartsV2];

  /* ---------- Correspondance codes du projet ↔ identifiants courts ---------- */
  const familleParNom = new Map(arbre.map(f => [f.nom, f]));
  const court = new Map();
  for (const c of projet.codes) {
    if (!c.parentId) continue;
    const parent = projet.codes.find(x => x.id === c.parentId);
    const e = familleParNom.get(parent?.name)?.enfants.find(e => e.nom === c.name);
    if (e) court.set(c.id, e.id);
  }
  const docEntretien = new Map(projet.documents
    .filter(d => d.variables.type_document === "entretien")
    .map(d => [d.name.match(/P\d+/)[0], d]));
  const segmentsC1 = projet.segments.filter(s => s.coder === "C1");

  /** Participants ayant au moins un passage C1 codé avec l'un des codes. */
  function participantsAvec(codes) {
    const ids = new Set(codes);
    return [...docEntretien.entries()]
      .filter(([, d]) => segmentsC1.some(s => s.docId === d.id && ids.has(court.get(s.codeId))))
      .map(([code]) => code);
  }

  /* ---------- Valeurs calculées ---------- */
  const minutes = tous.map(x => parseInt(x.duree, 10));
  // Accès de la CPN à la glycémie, relevé par l'observation (champ glycemieCpn).
  const etatGluco = o => o.glycemieCpn;
  const gluco = o => o.B.find(i => i.item === "Glucomètre");
  // Centres qu'aucun élément du chapitre ne doit permettre d'identifier.
  const centresProteges = new Set(tous.filter(x => /sans élément identifiant le centre/.test(consentementDe(x.code).citation)).map(x => x.cs));
  const equiteSpontane = Object.values(entretiens).filter(e =>
    Object.values(e.reponses).some(tours => tours.some(([qui, t]) => qui === "P" && /équit/i.test(t)))).length;

  const valeurs = {
    nbCentres: obsTous.length,
    nbInf: tous.filter(x => x.qualif === "infirmier").length,
    nbSf: tous.filter(x => x.qualif === "sage-femme").length,
    nbTitulaires: tous.filter(x => x.titulaire).length,
    dureeMin: Math.min(...minutes), dureeMax: Math.max(...minutes),
    // Glycémie de la première CPN, demandée par la CPN pour toutes et faite au laboratoire : relevé du jour de l'observation (champ glycemieCpn).
    glycFaite: obsTous.filter(o => etatGluco(o) === "faite").length,
    glycInterrompue: obsTous.filter(o => etatGluco(o) !== "faite").length,
    glycRupture: obsTous.filter(o => etatGluco(o) === "rupture").length,
    glycPanne: obsTous.filter(o => etatGluco(o) === "panne").length,
    glycAbsence: obsTous.filter(o => etatGluco(o) === "absence").length,
    // Ruptures de bandelettes de glycémie au cours des trois derniers mois.
    glycRupture3Mois: obsTous.filter(o => /^oui — bandelettes de glycémie/.test(o.ruptureTroisMois)).length,
    // Test manqué noté et refait au rendez-vous suivant.
    glycRattrapage: obsTous.filter(o => o.rattrapage === "oui").length,
    // Glycémie refaite systématiquement à 24-28 semaines (épreuve du protocole national de 2012).
    glycT3Systematique: obsTous.filter(o => o.glycemieT3 === "systématique").length,
    nbSeancesObservees: obsTous.filter(o => o.S && o.S.observee.startsWith("oui")).length,
    nbSeancesTension: obsTous.filter(o => o.S && /tension : oui/.test(o.S.sujets)).length,
    glucoPresent: obsTous.filter(o => gluco(o).present === "oui").length,
    // Glucomètre propre au service de CPN, réservé aux urgences (la glycémie de routine est faite au laboratoire).
    glucoCpnUrgence: obsTous.filter(o => o.glucoCpn === "oui").length,
    glucoFonctionnel: obsTous.filter(o => gluco(o).present === "oui" && !/NON fonctionnel/.test(gluco(o).etat)).length,
    // Glucomètre du laboratoire : en état, en panne, ou laboratoire pas encore ouvert.
    glucoLaboEnEtat: obsTous.filter(o => /au laboratoire/.test(gluco(o).etat) && !/NON fonctionnel/.test(gluco(o).etat)).length,
    glucoLaboPanne: obsTous.filter(o => /NON fonctionnel — au laboratoire/.test(gluco(o).etat)).length,
    laboNonOuvert: obsTous.filter(o => /laboratoire n'est pas encore opérationnel/.test(gluco(o).etat)).length,
    nbConstats: constats.length,
    nbEcarts: constats.filter(x => x.nature === "écart").length,
    nbConcordances: constats.filter(x => x.nature === "concordance").length,
    // Part des premières CPN ayant reçu une glycémie (données de routine, annexe 9).
    couvGlycMin: `${Math.min(...routine.map(r => parseInt(r.glyc.match(/\((\d+) %/)[1], 10)))} %`,
    couvGlycMax: `${Math.max(...routine.map(r => parseInt(r.glyc.match(/\((\d+) %/)[1], 10)))} %`,
    sourceRoutine: SOURCE_ROUTINE,
    reserveRoutine: RESERVE,
    equiteSpontane,
  };

  const LETTRES = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze",
    "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf", "vingt", "vingt et un", "vingt-deux"];
  function remplir(texte) {
    // Une phrase ne commence pas par un chiffre : le nombre y est écrit en lettres.
    const enTete = /(^|[.!?]\s+)(\{(?:N|n:[A-Z0-9+]+|v:\w+)\})/g;
    texte = texte.replace(enTete, (_, avant, ph) => {
      const valeur = remplacer(ph);
      if (!/^\d+$/.test(valeur)) return avant + valeur;   // une valeur textuelle reste telle quelle
      const n = Number(valeur);
      if (!LETTRES[n]) throw new Error(`nombre en début de phrase non écrivable en lettres : ${ph}`);
      return avant + LETTRES[n][0].toUpperCase() + LETTRES[n].slice(1);
    });
    return remplacer(texte);
  }
  function remplacer(texte) {
    return texte
      .replace(/\{N\}/g, String(docEntretien.size))
      .replace(/\{n:([A-Z0-9+]+)\}/g, (_, codes) => String(participantsAvec(codes.split("+")).length))
      .replace(/\{v:(\w+)\}/g, (_, cle) => {
        if (!(cle in valeurs)) throw new Error(`valeur inconnue : {v:${cle}}`);
        return String(valeurs[cle]);
      });
  }

  /* ---------- Contrôle des citations ---------- */
  const normaliser = t => t.replace(/\s+/g, " ").trim();
  function verifierCitation(b) {
    const doc = docEntretien.get(b.cite);
    if (!doc) throw new Error(`citation : participant inconnu ${b.cite}`);
    const consentement = consentementDe(b.cite);
    if (consentement.citation === "non") throw new Error(`citation refusée par ${b.cite} : ses propos ne peuvent pas être cités`);
    const cible = normaliser(b.t);
    const ok = segmentsC1.some(s => s.docId === doc.id && b.codes.includes(court.get(s.codeId)) && normaliser(s.text).includes(cible));
    if (!ok) throw new Error(`citation introuvable dans un passage de ${b.cite} codé ${b.codes.join("/")} : « ${b.t.slice(0, 70)}… »`);
  }

  function etiquette(code) {
    const x = tous.find(y => y.code === code);
    const c = consentementDe(code);
    const qualif = x.qualif === "infirmier" ? (x.sexe === "féminin" ? "infirmière" : "infirmier") : "sage-femme";
    // Citation sous condition : ni centre ni caractéristique.
    const carac = /sans élément identifiant/.test(c.citation) ? "" : `, ${qualif}`;
    const langue = x.langue === "kinyarwanda" ? " — traduit du kinyarwanda" : "";
    return `(${code}${carac}${langue})`;
  }

  // Fidélité du codage, recalculée sur le projet.
  const { interCoderAgreement } = await import("../../js/merge.js");
  const virgule = x => x.toFixed(3).replace(".", ",");
  const inter = interCoderAgreement(projet, "C1", "C2"), intra = interCoderAgreement(projet, "C1", "C1b");
  Object.assign(valeurs, {
    kappaInter: virgule(inter.overall.kappa), relusInter: inter.sharedDocs,
    kappaIntra: virgule(intra.overall.kappa), relusIntra: intra.sharedDocs,
    poInter: `${(inter.overall.po * 100).toFixed(1).replace(".", ",")} %`, unitesInter: inter.units,
    poIntra: `${(intra.overall.po * 100).toFixed(1).replace(".", ",")} %`, unitesIntra: intra.units,
    partInter: `${Math.round(100 * inter.sharedDocs / tous.length)} %`,
    nbCodes: projet.codes.filter(c => c.parentId).length,
    nbInductifs: projet.codes.filter(c => /inductif/.test(c.name)).length,
    nbRecontact: tous.filter(x => consentementDe(x.code).recontact === "oui").length,
  });

  return { projet, tous, obsTous, constats, court, docEntretien, segmentsC1, participantsAvec, etatGluco,
    centresProteges, valeurs, remplir, verifierCitation, etiquette };
}
