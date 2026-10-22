// donnees-rwanda.mjs — données RÉELLES et sourcées sur le Rwanda et le district
// de Ngoma, utilisées pour caler la simulation et pour le texte du mémoire.
//
// Chaque donnée porte sa source exacte. Rien ici n'est simulé : ce fichier est
// le seul endroit du dossier qui contient des chiffres réels, et il les sépare
// des données d'exercice. Une donnée non vérifiable n'y entre pas.

// Enquêtes démographiques et de santé (EDS / DHS), relevées le 2 octobre 2026
// par l'API du programme DHS (connecteur « Demographic and Health Surveys »).
// Population : femmes ayant eu une naissance vivante (ou un mort-né) au cours
// des deux années précédant l'enquête. « Est » = province de l'Est (Ngoma).
export const EDS = {
  source2019: "National Institute of Statistics of Rwanda (NISR), Ministry of Health, ICF. Rwanda Demographic and Health Survey 2019-20 (RW2019DHS). Données de l'API DHS Program, consultées le 2 octobre 2026.",
  source2025: "National Institute of Statistics of Rwanda (NISR), Ministry of Health, ICF. Rwanda Demographic and Health Survey 2025 (RW2025DHS). Données de l'API DHS Program, consultées le 2 octobre 2026.",
  // Indicateur DHS : RH_ANCN_W_N4P (au moins 4 visites prénatales)
  cpn4: { 2019: { national: 47.2, est: 45.9, plusPauvres: 36.6, plusRiches: 58.1 },
          2025: { national: 77.5, est: 77.4, plusPauvres: 73.7, plusRiches: 81.3 } },
  // RH_ANCT_W_TL4 (première visite avant le 4e mois de grossesse)
  premierTrimestre: { 2019: { national: 56.8, est: 58.1, plusPauvres: 49.0, plusRiches: 66.9 },
                      2025: { national: 67.0, est: 66.5, plusPauvres: 63.2, plusRiches: 76.0 } },
  // RH_ANCS_W_BLP, parmi les femmes ayant eu une CPN : tension mesurée
  tensionMesuree: { 2025: { national: 96.9, est: 93.5 } },
  // RH_ANCS_W_URN et RH_ANCS_W_BLS, parmi les femmes ayant eu une CPN
  urine: { 2025: { national: 98.1, est: 96.5 } },
  sang: { 2025: { national: 98.8, est: 97.9 } },
};

// Natalité et recours à la CPN (EDS 2025, province de l'Est), pour caler le
// volume d'inscriptions : 404 048 habitants × 29,3 ‰ ≈ 11 840 naissances par an.
// FE_FRTR_W_CBR (taux brut de natalité, ‰) ; RH_ANCP_W_SKP (CPN auprès d'un
// prestataire qualifié, %).
EDS.natalite = { 2025: { national: 27.7, est: 29.3 } };
EDS.cpnQualifie = { 2025: { national: 95.4, est: 95.3 } };

// Repères réels reproduits dans l'annexe 9, à côté des valeurs simulées.
// [indicateur, valeur, source courte vérifiable]
export const REPERES = [
  ["Population du district de Ngoma (2022)", "404 048 habitants, 14 secteurs, 90,8 % rurale", "NISR, 5e recensement général de la population et de l'habitat 2022, profil du district de Ngoma (statistics.gov.rw)"],
  ["Pauvreté (EICV7, 2023-2024)", "Ngoma 30,2 % ; Rwanda 27,4 %", "NISR, EICV7, profil de pauvreté et présentation du district de Ngoma (statistics.gov.rw)"],
  ["Formations sanitaires du district (2023-2024)", "44 formations sanitaires : 41 publiques, 3 privées", "Ministère de la Santé, Annual Health Statistical Booklet FY 2023-2024 (moh.gov.rw)"],
  ["Hôpital de référence du district", "Kibungo Level Two Teaching Hospital, 312 lits", "Site de l'hôpital (krh.gov.rw/about/overview)"],
  ["Taux brut de natalité (Est, EDS 2025)", "29,3 ‰, soit environ 11 800 naissances par an à Ngoma", "NISR, MOH, ICF, EDS 2025 (API DHS, indicateur FE_FRTR_W_CBR)"],
  ["CPN auprès d'un prestataire qualifié (Est, EDS 2025)", "95,3 %", "EDS 2025 (RH_ANCP_W_SKP)"],
  ["Au moins 4 visites prénatales", "Est : 45,9 % (2019-20) → 77,4 % (2025) ; Rwanda 2025 : 73,7 % (plus pauvres) à 81,3 % (plus riches)", "EDS 2019-20 et 2025 (RH_ANCN_W_N4P)"],
  ["Première visite avant le 4e mois", "Est : 58,1 % (2019-20) → 66,5 % (2025) ; Rwanda 2025 : 63,2 % (plus pauvres) à 76,0 % (plus riches)", "EDS 2019-20 et 2025 (RH_ANCT_W_TL4)"],
  ["Tension mesurée / prise de sang en CPN (Est, 2025)", "93,5 % / 97,9 %", "EDS 2025 (RH_ANCS_W_BLP, RH_ANCS_W_BLS)"],
  ["Modèle de CPN", "Huit contacts : 1er avant 12 semaines, puis 20 et 26 semaines, etc.", "RBC, National Antenatal Care Guidelines, 2021"],
  ["Affections recherchées à la 1re CPN", "Anémie, protéinurie, HTA, diabète, syphilis, etc., cochées au registre de maternité", "Schmidt et al., PLoS One 2021, doi:10.1371/journal.pone.0256415"],
  ["Relais communautaire", "Dans chaque village, un binôme d'agents de santé communautaire et une animatrice de santé maternelle (ASM)", "Condo et al., Hum Resour Health 2014, doi:10.1186/1478-4491-12-71"],
  ["Financement basé sur la performance (PBF)", "Adopté en 2005, évalué dans les centres de santé à partir de 2006 ; indicateurs CPN : 1re CPN précoce, 4 visites", "Basinga et al., Lancet 2011, doi:10.1016/S0140-6736(11)60177-3 ; Schmidt et al. 2021"],
  ["Niveaux infirmiers", "A2 (formation secondaire, arrêtée en 2007), A1 (3 ans), A0 (licence) ; sages-femmes A1 ou A0", "Rurangirwa et al., BMC Health Serv Res 2018, doi:10.1186/s12913-018-3694-5"],
  ["Norme de personnel d'un centre de santé", "21 agents, dont 9 infirmiers et 1 sage-femme", "Ministère de la Santé, Health Labour Market Analysis Report (OMS-AFRO)"],
  ["Séances d'éducation collective en CPN", "2 à 3 séances par semaine dans les centres de santé, réunissant les femmes enceintes présentes, animées par les infirmiers et sages-femmes", "Information de terrain fournie par l'auteur du mémoire ; à documenter par l'observation (rubrique ajoutée à la grille)"],
  ["CPN de groupe (essai national)", "8 à 12 femmes par groupe, animation par un prestataire et un agent de santé communautaire ; connaissances et soutien entre pairs accrus", "Musabyimana et al., Reprod Health 2019, doi:10.1186/s12978-019-0750-5"],
  ["Connaissance des signes de danger", "56 % des femmes enceintes connaissaient au moins trois signes de danger de la grossesse (Kigali, 2018) ; meilleure connaissance avec le nombre de CPN", "Uwiringiyimana et al., PLOS Glob Public Health 2022, doi:10.1371/journal.pgph.0001084"],
  ["Conjoint à la première CPN", "Test VIH du couple recommandé à la CPN1 ; perçu comme une obligation, il retarde ou exclut des femmes sans conjoint disponible", "Påfs et al., Midwifery 2015, doi:10.1016/j.midw.2015.09.010"],
  ["Mutuelle de santé et ubudehe", "Primes graduées selon la catégorie socio-économique (ubudehe) ; primes des ménages les plus pauvres payées par l'État ; ticket modérateur au centre de santé", "RSSB, régime CBHI (rssb.rw/schemes/cbhi-scheme) ; catégories réformées en 2020 : vérifier les montants en vigueur"],
  ["Shisha Kibondo", "Farine enrichie distribuée aux femmes enceintes et allaitantes des ménages les plus pauvres", "Rwanda Biomedical Centre (rbc.gov.rw/wp/?p=7362) ; Clinton Health Access Initiative, 2024"],
  ["Signalement par téléphone des ASM", "RapidSMS : enregistrement des grossesses et « alerte rouge » déclenchant la demande d'ambulance ; outil communautaire électronique (eCHIS) en cours de déploiement depuis 2023", "Ngabo et al., Pan Afr Med J 2012;13:31 (PMC3542808) ; Resolve to Save Lives, 2025"],
  ["Umugoroba w'ababyeyi", "Forum hebdomadaire des parents dans chaque village : famille, violences, nutrition, planning familial", "Nsanzabera et al., Public Health Nutr 2025, doi:10.1017/S1368980025100803 ; MIGEPROF"],
  ["Campagnes de dépistage des MNT", "Dépistage gratuit (tension, glycémie, IMC) ; à Kigali, 26 % de tensions élevées dont 73 % ignorées, 9 % de glycémies ≥ 1,26 g/l dont 71 % ignorées", "Enabel, Be-cause health, Rwanda NCD Mass Campaign, 2019"],
  ["Transport d'urgence", "Service d'aide médicale urgente (SAMU) créé en 2007, couvert par la mutuelle ; transferts d'urgence du centre de santé vers l'hôpital de district", "Étude SAMU Kigali, doi:10.26502/ogr034 ; UNFPA Rwanda"],
];
