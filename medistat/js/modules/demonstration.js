// medistat/js/modules/demonstration.js
// Jeu de données de démonstration — patients, examens, résultats et verbatims
// fictifs. Il permet de découvrir la Solution, de la former et de l'évaluer
// sans manipuler de données de santé réelles.
// Toutes les données sont engendrées par un générateur à graine fixe : le jeu
// est identique d'une installation à l'autre, ce qui rend les démonstrations
// et les copies d'écran reproductibles.

import * as store from "../core/store.js";
import { LOINC_COURANTS } from "../core/export.js";
import { hasPermission, nouvelId, genererIPP, genererNumeroDemande, genererCodeBarre,
  interpreterResultat } from "../core/model.js";
import { utilisateurCourant } from "../core/auth.js";
import { creerUtilisateur } from "../core/auth.js";

/* ===================== Générateur reproductible ===================== */

let graine = 20260719;
const alea = () => { graine = (graine * 1103515245 + 12345) & 0x7fffffff; return graine / 0x7fffffff; };
const entre = (a, b) => a + alea() * (b - a);
const entier = (a, b) => Math.floor(entre(a, b + 1));
const parmi = liste => liste[Math.floor(alea() * liste.length)];
const chance = p => alea() < p;
// Tirage gaussien (Box-Muller) : les paramètres biologiques suivent
// approximativement une loi normale dans une population.
const gaussien = (moyenne, ecartType) => {
  const u = Math.max(1e-9, alea()), v = alea();
  return moyenne + ecartType * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

const NOMS = ["Tshibangu", "Kabeya", "Mukendi", "Ilunga", "Kasongo", "Mbuyi", "Ngoy",
  "Kalala", "Mwamba", "Tshimanga", "Nkulu", "Banza", "Kayembe", "Lubaki", "Mutombo",
  "Diallo", "Traoré", "Camara", "Bamba", "Koné", "Ouédraogo", "Sanogo", "Cissé",
  "Ndiaye", "Fall", "Sow", "Barry", "Bah", "Sylla", "Touré"];
const PRENOMS_F = ["Alice", "Marie", "Grâce", "Esther", "Nadine", "Sylvie", "Chantal",
  "Josée", "Béatrice", "Clarisse", "Aminata", "Fatou", "Awa", "Kadiatou", "Mariam",
  "Rachel", "Nadège", "Perpétue", "Solange", "Élise"];
const PRENOMS_M = ["Jean", "Paul", "Pierre", "Joseph", "Patrick", "Serge", "Didier",
  "Emmanuel", "Christian", "Olivier", "Mamadou", "Ibrahim", "Moussa", "Amadou",
  "Souleymane", "Guy", "Blaise", "Théodore", "Fabrice", "Landry"];
const VILLES = ["Kinshasa", "Lubumbashi", "Goma", "Bukavu", "Kisangani", "Matadi", "Mbuji-Mayi"];
const SERVICES = ["Médecine interne", "Pédiatrie", "Gynécologie", "Chirurgie", "Urgences",
  "Cardiologie", "Consultation externe"];
const MOTIFS = ["Fièvre persistante", "Douleur abdominale", "Céphalées", "Asthénie",
  "Toux chronique", "Bilan de santé", "Suivi de diabète", "Suivi d'hypertension",
  "Douleur thoracique", "Vomissements", "Amaigrissement", "Contrôle post-thérapeutique"];
const DIAGNOSTICS = [
  { libelle: "Paludisme simple", cim10: "B54" },
  { libelle: "Infection urinaire", cim10: "N39.0" },
  { libelle: "Diabète de type 2", cim10: "E11" },
  { libelle: "Hypertension artérielle essentielle", cim10: "I10" },
  { libelle: "Anémie ferriprive", cim10: "D50" },
  { libelle: "Fièvre typhoïde", cim10: "A01.0" },
  { libelle: "Gastro-entérite aiguë", cim10: "A09" },
  { libelle: "Bronchite aiguë", cim10: "J20" },
  { libelle: "Dyslipidémie", cim10: "E78" },
  { libelle: "Insuffisance rénale chronique", cim10: "N18" },
];

// Verbatims de satisfaction — matière première de l'analyse qualitative
const VERBATIMS = [
  "L'accueil a été rapide et le personnel très attentif. Je suis satisfait de ma prise en charge.",
  "J'ai attendu plus de trois heures avant d'être reçu. L'attente est vraiment trop longue.",
  "Le médecin a pris le temps de m'expliquer ma maladie. Les explications étaient claires.",
  "Les résultats ont mis du temps à arriver, mais le laboratoire a été très professionnel.",
  "Douleur intense pendant le prélèvement, l'infirmière n'a pas été délicate.",
  "Je me sens beaucoup mieux depuis le traitement. Amélioration nette de mon état.",
  "Le coût des examens est trop élevé pour mes moyens. C'est décevant.",
  "Personnel compétent et à l'écoute. Je recommande cet établissement.",
  "La salle d'attente est propre mais il n'y a pas assez de sièges. Attente debout pénible.",
  "Aucune information sur mes résultats pendant deux jours. Beaucoup d'inquiétude.",
  "Excellent suivi, le biologiste m'a appelé directement pour un résultat anormal.",
  "Le service est bien organisé mais les horaires ne sont pas respectés. Retard fréquent.",
  "Ma fièvre a disparu et la fatigue s'estompe. Le traitement est efficace.",
  "L'infirmière a été très rassurante pendant la prise de sang. Merci à elle.",
  "Difficile de joindre le secrétariat par téléphone. Il faut se déplacer pour tout.",
  "Guérison complète après deux semaines. Je suis très satisfait du diagnostic.",
  "On m'a fait revenir trois fois pour le même examen. Mauvaise organisation.",
  "Le prélèvement s'est bien passé, rapide et sans douleur. Rien à redire.",
  "Angoisse importante en attendant les résultats, personne ne m'a informé du délai.",
  "Médecin compétent mais consultation trop courte, je n'ai pas pu poser mes questions.",
];

/* ===================== Chargement ===================== */

// Le jeu de démonstration est un acte de paramétrage, pas un acte de soin :
// il fabrique d'un coup des dossiers, des demandes et des résultats déjà
// validés. L'administrateur qui le charge n'a évidemment pas le droit de
// saisir un résultat — et il ne doit pas l'avoir. Les écritures se font donc
// au titre du droit d'administrer l'établissement, une fois ce droit vérifié
// ici, en un seul point.
const DROIT_AMORCAGE = { droitRequis: "etablissement:modification" };

export async function chargerDemonstration({ nbPatients = 120 } = {}) {
  graine = 20260719; // réinitialise le générateur pour un résultat identique
  const moi = utilisateurCourant();
  if (!moi) throw new Error("Aucune session ouverte.");
  if (!hasPermission(moi.role, "etablissement", "modification")) {
    throw new Error("Seul un administrateur d'établissement peut charger le jeu de démonstration.");
  }
  const etablissementId = moi.etablissementId;
  const rapport = { utilisateurs: 0, tests: 0, patients: 0, consultations: 0,
    demandes: 0, echantillons: 0, resultats: 0 };

  /* --- Utilisateurs représentant chaque profil (article 5) --- */
  const profils = [
    { identifiant: "dr.mukendi", nom: "Mukendi", prenom: "Joseph", role: "medecin", service: "Médecine interne" },
    { identifiant: "dr.kabeya", nom: "Kabeya", prenom: "Sylvie", role: "medecin", service: "Pédiatrie" },
    { identifiant: "bio.ilunga", nom: "Ilunga", prenom: "Marie", role: "biologiste", service: "Laboratoire" },
    { identifiant: "lab.kasongo", nom: "Kasongo", prenom: "Paul", role: "laborantin", service: "Laboratoire" },
    { identifiant: "lab.mbuyi", nom: "Mbuyi", prenom: "Grâce", role: "laborantin", service: "Laboratoire" },
    { identifiant: "inf.ngoy", nom: "Ngoy", prenom: "Chantal", role: "infirmier", service: "Urgences" },
    { identifiant: "acc.kalala", nom: "Kalala", prenom: "Didier", role: "receptionniste", service: "Accueil" },
    { identifiant: "qua.mwamba", nom: "Mwamba", prenom: "Esther", role: "qualite", service: "Qualité" },
  ];
  const utilisateurs = {};
  for (const p of profils) {
    try {
      const { utilisateur, motDePasseTemporaire } = await creerUtilisateur({
        ...p, motDePasse: "Demo" + p.role.slice(0, 3) + "2026!",
      });
      utilisateurs[p.role] = utilisateurs[p.role] || [];
      utilisateurs[p.role].push(utilisateur);
      rapport.utilisateurs++;
    } catch { /* l'identifiant existe déjà : on réutilise l'existant */ }
  }
  const tous = await store.lireTout("utilisateurs");
  const parRole = role => tous.filter(u => u.role === role);
  const medecins = parRole("medecin");
  const biologistes = parRole("biologiste");
  const laborantins = parRole("laborantin");
  const infirmiers = parRole("infirmier");

  /* --- Catalogue des tests, amorcé depuis la table LOINC --- */
  const catalogue = [];
  for (const t of LOINC_COURANTS) {
    const test = await store.depots.testsCatalogue.creer({
      code: t.code, loinc: t.loinc, nom: t.nom, categorie: t.categorie,
      unite: t.unite || "", type: t.type || "numerique",
      valeurRefMin: t.min ?? null, valeurRefMax: t.max ?? null,
      seuilCritiqueMin: t.critMin ?? null, seuilCritiqueMax: t.critMax ?? null,
      delaiRenduHeures: t.categorie === "MICROBIO" ? 72 : t.categorie === "SEROLOGIE" ? 24 : 6,
      prix: entier(3, 25) * 1000, methode: "Automate", actif: true,
      etablissementId,
    }, DROIT_AMORCAGE);
    catalogue.push(test);
    rapport.tests++;
  }
  const testsNumeriques = catalogue.filter(t => t.type === "numerique");
  const testsQualitatifs = catalogue.filter(t => t.type === "qualitatif");

  /* --- Patients, consultations, demandes, résultats --- */
  const maintenant = Date.now();
  const JOUR = 86400000;

  for (let i = 0; i < nbPatients; i++) {
    const sexe = chance(0.54) ? "F" : "M";
    const nom = parmi(NOMS);
    const prenom = parmi(sexe === "F" ? PRENOMS_F : PRENOMS_M);
    const age = chance(0.18) ? entier(0, 15) : chance(0.25) ? entier(60, 88) : entier(16, 59);
    const naissance = new Date(maintenant - age * 365.25 * JOUR - entier(0, 364) * JOUR);

    const patient = await store.depots.patients.creer({
      ipp: genererIPP("DEMO", i + 1),
      nom, prenom,
      dateNaissance: naissance.toISOString().slice(0, 10),
      sexe,
      telephone: `+243 9${entier(10, 99)} ${entier(100, 999)} ${entier(100, 999)}`,
      ville: parmi(VILLES),
      adresse: `${entier(1, 250)}, avenue ${parmi(["Kasa-Vubu", "Lumumba", "de la Paix", "du Marché", "Mobutu"])}`,
      groupeSanguin: parmi(["O+", "A+", "B+", "AB+", "O−", "A−"]),
      antecedents: chance(0.35)
        ? parmi(["Diabète de type 2 depuis 2019", "Hypertension artérielle traitée",
          "Asthme dans l'enfance", "Drépanocytose hétérozygote", "Chirurgie appendiculaire en 2015",
          "Tuberculose traitée en 2020"])
        : "",
      allergies: chance(0.16) ? parmi(["Pénicilline", "Sulfamides", "Arachides", "Aspirine"]) : "",
      contactUrgence: `${parmi(PRENOMS_M)} ${nom} — +243 9${entier(10, 99)} ${entier(100, 999)} ${entier(100, 999)}`,
      archive: false,
      etablissementId,
    }, DROIT_AMORCAGE);
    rapport.patients++;

    // Chaque patient a de 1 à 4 épisodes de soins, répartis sur 18 mois
    const nbConsultations = entier(1, 4);
    for (let c = 0; c < nbConsultations; c++) {
      const dateConsultation = new Date(maintenant - entier(1, 540) * JOUR - entier(0, 23) * 3600000);
      const medecin = parmi(medecins.length ? medecins : [moi]);
      const diagnostic = parmi(DIAGNOSTICS);

      const consultation = await store.depots.consultations.creer({
        patientId: patient.id,
        date: dateConsultation.toISOString(),
        medecinId: medecin.id,
        service: parmi(SERVICES),
        motif: parmi(MOTIFS),
        symptomes: parmi([
          "Fièvre à 39 °C depuis trois jours, frissons et sueurs nocturnes.",
          "Douleur épigastrique postprandiale, nausées, pas de vomissement.",
          "Céphalées frontales persistantes, photophobie modérée.",
          "Asthénie importante, essoufflement à l'effort, pâleur conjonctivale.",
          "Toux productive depuis deux semaines, expectorations purulentes.",
          "Polyurie et polydipsie, amaigrissement de 6 kg en deux mois.",
        ]),
        constantes: {
          temperature: Number(gaussien(37.4, 0.9).toFixed(1)),
          tensionSystolique: Math.round(gaussien(128, 18)),
          tensionDiastolique: Math.round(gaussien(80, 11)),
          pouls: Math.round(gaussien(82, 13)),
          poids: Math.round(gaussien(age < 15 ? 28 : 68, 14)),
          taille: Math.round(gaussien(age < 15 ? 128 : 168, 11)),
          saturation: Math.min(100, Math.round(gaussien(97, 2))),
        },
        diagnostic: diagnostic.libelle,
        cim10: diagnostic.cim10,
        conduite: parmi(["Traitement ambulatoire et contrôle à J7.",
          "Bilan biologique complémentaire avant décision.",
          "Hospitalisation de courte durée pour surveillance.",
          "Poursuite du traitement en cours, réévaluation dans un mois."]),
        statut: "cloturee",
        // Verbatim de satisfaction : matière de l'analyse qualitative
        commentairePatient: chance(0.45) ? parmi(VERBATIMS) : "",
        etablissementId,
      }, DROIT_AMORCAGE);
      rapport.consultations++;

      // Une consultation sur deux donne lieu à une demande d'examens
      if (!chance(0.62)) continue;

      const urgence = chance(0.08) ? "vital" : chance(0.22) ? "urgent" : "routine";
      const nbTests = entier(2, 6);
      const testsChoisis = [];
      while (testsChoisis.length < nbTests) {
        const t = chance(0.82) ? parmi(testsNumeriques) : parmi(testsQualitatifs);
        if (!testsChoisis.some(x => x.code === t.code)) testsChoisis.push(t);
      }

      const datePrelevement = new Date(dateConsultation.getTime() + entier(10, 180) * 60000);
      const demande = await store.depots.demandes.creer({
        numero: genererNumeroDemande(rapport.demandes + 1, dateConsultation),
        patientId: patient.id,
        consultationId: consultation.id,
        prescripteurId: medecin.id,
        prescripteurNom: `Dr ${medecin.prenom} ${medecin.nom}`,
        date: dateConsultation.toISOString(),
        datePrelevement: datePrelevement.toISOString(),
        urgence,
        tests: testsChoisis.map(t => t.code),
        statut: "rendue",
        etablissementId,
      }, DROIT_AMORCAGE);
      rapport.demandes++;

      const echantillon = await store.depots.echantillons.creer({
        codeBarre: genererCodeBarre(rapport.echantillons + 1, datePrelevement),
        demandeId: demande.id,
        patientId: patient.id,
        type: testsChoisis.some(t => t.code === "ECBU") ? "URINE" : "SANG",
        datePrelevement: datePrelevement.toISOString(),
        preleveurId: parmi(infirmiers.length ? infirmiers : [moi]).id,
        dateReception: new Date(datePrelevement.getTime() + entier(15, 120) * 60000).toISOString(),
        statut: "analyse",
        conformite: chance(0.96) ? "conforme" : "non_conforme",
        motifNonConformite: chance(0.96) ? "" : parmi(["Tube hémolysé", "Volume insuffisant", "Identification incomplète"]),
        volume: entier(3, 10),
        etablissementId,
      }, DROIT_AMORCAGE);
      rapport.echantillons++;

      const laborantin = parmi(laborantins.length ? laborantins : [moi]);
      const biologiste = parmi(biologistes.length ? biologistes : [moi]);
      const dateSaisie = new Date(datePrelevement.getTime() + entier(1, 30) * 3600000);
      const dateValidation = new Date(dateSaisie.getTime() + entier(10, 240) * 60000);

      for (const test of testsChoisis) {
        let valeur = null, valeurTexte = null;

        if (test.type === "qualitatif") {
          // Prévalences réalistes pour un contexte d'Afrique centrale
          const prevalence = test.code === "PALU" ? 0.28 : test.code === "VIH" ? 0.04
            : test.code === "HBS" ? 0.07 : test.code === "WIDAL" ? 0.16 : 0.2;
          valeurTexte = chance(prevalence) ? "Positif" : "Négatif";
          if (test.code === "GS") valeurTexte = patient.groupeSanguin;
          if (test.code === "ECBU") {
            valeurTexte = chance(0.3)
              ? `Culture positive — ${parmi(["Escherichia coli", "Klebsiella pneumoniae", "Proteus mirabilis"])} > 10⁵ UFC/mL`
              : "Culture stérile";
          }
        } else {
          // Valeur tirée autour de la normale, avec anomalies plausibles :
          // certains patients sont réellement malades, et le diagnostic
          // influence la biologie — ce qui rend les analyses statistiques
          // ultérieures cohérentes plutôt qu'aléatoires.
          const min = Number(test.valeurRefMin), max = Number(test.valeurRefMax);
          const centre = (min + max) / 2;
          const etendue = (max - min) / 4 || centre * 0.15 || 1;
          let v = gaussien(centre, etendue);

          if (diagnostic.cim10 === "E11" && test.code === "GLY") v = gaussien(1.9, 0.45);
          if (diagnostic.cim10 === "E11" && test.code === "HBA1C") v = gaussien(8.2, 1.4);
          if (diagnostic.cim10 === "D50" && test.code === "HB") v = gaussien(8.6, 1.5);
          if (diagnostic.cim10 === "B54" && test.code === "PLQ") v = gaussien(110, 40);
          if (diagnostic.cim10 === "N18" && test.code === "CREAT") v = gaussien(28, 9);
          if (diagnostic.cim10 === "N18" && test.code === "UREE") v = gaussien(0.9, 0.3);
          if (diagnostic.cim10 === "I10" && test.code === "CHOL") v = gaussien(2.3, 0.4);
          if (diagnostic.cim10 === "E78" && test.code === "TG") v = gaussien(2.4, 0.7);
          if (["A01.0", "A09", "J20", "B54"].includes(diagnostic.cim10) && test.code === "CRP") {
            v = gaussien(65, 30);
          }
          if (["A01.0", "J20"].includes(diagnostic.cim10) && test.code === "GB") v = gaussien(14, 3.5);

          const decimales = Math.abs(centre) < 2 ? 2 : Math.abs(centre) < 20 ? 1 : 0;
          valeur = Number(Math.max(0, v).toFixed(decimales));
        }

        const interpretation = interpreterResultat(valeur, test);
        await store.depots.resultats.creer({
          demandeId: demande.id,
          echantillonId: echantillon.id,
          patientId: patient.id,
          testCode: test.code,
          valeur, valeurTexte,
          unite: test.unite,
          horsNorme: interpretation.horsNorme,
          critique: interpretation.critique,
          saisiPar: laborantin.id,
          dateSaisie: dateSaisie.toISOString(),
          validePar: biologiste.id,
          dateValidation: dateValidation.toISOString(),
          statut: "rendu",
          commentaireBiologiste: interpretation.critique
            ? "Valeur critique : prescripteur alerté par téléphone."
            : (chance(0.09) ? "Contrôle réalisé sur second prélèvement, résultat confirmé." : ""),
          alerteAcquittee: interpretation.critique,
          version: 1,
          etablissementId,
        }, DROIT_AMORCAGE);
        rapport.resultats++;
      }
    }
  }

  await store.definirParametre("demonstrationChargee", new Date().toISOString());
  await store.tracer("parametrage", "base", null,
    `Chargement du jeu de démonstration : ${rapport.patients} patients, ${rapport.resultats} résultats`);
  return rapport;
}

/* ===================== Suppression ===================== */

// Retire les données de démonstration sans toucher aux données réelles :
// tous les enregistrements engendrés portent un IPP préfixé « DEMO ».
export async function supprimerDemonstration() {
  const patients = (await store.lireTout("patients")).filter(p => String(p.ipp).startsWith("DEMO"));
  const idsPatients = new Set(patients.map(p => p.id));
  const rapport = { patients: 0, consultations: 0, demandes: 0, echantillons: 0, resultats: 0 };

  for (const magasin of ["resultats", "echantillons", "demandes", "consultations"]) {
    for (const e of await store.lireTout(magasin)) {
      if (idsPatients.has(e.patientId)) { await store.supprimer(magasin, e.id); rapport[magasin]++; }
    }
  }
  for (const p of patients) { await store.supprimer("patients", p.id); rapport.patients++; }

  await store.definirParametre("demonstrationChargee", null);
  await store.tracer("suppression", "base", null,
    `Suppression du jeu de démonstration : ${rapport.patients} patients`);
  return rapport;
}

export async function demonstrationPresente() {
  return !!(await store.parametre("demonstrationChargee", null));
}
