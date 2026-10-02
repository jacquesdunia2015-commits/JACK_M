# ⚠️ DONNÉES ENTIÈREMENT SIMULÉES — NE PAS CITER

**Ce dossier ne contient aucune donnée de terrain.** Les 20 entretiens et les
15 observations qu'on y trouve ont été **entièrement fabriqués**. Aucun
entretien n'a été conduit, aucun centre de santé n'a été visité, aucune des
personnes décrites n'existe. Les codes de structure (CS01 à CS15) sont fictifs
et ne désignent aucun établissement réel.

Ces fichiers servent à **une seule chose** : apprendre à manipuler QualiCode
avant une collecte réelle. Ils ne peuvent être cités, ni figurer dans un
mémoire, ni servir de résultat, ni être présentés à un comité d'éthique ou à un
jury comme des données de recherche.

Si vous êtes arrivé ici par hasard et cherchez des résultats sur le dépistage de
l'hypertension et du diabète en consultation prénatale au Rwanda : **il n'y en a
pas dans ce dossier.**

---

## Ce que c'est

Un exercice de formation adossé au protocole de recherche de mémoire
*« L'équité d'accès au dépistage capacitant de l'hypertension artérielle et du
diabète en consultation prénatale : perceptions et pratiques déclarées des
infirmiers et sages-femmes de Ngoma (Rwanda) »* (MUKAKI DUNIA Jacques, Master en
Santé publique — Promotion de la santé, ENATSE, Université de Parakou).

Le protocole lui-même **n'est pas inclus** dans ce dépôt, qui est public : son
texte et ses figures restent sur le poste (voir `sources/extraire-protocole.py`).
Seule la liste de ses 71 références, faite de publications, est versée
(`sources/references-protocole.json`). Pour la même raison, le **mémoire complet**,
qui reprend le texte intégral du protocole, n'est pas versé : il se produit sur
le poste.

## Pour la collecte réelle : `kit-donnees-reelles/`

Le dossier [`kit-donnees-reelles/`](kit-donnees-reelles/LISEZ-MOI.md) contient les
formulaires vierges et un projet QualiCode vide, « Mémoire Ngoma — Données
réelles », sans aucune donnée ni aucun élément de cet exercice. C'est là que
commence le travail réel ; ce dossier-ci reste l'exercice.

## Contenu

### `livrables/`

| Fichier | Contenu |
|---|---|
| `1_Annexes_remplies_SIMULATION.docx` | **Tous les outils de collecte remplis** : index des 20 entretiens (annexe 1), 15 grilles d'observation (annexe 2), 20 fiches sociodémographiques (annexe 3), registre des consentements (annexe 4), données de routine du district (annexe 9, valeurs simulées calées sur des repères réels et sourcés — recensement 2022, EICV7, EDS 2025, directives du RBC — reproduits en fin d'annexe et réunis dans `sources/donnees-rwanda.mjs`), et la couverture du Tableau II |
| `2_Transcriptions_verbatim_SIMULATION.docx` | Les 20 transcriptions, question par question selon l'annexe 1, avec relances et journal de bord |
| `3_Guide_QualiCode_pour_ce_memoire.docx` | Les six phases de l'analyse thématique (§ 4.2.6) traduites en gestes dans l'application |
| `4_Note_de_positionnalite_MODELE.docx` | La note de positionnalité (confirmabilité, annexe 8), en modèle d'exercice modifiable : avant le codage, puis à la fin de l'analyse — la même que dans le projet |
| `5_Chapitre_Resultats_SIMULATION.docx` | **Le chapitre 5 (Résultats)**, version resserrée du mémoire : participants et centres, objectifs spécifiques 1 et 2, sept thèmes, équité et transformations, triangulation. Chaque citation et chaque effectif sont vérifiés contre le codage à la production du document |
| `6_Chapitre_Discussion_SIMULATION.docx` | **Le chapitre 6 (Discussion)**, version resserrée : confrontation des résultats à la littérature et au cadre conceptuel, révisions du cadre, forces, limites et perspectives. Les références ajoutées pendant la rédaction (72 à 86) ont été vérifiées dans PubMed pour les articles ; les rapports et directives restent à vérifier sur pièce |
| `7_Rapport_de_memoire_SIMULATION.docx` | **Le rapport de mémoire** : une synthèse d'une dizaine de pages (messages clés, contexte, objectifs, méthodes, résultats avec l'accès à la glycémie centre par centre, thèmes, discussion, recommandations, limites), suivie de la liste de ce qui reste à compléter ou à vérifier |
| `8_Memoire_complet_SIMULATION.docx` | **Le mémoire complet** selon le plan type de l'ENATSE (pages liminaires, executive summary, introduction, chapitres 1 à 6, conclusion et suggestions, 86 références en Vancouver, annexes, table des matières, résumé et abstract). **Non versé au dépôt** : produit sur le poste par `faire-memoire.mjs`, qui a besoin du protocole extrait. **69 pages**, de la page de garde à l'abstract, annexes comprises (limite : 70), mesurées avec l'interligne 1,5 réel. Le chapitre 6 propose un **cadre conceptuel révisé** (figure 3), généré à partir des résultats. Le sommaire et la table des matières sont **déjà remplis** : le fichier passe en dernière étape par LibreOffice (`finaliser-docx.py`), qui le réenregistre au format Word standard. Mise en forme : Times New Roman 14, interligne 1,5, texte justifié, marges de 2,5 cm (3 cm à gauche) ; annexes, listes et références en 12 pt à interligne simple (style « Texte compact ») ; références numérotées selon Vancouver dans l'ordre de première citation ; styles Word modifiables. Pour tenir la limite, 28 paragraphes des chapitres 1 à 4 du protocole ne sont pas repris et le tableau de cohérence (annexe 8 du protocole) n'est pas reproduit (liste dans `faire-memoire.mjs`). Dans Word, mettre à jour le sommaire et la table des matières (Ctrl+A puis F9) |
| `Memoire_Ngoma_SIMULATION.projx` | **Le projet QualiCode « Mémoire Ngoma — SIMULATION de formation »**, les deux vagues réunies |

À ouvrir par **Accueil ▸ Ouvrir (.projx)**. Le projet porte le même nom et le
même identifiant que la version antérieure (vague 1 seule) : il la **remplace**
dans l'application, sans créer de doublon.

### Le projet

| | Vague 1 | Vague 2 | Projet |
|---|---|---|---|
| Participants | 5 infirmiers, 5 sages-femmes | 5 infirmiers ou infirmières, 5 sages-femmes | **20** |
| Centres | CS02, CS03, CS07, CS11, CS14 | les 10 autres | **15 des 16 du district** (le seizième a servi au pré-test) |

| Projet | |
|---|---|
| Documents | 35 (20 entretiens, 15 comptes rendus d'observation) |
| Codes | 92 en 11 familles, dont 34 inductifs |
| Segments codés | 2 296 |
| Double codage | 3 entretiens recodés par un pair extérieur (codeur C2), comme prévu au § 4.2.5.6 |
| Stabilité intra-codeur | 3 entretiens recodés par le premier codeur quatre semaines après (étiquette C1b) |
| Mémos | 20 mémos d'analyse, 20 journaux de bord, 11 définitions de familles |

La variable « vague » distingue les deux vagues. Les variables
« citation_autorisee » et « recontact_accepte » reprennent le registre des
consentements : **P05 a refusé la citation** (ses propos s'analysent, ils ne se
citent pas), **P19 l'a acceptée sans élément identifiant son centre**. La
requête « Extraits citables » en tient compte.

Les mémos suivent les six phases de l'analyse thématique, puis les étapes de
rigueur du protocole : contrôle de fidélité des transcriptions, double codage
et stabilité intra-codeur, triangulation, vérification des interprétations,
suffisance informationnelle, piste d'audit. La note de positionnalité est
rédigée comme un **modèle d'exercice** : les éléments biographiques viennent du
protocole corrigé (page de garde, § 4.2.5.6) ; ce qu'il ne dit pas reste entre
crochets, à préciser.

La vague 2 n'est pas une répétition de la première. Elle introduit un centre bien
doté (ce que change l'équipement, et ce qu'il ne change pas), un registre rempli
sans que les actes suivent, les agents de santé communautaire comme relais, le
recours aux guérisseurs tel que les prestataires le perçoivent, des femmes
mobiles que le suivi perd, et une participante qui refuse de classer les femmes
en catégories.

### Pourquoi aucune signature, et aucun nom de secteur

Le registre des consentements (annexe 4) ne simule **aucune signature** : un
formulaire de consentement signé est une pièce du dossier éthique, et en
fabriquer un produirait exactement le document qui ne doit jamais exister. Les
données de routine (annexe 9) désignent les secteurs par le code du centre
qu'ils abritent : inventer des chiffres de pauvreté sous le nom d'un secteur
réel produirait une statistique fausse sur un lieu réel.

### `sources/`

Les scripts qui produisent les livrables. Une source unique alimente à la fois
les documents Word et le projet QualiCode : les deux ne peuvent donc pas
diverger.

```bash
cd memoire-ngoma/sources
node construire.mjs ../livrables     # → le projet .projx
npm install docx                     # nécessaire uniquement pour les documents Word
node faire-docx.mjs ../livrables     # → annexes remplies + transcriptions
node faire-guide.mjs ../livrables    # → guide d'utilisation (lit les projets pour ses chiffres)
node faire-resultats.mjs ../livrables     # → chapitre 5
node faire-discussion.mjs ../livrables    # → chapitre 6
node faire-rapport.mjs ../livrables       # → rapport de mémoire
# Mémoire complet : extraire d'abord le protocole (python-docx), sur le poste seulement
python3 extraire-protocole.py chemin/Protocole_corrige.docx
node faire-figure-cadre.mjs ../livrables  # → figure 3, cadre conceptuel révisé (Playwright)
node faire-memoire.mjs ../livrables       # → mémoire complet (non versé)
python3 finaliser-docx.py ../livrables/8_Memoire_complet_SIMULATION.docx   # index remplis, format Word standard
python3 finaliser-docx.py ../livrables/7_Rapport_de_memoire_SIMULATION.docx
```

**Le glucomètre au laboratoire.** Dans les centres de santé rwandais, le
glucomètre relève le plus souvent du laboratoire ou de la consultation des
maladies non transmissibles, pas de la salle de CPN. La simulation le reflète :
aucun centre n'a de glucomètre en CPN ; la glycémie est réalisable sur bon de
la CPN dans 5 centres, réservée aux malades chroniques dans 3, impossible (panne,
bandelettes absentes ou périmées) dans 6, et un centre n'a pas d'appareil. La
glycémie est prévue pour toutes les femmes à la première CPN (registre de
maternité), mais elle n'est effectivement faite que là où le laboratoire le
permet, et elle n'est refaite nulle part de façon systématique entre 24 et 28
semaines, quand apparaît le diabète gestationnel (code inductif B9). Ces
proportions sont **simulées** ; elles s'inspirent des données nationales citées
au chapitre 6 (STEPS 2022, Meharry et al. 2019, Schmidt et al. 2021,
Rurangirwa et al. 2018), qui sont à confirmer dans leur texte intégral.

Les tableaux de couverture du Tableau II et les effectifs cités par le guide sont
**calculés** à partir des données, jamais recopiés : modifier un participant et
reconstruire ne laisse aucun chiffre périmé.

## Trois mises en garde reprises du guide

1. **Le risque n'est pas la fraude, c'est l'amorçage.** Arriver sur le terrain
   avec ces thèmes en tête conduirait à n'entendre que ce qui les confirme.
   Refaire les gestes, ne pas retenir les conclusions.
2. **Ne pas utiliser le test du χ² dans les résultats.** L'application le
   calcule, mais le § 4.2.4 du protocole précise que l'étude ne mesure aucune
   variable et n'éprouve aucune relation.
3. **Les termes en kinyarwanda entre crochets sont illustratifs.** Ils montrent
   où les placer, pas comment les écrire : ils doivent être relus par un
   locuteur natif.

## Ce dossier n'est pas publié sur le site

Le déploiement GitHub Pages de QualiCode **refuse de publier** si ce dossier est
présent dans l'arborescence (voir `.github/workflows/deploy-pages.yml`). Ces
fichiers restent donc dans le dépôt, sans être servis par l'adresse publique de
l'application.
